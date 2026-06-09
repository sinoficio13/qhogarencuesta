import { describe, it, expect } from 'vitest'
import { toSurveyView } from '@/lib/dto/surveyShape'
import type { SurveyDbRow } from '@/lib/dto/surveyShape'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const surveyRow: SurveyDbRow = {
  id: 'survey-uuid-1',
  slug: 'buyers',
  title: 'Compradores',
  description: 'Encuesta para compradores',
  metaChips: ['chip1', 'chip2'],
  noteHtml: '<b>Nota:</b> importante',
  isActive: true,
  identifierType: 'email',
  identifierLabel: null,
  questions: [
    {
      id: 'q-single-uuid',
      surveyId: 'survey-uuid-1',
      position: 10,
      type: 'single',
      text: '¿Cuál es tu presupuesto?',
      hint: 'Elige una opción',
      hintWhy: null,
      isRequired: true,
      maxSelect: null,
      options: [
        { id: 'opt-a', questionId: 'q-single-uuid', position: 10, text: 'Menos de 200k', isControl: false },
        { id: 'opt-b', questionId: 'q-single-uuid', position: 20, text: '200k-400k', isControl: false },
      ],
      scaleRows: [],
    },
    {
      id: 'q-scale-uuid',
      surveyId: 'survey-uuid-1',
      position: 20,
      type: 'scale',
      text: '¿Qué importa más?',
      hint: null,
      hintWhy: null,
      isRequired: true,
      maxSelect: null,
      options: [],
      scaleRows: [
        { id: 'row-1', questionId: 'q-scale-uuid', position: 10, labelHtml: 'Tiempo <b>andando</b>' },
        { id: 'row-2', questionId: 'q-scale-uuid', position: 20, labelHtml: 'Zona' },
      ],
    },
    {
      id: 'q-open-uuid',
      surveyId: 'survey-uuid-1',
      position: 30,
      type: 'open',
      text: '¿Algo más?',
      hint: null,
      hintWhy: null,
      isRequired: false,
      maxSelect: null,
      options: [],
      scaleRows: [],
    },
  ],
}

describe('toSurveyView', () => {
  it('maps survey fields to view DTO', () => {
    const view = toSurveyView(surveyRow)
    expect(view.id).toBe('survey-uuid-1')
    expect(view.slug).toBe('buyers')
    expect(view.title).toBe('Compradores')
    expect(view.description).toBe('Encuesta para compradores')
    expect(view.metaChips).toEqual(['chip1', 'chip2'])
    expect(view.noteHtml).toBe('<b>Nota:</b> importante')
    // PIVOT dedup fields
    expect(view.identifierType).toBe('email')
    expect(view.identifierLabel).toBeNull()
  })

  it('maps identifierType cedula and custom label', () => {
    const row: SurveyDbRow = { ...surveyRow, identifierType: 'cedula', identifierLabel: 'Número de documento' }
    const view = toSurveyView(row)
    expect(view.identifierType).toBe('cedula')
    expect(view.identifierLabel).toBe('Número de documento')
  })

  it('maps questions in position order', () => {
    const view = toSurveyView(surveyRow)
    expect(view.questions).toHaveLength(3)
    expect(view.questions[0].id).toBe('q-single-uuid')
    expect(view.questions[1].id).toBe('q-scale-uuid')
    expect(view.questions[2].id).toBe('q-open-uuid')
  })

  it('maps single question with options sorted by position', () => {
    const view = toSurveyView(surveyRow)
    const singleQ = view.questions[0]
    expect(singleQ.type).toBe('single')
    expect(singleQ.options).toHaveLength(2)
    expect(singleQ.options![0]).toEqual({ id: 'opt-a', text: 'Menos de 200k', isControl: false })
    expect(singleQ.options![1]).toEqual({ id: 'opt-b', text: '200k-400k', isControl: false })
    expect(singleQ.scaleRows).toBeUndefined()
  })

  it('maps scale question with scaleRows sorted by position', () => {
    const view = toSurveyView(surveyRow)
    const scaleQ = view.questions[1]
    expect(scaleQ.type).toBe('scale')
    expect(scaleQ.scaleRows).toHaveLength(2)
    expect(scaleQ.scaleRows![0]).toEqual({ id: 'row-1', labelHtml: 'Tiempo <b>andando</b>' })
    expect(scaleQ.scaleRows![1]).toEqual({ id: 'row-2', labelHtml: 'Zona' })
    expect(scaleQ.options).toBeUndefined()
  })

  it('maps open question with no options or scaleRows', () => {
    const view = toSurveyView(surveyRow)
    const openQ = view.questions[2]
    expect(openQ.type).toBe('open')
    expect(openQ.options).toBeUndefined()
    expect(openQ.scaleRows).toBeUndefined()
    expect(openQ.isRequired).toBe(false)
  })

  it('propagates null hint and hintWhy correctly', () => {
    const view = toSurveyView(surveyRow)
    expect(view.questions[1].hint).toBeNull()
    expect(view.questions[1].hintWhy).toBeNull()
  })

  it('returns null for missing survey (null input)', () => {
    const view = toSurveyView(null)
    expect(view).toBeNull()
  })
})
