/**
 * TDD Gate — submitSurvey dedup integration tests (PIVOT: identifier-based dedup)
 *
 * Written FIRST (RED) before new schema migration or submitSurvey rework exists.
 * Runs against TEST_DATABASE_URL (local docker postgres:16, qhogar_test).
 *
 * Covers:
 *  1. Happy path: valid email identifier → response inserted with identifier_hash set
 *  2. Same email (same normalized) → rejected with _identifier error (unique index)
 *  3. Different emails → both accepted (two separate responses)
 *  4. Invalid email format → rejected with _identifier error (no DB rows)
 *  5. Happy path: cedula survey → response inserted
 *  6. Same cedula → rejected
 *  7. Invalid cedula (too short) → rejected with _identifier error
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
  // Clean all tables with CASCADE
  await pool.query(`
    TRUNCATE TABLE answers, responses, scale_rows, options, questions, surveys
    RESTART IDENTITY CASCADE
  `)
})

// ── Fixture builder ───────────────────────────────────────────────────────────

async function insertFixtureSurvey(
  slug: string,
  identifierType: 'email' | 'cedula' = 'email',
) {
  const [survey] = await db
    .insert(schema.surveys)
    .values({
      slug,
      title: 'Dedup Fixture Survey',
      isActive: true,
      identifierType,
    })
    .returning()

  const [q1] = await db
    .insert(schema.questions)
    .values({
      surveyId: survey.id,
      position: 10,
      type: 'single',
      text: 'Q1',
      isRequired: true,
    })
    .returning()

  const [opt] = await db
    .insert(schema.options)
    .values({ questionId: q1.id, position: 10, text: 'Option A' })
    .returning()

  return { survey, q1, opt }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('submitSurvey dedup — email identifier type', () => {
  it('happy path: valid email → response inserted with identifierHash', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('dedup-email-happy')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      identifier: 'jose@example.com',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })

    expect(result.ok).toBe(true)

    const respRows = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(1)
    // identifierHash must be set (not null)
    expect(respRows[0].identifierHash).not.toBeNull()
    expect(typeof respRows[0].identifierHash).toBe('string')
    expect(respRows[0].identifierHash!.length).toBe(64) // SHA-256 hex
  })

  it('second submit with same email → rejected with _identifier error, no extra response', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('dedup-email-second')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const first = await submitSurvey({
      surveyId: survey.id,
      identifier: 'jose@example.com',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })
    expect(first.ok).toBe(true)

    const second = await submitSurvey({
      surveyId: survey.id,
      identifier: 'jose@example.com',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.errors._identifier).toBeDefined()
      expect(second.errors._identifier).toMatch(/email/i)
    }

    // Only one response total
    const respRows = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(1)
  })

  it('same email in different case → treated as duplicate (normalized)', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('dedup-email-case')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    await submitSurvey({
      surveyId: survey.id,
      identifier: 'jose@example.com',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })

    const second = await submitSurvey({
      surveyId: survey.id,
      identifier: 'JOSE@EXAMPLE.COM',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.errors._identifier).toBeDefined()
    }
  })

  it('different emails → both accepted (two separate responses)', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('dedup-email-different')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const r1 = await submitSurvey({
      surveyId: survey.id,
      identifier: 'alice@example.com',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })
    expect(r1.ok).toBe(true)

    const r2 = await submitSurvey({
      surveyId: survey.id,
      identifier: 'bob@example.com',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })
    expect(r2.ok).toBe(true)

    const respRows = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(2)
  })

  it('invalid email format → rejected with _identifier error, no response saved', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('dedup-email-invalid')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      identifier: 'notanemail',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors._identifier).toBeDefined()
    }

    const respRows = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(0)
  })
})

describe('submitSurvey dedup — cedula identifier type', () => {
  it('happy path: valid cedula → response inserted', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('dedup-cedula-happy', 'cedula')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      identifier: 'AB12345',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })

    expect(result.ok).toBe(true)

    const respRows = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(1)
    expect(respRows[0].identifierHash).not.toBeNull()
  })

  it('same cedula → rejected with _identifier error mentioning cédula', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('dedup-cedula-second', 'cedula')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    await submitSurvey({
      surveyId: survey.id,
      identifier: 'AB12345',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })

    const second = await submitSurvey({
      surveyId: survey.id,
      identifier: 'AB12345',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.errors._identifier).toBeDefined()
      expect(second.errors._identifier).toMatch(/cédula/i)
    }
  })

  it('invalid cedula (too short) → rejected with _identifier error, no response saved', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('dedup-cedula-invalid', 'cedula')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      identifier: '123',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors._identifier).toBeDefined()
    }

    const respRows = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(0)
  })
})
