/**
 * CLI de administración — QHogar Encuestas.
 *
 * CRUD completo de encuestas/preguntas/opciones + lectura/export de respuestas,
 * conectándose directo a la DB (mismo cliente y schema que la app, vía
 * DATABASE_URL sobre neon-http). NO requiere el panel web ni login HTTP.
 *
 * ⚠️ SEGURIDAD: quien corre esto tiene acceso TOTAL a los datos (es la DB).
 *    El DATABASE_URL es una llave maestra. No lo compartas ni lo commitees.
 *
 * Uso:
 *   npm run cli -- <comando> [args] [--flags]
 *   npm run cli -- help
 *
 * Para apuntar a PRODUCCIÓN:
 *   vercel env pull .env.prod --environment=production
 *   DATABASE_URL="$(grep DATABASE_URL_UNPOOLED= .env.prod | cut -d= -f2- | tr -d '\"')" npm run cli -- surveys:list
 * (o exportá DATABASE_URL a mano). Si no, usa .env.local.
 */
import { readFileSync, writeFileSync } from 'node:fs'

if (!process.env.DATABASE_URL) {
  try { process.loadEnvFile('.env.local') } catch { /* asume DATABASE_URL en el entorno */ }
}

import { eq, asc, count, max } from 'drizzle-orm'
import { db } from '../src/db/index'
import { surveys, questions, options, scaleRows, responses, answers } from '../src/db/schema'
import { withTx } from '../src/db/tx'
import { slugify } from '../src/lib/slugify'
import { computeNextPosition } from '../src/lib/position'

// ── parse argv ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const cmd = argv[0]
const positional = argv.slice(1).filter((a) => !a.startsWith('--'))
const flags: Record<string, string | boolean> = {}
for (const a of argv.slice(1).filter((a) => a.startsWith('--'))) {
  const [k, ...v] = a.slice(2).split('=')
  flags[k] = v.length ? v.join('=') : true
}
const flag = (k: string) => (typeof flags[k] === 'string' ? (flags[k] as string) : undefined)

// ── helpers ───────────────────────────────────────────────────────────────────
async function surveyBySlug(slug: string) {
  const [s] = await db.select().from(surveys).where(eq(surveys.slug, slug)).limit(1)
  if (!s) throw new Error(`No existe encuesta con slug "${slug}"`)
  return s
}
const QTYPES = ['single', 'multi', 'scale', 'open'] as const
type QType = (typeof QTYPES)[number]

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

// ── comandos ──────────────────────────────────────────────────────────────────
const commands: Record<string, () => Promise<void>> = {
  async help() {
    console.log(`
QHogar Encuestas — CLI

ENCUESTAS
  surveys:list                          Lista todas con conteos
  survey:show <slug>                    Detalle: preguntas, opciones, filas
  survey:create --slug=s --title="T"    Crea encuesta  [--identifier=email|cedula] [--label="..."]
  survey:rename <slug> --title="T"      Cambia el título
  survey:toggle <slug>                  Activa / desactiva
  survey:delete <slug>                  Borra (cascada: preguntas/respuestas)

PREGUNTAS
  question:add <slug> --type=T --text="..."   [--required=false] [--max=N] [--hint="..."]
                                        type = single | multi | scale | open
  question:delete <questionId>          Borra una pregunta
  option:add <questionId> --text="..."  [--control]
  option:delete <optionId>
  row:add <questionId> --label="..."    Fila de escala
  row:delete <rowId>

RESPUESTAS
  responses:count [slug]                Conteo (total o por encuesta)
  responses:read <slug>                 Resumen agregado en la terminal
  responses:export <slug> [--out=f.csv] CSV (a archivo o a pantalla)
  responses:reset <slug> --yes          Borra TODAS las respuestas de la encuesta
`)
  },

  async 'surveys:list'() {
    const list = await db.select().from(surveys).orderBy(asc(surveys.createdAt))
    const qc = await db.select({ s: questions.surveyId, n: count() }).from(questions).groupBy(questions.surveyId)
    const rc = await db.select({ s: responses.surveyId, n: count() }).from(responses).groupBy(responses.surveyId)
    const qm = Object.fromEntries(qc.map((r) => [r.s, r.n]))
    const rm = Object.fromEntries(rc.map((r) => [r.s, r.n]))
    if (!list.length) return console.log('(no hay encuestas)')
    for (const s of list) {
      console.log(
        `${s.isActive ? '●' : '○'} /${s.slug.padEnd(16)} ${String(qm[s.id] ?? 0).padStart(2)} preg · ${String(rm[s.id] ?? 0).padStart(3)} resp · ${s.identifierType} · ${s.title}`
      )
    }
  },

  async 'survey:show'() {
    const s = await surveyBySlug(positional[0])
    console.log(`/${s.slug} — ${s.title} [${s.isActive ? 'ACTIVA' : 'INACTIVA'}] · validador: ${s.identifierType}`)
    const qs = await db.select().from(questions).where(eq(questions.surveyId, s.id)).orderBy(asc(questions.position))
    for (const q of qs) {
      console.log(`\n  [${q.position}] (${q.type}${q.isRequired ? '' : ', opcional'}${q.maxSelect ? `, máx ${q.maxSelect}` : ''}) ${q.text}`)
      console.log(`      id: ${q.id}`)
      if (q.type === 'single' || q.type === 'multi') {
        const os = await db.select().from(options).where(eq(options.questionId, q.id)).orderBy(asc(options.position))
        os.forEach((o) => console.log(`      - ${o.text}${o.isControl ? ' [control]' : ''}  (${o.id})`))
      }
      if (q.type === 'scale') {
        const rs = await db.select().from(scaleRows).where(eq(scaleRows.questionId, q.id)).orderBy(asc(scaleRows.position))
        rs.forEach((r) => console.log(`      · ${r.labelHtml.replace(/<[^>]+>/g, '')}  (${r.id})`))
      }
    }
  },

  async 'survey:create'() {
    const slug = slugify(flag('slug') ?? '')
    const title = flag('title')
    if (!slug || !title) throw new Error('Faltan --slug y/o --title')
    const identifierType = flag('identifier') === 'cedula' ? 'cedula' : 'email'
    const [s] = await db
      .insert(surveys)
      .values({ slug, title, identifierType, identifierLabel: flag('label') ?? null, isActive: true })
      .returning()
    console.log(`✓ Creada /${s.slug} (${s.id})`)
  },

  async 'survey:rename'() {
    const s = await surveyBySlug(positional[0])
    const title = flag('title')
    if (!title) throw new Error('Falta --title')
    await db.update(surveys).set({ title }).where(eq(surveys.id, s.id))
    console.log(`✓ Renombrada /${s.slug} → "${title}"`)
  },

  async 'survey:toggle'() {
    const s = await surveyBySlug(positional[0])
    await db.update(surveys).set({ isActive: !s.isActive }).where(eq(surveys.id, s.id))
    console.log(`✓ /${s.slug} ahora ${!s.isActive ? 'ACTIVA' : 'INACTIVA'}`)
  },

  async 'survey:delete'() {
    const s = await surveyBySlug(positional[0])
    await db.delete(surveys).where(eq(surveys.id, s.id))
    console.log(`✓ Borrada /${s.slug} (y sus preguntas/respuestas)`)
  },

  async 'question:add'() {
    const s = await surveyBySlug(positional[0])
    const type = flag('type') as QType
    const text = flag('text')
    if (!QTYPES.includes(type)) throw new Error(`--type debe ser ${QTYPES.join('|')}`)
    if (!text) throw new Error('Falta --text')
    const existing = await db.select({ p: questions.position }).from(questions).where(eq(questions.surveyId, s.id))
    const position = computeNextPosition(existing.map((e) => e.p))
    const maxSelect = type === 'multi' && flag('max') ? parseInt(flag('max')!, 10) : null
    const [q] = await db
      .insert(questions)
      .values({
        surveyId: s.id,
        position,
        type,
        text,
        hint: flag('hint') ?? null,
        isRequired: flag('required') !== 'false',
        maxSelect,
      })
      .returning()
    console.log(`✓ Pregunta agregada a /${s.slug} [pos ${q.position}] (${q.id})`)
  },

  async 'question:delete'() {
    await db.delete(questions).where(eq(questions.id, positional[0]))
    console.log(`✓ Pregunta ${positional[0]} borrada`)
  },

  async 'option:add'() {
    const qid = positional[0]
    const text = flag('text')
    if (!text) throw new Error('Falta --text')
    const existing = await db.select({ p: options.position }).from(options).where(eq(options.questionId, qid))
    const [o] = await db
      .insert(options)
      .values({ questionId: qid, position: computeNextPosition(existing.map((e) => e.p)), text, isControl: !!flags['control'] })
      .returning()
    console.log(`✓ Opción agregada (${o.id})${o.isControl ? ' [control]' : ''}`)
  },

  async 'option:delete'() {
    await db.delete(options).where(eq(options.id, positional[0]))
    console.log(`✓ Opción ${positional[0]} borrada`)
  },

  async 'row:add'() {
    const qid = positional[0]
    const label = flag('label')
    if (!label) throw new Error('Falta --label')
    const existing = await db.select({ p: scaleRows.position }).from(scaleRows).where(eq(scaleRows.questionId, qid))
    const [r] = await db
      .insert(scaleRows)
      .values({ questionId: qid, position: computeNextPosition(existing.map((e) => e.p)), labelHtml: label })
      .returning()
    console.log(`✓ Fila agregada (${r.id})`)
  },

  async 'row:delete'() {
    await db.delete(scaleRows).where(eq(scaleRows.id, positional[0]))
    console.log(`✓ Fila ${positional[0]} borrada`)
  },

  async 'responses:count'() {
    if (positional[0]) {
      const s = await surveyBySlug(positional[0])
      const [{ n }] = await db.select({ n: count() }).from(responses).where(eq(responses.surveyId, s.id))
      const [{ last }] = await db.select({ last: max(responses.submittedAt) }).from(responses).where(eq(responses.surveyId, s.id))
      console.log(`/${s.slug}: ${n} respuestas · última: ${last ?? '—'}`)
    } else {
      const [{ n }] = await db.select({ n: count() }).from(responses)
      console.log(`Total: ${n} respuestas`)
    }
  },

  async 'responses:read'() {
    const s = await surveyBySlug(positional[0])
    const [{ total }] = await db.select({ total: count() }).from(responses).where(eq(responses.surveyId, s.id))
    console.log(`/${s.slug} — ${total} respuestas\n`)
    const qs = await db.select().from(questions).where(eq(questions.surveyId, s.id)).orderBy(asc(questions.position))
    const ans = await db
      .select({ q: answers.questionId, o: answers.optionIds, sv: answers.scaleValues, tv: answers.textValue })
      .from(answers).innerJoin(responses, eq(answers.responseId, responses.id)).where(eq(responses.surveyId, s.id))
    for (const q of qs) {
      const qa = ans.filter((a) => a.q === q.id)
      console.log(`▸ ${q.text}  (${qa.length} resp)`)
      if (q.type === 'single' || q.type === 'multi') {
        const os = await db.select().from(options).where(eq(options.questionId, q.id)).orderBy(asc(options.position))
        const cnt: Record<string, number> = {}
        qa.forEach((a) => (a.o ?? []).forEach((id) => (cnt[id] = (cnt[id] ?? 0) + 1)))
        os.forEach((o) => {
          const c = cnt[o.id] ?? 0
          const pct = qa.length ? Math.round((c / qa.length) * 100) : 0
          console.log(`    ${String(pct).padStart(3)}% (${c})  ${o.text}${o.isControl ? ' [control]' : ''}`)
        })
      } else if (q.type === 'scale') {
        const rs = await db.select().from(scaleRows).where(eq(scaleRows.questionId, q.id)).orderBy(asc(scaleRows.position))
        const sum: Record<string, number> = {}, num: Record<string, number> = {}
        qa.forEach((a) => Object.entries(a.sv ?? {}).forEach(([rid, v]) => { sum[rid] = (sum[rid] ?? 0) + (v as number); num[rid] = (num[rid] ?? 0) + 1 }))
        rs.forEach((r) => console.log(`    ${num[r.id] ? (sum[r.id] / num[r.id]).toFixed(1) : '—'}/5  ${r.labelHtml.replace(/<[^>]+>/g, '')}`))
      } else {
        qa.map((a) => a.tv).filter(Boolean).forEach((t) => console.log(`    · ${t}`))
      }
      console.log('')
    }
  },

  async 'responses:export'() {
    const s = await surveyBySlug(positional[0])
    const qs = await db.select().from(questions).where(eq(questions.surveyId, s.id)).orderBy(asc(questions.position))
    const optText: Record<string, string> = {}, rowText: Record<string, string> = {}
    for (const q of qs) {
      if (q.type === 'single' || q.type === 'multi') (await db.select().from(options).where(eq(options.questionId, q.id))).forEach((o) => (optText[o.id] = o.text))
      if (q.type === 'scale') (await db.select().from(scaleRows).where(eq(scaleRows.questionId, q.id))).forEach((r) => (rowText[r.id] = r.labelHtml.replace(/<[^>]+>/g, '')))
    }
    const resps = await db.select({ id: responses.id, at: responses.submittedAt }).from(responses).where(eq(responses.surveyId, s.id)).orderBy(asc(responses.submittedAt))
    const ans = await db.select({ rid: answers.responseId, q: answers.questionId, o: answers.optionIds, sv: answers.scaleValues, tv: answers.textValue })
      .from(answers).innerJoin(responses, eq(answers.responseId, responses.id)).where(eq(responses.surveyId, s.id))
    const byResp: Record<string, Record<string, (typeof ans)[number]>> = {}
    ans.forEach((a) => ((byResp[a.rid] ??= {})[a.q] = a))
    const cell = (q: (typeof qs)[number], a?: (typeof ans)[number]) => {
      if (!a) return ''
      if (q.type === 'single' || q.type === 'multi') return (a.o ?? []).map((id) => optText[id] ?? id).join(' | ')
      if (q.type === 'scale') return Object.entries(a.sv ?? {}).map(([rid, n]) => `${rowText[rid] ?? rid}: ${n}`).join('; ')
      return a.tv ?? ''
    }
    const lines = [['#', 'Fecha', ...qs.map((q, i) => `P${i + 1}. ${q.text}`)].map(csvCell).join(',')]
    resps.forEach((r, i) => lines.push([String(i + 1), new Date(r.at).toISOString(), ...qs.map((q) => cell(q, byResp[r.id]?.[q.id]))].map(csvCell).join(',')))
    const csv = '﻿' + lines.join('\r\n')
    const out = flag('out')
    if (out) { writeFileSync(out, csv); console.log(`✓ CSV escrito en ${out} (${resps.length} respuestas)`) }
    else console.log(csv)
  },

  async 'responses:reset'() {
    const s = await surveyBySlug(positional[0])
    if (!flags['yes']) throw new Error('Agregá --yes para confirmar el borrado de TODAS las respuestas')
    const del = await db.delete(responses).where(eq(responses.surveyId, s.id)).returning()
    console.log(`✓ Borradas ${del.length} respuestas de /${s.slug}`)
  },
}

async function main() {
  if (!cmd || cmd === 'help' || cmd === '--help') return commands.help()
  const fn = commands[cmd]
  if (!fn) { console.error(`Comando desconocido: "${cmd}". Probá: npm run cli -- help`); process.exit(1) }
  await fn()
}

main().then(() => process.exit(0)).catch((err) => { console.error('CLI ERROR:', err.message || err); process.exit(1) })
