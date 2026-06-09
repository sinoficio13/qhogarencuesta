'use client'

/**
 * SurveyForm — Client Component for public survey rendering and submission.
 *
 * T-046: receives SurveyView (from RSC), renders all question types,
 * calls submitSurvey Server Action on submit.
 *
 * Interactions:
 *  - single: radio — exactly one selection
 *  - multi: checkbox — live maxSelect cap enforcement (disable at cap)
 *  - scale: 1–5 dot buttons per row (all rows required)
 *  - open: textarea
 *
 * Progress counter: counts required questions that have been answered.
 * Done card: replaces the form on successful submission.
 *
 * CSS classes: match globals.css VERBATIM — no Tailwind here.
 * dangerouslySetInnerHTML: ONLY on sanitized labelHtml / noteHtml fields.
 */

import { useState, useCallback, useEffect } from 'react'
import { submitSurvey } from '@/actions/submitSurvey'
import type { SurveyView, QuestionView } from '@/lib/dto/surveyShape'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnswerState {
  // For single/multi: array of selected option ids
  optionIds?: string[]
  // For scale: map rowId → value 1..5
  scaleValues?: Record<string, number>
  // For open: text string
  textValue?: string
}

type FormState = Record<string, AnswerState>

interface Props {
  view: SurveyView
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countAnswered(questions: QuestionView[], formState: FormState): number {
  let answered = 0
  for (const q of questions) {
    if (!q.isRequired) continue // optional — not counted
    const a = formState[q.id]
    if (!a) continue

    if (q.type === 'single' || q.type === 'multi') {
      if (a.optionIds && a.optionIds.length > 0) answered++
    } else if (q.type === 'scale') {
      const rowCount = q.scaleRows?.length ?? 0
      const ratedCount = Object.keys(a.scaleValues ?? {}).length
      if (rowCount > 0 && ratedCount === rowCount) answered++
    } else if (q.type === 'open') {
      if ((a.textValue ?? '').trim().length > 0) answered++
    }
  }
  return answered
}

function countRequired(questions: QuestionView[]): number {
  return questions.filter((q) => q.isRequired).length
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SingleQuestion({
  question,
  selected,
  onSelect,
  error,
}: {
  question: QuestionView
  selected: string | undefined
  onSelect: (optionId: string) => void
  error?: string
}) {
  return (
    <div className="opts" data-single="">
      {question.options?.map((opt) => (
        <label
          key={opt.id}
          className={`opt-row${selected === opt.id ? ' sel' : ''}${opt.isControl ? ' control' : ''}`}
        >
          <input
            type="radio"
            name={question.id}
            checked={selected === opt.id}
            onChange={() => onSelect(opt.id)}
          />
          <span>{opt.text}</span>
          {opt.isControl && <span className="ctrl-tag">control</span>}
        </label>
      ))}
      {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '6px' }}>{error}</p>}
    </div>
  )
}

function MultiQuestion({
  question,
  selected,
  onToggle,
  error,
}: {
  question: QuestionView
  selected: string[]
  onToggle: (optionId: string) => void
  error?: string
}) {
  const maxSelect = question.maxSelect
  const atCap = maxSelect !== null && maxSelect !== undefined && selected.length >= maxSelect

  return (
    <div className="opts" data-multi="" data-max={maxSelect ?? undefined}>
      {question.options?.map((opt) => {
        const isChecked = selected.includes(opt.id)
        const isDisabled = atCap && !isChecked
        return (
          <label
            key={opt.id}
            className={`opt-row${isChecked ? ' sel' : ''}${opt.isControl ? ' control' : ''}${isDisabled ? ' disabled' : ''}`}
          >
            <input
              type="checkbox"
              name={question.id}
              checked={isChecked}
              disabled={isDisabled}
              onChange={() => onToggle(opt.id)}
            />
            <span>{opt.text}</span>
            {opt.isControl && <span className="ctrl-tag">control</span>}
          </label>
        )
      })}
      {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '6px' }}>{error}</p>}
    </div>
  )
}

function ScaleQuestion({
  question,
  scaleValues,
  onRate,
  error,
}: {
  question: QuestionView
  scaleValues: Record<string, number>
  onRate: (rowId: string, value: number) => void
  error?: string
}) {
  return (
    <>
      <div className="scale-legend" aria-hidden="true">
        <span>1 — nada</span>
        <span>5 — muchísimo</span>
      </div>
      <div className="scale" data-scale="">
        {question.scaleRows?.map((row) => (
          <div key={row.id} className="scale-row">
            {/* dangerouslySetInnerHTML ONLY on sanitized labelHtml (sanitized at write time) */}
            <span
              className="label"
              dangerouslySetInnerHTML={{ __html: row.labelHtml }}
            />
            <div className="dots">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`dot${scaleValues[row.id] === n ? ' on' : ''}`}
                  onClick={() => onRate(row.id, n)}
                  aria-label={`${n}`}
                  aria-pressed={scaleValues[row.id] === n}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '6px', paddingLeft: '50px' }}>{error}</p>}
    </>
  )
}

function OpenQuestion({
  question,
  value,
  onChange,
  error,
}: {
  question: QuestionView
  value: string
  onChange: (text: string) => void
  error?: string
}) {
  return (
    <>
      <textarea
        name={question.id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tu respuesta…"
        rows={3}
      />
      {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '6px', marginLeft: '50px' }}>{error}</p>}
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SurveyForm({ view }: Props) {
  const [formState, setFormState] = useState<FormState>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const requiredCount = countRequired(view.questions)
  const answeredCount = countAnswered(view.questions, formState)

  // ── State updaters ────────────────────────────────────────────────────────

  const handleSingleSelect = useCallback((questionId: string, optionId: string) => {
    setFormState((prev) => ({
      ...prev,
      [questionId]: { optionIds: [optionId] },
    }))
    setErrors((prev) => { const e = { ...prev }; delete e[questionId]; return e })
  }, [])

  const handleMultiToggle = useCallback((questionId: string, optionId: string, maxSelect: number | null) => {
    setFormState((prev) => {
      const current = prev[questionId]?.optionIds ?? []
      let next: string[]
      if (current.includes(optionId)) {
        next = current.filter((id) => id !== optionId)
      } else {
        if (maxSelect !== null && current.length >= maxSelect) {
          return prev // already at cap — ignore
        }
        next = [...current, optionId]
      }
      return { ...prev, [questionId]: { optionIds: next } }
    })
    setErrors((prev) => { const e = { ...prev }; delete e[questionId]; return e })
  }, [])

  const handleScaleRate = useCallback((questionId: string, rowId: string, value: number) => {
    setFormState((prev) => {
      const current = prev[questionId]?.scaleValues ?? {}
      return {
        ...prev,
        [questionId]: { scaleValues: { ...current, [rowId]: value } },
      }
    })
    setErrors((prev) => { const e = { ...prev }; delete e[questionId]; return e })
  }, [])

  const handleOpenChange = useCallback((questionId: string, text: string) => {
    setFormState((prev) => ({
      ...prev,
      [questionId]: { textValue: text },
    }))
    setErrors((prev) => { const e = { ...prev }; delete e[questionId]; return e })
  }, [])

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setErrors({})

    const answers = view.questions.map((q) => {
      const a = formState[q.id]
      return {
        questionId: q.id,
        optionIds: a?.optionIds,
        scaleValues: a?.scaleValues,
        textValue: a?.textValue,
      }
    })

    const result = await submitSurvey({
      surveyId: view.id,
      answers,
    })

    if (result.ok) {
      setDone(true)
    } else {
      setErrors(result.errors ?? {})
    }

    setSubmitting(false)
  }

  // ── Done card ─────────────────────────────────────────────────────────────

  if (done) {
    return (
      <section className="panel">
        <div className="done">
          <div className="check">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12.5 10 17 19 7" stroke="#0E7C66" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3>¡Gracias! Respuesta registrada</h3>
          <p>Tu respuesta se ha guardado correctamente. ¡Muchas gracias por participar!</p>
        </div>
      </section>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit}>
      <section className="panel">
        <div className="panel-head">
          <h2>{view.title}</h2>
          {view.metaChips && view.metaChips.length > 0 && (
            <div className="meta">
              {view.metaChips.map((chip, i) => (
                <span key={i} className="chip">{chip}</span>
              ))}
            </div>
          )}
          {view.noteHtml && (
            /* dangerouslySetInnerHTML ONLY on sanitized noteHtml */
            <div className="note" dangerouslySetInnerHTML={{ __html: view.noteHtml }} />
          )}
        </div>

        <div className="qlist">
          {view.questions.map((q, idx) => (
            <div key={q.id} className="q">
              <div className="q-h">
                <span className={`q-n${!q.isRequired ? ' opt' : ''}`}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="q-t">
                  {q.text}
                  {!q.isRequired && (
                    <span style={{ color: 'var(--muted-2)', fontWeight: 400, fontSize: '14px' }}> (opcional)</span>
                  )}
                </span>
              </div>

              {q.hint && !q.hintWhy && (
                <div className="q-hint">{q.hint}</div>
              )}
              {q.hintWhy && (
                <div className="q-hint why">{q.hintWhy}</div>
              )}

              {q.type === 'single' && (
                <SingleQuestion
                  question={q}
                  selected={formState[q.id]?.optionIds?.[0]}
                  onSelect={(optionId) => handleSingleSelect(q.id, optionId)}
                  error={errors[q.id]}
                />
              )}

              {q.type === 'multi' && (
                <MultiQuestion
                  question={q}
                  selected={formState[q.id]?.optionIds ?? []}
                  onToggle={(optionId) => handleMultiToggle(q.id, optionId, q.maxSelect)}
                  error={errors[q.id]}
                />
              )}

              {q.type === 'scale' && (
                <ScaleQuestion
                  question={q}
                  scaleValues={formState[q.id]?.scaleValues ?? {}}
                  onRate={(rowId, value) => handleScaleRate(q.id, rowId, value)}
                  error={errors[q.id]}
                />
              )}

              {q.type === 'open' && (
                <OpenQuestion
                  question={q}
                  value={formState[q.id]?.textValue ?? ''}
                  onChange={(text) => handleOpenChange(q.id, text)}
                  error={errors[q.id]}
                />
              )}
            </div>
          ))}
        </div>

        <div className="panel-foot">
          <span className="progress">
            Respondidas <b>{answeredCount}</b> / {requiredCount}
          </span>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar respuestas'}
          </button>
        </div>
      </section>
    </form>
  )
}
