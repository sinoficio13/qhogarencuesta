/**
 * DTO mapper: raw SubmitPayload answers → answer insert rows.
 * PURE — no DB imports, no framework deps.
 *
 * Rules:
 * - single/multi → optionIds array, scaleValues/textValue null
 * - scale → scaleValues object, optionIds/textValue null
 * - open → textValue string, optionIds/scaleValues null
 * - optional open with empty/whitespace-only text → row omitted entirely
 */

import type { SubmitPayload, SurveyStructure } from '@/lib/validation/submit'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AnswerInsert {
  responseId: string
  questionId: string
  optionIds: string[] | null
  scaleValues: Record<string, number> | null
  textValue: string | null
}

// ── Mapper ────────────────────────────────────────────────────────────────────

/**
 * Map validated payload answers to DB insert rows.
 * Assumes payload has already been validated by validateSubmit().
 *
 * @param responseId  The newly-created response UUID
 * @param structure   Survey structure (used to determine question type)
 * @param payload     Raw form submission payload
 * @returns  Array of answer rows ready for bulk insert
 */
export function mapAnswersToInsert(
  responseId: string,
  structure: SurveyStructure,
  payload: SubmitPayload,
): AnswerInsert[] {
  const questionTypeMap = new Map(structure.questions.map((q) => [q.id, q.type]))
  const questionRequiredMap = new Map(structure.questions.map((q) => [q.id, q.isRequired]))

  const rows: AnswerInsert[] = []

  for (const answer of payload.answers) {
    const type = questionTypeMap.get(answer.questionId)
    if (!type) continue // unknown question — skip (validation should have caught this)

    if (type === 'single' || type === 'multi') {
      if (!answer.optionIds || answer.optionIds.length === 0) continue
      rows.push({
        responseId,
        questionId: answer.questionId,
        optionIds: answer.optionIds,
        scaleValues: null,
        textValue: null,
      })
      continue
    }

    if (type === 'scale') {
      if (!answer.scaleValues) continue
      rows.push({
        responseId,
        questionId: answer.questionId,
        optionIds: null,
        scaleValues: answer.scaleValues,
        textValue: null,
      })
      continue
    }

    if (type === 'open') {
      const trimmed = (answer.textValue ?? '').trim()
      const isRequired = questionRequiredMap.get(answer.questionId) ?? false
      // Omit row if empty (whether optional or required — required validation
      // is handled upstream by validateSubmit, not here)
      if (trimmed.length === 0) {
        // Only emit a row if there's actual content
        continue
      }
      rows.push({
        responseId,
        questionId: answer.questionId,
        optionIds: null,
        scaleValues: null,
        textValue: trimmed,
      })
      // suppress unused variable warning
      void isRequired
    }
  }

  return rows
}
