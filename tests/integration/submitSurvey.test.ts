/**
 * WU-4 TDD Gate — submitSurvey integration tests (T-042)
 *
 * Strict TDD: written BEFORE submitSurvey.ts exists.
 * Runs against TEST_DATABASE_URL (local docker postgres:16, qhogar_test db).
 *
 * Covers:
 *  - happy path: response + N answers inserted atomically
 *  - missing required answer → rejected with errors (no DB rows)
 *  - over-cap multi selection → rejected server-side
 *  - unknown/cross-survey option id → rejected
 *  - incomplete scale (missing row) → rejected
 *  - empty optional open → no answer row inserted
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'

// ── Test DB setup ─────────────────────────────────────────────────────────────

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://qhogar:qhogar@localhost:5432/qhogar_test'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DB_URL })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
}, 30_000)

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  // Clean in dependency order
  await db.delete(schema.answers)
  await db.delete(schema.responses)
  await db.delete(schema.scaleRows)
  await db.delete(schema.options)
  await db.delete(schema.questions)
  await db.delete(schema.surveys)
})

// ── Fixture builder ───────────────────────────────────────────────────────────

/**
 * Inserts a minimal fixture survey with:
 *   - Q1 single (required) — 2 options
 *   - Q2 multi max=2 (required) — 3 options
 *   - Q3 scale (required) — 2 rows
 *   - Q4 open (optional)
 * Returns survey + all created ids for building payloads.
 */
async function insertFixtureSurvey(slug = 'test-fixture') {
  const [survey] = await db
    .insert(schema.surveys)
    .values({ slug, title: 'Fixture Survey', isActive: true })
    .returning()

  // Q1 — single
  const [q1] = await db
    .insert(schema.questions)
    .values({ surveyId: survey.id, position: 10, type: 'single', text: 'Q1 single', isRequired: true })
    .returning()
  const [q1o1] = await db.insert(schema.options).values({ questionId: q1.id, position: 10, text: 'Opt A' }).returning()
  const [q1o2] = await db.insert(schema.options).values({ questionId: q1.id, position: 20, text: 'Opt B' }).returning()

  // Q2 — multi max=2
  const [q2] = await db
    .insert(schema.questions)
    .values({ surveyId: survey.id, position: 20, type: 'multi', text: 'Q2 multi', isRequired: true, maxSelect: 2 })
    .returning()
  const [q2o1] = await db.insert(schema.options).values({ questionId: q2.id, position: 10, text: 'M Opt A' }).returning()
  const [q2o2] = await db.insert(schema.options).values({ questionId: q2.id, position: 20, text: 'M Opt B' }).returning()
  const [q2o3] = await db.insert(schema.options).values({ questionId: q2.id, position: 30, text: 'M Opt C' }).returning()

  // Q3 — scale
  const [q3] = await db
    .insert(schema.questions)
    .values({ surveyId: survey.id, position: 30, type: 'scale', text: 'Q3 scale', isRequired: true })
    .returning()
  const [q3r1] = await db.insert(schema.scaleRows).values({ questionId: q3.id, position: 10, labelHtml: 'Row 1' }).returning()
  const [q3r2] = await db.insert(schema.scaleRows).values({ questionId: q3.id, position: 20, labelHtml: 'Row 2' }).returning()

  // Q4 — open optional
  const [q4] = await db
    .insert(schema.questions)
    .values({ surveyId: survey.id, position: 40, type: 'open', text: 'Q4 open (opt)', isRequired: false })
    .returning()

  return { survey, q1, q1o1, q1o2, q2, q2o1, q2o2, q2o3, q3, q3r1, q3r2, q4 }
}

// ── Import the action under test ──────────────────────────────────────────────

// NOTE: submitSurvey is a Next.js Server Action.
// We test the core logic by importing from the module directly.
// DATABASE_URL is set to TEST_DATABASE_URL via vitest.config.ts `env` so
// @/db/index.ts picks the test DB at module load time.

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('submitSurvey: happy path', () => {
  it('inserts one response + all answer rows atomically', async () => {
    const { survey, q1, q1o1, q2, q2o1, q2o2, q3, q3r1, q3r2 } = await insertFixtureSurvey('happy')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      answers: [
        { questionId: q1.id, optionIds: [q1o1.id] },
        { questionId: q2.id, optionIds: [q2o1.id, q2o2.id] },
        { questionId: q3.id, scaleValues: { [q3r1.id]: 4, [q3r2.id]: 5 } },
        // Q4 optional — omitted entirely
      ],
    })

    expect(result.ok).toBe(true)

    // Assert one response row exists
    const respRows = await db.select().from(schema.responses).where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(1)

    // Assert 3 answer rows (Q4 omitted — no text)
    const ansRows = await db.select().from(schema.answers).where(eq(schema.answers.responseId, respRows[0].id))
    expect(ansRows).toHaveLength(3)
  })

  it('omits answer row for empty optional open question', async () => {
    const { survey, q1, q1o1, q2, q2o1, q3, q3r1, q3r2, q4 } = await insertFixtureSurvey('happy-open')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      answers: [
        { questionId: q1.id, optionIds: [q1o1.id] },
        { questionId: q2.id, optionIds: [q2o1.id] },
        { questionId: q3.id, scaleValues: { [q3r1.id]: 3, [q3r2.id]: 2 } },
        { questionId: q4.id, textValue: '   ' }, // whitespace-only → skip
      ],
    })

    expect(result.ok).toBe(true)

    const respRows = await db.select().from(schema.responses).where(eq(schema.responses.surveyId, survey.id))
    const ansRows = await db.select().from(schema.answers).where(eq(schema.answers.responseId, respRows[0].id))
    // 3 required questions answered; Q4 whitespace-only → no row
    expect(ansRows).toHaveLength(3)
  })
})

describe('submitSurvey: validation rejection — no DB rows on failure', () => {
  it('rejects missing required answer (single question) with errors', async () => {
    const { survey, q2, q2o1, q3, q3r1, q3r2 } = await insertFixtureSurvey('missing-required')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      answers: [
        // Q1 (single, required) is missing entirely
        { questionId: q2.id, optionIds: [q2o1.id] },
        { questionId: q3.id, scaleValues: { [q3r1.id]: 1, [q3r2.id]: 2 } },
      ],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toBeDefined()
    }

    // No response rows should exist
    const respRows = await db.select().from(schema.responses).where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(0)
  })

  it('rejects over-cap multi selection with errors', async () => {
    const { survey, q1, q1o1, q2, q2o1, q2o2, q2o3, q3, q3r1, q3r2 } = await insertFixtureSurvey('overcap')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      answers: [
        { questionId: q1.id, optionIds: [q1o1.id] },
        // Q2 has maxSelect=2 but we send 3
        { questionId: q2.id, optionIds: [q2o1.id, q2o2.id, q2o3.id] },
        { questionId: q3.id, scaleValues: { [q3r1.id]: 1, [q3r2.id]: 2 } },
      ],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[q2.id]).toMatch(/maximum/i)
    }

    // No response rows
    const respRows = await db.select().from(schema.responses).where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(0)
  })

  it('rejects cross-survey option id with errors', async () => {
    const { survey, q1, q2, q2o1, q3, q3r1, q3r2 } = await insertFixtureSurvey('cross-survey-a')
    const other = await insertFixtureSurvey('cross-survey-b')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      answers: [
        // Use an option id from a different survey's question
        { questionId: q1.id, optionIds: [other.q1o1.id] },
        { questionId: q2.id, optionIds: [q2o1.id] },
        { questionId: q3.id, scaleValues: { [q3r1.id]: 1, [q3r2.id]: 2 } },
      ],
    })

    expect(result.ok).toBe(false)

    const respRows = await db.select().from(schema.responses).where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(0)
  })

  it('rejects incomplete scale (missing a row) with errors', async () => {
    const { survey, q1, q1o1, q2, q2o1, q3, q3r1 } = await insertFixtureSurvey('incomplete-scale')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      answers: [
        { questionId: q1.id, optionIds: [q1o1.id] },
        { questionId: q2.id, optionIds: [q2o1.id] },
        // Q3 scale has 2 rows but we only rate one
        { questionId: q3.id, scaleValues: { [q3r1.id]: 3 } },
      ],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[q3.id]).toBeDefined()
    }

    const respRows = await db.select().from(schema.responses).where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(0)
  })
})
