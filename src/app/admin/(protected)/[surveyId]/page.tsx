/**
 * /admin/[surveyId] — Question editor.
 *
 * Shows the survey title + ordered questions with their options/scale rows.
 * Allows:
 *  - Adding new questions (with type selection)
 *  - Editing question text/hint/hintWhy/isRequired/maxSelect
 *  - Deleting questions
 *  - Adding/editing/removing options (for single/multi questions)
 *  - Adding/editing/removing scale rows (for scale questions)
 *  - Reordering questions via up/down buttons (position gap-based)
 */

import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/db'
import { surveys, questions, options, scaleRows } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  addOption,
  updateOption,
  removeOption,
  addScaleRow,
  updateScaleRow,
  removeScaleRow,
} from '@/actions/adminQuestions'
import AddQuestionForm from './AddQuestionForm'
import SurveyNav from './SurveyNav'

// ── Param type ─────────────────────────────────────────────────────────────────

interface Params {
  surveyId: string
}

// ── Form-action wrappers ───────────────────────────────────────────────────────

async function createQuestionAction(formData: FormData) {
  'use server'
  const surveyId = formData.get('surveyId') as string
  const type = formData.get('type') as 'single' | 'multi' | 'scale' | 'open'
  const text = (formData.get('text') as string).trim()
  const hint = (formData.get('hint') as string | null)?.trim() || undefined
  const hintWhy = (formData.get('hintWhy') as string | null)?.trim() || undefined
  const isRequired = formData.get('isRequired') === 'true'
  const maxSelectRaw = formData.get('maxSelect') as string | null
  const maxSelect = maxSelectRaw && maxSelectRaw !== '' ? parseInt(maxSelectRaw, 10) : undefined

  await createQuestion({ surveyId, type, text, hint, hintWhy, isRequired, maxSelect })
  redirect(`/admin/${surveyId}`)
}

async function updateQuestionAction(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const surveyId = formData.get('surveyId') as string
  const text = (formData.get('text') as string)?.trim()
  const hint = (formData.get('hint') as string | null)?.trim() ?? undefined
  const hintWhy = (formData.get('hintWhy') as string | null)?.trim() ?? undefined
  const isRequired = formData.get('isRequired') === 'true'
  const maxSelectRaw = formData.get('maxSelect') as string | null
  const maxSelect = maxSelectRaw !== null && maxSelectRaw !== '' ? parseInt(maxSelectRaw, 10) : null

  const result = await updateQuestion({ id, text, hint, hintWhy, isRequired, maxSelect })
  if (!result.ok) {
    // For now, redirect back — error display would need client state
    console.error('updateQuestion failed:', result.errors)
  }
  redirect(`/admin/${surveyId}`)
}

async function deleteQuestionAction(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const surveyId = formData.get('surveyId') as string
  try {
    const result = await deleteQuestion({ id })
    if (!result.ok) {
      console.error('deleteQuestion failed:', result.errors)
    }
  } catch (err) {
    // DB-level failure (e.g. FK constraint). Log and fall through to redirect
    // so the editor reloads instead of crashing the whole page.
    // redirect() MUST stay outside this try: it throws NEXT_REDIRECT and the
    // catch would otherwise swallow the navigation signal.
    console.error('deleteQuestion threw:', err)
  }
  redirect(`/admin/${surveyId}`)
}

async function moveQuestionUpAction(formData: FormData) {
  'use server'
  const surveyId = formData.get('surveyId') as string
  const questionId = formData.get('questionId') as string
  const allIdsRaw = formData.get('allIds') as string
  const allIds = allIdsRaw.split(',')
  const idx = allIds.indexOf(questionId)
  if (idx > 0) {
    const newOrder = [...allIds]
    ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
    await reorderQuestions({ surveyId, orderedIds: newOrder })
  }
  revalidatePath(`/admin/${surveyId}`)
}

async function moveQuestionDownAction(formData: FormData) {
  'use server'
  const surveyId = formData.get('surveyId') as string
  const questionId = formData.get('questionId') as string
  const allIdsRaw = formData.get('allIds') as string
  const allIds = allIdsRaw.split(',')
  const idx = allIds.indexOf(questionId)
  if (idx < allIds.length - 1) {
    const newOrder = [...allIds]
    ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
    await reorderQuestions({ surveyId, orderedIds: newOrder })
  }
  revalidatePath(`/admin/${surveyId}`)
}

async function addOptionAction(formData: FormData) {
  'use server'
  const questionId = formData.get('questionId') as string
  const surveyId = formData.get('surveyId') as string
  const text = (formData.get('text') as string).trim()
  const isControl = formData.get('isControl') === 'true'
  await addOption({ questionId, text, isControl })
  redirect(`/admin/${surveyId}`)
}

async function removeOptionAction(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const surveyId = formData.get('surveyId') as string
  await removeOption({ id })
  redirect(`/admin/${surveyId}`)
}

async function addScaleRowAction(formData: FormData) {
  'use server'
  const questionId = formData.get('questionId') as string
  const surveyId = formData.get('surveyId') as string
  const labelHtml = (formData.get('labelHtml') as string).trim()
  await addScaleRow({ questionId, labelHtml })
  redirect(`/admin/${surveyId}`)
}

async function removeScaleRowAction(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const surveyId = formData.get('surveyId') as string
  await removeScaleRow({ id })
  redirect(`/admin/${surveyId}`)
}

// ── Page component ─────────────────────────────────────────────────────────────

export default async function QuestionEditorPage({
  params,
}: {
  params: Promise<Params>
}) {
  await requireAdmin()
  const { surveyId } = await params

  // Load survey
  const [survey] = await db
    .select()
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)
  if (!survey) notFound()

  // Load questions with options and scale rows
  const questionList = await db
    .select()
    .from(questions)
    .where(eq(questions.surveyId, surveyId))
    .orderBy(asc(questions.position))

  const allIds = questionList.map((q) => q.id)

  // Load options and scale rows for all questions
  const optionMap: Record<string, (typeof options.$inferSelect)[]> = {}
  const scaleRowMap: Record<string, (typeof scaleRows.$inferSelect)[]> = {}

  for (const q of questionList) {
    if (q.type === 'single' || q.type === 'multi') {
      optionMap[q.id] = await db
        .select()
        .from(options)
        .where(eq(options.questionId, q.id))
        .orderBy(asc(options.position))
    }
    if (q.type === 'scale') {
      scaleRowMap[q.id] = await db
        .select()
        .from(scaleRows)
        .where(eq(scaleRows.questionId, q.id))
        .orderBy(asc(scaleRows.position))
    }
  }

  const typeBadgeColors: Record<string, string> = {
    single: '#E9EFF6',
    multi: '#EEF2FF',
    scale: '#FEF9EC',
    open: '#FDF3EF',
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <SurveyNav surveyId={surveyId} active="edit" title={survey.title} />

      {/* Add question form — componente cliente claro y estético */}
      <AddQuestionForm surveyId={surveyId} action={createQuestionAction} />

      {/* Question list */}
      {questionList.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
          Esta encuesta no tiene preguntas todavía. Agregá la primera arriba.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {questionList.map((q, idx) => (
            <div
              key={q.id}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 14,
                background: 'var(--surface)',
                overflow: 'hidden',
              }}
            >
              {/* Question header — apilado: controles arriba, texto full-width abajo (mobile-friendly) */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFCFB' }}>
                {/* Fila de controles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--brand)', borderRadius: 8, padding: '3px 9px', flex: 'none' }}>
                    {idx + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: typeBadgeColors[q.type] ?? '#f0f0f0',
                      border: '1px solid var(--line)',
                      color: 'var(--muted)',
                      flex: 'none',
                    }}
                  >
                    {q.type}
                  </span>
                  {!q.isRequired && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', border: '1px solid var(--line)', padding: '2px 6px', borderRadius: 6, flex: 'none' }}>
                      opcional
                    </span>
                  )}

                  <div style={{ flex: 1 }} />

                  {/* Reorder + delete */}
                  <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
                    <form action={moveQuestionUpAction} style={{ display: 'inline' }}>
                      <input type="hidden" name="surveyId" value={surveyId} />
                      <input type="hidden" name="questionId" value={q.id} />
                      <input type="hidden" name="allIds" value={allIds.join(',')} />
                      <button type="submit" disabled={idx === 0} style={{ ...iconBtnStyle, opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                    </form>
                    <form action={moveQuestionDownAction} style={{ display: 'inline' }}>
                      <input type="hidden" name="surveyId" value={surveyId} />
                      <input type="hidden" name="questionId" value={q.id} />
                      <input type="hidden" name="allIds" value={allIds.join(',')} />
                      <button type="submit" disabled={idx === questionList.length - 1} style={{ ...iconBtnStyle, opacity: idx === questionList.length - 1 ? 0.3 : 1 }}>↓</button>
                    </form>
                    <form action={deleteQuestionAction} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="surveyId" value={surveyId} />
                      <button type="submit" style={{ ...iconBtnStyle, color: '#c0392b' }}>✕</button>
                    </form>
                  </div>
                </div>

                {/* Texto de la pregunta — ancho completo */}
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, lineHeight: 1.45, color: 'var(--ink)' }}>
                  {q.text}
                </span>
              </div>

              {/* Edit form */}
              <details style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
                <summary style={{ fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>Editar pregunta</summary>
                <form action={updateQuestionAction} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="surveyId" value={surveyId} />
                  <label style={smallLabelStyle}>
                    Texto
                    <input name="text" defaultValue={q.text} required style={inputStyle} />
                  </label>
                  <label style={smallLabelStyle}>
                    Hint
                    <input name="hint" defaultValue={q.hint ?? ''} style={inputStyle} />
                  </label>
                  <label style={smallLabelStyle}>
                    Hint Why
                    <input name="hintWhy" defaultValue={q.hintWhy ?? ''} style={inputStyle} />
                  </label>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{ ...smallLabelStyle, flex: 'none' }}>
                      Obligatoria
                      <select name="isRequired" defaultValue={String(q.isRequired)} style={{ ...inputStyle, width: 'auto' }}>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </label>
                    {q.type === 'multi' && (
                      <label style={{ ...smallLabelStyle, flex: 'none' }}>
                        maxSelect
                        <input name="maxSelect" type="number" min={1} defaultValue={q.maxSelect ?? ''} style={{ ...inputStyle, width: 80 }} />
                      </label>
                    )}
                  </div>
                  <button type="submit" style={saveBtnStyle}>Guardar cambios</button>
                </form>
              </details>

              {/* Options (single/multi) */}
              {(q.type === 'single' || q.type === 'multi') && (
                <div style={{ padding: '14px 20px' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted-2)', margin: '0 0 10px' }}>
                    Opciones ({optionMap[q.id]?.length ?? 0})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {(optionMap[q.id] ?? []).map((opt) => (
                      <div
                        key={opt.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 12px',
                          border: '1px solid var(--line)',
                          borderRadius: 10,
                          background: opt.isControl ? '#FAFAFA' : '#fff',
                          borderStyle: opt.isControl ? 'dashed' : 'solid',
                        }}
                      >
                        <span style={{ flex: 1, fontSize: 14, color: opt.isControl ? 'var(--muted)' : 'var(--ink)' }}>
                          {opt.text}
                          {opt.isControl && (
                            <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-2)', border: '1px solid var(--line)', padding: '1px 5px', borderRadius: 4 }}>
                              control
                            </span>
                          )}
                        </span>
                        <form action={removeOptionAction} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={opt.id} />
                          <input type="hidden" name="surveyId" value={surveyId} />
                          <button type="submit" style={{ ...iconBtnStyle, fontSize: 11, color: '#c0392b' }}>✕</button>
                        </form>
                      </div>
                    ))}
                  </div>
                  {/* Add option form */}
                  <form action={addOptionAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input type="hidden" name="questionId" value={q.id} />
                    <input type="hidden" name="surveyId" value={surveyId} />
                    <input name="text" required placeholder="Texto de la opción" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
                    <select name="isControl" style={{ ...inputStyle, width: 'auto' }}>
                      <option value="false">Normal</option>
                      <option value="true">Control</option>
                    </select>
                    <button type="submit" style={saveBtnStyle}>+ Opción</button>
                  </form>
                </div>
              )}

              {/* Scale rows (scale) */}
              {q.type === 'scale' && (
                <div style={{ padding: '14px 20px' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted-2)', margin: '0 0 10px' }}>
                    Filas de escala ({scaleRowMap[q.id]?.length ?? 0})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {(scaleRowMap[q.id] ?? []).map((sr) => (
                      <div
                        key={sr.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}
                      >
                        <span style={{ flex: 1, fontSize: 14 }} dangerouslySetInnerHTML={{ __html: sr.labelHtml }} />
                        <form action={removeScaleRowAction} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={sr.id} />
                          <input type="hidden" name="surveyId" value={surveyId} />
                          <button type="submit" style={{ ...iconBtnStyle, fontSize: 11, color: '#c0392b' }}>✕</button>
                        </form>
                      </div>
                    ))}
                  </div>
                  {/* Add scale row form */}
                  <form action={addScaleRowAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input type="hidden" name="questionId" value={q.id} />
                    <input type="hidden" name="surveyId" value={surveyId} />
                    <input name="labelHtml" required placeholder="Label HTML (Ej: <b>Proceso de compra</b>)" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
                    <button type="submit" style={saveBtnStyle}>+ Fila</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Inline styles ─────────────────────────────────────────────────────────────

const smallLabelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--ink)',
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', fontSize: 14,
  fontFamily: 'var(--font-body)', color: 'var(--ink)', background: '#fff', outline: 'none',
}

const iconBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 13, background: 'transparent', border: '1px solid var(--line)',
  borderRadius: 7, padding: '3px 8px', cursor: 'pointer', color: 'var(--muted)', lineHeight: 1.4,
}

const saveBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
  background: 'var(--brand)', color: '#fff', borderRadius: 9, padding: '8px 16px', whiteSpace: 'nowrap',
}
