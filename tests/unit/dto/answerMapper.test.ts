import { describe, it, expect } from 'vitest'
import { mapAnswersToInsert } from '@/lib/dto/answerMapper'
import type { AnswerInsert } from '@/lib/dto/answerMapper'
import type { SubmitPayload } from '@/lib/validation/submit'
import type { SurveyStructure } from '@/lib/validation/submit'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const surveyId = 'survey-1'
const responseId = 'response-uuid-1'

const structure: SurveyStructure = {
  id: surveyId,
  questions: [
    {
      id: 'q-single',
      surveyId,
      type: 'single',
      isRequired: true,
      maxSelect: null,
      options: [{ id: 'opt-a', questionId: 'q-single' }],
      scaleRows: [],
    },
    {
      id: 'q-multi',
      surveyId,
      type: 'multi',
      isRequired: true,
      maxSelect: 2,
      options: [
        { id: 'opt-1', questionId: 'q-multi' },
        { id: 'opt-2', questionId: 'q-multi' },
      ],
      scaleRows: [],
    },
    {
      id: 'q-scale',
      surveyId,
      type: 'scale',
      isRequired: true,
      maxSelect: null,
      options: [],
      scaleRows: [
        { id: 'row-1', questionId: 'q-scale' },
        { id: 'row-2', questionId: 'q-scale' },
      ],
    },
    {
      id: 'q-open',
      surveyId,
      type: 'open',
      isRequired: false,
      maxSelect: null,
      options: [],
      scaleRows: [],
    },
  ],
}

describe('mapAnswersToInsert', () => {
  it('maps single-choice answer to optionIds array', () => {
    const payload: SubmitPayload = {
      surveyId,
      answers: [{ questionId: 'q-single', optionIds: ['opt-a'] }],
    }
    const rows = mapAnswersToInsert(responseId, structure, payload)
    const row = rows.find((r) => r.questionId === 'q-single')!
    expect(row.optionIds).toEqual(['opt-a'])
    expect(row.scaleValues).toBeNull()
    expect(row.textValue).toBeNull()
  })

  it('maps multi-choice answer to optionIds array', () => {
    const payload: SubmitPayload = {
      surveyId,
      answers: [{ questionId: 'q-multi', optionIds: ['opt-1', 'opt-2'] }],
    }
    const rows = mapAnswersToInsert(responseId, structure, payload)
    const row = rows.find((r) => r.questionId === 'q-multi')!
    expect(row.optionIds).toEqual(['opt-1', 'opt-2'])
    expect(row.scaleValues).toBeNull()
    expect(row.textValue).toBeNull()
  })

  it('maps scale answer to scaleValues object', () => {
    const payload: SubmitPayload = {
      surveyId,
      answers: [{ questionId: 'q-scale', scaleValues: { 'row-1': 4, 'row-2': 2 } }],
    }
    const rows = mapAnswersToInsert(responseId, structure, payload)
    const row = rows.find((r) => r.questionId === 'q-scale')!
    expect(row.scaleValues).toEqual({ 'row-1': 4, 'row-2': 2 })
    expect(row.optionIds).toBeNull()
    expect(row.textValue).toBeNull()
  })

  it('maps open answer to textValue', () => {
    const payload: SubmitPayload = {
      surveyId,
      answers: [{ questionId: 'q-open', textValue: 'Some free text' }],
    }
    const rows = mapAnswersToInsert(responseId, structure, payload)
    const row = rows.find((r) => r.questionId === 'q-open')!
    expect(row.textValue).toBe('Some free text')
    expect(row.optionIds).toBeNull()
    expect(row.scaleValues).toBeNull()
  })

  it('omits empty optional open answer (no row produced)', () => {
    const payload: SubmitPayload = {
      surveyId,
      answers: [
        { questionId: 'q-single', optionIds: ['opt-a'] },
        // q-open with empty textValue — should be omitted
        { questionId: 'q-open', textValue: '   ' },
      ],
    }
    const rows = mapAnswersToInsert(responseId, structure, payload)
    const openRow = rows.find((r) => r.questionId === 'q-open')
    expect(openRow).toBeUndefined()
  })

  it('attaches the responseId to every row', () => {
    const payload: SubmitPayload = {
      surveyId,
      answers: [
        { questionId: 'q-single', optionIds: ['opt-a'] },
        { questionId: 'q-multi', optionIds: ['opt-1'] },
        { questionId: 'q-scale', scaleValues: { 'row-1': 3, 'row-2': 4 } },
      ],
    }
    const rows = mapAnswersToInsert(responseId, structure, payload)
    expect(rows.every((r) => r.responseId === responseId)).toBe(true)
  })
})
