'use server'

/**
 * submitSurvey — Server Action for public survey submission.
 *
 * Flow (design §5):
 *  1. Re-fetch authoritative survey structure from DB by surveyId.
 *  2. Run validateSubmit (pure, trusted structure from DB — never client shape).
 *  3. On validation failure → return typed errors immediately (no DB writes).
 *  4. On success → mapAnswersToInsert, then insert response + answers in ONE
 *     db.transaction() (atomicity guarantee — either all rows land or none).
 *  5. Return { ok: true } on success or { ok: false, errors } on failure.
 *
 * revalidatePath is intentionally omitted — responses are not displayed publicly.
 */

import { db } from '@/db'
import { responses, answers, surveys, questions, options, scaleRows } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { validateSubmit } from '@/lib/validation/submit'
import { mapAnswersToInsert } from '@/lib/dto/answerMapper'
import { toSurveyView } from '@/lib/dto/surveyShape'
import type { SubmitPayload } from '@/lib/validation/submit'

// ── Return types ──────────────────────────────────────────────────────────────

export interface SubmitSuccess {
  ok: true
}

export interface SubmitFailure {
  ok: false
  errors: Record<string, string>
}

export type SubmitResult = SubmitSuccess | SubmitFailure

// ── Action ────────────────────────────────────────────────────────────────────

export async function submitSurvey(payload: SubmitPayload): Promise<SubmitResult> {
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
      errors: { _survey: 'Survey not found or not active.' },
    }
  }

  // Build SurveyView DTO → then derive SurveyStructure for validation
  const surveyView = toSurveyView(surveyRow)
  if (!surveyView) {
    return { ok: false, errors: { _survey: 'Survey data unavailable.' } }
  }

  // Build the structure shape expected by validateSubmit
  // (SurveyStructure is a simplified view used for validation)
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

  // 2. Validate (pure — uses authoritative DB structure)
  const validation = validateSubmit(structure, payload)

  if (!validation.ok) {
    return { ok: false, errors: validation.errors }
  }

  // 3. Map to insert rows
  // We need a responseId placeholder — we'll get the real one from the INSERT
  // Build answer rows after we have the response id (done inside transaction)

  // 4. Atomic transaction: insert response then bulk-insert answers
  try {
    await db.transaction(async (tx) => {
      const [resp] = await tx
        .insert(responses)
        .values({ surveyId: surveyView.id })
        .returning()

      const answerRows = mapAnswersToInsert(resp.id, structure, payload)

      if (answerRows.length > 0) {
        await tx.insert(answers).values(answerRows)
      }
    })
  } catch (err) {
    console.error('[submitSurvey] DB error:', err)
    return {
      ok: false,
      errors: { _db: 'An error occurred while saving your response. Please try again.' },
    }
  }

  return { ok: true }
}
