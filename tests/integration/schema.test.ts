/**
 * WU-1 TDD Gate — schema integration tests (T-011 → T-017)
 *
 * Runs against TEST_DATABASE_URL (local docker postgres:16, qhogar_test db).
 * Uses node-postgres (pg) driver directly for raw constraint testing.
 *
 * RED first: these tests are written BEFORE schema.ts exists.
 * They will fail until T-012..T-016 are complete.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import * as schema from '@/db/schema'
import { sql } from 'drizzle-orm'

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://qhogar:qhogar@localhost:5432/qhogar_test'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DB_URL })
  db = drizzle(pool, { schema })

  // Apply migrations to the test DB
  await migrate(db, { migrationsFolder: './drizzle' })

  // Clean all tables with CASCADE (handles all FK constraints in one shot)
  await pool.query(`
    TRUNCATE TABLE answers, responses, invitations, scale_rows, options, questions, surveys
    RESTART IDENTITY CASCADE
  `)
}, 30_000)

afterAll(async () => {
  await pool.end()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function insertSurvey(slug = 'test-survey') {
  const [survey] = await db
    .insert(schema.surveys)
    .values({ slug, title: 'Test Survey' })
    .returning()
  return survey
}

async function insertQuestion(
  surveyId: string,
  position = 10,
  type: 'single' | 'multi' | 'scale' | 'open' = 'single'
) {
  const [question] = await db
    .insert(schema.questions)
    .values({ surveyId, position, type, text: 'Test Question' })
    .returning()
  return question
}

async function insertOption(questionId: string, position = 10) {
  const [option] = await db
    .insert(schema.options)
    .values({ questionId, position, text: 'Option A' })
    .returning()
  return option
}

async function insertResponse(surveyId: string) {
  const [response] = await db
    .insert(schema.responses)
    .values({ surveyId })
    .returning()
  return response
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('schema: happy path — survey → question → option insert', () => {
  it('inserts a survey, question, and option without errors', async () => {
    const survey = await insertSurvey('happy-path')
    expect(survey.id).toBeTruthy()
    expect(survey.slug).toBe('happy-path')

    const question = await insertQuestion(survey.id, 10, 'single')
    expect(question.id).toBeTruthy()
    expect(question.surveyId).toBe(survey.id)

    const option = await insertOption(question.id, 10)
    expect(option.id).toBeTruthy()
    expect(option.questionId).toBe(question.id)
  })

  it('inserts a response with a valid answer (optionIds only)', async () => {
    const survey = await insertSurvey('answer-happy')
    const question = await insertQuestion(survey.id, 10, 'single')
    const option = await insertOption(question.id, 10)
    const response = await insertResponse(survey.id)

    const [answer] = await db
      .insert(schema.answers)
      .values({
        responseId: response.id,
        questionId: question.id,
        optionIds: [option.id],
        scaleValues: null,
        textValue: null,
      })
      .returning()

    expect(answer.id).toBeTruthy()
    expect(answer.optionIds).toEqual([option.id])
  })

  it('inserts a response with a valid answer (textValue only)', async () => {
    const survey = await insertSurvey('answer-text')
    const question = await insertQuestion(survey.id, 10, 'open')
    const response = await insertResponse(survey.id)

    const [answer] = await db
      .insert(schema.answers)
      .values({
        responseId: response.id,
        questionId: question.id,
        optionIds: null,
        scaleValues: null,
        textValue: 'Some open answer',
      })
      .returning()

    expect(answer.textValue).toBe('Some open answer')
  })
})

describe('schema: CHECK constraint — answers_one_of_chk', () => {
  it('rejects a row with BOTH optionIds AND textValue populated', async () => {
    const survey = await insertSurvey('chk-two-payloads')
    const question = await insertQuestion(survey.id, 10, 'single')
    const option = await insertOption(question.id, 10)
    const response = await insertResponse(survey.id)

    await expect(
      db.insert(schema.answers).values({
        responseId: response.id,
        questionId: question.id,
        optionIds: [option.id],
        scaleValues: null,
        textValue: 'should not be allowed with optionIds',
      })
    ).rejects.toThrow()
  })

  it('rejects a row with optionIds AND scaleValues both populated', async () => {
    const survey = await insertSurvey('chk-two-payloads-2')
    const question = await insertQuestion(survey.id, 10, 'scale')
    const option = await insertOption(question.id, 10)
    const response = await insertResponse(survey.id)

    await expect(
      db.insert(schema.answers).values({
        responseId: response.id,
        questionId: question.id,
        optionIds: [option.id],
        scaleValues: { row1: 3 },
        textValue: null,
      })
    ).rejects.toThrow()
  })

  it('rejects a row with ALL THREE payload columns NULL (zero count)', async () => {
    const survey = await insertSurvey('chk-zero-payloads')
    const question = await insertQuestion(survey.id, 10, 'open')
    const response = await insertResponse(survey.id)

    await expect(
      db.insert(schema.answers).values({
        responseId: response.id,
        questionId: question.id,
        optionIds: null,
        scaleValues: null,
        textValue: null,
      })
    ).rejects.toThrow()
  })
})

describe('schema: UNIQUE constraint — questions_survey_pos_uq', () => {
  it('rejects duplicate position within the same survey', async () => {
    const survey = await insertSurvey('pos-unique')

    await insertQuestion(survey.id, 10)

    await expect(
      db.insert(schema.questions).values({
        surveyId: survey.id,
        position: 10,
        type: 'multi',
        text: 'Duplicate position question',
      })
    ).rejects.toThrow()
  })

  it('allows same position in different surveys', async () => {
    const surveyA = await insertSurvey('pos-survey-a')
    const surveyB = await insertSurvey('pos-survey-b')

    await insertQuestion(surveyA.id, 10)
    const q2 = await insertQuestion(surveyB.id, 10)

    expect(q2.id).toBeTruthy()
  })
})
