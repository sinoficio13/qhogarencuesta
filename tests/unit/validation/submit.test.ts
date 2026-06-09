import { describe, it, expect } from 'vitest'
import { validateSubmit } from '@/lib/validation/submit'
import type { SurveyStructure, SubmitPayload } from '@/lib/validation/submit'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const surveyId = 'survey-1'
const otherSurveyId = 'survey-2'

const singleQ: SurveyStructure['questions'][0] = {
  id: 'q-single',
  surveyId,
  type: 'single',
  isRequired: true,
  maxSelect: null,
  options: [
    { id: 'opt-a', questionId: 'q-single' },
    { id: 'opt-b', questionId: 'q-single' },
  ],
  scaleRows: [],
}

const multiQ: SurveyStructure['questions'][0] = {
  id: 'q-multi',
  surveyId,
  type: 'multi',
  isRequired: true,
  maxSelect: 2,
  options: [
    { id: 'opt-1', questionId: 'q-multi' },
    { id: 'opt-2', questionId: 'q-multi' },
    { id: 'opt-3', questionId: 'q-multi' },
    { id: 'opt-ctrl', questionId: 'q-multi', isControl: true },
  ],
  scaleRows: [],
}

const scaleQ: SurveyStructure['questions'][0] = {
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
}

const openQ: SurveyStructure['questions'][0] = {
  id: 'q-open',
  surveyId,
  type: 'open',
  isRequired: false,
  maxSelect: null,
  options: [],
  scaleRows: [],
}

const openQRequired: SurveyStructure['questions'][0] = {
  id: 'q-open-req',
  surveyId,
  type: 'open',
  isRequired: true,
  maxSelect: null,
  options: [],
  scaleRows: [],
}

const structure: SurveyStructure = {
  id: surveyId,
  questions: [singleQ, multiQ, scaleQ, openQ],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('validateSubmit', () => {
  describe('required field missing', () => {
    it('returns error when required single question not answered', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          // missing q-single
          { questionId: 'q-multi', optionIds: ['opt-1'] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4 },
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(false)
      expect(result.errors?.['q-single']).toBeDefined()
    })

    it('returns ok when all required questions answered', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: ['opt-1', 'opt-2'] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4 },
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(true)
      expect(result.errors).toBeUndefined()
    })
  })

  describe('single question', () => {
    it('rejects when 2 optionIds provided', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a', 'opt-b'] },
          { questionId: 'q-multi', optionIds: ['opt-1'] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4 },
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(false)
      expect(result.errors?.['q-single']).toMatch(/exactly one/i)
    })

    it('rejects option belonging to a different question (no bleed)', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-1'] }, // opt-1 belongs to q-multi
          { questionId: 'q-multi', optionIds: ['opt-1'] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4 },
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(false)
      expect(result.errors?.['q-single']).toMatch(/unknown option/i)
    })
  })

  describe('multi question', () => {
    it('rejects when optionIds length exceeds maxSelect', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: ['opt-1', 'opt-2', 'opt-3'] }, // 3 > maxSelect=2
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4 },
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(false)
      expect(result.errors?.['q-multi']).toMatch(/max/i)
    })

    it('passes when optionIds at cap (maxSelect)', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: ['opt-1', 'opt-2'] }, // exactly 2 = cap
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4 },
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(true)
    })

    it('rejects required multi with 0 selected', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: [] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4 },
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(false)
      expect(result.errors?.['q-multi']).toBeDefined()
    })

    it('counts control options but does not reject them', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: ['opt-1', 'opt-ctrl'] }, // control option included
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4 },
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(true)
    })
  })

  describe('scale question', () => {
    it('rejects when a scale row is missing', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: ['opt-1'] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3 }, // row-2 missing
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(false)
      expect(result.errors?.['q-scale']).toMatch(/row/i)
    })

    it('rejects scale value out of 1–5 range', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: ['opt-1'] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 6, 'row-2': 4 }, // 6 out of range
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(false)
      expect(result.errors?.['q-scale']).toMatch(/1.5|range/i)
    })

    it('rejects unknown row id in scale (no bleed)', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: ['opt-1'] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4, 'row-foreign': 5 },
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(false)
      expect(result.errors?.['q-scale']).toMatch(/unknown row/i)
    })

    it('passes when all rows rated 1–5', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: ['opt-1'] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 1, 'row-2': 5 },
          },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(true)
    })
  })

  describe('open question', () => {
    it('optional open may be empty or missing — ok, no answer row', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: ['opt-1'] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4 },
          },
          // q-open intentionally omitted (optional)
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(true)
    })

    it('required open empty string fails', () => {
      const structureWithRequiredOpen: SurveyStructure = {
        id: surveyId,
        questions: [openQRequired],
      }
      const payload: SubmitPayload = {
        surveyId,
        answers: [{ questionId: 'q-open-req', textValue: '   ' }],
      }
      const result = validateSubmit(structureWithRequiredOpen, payload)
      expect(result.ok).toBe(false)
      expect(result.errors?.['q-open-req']).toBeDefined()
    })
  })

  describe('unknown question id', () => {
    it('rejects answers for question ids not in structure', () => {
      const payload: SubmitPayload = {
        surveyId,
        answers: [
          { questionId: 'q-single', optionIds: ['opt-a'] },
          { questionId: 'q-multi', optionIds: ['opt-1'] },
          {
            questionId: 'q-scale',
            scaleValues: { 'row-1': 3, 'row-2': 4 },
          },
          { questionId: 'q-unknown', optionIds: ['opt-a'] },
        ],
      }
      const result = validateSubmit(structure, payload)
      expect(result.ok).toBe(false)
      expect(result.errors?.['q-unknown']).toMatch(/unknown question/i)
    })
  })
})
