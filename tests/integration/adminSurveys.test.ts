/**
 * WU-5 TDD Gate — admin surveys integration tests (RED first)
 *
 * Covers:
 *  1. createSurvey: slug must be unique (duplicate rejected with clear error)
 *  2. createSurvey: slug is URL-safe (slugified from raw input)
 *  3. createSurvey: noteHtml is sanitized
 *  4. updateSurvey: updates title and description
 *  5. deleteSurvey: cascade-deletes questions/options
 *  6. toggleActive: flips isActive
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
  await pool.query(`
    TRUNCATE TABLE answers, responses, invitations, scale_rows, options, questions, surveys
    RESTART IDENTITY CASCADE
  `)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createSurvey', () => {
  it('creates a survey with valid slug', async () => {
    const { createSurvey } = await import('@/actions/adminSurveys')
    const result = await createSurvey({
      title: 'Mi Primera Encuesta',
      slug: 'mi-primera-encuesta',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.survey.slug).toBe('mi-primera-encuesta')
      expect(result.survey.title).toBe('Mi Primera Encuesta')
    }
  })

  it('rejects duplicate slug', async () => {
    const { createSurvey } = await import('@/actions/adminSurveys')
    // First insert succeeds
    await db.insert(schema.surveys).values({ slug: 'duplicado', title: 'Existing' })

    // Second insert with same slug should fail
    const result = await createSurvey({ title: 'Otro título', slug: 'duplicado' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.slug).toBeDefined()
    }
  })

  it('slugifies raw input (spaces → dashes, lowercase)', async () => {
    const { createSurvey } = await import('@/actions/adminSurveys')
    // Passing pre-slugified slug — slugify should normalize it
    const result = await createSurvey({
      title: 'Test Survey',
      slug: 'Test Survey With Spaces',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Should be lowercase and dashes
      expect(result.survey.slug).not.toContain(' ')
      expect(result.survey.slug).toBe(result.survey.slug.toLowerCase())
    }
  })

  it('sanitizes noteHtml (strips script tags)', async () => {
    const { createSurvey } = await import('@/actions/adminSurveys')
    const result = await createSurvey({
      title: 'Survey With Script',
      slug: 'survey-script',
      noteHtml: '<b>Bold</b><script>evil()</script>text',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.survey.noteHtml).not.toContain('<script>')
      expect(result.survey.noteHtml).toContain('<b>Bold</b>')
    }
  })
})

describe('updateSurvey', () => {
  it('updates title and description', async () => {
    const [survey] = await db
      .insert(schema.surveys)
      .values({ slug: 'update-test', title: 'Original' })
      .returning()

    const { updateSurvey } = await import('@/actions/adminSurveys')
    const result = await updateSurvey({
      id: survey.id,
      title: 'Updated Title',
      description: 'New description',
    })
    expect(result.ok).toBe(true)

    const [updated] = await db.select().from(schema.surveys).where(eq(schema.surveys.id, survey.id))
    expect(updated.title).toBe('Updated Title')
    expect(updated.description).toBe('New description')
  })
})

describe('deleteSurvey', () => {
  it('cascade-deletes questions and options', async () => {
    const [survey] = await db
      .insert(schema.surveys)
      .values({ slug: 'del-survey', title: 'To Delete' })
      .returning()
    const [question] = await db
      .insert(schema.questions)
      .values({ surveyId: survey.id, position: 10, type: 'single', text: 'Q1', isRequired: true })
      .returning()
    await db.insert(schema.options).values({ questionId: question.id, position: 10, text: 'Opt A' })

    const { deleteSurvey } = await import('@/actions/adminSurveys')
    const result = await deleteSurvey({ id: survey.id })
    expect(result.ok).toBe(true)

    const surveys = await db.select().from(schema.surveys).where(eq(schema.surveys.id, survey.id))
    expect(surveys).toHaveLength(0)

    const questions = await db.select().from(schema.questions).where(eq(schema.questions.surveyId, survey.id))
    expect(questions).toHaveLength(0)
  })
})

describe('toggleActive', () => {
  it('flips isActive from true to false and back', async () => {
    const [survey] = await db
      .insert(schema.surveys)
      .values({ slug: 'toggle-test', title: 'Toggle', isActive: true })
      .returning()

    const { toggleActive } = await import('@/actions/adminSurveys')
    await toggleActive({ id: survey.id })

    const [after] = await db.select().from(schema.surveys).where(eq(schema.surveys.id, survey.id))
    expect(after.isActive).toBe(false)

    await toggleActive({ id: survey.id })
    const [restored] = await db.select().from(schema.surveys).where(eq(schema.surveys.id, survey.id))
    expect(restored.isActive).toBe(true)
  })
})
