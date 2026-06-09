/**
 * WU-5 TDD Gate — invitation token integration tests (dedup slice)
 *
 * Written FIRST (RED) before schema migration, submitSurvey rework, or
 * /r/[token] route exists.
 * Runs against TEST_DATABASE_URL (local docker postgres:16, qhogar_test).
 *
 * Covers:
 *  1. Submit via valid token: succeeds, marks invitation.used_at, sets
 *     responses.invitation_id, inserts all answer rows.
 *  2. Second submit with the same token: rejected (0 new response rows).
 *  3. Invalid token (does not exist): rejected, no response saved.
 *  4. Token from a different survey: rejected even if token itself is valid,
 *     no response saved.
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
let db: ReturnType<typeof drizzle<typeof schema>>

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DB_URL })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
}, 30_000)

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  // Clean all tables with CASCADE to handle all FK constraints in one shot.
  // This avoids FK ordering issues across test files sharing the same singleFork.
  // TRUNCATE ... CASCADE is the safest cleanup strategy for integration tests.
  await pool.query(`
    TRUNCATE TABLE answers, responses, invitations, scale_rows, options, questions, surveys
    RESTART IDENTITY CASCADE
  `)
})

// ── Fixture ───────────────────────────────────────────────────────────────────

async function insertFixtureSurvey(slug = 'token-fixture') {
  const [survey] = await db
    .insert(schema.surveys)
    .values({ slug, title: 'Token Fixture Survey', isActive: true })
    .returning()

  const [q1] = await db
    .insert(schema.questions)
    .values({ surveyId: survey.id, position: 10, type: 'single', text: 'Q1', isRequired: true })
    .returning()

  const [opt] = await db
    .insert(schema.options)
    .values({ questionId: q1.id, position: 10, text: 'Option A' })
    .returning()

  return { survey, q1, opt }
}

async function insertInvitation(surveyId: string, token = 'TESTTOKEN12') {
  const [inv] = await db
    .insert(schema.invitations)
    .values({ surveyId, token })
    .returning()
  return inv
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('submitSurvey with token: happy path', () => {
  it('valid token: succeeds, marks used_at, sets invitationId, inserts answer', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('tok-happy')
    const inv = await insertInvitation(survey.id, 'HAPPYTOKEN1')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      token: inv.token,
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })

    expect(result.ok).toBe(true)

    // Invitation is now marked used
    const [updatedInv] = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.id, inv.id))
    expect(updatedInv.usedAt).not.toBeNull()

    // Response exists with invitationId set
    const respRows = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(1)
    expect(respRows[0].invitationId).toBe(inv.id)

    // Answer row exists
    const ansRows = await db
      .select()
      .from(schema.answers)
      .where(eq(schema.answers.responseId, respRows[0].id))
    expect(ansRows).toHaveLength(1)
  })
})

describe('submitSurvey with token: rejection cases', () => {
  it('second submit with same token: rejected, no extra response saved', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('tok-second')
    const inv = await insertInvitation(survey.id, 'SECONDTOKEN')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    // First submit — should succeed
    const first = await submitSurvey({
      surveyId: survey.id,
      token: inv.token,
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })
    expect(first.ok).toBe(true)

    // Second submit with the same token — should be rejected
    const second = await submitSurvey({
      surveyId: survey.id,
      token: inv.token,
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.errors._token).toBeDefined()
    }

    // Only one response in total
    const respRows = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(1)
  })

  it('invalid token (does not exist): rejected, no response saved', async () => {
    const { survey, q1, opt } = await insertFixtureSurvey('tok-invalid')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    const result = await submitSurvey({
      surveyId: survey.id,
      token: 'NONEXISTENT9',
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors._token).toBeDefined()
    }

    // No response saved
    const respRows = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.surveyId, survey.id))
    expect(respRows).toHaveLength(0)
  })

  it('token from a different survey: rejected, no response saved', async () => {
    const { survey: surveyA, q1, opt } = await insertFixtureSurvey('tok-surveyA')
    const { survey: surveyB } = await insertFixtureSurvey('tok-surveyB')

    // Invitation belongs to surveyB
    const inv = await insertInvitation(surveyB.id, 'CROSSSURVEY1')

    const { submitSurvey } = await import('@/actions/submitSurvey')

    // Try to submit to surveyA using surveyB's token
    const result = await submitSurvey({
      surveyId: surveyA.id,
      token: inv.token,
      answers: [{ questionId: q1.id, optionIds: [opt.id] }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors._token).toBeDefined()
    }

    // No response for surveyA
    const respRows = await db
      .select()
      .from(schema.responses)
      .where(eq(schema.responses.surveyId, surveyA.id))
    expect(respRows).toHaveLength(0)
  })
})
