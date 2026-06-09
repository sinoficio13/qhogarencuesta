'use server'

/**
 * submitSurvey — Server Action for public survey submission.
 *
 * Flow (design §5 + WU-5 dedup slice):
 *  1. Re-fetch authoritative survey structure from DB by surveyId.
 *  2. Run validateSubmit (pure, trusted structure from DB — never client shape).
 *  3. On validation failure → return typed errors immediately (no DB writes).
 *  4. On success → mapAnswersToInsert, then run ONE db.transaction():
 *     a. If token provided: UPDATE invitations SET used_at=now()
 *        WHERE token=? AND used_at IS NULL AND survey_id=?  RETURNING id
 *        → If 0 rows returned: rollback, return _token error (already used / invalid / wrong survey).
 *     b. Insert response (with invitationId when token was valid).
 *     c. Bulk-insert answers.
 *  5. Return { ok: true } on success or { ok: false, errors } on failure.
 *
 * Backward-safe: token is OPTIONAL. Submissions from /[slug] (preview-only) don't
 * pass a token; those produce responses with invitationId = NULL.
 *
 * revalidatePath intentionally omitted — responses are not displayed publicly.
 */

import { db } from '@/db'
import { responses, answers, surveys, invitations } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
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

// ── Extended payload (adds optional token) ────────────────────────────────────

export interface SubmitPayloadWithToken extends SubmitPayload {
  token?: string
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function submitSurvey(payload: SubmitPayloadWithToken): Promise<SubmitResult> {
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

  // 3. Atomic transaction: optionally consume token, insert response + answers
  try {
    let tokenError: string | null = null

    await db.transaction(async (tx) => {
      let invitationId: string | null = null

      // ── Token consume (atomic, race-safe) ──────────────────────────────────
      if (payload.token) {
        // UPDATE...RETURNING: returns the row only if it was unused AND belongs
        // to this exact survey. 0 rows → already used, invalid, or wrong survey.
        const consumed = await tx
          .update(invitations)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(invitations.token, payload.token),
              eq(invitations.surveyId, payload.surveyId),
              isNull(invitations.usedAt)
            )
          )
          .returning()

        if (consumed.length === 0) {
          // Signal rollback via error — Drizzle rolls back on thrown errors
          tokenError = 'Este link ya fue usado o no es válido.'
          throw new Error('TOKEN_CONSUMED')
        }

        invitationId = consumed[0].id
      }

      // ── Insert response ────────────────────────────────────────────────────
      const [resp] = await tx
        .insert(responses)
        .values({
          surveyId: surveyView.id,
          ...(invitationId ? { invitationId } : {}),
        })
        .returning()

      // ── Bulk-insert answers ────────────────────────────────────────────────
      const answerRows = mapAnswersToInsert(resp.id, structure, payload)
      if (answerRows.length > 0) {
        await tx.insert(answers).values(answerRows)
      }
    })

    if (tokenError) {
      return { ok: false, errors: { _token: tokenError } }
    }
  } catch (err) {
    // Token error is surfaced via tokenError above after the transaction throws
    if (err instanceof Error && err.message === 'TOKEN_CONSUMED') {
      return {
        ok: false,
        errors: { _token: 'Este link ya fue usado o no es válido.' },
      }
    }
    console.error('[submitSurvey] DB error:', err)
    return {
      ok: false,
      errors: { _db: 'An error occurred while saving your response. Please try again.' },
    }
  }

  return { ok: true }
}
