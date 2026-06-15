'use client'

/**
 * SurveyForm — Client Component for public survey rendering and submission.
 *
 * PIVOT (identifier-based dedup):
 *  - The identifier field (email or cédula) is the FIRST field of the form.
 *  - `token` and `preview` props removed — /[slug] is now fully answerable.
 *  - Identifier included in submit payload.
 *  - _identifier error surfaced prominently (same banner pattern as other errors).
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

import { useState, useCallback } from 'react'
import { submitSurvey } from '@/actions/submitSurvey'
import { validateIdentifier } from '@/lib/identifier'
import type { SurveyView, QuestionView } from '@/lib/dto/surveyShape'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnswerState {
  optionIds?: string[]
  scaleValues?: Record<string, number>
  textValue?: string
}

type FormState = Record<string, AnswerState>

interface Props {
  view: SurveyView
  /** Vista previa del admin: se ve igual que para el encuestado pero el envío
   *  está deshabilitado y no guarda nada. */
  preview?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countAnswered(questions: QuestionView[], formState: FormState): number {
  let answered = 0
  for (const q of questions) {
    if (!q.isRequired) continue
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

function spanishError(q: QuestionView): string {
  switch (q.type) {
    case 'single':
      return 'Elegí una opción para continuar.'
    case 'multi':
      return q.maxSelect
        ? `Seleccioná entre 1 y ${q.maxSelect} opciones.`
        : 'Seleccioná al menos una opción.'
    case 'scale':
      return 'Puntuá todas las filas, del 1 al 5.'
    case 'open':
      return 'Esta pregunta es obligatoria.'
    default:
      return 'Revisá esta pregunta.'
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SingleQuestion({
  question, selected, onSelect, error,
}: {
  question: QuestionView; selected: string | undefined
  onSelect: (optionId: string) => void; error?: string
}) {
  return (
    <div className="opts" data-single="">
      {question.options?.map((opt) => (
        <label key={opt.id} className={`opt-row${selected === opt.id ? ' sel' : ''}`}>
          <input type="radio" name={question.id} checked={selected === opt.id} onChange={() => onSelect(opt.id)} />
          <span>{opt.text}</span>
        </label>
      ))}
      {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '6px' }}>{error}</p>}
    </div>
  )
}

function MultiQuestion({
  question, selected, onToggle, error,
}: {
  question: QuestionView; selected: string[]
  onToggle: (optionId: string) => void; error?: string
}) {
  const maxSelect = question.maxSelect
  const atCap = maxSelect !== null && maxSelect !== undefined && selected.length >= maxSelect

  return (
    <div className="opts" data-multi="" data-max={maxSelect ?? undefined}>
      {question.options?.map((opt) => {
        const isChecked = selected.includes(opt.id)
        const isDisabled = atCap && !isChecked
        return (
          <label key={opt.id} className={`opt-row${isChecked ? ' sel' : ''}${isDisabled ? ' disabled' : ''}`}>
            <input type="checkbox" name={question.id} checked={isChecked} disabled={isDisabled} onChange={() => onToggle(opt.id)} />
            <span>{opt.text}</span>
          </label>
        )
      })}
      {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '6px' }}>{error}</p>}
    </div>
  )
}

function ScaleQuestion({
  question, scaleValues, onRate, error,
}: {
  question: QuestionView; scaleValues: Record<string, number>
  onRate: (rowId: string, value: number) => void; error?: string
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
            <span className="label" dangerouslySetInnerHTML={{ __html: row.labelHtml }} />
            <div className="dots">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={`dot${scaleValues[row.id] === n ? ' on' : ''}`}
                  onClick={() => onRate(row.id, n)} aria-label={`${n}`} aria-pressed={scaleValues[row.id] === n}>
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
  question, value, onChange, error,
}: {
  question: QuestionView; value: string
  onChange: (text: string) => void; error?: string
}) {
  return (
    <>
      <textarea name={question.id} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Tu respuesta…" rows={3} />
      {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '6px', marginLeft: '50px' }}>{error}</p>}
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SurveyForm({ view, preview = false }: Props) {
  const [identifier, setIdentifier] = useState('')
  const [formState, setFormState] = useState<FormState>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const requiredCount = countRequired(view.questions)
  const answeredCount = countAnswered(view.questions, formState)

  // Identifier field config
  const identifierType = view.identifierType
  const identifierLabel =
    view.identifierLabel ||
    (identifierType === 'email' ? 'Email' : 'Cédula')
  const identifierInputType = identifierType === 'email' ? 'email' : 'text'

  // ── State updaters ────────────────────────────────────────────────────────

  const handleSingleSelect = useCallback((questionId: string, optionId: string) => {
    setFormState((prev) => ({ ...prev, [questionId]: { optionIds: [optionId] } }))
    setErrors((prev) => { const e = { ...prev }; delete e[questionId]; return e })
  }, [])

  const handleMultiToggle = useCallback((questionId: string, optionId: string, maxSelect: number | null) => {
    setFormState((prev) => {
      const current = prev[questionId]?.optionIds ?? []
      let next: string[]
      if (current.includes(optionId)) {
        next = current.filter((id) => id !== optionId)
      } else {
        if (maxSelect !== null && current.length >= maxSelect) return prev
        next = [...current, optionId]
      }
      return { ...prev, [questionId]: { optionIds: next } }
    })
    setErrors((prev) => { const e = { ...prev }; delete e[questionId]; return e })
  }, [])

  const handleScaleRate = useCallback((questionId: string, rowId: string, value: number) => {
    setFormState((prev) => {
      const current = prev[questionId]?.scaleValues ?? {}
      return { ...prev, [questionId]: { scaleValues: { ...current, [rowId]: value } } }
    })
    setErrors((prev) => { const e = { ...prev }; delete e[questionId]; return e })
  }, [])

  const handleOpenChange = useCallback((questionId: string, text: string) => {
    setFormState((prev) => ({ ...prev, [questionId]: { textValue: text } }))
    setErrors((prev) => { const e = { ...prev }; delete e[questionId]; return e })
  }, [])

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (preview) return // vista previa: no se envía nada
    if (submitting) return

    // Client-side: validar el identificador ANTES de enviar.
    // 1) requerido  2) formato (mismo criterio que el server, vía validateIdentifier)
    const scrollToId = () => {
      if (typeof document !== 'undefined') {
        requestAnimationFrame(() =>
          document
            .getElementById('survey-identifier-field')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        )
      }
    }
    if (!identifier.trim()) {
      setErrors({ _identifier: `${identifierLabel} es obligatorio.` })
      scrollToId()
      return
    }
    const idCheck = validateIdentifier(identifierType, identifier.trim())
    if (!idCheck.ok) {
      setErrors({ _identifier: idCheck.error })
      scrollToId()
      return
    }

    setSubmitting(true)
    setErrors({})

    const answerList = view.questions.map((q) => {
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
      identifier: identifier.trim(),
      answers: answerList,
    })

    if (result.ok) {
      setDone(true)
    } else {
      const errs = result.errors ?? {}
      setErrors(errs)

      // Scroll to first flagged question; if _identifier error, scroll to top of form
      if (errs._identifier) {
        if (typeof document !== 'undefined') {
          requestAnimationFrame(() => {
            document
              .getElementById('survey-identifier-field')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          })
        }
      } else {
        const firstErrorId = view.questions.find((q) => errs[q.id])?.id
        if (firstErrorId && typeof document !== 'undefined') {
          requestAnimationFrame(() => {
            document
              .getElementById(`q-${firstErrorId}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          })
        }
      }
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
    <form onSubmit={handleSubmit} noValidate>
      {preview && (
        <div
          style={{
            margin: '0 0 16px',
            padding: '12px 18px',
            borderRadius: 12,
            background: '#FFF6E9',
            border: '1px solid #F0D9A8',
            color: '#8a6d3b',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span aria-hidden="true">👁</span>
          <span><strong>Vista previa.</strong> Así la ven los encuestados. Podés tocar todo; <strong>no se guarda nada</strong>.</span>
        </div>
      )}
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
            <div className="note" dangerouslySetInnerHTML={{ __html: view.noteHtml }} />
          )}
        </div>

        <div className="qlist">
          {/* Identifier field — FIRST field of the form */}
          <div id="survey-identifier-field" className="q">
            <div className="q-h">
              <span className="q-n">00</span>
              <span className="q-t">{identifierLabel}</span>
            </div>
            <div style={{ paddingLeft: '50px', paddingRight: '16px', marginTop: '10px' }}>
              <input
                type={identifierInputType}
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value)
                  setErrors((prev) => { const er = { ...prev }; delete er._identifier; return er })
                }}
                placeholder={
                  identifierType === 'email'
                    ? 'nombre@dominio.com'
                    : 'Tu número de cédula'
                }
                required
                autoComplete={identifierType === 'email' ? 'email' : 'off'}
                style={{
                  border: errors._identifier ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  borderRadius: 10,
                  padding: '10px 13px',
                  fontSize: 15,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--ink)',
                  background: '#fff',
                  outline: 'none',
                  width: '100%',
                  maxWidth: 340,
                  boxSizing: 'border-box',
                }}
              />
              {errors._identifier && (
                <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '6px' }}>
                  {errors._identifier}
                </p>
              )}
            </div>
          </div>

          {view.questions.map((q, idx) => (
            <div key={q.id} id={`q-${q.id}`} className="q">
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

              {q.hint && !q.hintWhy && <div className="q-hint">{q.hint}</div>}
              {q.hintWhy && <div className="q-hint why">{q.hintWhy}</div>}

              {q.type === 'single' && (
                <SingleQuestion
                  question={q}
                  selected={formState[q.id]?.optionIds?.[0]}
                  onSelect={(optionId) => handleSingleSelect(q.id, optionId)}
                  error={errors[q.id] ? spanishError(q) : undefined}
                />
              )}
              {q.type === 'multi' && (
                <MultiQuestion
                  question={q}
                  selected={formState[q.id]?.optionIds ?? []}
                  onToggle={(optionId) => handleMultiToggle(q.id, optionId, q.maxSelect)}
                  error={errors[q.id] ? spanishError(q) : undefined}
                />
              )}
              {q.type === 'scale' && (
                <ScaleQuestion
                  question={q}
                  scaleValues={formState[q.id]?.scaleValues ?? {}}
                  onRate={(rowId, value) => handleScaleRate(q.id, rowId, value)}
                  error={errors[q.id] ? spanishError(q) : undefined}
                />
              )}
              {q.type === 'open' && (
                <OpenQuestion
                  question={q}
                  value={formState[q.id]?.textValue ?? ''}
                  onChange={(text) => handleOpenChange(q.id, text)}
                  error={errors[q.id] ? spanishError(q) : undefined}
                />
              )}
            </div>
          ))}
        </div>

        {/* General validation error banner (question-level errors) */}
        {Object.keys(errors).some((k) => k !== '_identifier' && k !== '_db' && k !== '_survey') && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              margin: '0 34px',
              padding: '13px 16px',
              borderRadius: '11px',
              border: '1px solid var(--accent)',
              background: '#FDF3EF',
              color: 'var(--accent-deep)',
              fontSize: '14px',
            }}
          >
            <strong>Faltan respuestas o hay datos inválidos.</strong> Revisá las
            preguntas marcadas en naranja más arriba y volvé a enviar.
          </div>
        )}

        {/* _db error */}
        {errors._db && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              margin: '0 34px 12px',
              padding: '13px 16px',
              borderRadius: '11px',
              border: '1px solid var(--accent)',
              background: '#FDF3EF',
              color: 'var(--accent-deep)',
              fontSize: '14px',
            }}
          >
            {errors._db}
          </div>
        )}

        <div className="panel-foot">
          <span className="progress">
            Respondidas <b>{answeredCount}</b> / {requiredCount}
          </span>
          {preview ? (
            <button type="button" className="btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
              Enviar (deshabilitado en vista previa)
            </button>
          ) : (
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar respuestas'}
            </button>
          )}
        </div>
      </section>
    </form>
  )
}
