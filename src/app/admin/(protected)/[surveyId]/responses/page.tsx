/**
 * /admin/[surveyId]/responses — Response summary (simple aggregate view).
 *
 * Shows:
 * - Total response count
 * - Per-question basic aggregates:
 *   - single/multi: count per option
 *   - scale: average value per row
 *   - open: list of text responses
 *
 * Simple readable summary — no charts.
 */

import { requireAdmin } from '@/lib/auth/requireAdmin'
import SurveyNav from '../SurveyNav'
import { db } from '@/db'
import { surveys, questions, options, scaleRows, responses, answers } from '@/db/schema'
import { eq, asc, sql, count } from 'drizzle-orm'
import { notFound } from 'next/navigation'

interface Params {
  surveyId: string
}

export default async function ResponsesPage({
  params,
}: {
  params: Promise<Params>
}) {
  await requireAdmin()
  const { surveyId } = await params

  const [survey] = await db
    .select({ id: surveys.id, title: surveys.title, slug: surveys.slug })
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)
  if (!survey) notFound()

  // Total responses
  const [{ total }] = await db
    .select({ total: count() })
    .from(responses)
    .where(eq(responses.surveyId, surveyId))

  // Load questions with options and scale rows
  const questionList = await db
    .select()
    .from(questions)
    .where(eq(questions.surveyId, surveyId))
    .orderBy(asc(questions.position))

  // Load all answers for this survey's responses in one shot
  // We'll process aggregates per question in JS (simple, Phase-1 cardinality)
  const answerRows = await db
    .select({
      id: answers.id,
      questionId: answers.questionId,
      optionIds: answers.optionIds,
      scaleValues: answers.scaleValues,
      textValue: answers.textValue,
    })
    .from(answers)
    .innerJoin(responses, eq(answers.responseId, responses.id))
    .where(eq(responses.surveyId, surveyId))

  // Load options and scale rows for rendering
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

  return (
    <div style={{ maxWidth: 860 }}>
      <SurveyNav surveyId={surveyId} active="responses" title={survey.title} />
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 18px', background: 'var(--surface)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: 'var(--ink)' }}>{total}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted-2)', marginLeft: 10 }}>
            respuesta{total !== 1 ? 's' : ''} totales
          </span>
        </div>
        <a href={`/admin/${surveyId}/export`} style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brand-deep)', textDecoration: 'none', border: '1px solid #CDE6DD', background: '#E9F4F0', borderRadius: 8, padding: '8px 12px' }}>
          ↓ Exportar CSV
        </a>
      </div>

      {total === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
          Todavía no hay respuestas para esta encuesta.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {questionList.map((q, idx) => {
            const qAnswers = answerRows.filter((a) => a.questionId === q.id)
            const answered = qAnswers.length

            return (
              <div
                key={q.id}
                style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}
              >
                {/* Question header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: '#FAFCFB', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, color: '#fff', background: 'var(--brand)', borderRadius: 8, padding: '3px 9px', flex: 'none' }}>
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{q.text}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-2)', marginTop: 2 }}>
                      {q.type} · {answered} respuesta{answered !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Aggregates */}
                <div style={{ padding: '16px 20px' }}>
                  {/* Single / Multi: count per option */}
                  {(q.type === 'single' || q.type === 'multi') && (() => {
                    const opts = optionMap[q.id] ?? []
                    const countPerOption: Record<string, number> = {}
                    for (const a of qAnswers) {
                      if (a.optionIds) {
                        for (const oid of a.optionIds) {
                          countPerOption[oid] = (countPerOption[oid] ?? 0) + 1
                        }
                      }
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {opts.map((opt) => {
                          const c = countPerOption[opt.id] ?? 0
                          const pct = answered > 0 ? Math.round((c / answered) * 100) : 0
                          return (
                            <div key={opt.id}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 13 }}>
                                <span style={{ color: opt.isControl ? 'var(--muted)' : 'var(--ink)' }}>
                                  {opt.text}
                                  {opt.isControl && <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-2)', border: '1px solid var(--line)', padding: '1px 5px', borderRadius: 4 }}>control</span>}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-2)' }}>{c} ({pct}%)</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 4, background: 'var(--line)' }}>
                                <div style={{ height: 6, borderRadius: 4, background: 'var(--brand)', width: `${pct}%`, transition: 'width .3s ease' }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {/* Scale: average per row */}
                  {q.type === 'scale' && (() => {
                    const rows = scaleRowMap[q.id] ?? []
                    // scaleValues is { [rowId]: number }
                    const sumMap: Record<string, number> = {}
                    const cntMap: Record<string, number> = {}
                    for (const a of qAnswers) {
                      if (a.scaleValues) {
                        for (const [rowId, val] of Object.entries(a.scaleValues)) {
                          sumMap[rowId] = (sumMap[rowId] ?? 0) + (val as number)
                          cntMap[rowId] = (cntMap[rowId] ?? 0) + 1
                        }
                      }
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {rows.map((row) => {
                          const avg = cntMap[row.id] > 0 ? (sumMap[row.id] / cntMap[row.id]).toFixed(1) : '—'
                          return (
                            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}>
                              <div style={{ flex: 1, fontSize: 14 }} dangerouslySetInnerHTML={{ __html: row.labelHtml }} />
                              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--brand-deep)' }}>
                                {avg}
                              </div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-2)' }}>
                                /5
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {/* Open: list of text responses */}
                  {q.type === 'open' && (() => {
                    const texts = qAnswers.map((a) => a.textValue).filter(Boolean) as string[]
                    if (texts.length === 0) {
                      return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sin respuestas de texto.</p>
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {texts.map((t, i) => (
                          <div
                            key={i}
                            style={{ padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 10, background: '#fff', fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}
                          >
                            {t}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
