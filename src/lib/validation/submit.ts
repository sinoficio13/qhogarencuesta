// PURE — no DB, no framework imports

export interface SurveyOption {
  id: string
  questionId: string
  isControl?: boolean
}

export interface SurveyScaleRow {
  id: string
  questionId: string
}

export interface SurveyQuestion {
  id: string
  surveyId: string
  type: 'single' | 'multi' | 'scale' | 'open'
  isRequired: boolean
  maxSelect: number | null
  options: SurveyOption[]
  scaleRows: SurveyScaleRow[]
}

export interface SurveyStructure {
  id: string
  questions: SurveyQuestion[]
}

export interface AnswerPayload {
  questionId: string
  optionIds?: string[]
  scaleValues?: Record<string, number>
  textValue?: string
}

export interface SubmitPayload {
  surveyId: string
  answers: AnswerPayload[]
}

export interface ValidationResult {
  ok: true
  errors?: undefined
}

export interface ValidationFailure {
  ok: false
  errors: Record<string, string>
}

export type ValidateResult = ValidationResult | ValidationFailure

// ── Core validator ─────────────────────────────────────────────────────────────

export function validateSubmit(
  structure: SurveyStructure,
  payload: SubmitPayload,
): ValidateResult {
  const errors: Record<string, string> = {}

  // Index questions by id for O(1) lookup
  const questionMap = new Map(structure.questions.map((q) => [q.id, q]))

  // Index payload answers by questionId
  const answerMap = new Map(payload.answers.map((a) => [a.questionId, a]))

  // 1. Reject answers for question ids not in structure
  for (const answer of payload.answers) {
    if (!questionMap.has(answer.questionId)) {
      errors[answer.questionId] = `Unknown question id: ${answer.questionId}`
    }
  }

  // 2. Validate each question in structure
  for (const q of structure.questions) {
    const answer = answerMap.get(q.id)

    // Build lookup sets for valid option/row ids
    const validOptionIds = new Set(q.options.map((o) => o.id))
    const validRowIds = new Set(q.scaleRows.map((r) => r.id))

    switch (q.type) {
      case 'single': {
        if (!answer || !answer.optionIds || answer.optionIds.length === 0) {
          if (q.isRequired) {
            errors[q.id] = 'This question is required.'
          }
          break
        }
        if (answer.optionIds.length !== 1) {
          errors[q.id] = 'Single-choice question requires exactly one option.'
          break
        }
        const chosenId = answer.optionIds[0]
        if (!validOptionIds.has(chosenId)) {
          errors[q.id] = `Unknown option id: ${chosenId}`
        }
        break
      }

      case 'multi': {
        if (!answer || !answer.optionIds || answer.optionIds.length === 0) {
          if (q.isRequired) {
            errors[q.id] = 'This question requires at least one selection.'
          }
          break
        }
        const ids = answer.optionIds
        // Check all ids belong to this question
        for (const id of ids) {
          if (!validOptionIds.has(id)) {
            errors[q.id] = `Unknown option id: ${id}`
            break
          }
        }
        if (errors[q.id]) break
        // Check maxSelect cap (control options count toward cap)
        if (q.maxSelect !== null && ids.length > q.maxSelect) {
          errors[q.id] = `Maximum ${q.maxSelect} options allowed.`
        }
        break
      }

      case 'scale': {
        if (!answer || !answer.scaleValues) {
          if (q.isRequired) {
            errors[q.id] = 'All scale rows must be rated.'
          }
          break
        }
        const sv = answer.scaleValues
        const submittedRowIds = new Set(Object.keys(sv))

        // Reject unknown row ids (no bleed)
        for (const rowId of submittedRowIds) {
          if (!validRowIds.has(rowId)) {
            errors[q.id] = `Unknown row id: ${rowId}`
            break
          }
        }
        if (errors[q.id]) break

        // All rows must be present
        for (const row of q.scaleRows) {
          if (!(row.id in sv)) {
            errors[q.id] = `Scale row ${row.id} must be rated.`
            break
          }
        }
        if (errors[q.id]) break

        // All values must be integers 1–5
        for (const [rowId, val] of Object.entries(sv)) {
          if (!Number.isInteger(val) || val < 1 || val > 5) {
            errors[q.id] = `Scale values must be in range 1–5 (got ${val} for row ${rowId}).`
            break
          }
        }
        break
      }

      case 'open': {
        if (!answer || answer.textValue === undefined || answer.textValue === null) {
          if (q.isRequired) {
            errors[q.id] = 'This question is required.'
          }
          // Optional and missing → ok, no answer row needed
          break
        }
        const trimmed = answer.textValue.trim()
        if (q.isRequired && trimmed.length === 0) {
          errors[q.id] = 'This question is required.'
        }
        break
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }
  return { ok: true }
}
