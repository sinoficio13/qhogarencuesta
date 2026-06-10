/**
 * GET /admin/[surveyId]/export — descarga las respuestas de una encuesta en CSV.
 *
 * Formato WIDE: una fila por respondente, una columna por pregunta (más cómodo
 * para abrir en Excel/Sheets y armar tablas/gráficos).
 *   - single  → texto de la opción elegida
 *   - multi   → opciones elegidas unidas por " | "
 *   - scale   → "fila: n; fila: n; …"
 *   - open    → texto libre
 * Columnas fijas: "#", "Fecha".
 * El identificador (email/cédula) NO se exporta: se guarda solo hasheado.
 *
 * Protegido por middleware (/admin/*) + requireAdmin defensivo.
 */
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/db'
import { surveys, questions, options, scaleRows, responses, answers } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'

function csvCell(value: string): string {
  // Escapar para CSV: envolver en comillas y duplicar comillas internas si hace
  // falta (coma, comilla, salto de línea).
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  await requireAdmin()
  const { surveyId } = await params

  const [survey] = await db
    .select({ slug: surveys.slug, title: surveys.title })
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)
  if (!survey) {
    return new Response('Survey not found', { status: 404 })
  }

  const questionList = await db
    .select()
    .from(questions)
    .where(eq(questions.surveyId, surveyId))
    .orderBy(asc(questions.position))

  // Mapas de texto para opciones y filas de escala
  const optionText: Record<string, string> = {}
  const scaleRowText: Record<string, string> = {}
  for (const q of questionList) {
    if (q.type === 'single' || q.type === 'multi') {
      const opts = await db.select().from(options).where(eq(options.questionId, q.id))
      for (const o of opts) optionText[o.id] = o.text
    }
    if (q.type === 'scale') {
      const rows = await db.select().from(scaleRows).where(eq(scaleRows.questionId, q.id))
      // labelHtml puede traer <b>…</b>: lo limpiamos para el CSV
      for (const r of rows) scaleRowText[r.id] = r.labelHtml.replace(/<[^>]+>/g, '')
    }
  }

  const respList = await db
    .select({ id: responses.id, submittedAt: responses.submittedAt })
    .from(responses)
    .where(eq(responses.surveyId, surveyId))
    .orderBy(asc(responses.submittedAt))

  const answerRows = await db
    .select({
      responseId: answers.responseId,
      questionId: answers.questionId,
      optionIds: answers.optionIds,
      scaleValues: answers.scaleValues,
      textValue: answers.textValue,
    })
    .from(answers)
    .innerJoin(responses, eq(answers.responseId, responses.id))
    .where(eq(responses.surveyId, surveyId))

  // index: responseId -> questionId -> answer
  const byResp: Record<string, Record<string, (typeof answerRows)[number]>> = {}
  for (const a of answerRows) {
    ;(byResp[a.responseId] ??= {})[a.questionId] = a
  }

  function cellFor(q: (typeof questionList)[number], a?: (typeof answerRows)[number]): string {
    if (!a) return ''
    if (q.type === 'single' || q.type === 'multi') {
      return (a.optionIds ?? []).map((id) => optionText[id] ?? id).join(' | ')
    }
    if (q.type === 'scale') {
      const sv = a.scaleValues ?? {}
      return Object.entries(sv)
        .map(([rowId, n]) => `${scaleRowText[rowId] ?? rowId}: ${n}`)
        .join('; ')
    }
    return a.textValue ?? ''
  }

  // Header
  const header = ['#', 'Fecha', ...questionList.map((q, i) => `P${i + 1}. ${q.text}`)]
  const lines = [header.map(csvCell).join(',')]

  respList.forEach((r, idx) => {
    const cells = [
      String(idx + 1),
      r.submittedAt instanceof Date ? r.submittedAt.toISOString() : String(r.submittedAt),
      ...questionList.map((q) => cellFor(q, byResp[r.id]?.[q.id])),
    ]
    lines.push(cells.map(csvCell).join(','))
  })

  // BOM para que Excel respete los acentos UTF-8
  const csv = '﻿' + lines.join('\r\n')
  const filename = `respuestas-${survey.slug}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
