'use server'

/**
 * submitSurvey — Server Action for public survey submission.
 *
 * PIVOT (identifier-based dedup, replaces one-time tokens):
 *
 * Flow:
 *  1. Re-fetch authoritative survey structure from DB by surveyId.
 *  2. Validate the identifier (validateIdentifier per survey's identifierType).
 *     On invalid → return {ok:false, errors:{_identifier:'...'}} immediately.
 *  3. Run validateSubmit (pure) on answers.
 *     On invalid → return {ok:false, errors:{...}} immediately.
 *  4. Hash the identifier (hashIdentifier — deterministic SHA-256 + pepper).
 *  5. Atomic db.transaction():
 *     a. Insert response with identifierHash.
 *     b. Bulk-insert answers.
 *     Race-safe: partial unique index (surveyId, identifierHash) WHERE NOT NULL
 *     catches duplicate submissions → catch unique violation → return _identifier error.
 *  6. Return { ok: true } on success.
 *
 * Error codes:
 *  - _identifier: invalid format or already-submitted (dedup)
 *  - _survey: survey not found / inactive
 *  - _db: unexpected DB error
 *
 * revalidatePath intentionally omitted — responses are not displayed publicly.
 */

import { db } from '@/db'
import { withTx } from '@/db/tx'
import { responses, answers, surveys } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { validateSubmit } from '@/lib/validation/submit'
import { mapAnswersToInsert } from '@/lib/dto/answerMapper'
import { toSurveyView } from '@/lib/dto/surveyShape'
import { validateIdentifier, hashIdentifier } from '@/lib/identifier'
import type { SubmitPayload } from '@/lib/validation/submit'
import type { IdentifierType } from '@/lib/identifier'

// ── Return types ──────────────────────────────────────────────────────────────

export interface SubmitSuccess {
  ok: true
}

export interface SubmitFailure {
  ok: false
  errors: Record<string, string>
}

export type SubmitResult = SubmitSuccess | SubmitFailure

// ── Extended payload (adds required identifier) ───────────────────────────────

export interface SubmitPayloadWithIdentifier extends SubmitPayload {
  /** Raw identifier entered by the respondent (email or cédula, not hashed) */
  identifier: string
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function submitSurvey(
  payload: SubmitPayloadWithIdentifier,
): Promise<SubmitResult> {
  // 1. Re-fetch authoritative survey structure from DB (never trust client ids)
  const surveyRow = await db.query.surveys.findFirst({
    where: eq(surveys.id, payload.surveyId),
    with: {
      questions: {
        orderBy: (q, { asc }) => [asc(q.position)],
        with: {
          options: {
            orderBy: (o, { asc }) => [asc(o.position)],
          },
          scaleRows: {
            orderBy: (r, { asc }) => [asc(r.position)],
          },
        },
      },
    },
  })

  if (!surveyRow || !surveyRow.isActive) {
    return {
      ok: false,
      errors: { _survey: 'Encuesta no encontrada o no activa.' },
    }
  }

  // 2. Validate identifier format BEFORE touching the DB
  const identifierType = surveyRow.identifierType as IdentifierType
  const identifierValidation = validateIdentifier(identifierType, payload.identifier)
  if (!identifierValidation.ok) {
    return {
      ok: false,
      errors: { _identifier: identifierValidation.error },
    }
  }

  // 3. Build SurveyView DTO → derive SurveyStructure for answer validation
  const surveyView = toSurveyView(surveyRow)
  if (!surveyView) {
    return { ok: false, errors: { _survey: 'Datos de encuesta no disponibles.' } }
  }

  const structure = {
    id: surveyView.id,
    questions: surveyView.questions.map((q) => ({
      id: q.id,
      surveyId: surveyView.id,
      type: q.type,
      isRequired: q.isRequired,
      maxSelect: q.maxSelect,
      options: (q.options ?? []).map((o) => ({ id: o.id, questionId: q.id, isControl: o.isControl })),
      scaleRows: (q.scaleRows ?? []).map((r) => ({ id: r.id, questionId: q.id })),
    })),
  }

  // 4. Validate answers (pure — uses authoritative DB structure)
  const validation = validateSubmit(structure, payload)
  if (!validation.ok) {
    return { ok: false, errors: validation.errors }
  }

  // 5. Hash the identifier (deterministic, pepper-keyed)
  const identifierHash = await hashIdentifier(identifierType, payload.identifier)

  // 6. Insertar response + answers (transacción si el driver la soporta;
  //    neon-http no la soporta → corre secuencial vía withTx).
  try {
    await withTx(async (tx) => {
      // Insert response with identifierHash
      // Partial unique index (survey_id, identifier_hash) WHERE NOT NULL
      // will reject duplicates at the DB level if there's a race.
      const [resp] = await tx
        .insert(responses)
        .values({
          surveyId: surveyView.id,
          identifierHash,
        })
        .returning()

      // Bulk-insert answers
      const answerRows = mapAnswersToInsert(resp.id, structure, payload)
      if (answerRows.length > 0) {
        await tx.insert(answers).values(answerRows)
      }
    })
  } catch (err) {
    // Unique-violation: same identifier already submitted for this survey
    // PostgreSQL error code 23505 = unique_violation
    // The error may be a DrizzleQueryError wrapping a pg Error, so check both
    // the top-level message and the nested cause for the PG error code.
    const msg = err instanceof Error ? err.message : String(err)
    const causeMsg = (err instanceof Error && err.cause instanceof Error)
      ? err.cause.message
      : ''
    // Access pg's code field if it exists (via cause or direct property)
    const errCode =
      (err as { code?: string }).code ??
      ((err instanceof Error && err.cause) ? (err.cause as { code?: string }).code : undefined) ??
      ''
    const isUniqueViolation =
      errCode === '23505' ||
      msg.includes('responses_survey_identifier_uq') ||
      causeMsg.includes('responses_survey_identifier_uq') ||
      causeMsg.includes('23505')

    if (isUniqueViolation) {
      const label =
        identifierType === 'email' ? 'email' : 'cédula'
      return {
        ok: false,
        errors: {
          _identifier: `Ya registramos una respuesta con este ${label}.`,
        },
      }
    }

    console.error('[submitSurvey] DB error:', err)
    return {
      ok: false,
      errors: {
        _db: 'Ocurrió un error al guardar la respuesta. Por favor intentá de nuevo.',
      },
    }
  }

  return { ok: true }
}
