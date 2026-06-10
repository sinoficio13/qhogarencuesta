/**
 * Seed script — carga las 2 encuestas desde surveys.json (single source of truth).
 *
 * Idempotente: si una encuesta con ese slug ya existe, la SALTEA (no duplica).
 * Para re-seedear desde cero, borrá la encuesta desde el panel admin o la DB.
 *
 * Mapeo surveys.json → schema:
 *   - type 'text'        → questions.type 'open'
 *   - maxSelections      → questions.maxSelect (NULL si no aplica)
 *   - isControl          → options.isControl
 *   - rows[] (scale)     → scale_rows.labelHtml
 *   - audience/length/…  → surveys.metaChips[]
 *
 * Validador (decisión del usuario): EMAIL para ambas encuestas.
 *
 * Posiciones: gap-based (10, 20, 30, …) — coherente con src/lib/position.ts.
 *
 * Run: `npm run db:seed` (usa DATABASE_URL; cae a .env.local si no está seteada).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Cargar .env.local SOLO si DATABASE_URL no vino ya del entorno
// (así un `DATABASE_URL=<neon> npm run db:seed` gana sobre el local).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    /* sin .env.local: se asume DATABASE_URL en el entorno */
  }
}

import { db } from '../src/db/index'
import { surveys, questions, options, scaleRows } from '../src/db/schema'
import { eq } from 'drizzle-orm'

// ── Tipos del JSON de origen ──────────────────────────────────────────────────

type JsonOption = string | { label: string; control: boolean }

interface JsonQuestion {
  number: string
  name: string
  type: 'single' | 'multi' | 'scale' | 'text'
  required: boolean
  text: string
  hint?: string
  maxSelections?: number | null
  options?: JsonOption[]
  scale?: { min: number; max: number }
  rows?: string[]
  placeholder?: string
}

interface JsonSurvey {
  id: string
  title: string
  audience: string
  length: string
  estimatedTime: string
  tense: string
  note: string
  questions: JsonQuestion[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const POS_GAP = 10

/** type 'text' en el JSON = 'open' en el schema. */
function mapType(t: JsonQuestion['type']): 'single' | 'multi' | 'scale' | 'open' {
  return t === 'text' ? 'open' : t
}

function normalizeOption(o: JsonOption): { text: string; isControl: boolean } {
  return typeof o === 'string'
    ? { text: o, isControl: false }
    : { text: o.label, isControl: o.control }
}

// ── Seed de una encuesta ───────────────────────────────────────────────────────

async function seedSurvey(s: JsonSurvey): Promise<'created' | 'skipped'> {
  const existing = await db
    .select({ id: surveys.id })
    .from(surveys)
    .where(eq(surveys.slug, s.id))
    .limit(1)

  if (existing.length > 0) {
    return 'skipped'
  }

  await db.transaction(async (tx) => {
    const [survey] = await tx
      .insert(surveys)
      .values({
        slug: s.id,
        title: s.title,
        metaChips: [s.audience, s.length, s.estimatedTime, s.tense],
        noteHtml: s.note,
        isActive: true,
        // Decisión del usuario: validador = email para ambas encuestas.
        identifierType: 'email',
        identifierLabel: 'Tu correo electrónico',
      })
      .returning({ id: surveys.id })

    let qPos = POS_GAP
    for (const q of s.questions) {
      const [question] = await tx
        .insert(questions)
        .values({
          surveyId: survey.id,
          position: qPos,
          type: mapType(q.type),
          text: q.text,
          hint: q.hint ?? null,
          isRequired: q.required,
          maxSelect: q.maxSelections ?? null,
        })
        .returning({ id: questions.id })
      qPos += POS_GAP

      // single / multi → options
      if ((q.type === 'single' || q.type === 'multi') && q.options) {
        let oPos = POS_GAP
        for (const raw of q.options) {
          const opt = normalizeOption(raw)
          await tx.insert(options).values({
            questionId: question.id,
            position: oPos,
            text: opt.text,
            isControl: opt.isControl,
          })
          oPos += POS_GAP
        }
      }

      // scale → scale_rows
      if (q.type === 'scale' && q.rows) {
        let rPos = POS_GAP
        for (const label of q.rows) {
          await tx.insert(scaleRows).values({
            questionId: question.id,
            position: rPos,
            labelHtml: label,
          })
          rPos += POS_GAP
        }
      }
      // 'text' (open): sin options ni rows
    }
  })

  return 'created'
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  const jsonPath = join(process.cwd(), 'surveys.json')
  const data = JSON.parse(readFileSync(jsonPath, 'utf8')) as { surveys: JsonSurvey[] }

  console.log(`seed: ${data.surveys.length} encuesta(s) en ${jsonPath}\n`)

  for (const s of data.surveys) {
    const result = await seedSurvey(s)
    const tag = result === 'created' ? '✓ creada' : '· salteada (ya existe)'
    console.log(`  ${tag.padEnd(26)} ${s.id.padEnd(14)} (${s.questions.length} preguntas, validador: email)`)
  }

  console.log('\nseed: listo.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('seed: ERROR\n', err)
    process.exit(1)
  })
