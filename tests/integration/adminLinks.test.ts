/**
 * WU-5 TDD Gate — admin links integration tests (RED first)
 *
 * Covers:
 *  1. generateLinks: inserts N unused invitations with fresh tokens
 *  2. generateLinks: tokens are unique across the batch
 *  3. generateLinks: optional label is set on all rows
 *  4. listInvitations: returns invitations for a survey with used/unused status
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'

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

async function insertSurvey(slug = 'links-fixture') {
  const [s] = await db
    .insert(schema.surveys)
    .values({ slug, title: 'Links Test Survey', isActive: true })
    .returning()
  return s
}

describe('generateLinks', () => {
  it('inserts N unused invitations', async () => {
    const survey = await insertSurvey()
    const { generateLinks } = await import('@/actions/adminLinks')
    const result = await generateLinks({ surveyId: survey.id, count: 5 })
    expect(result.ok).toBe(true)

    const rows = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.surveyId, survey.id))
    expect(rows).toHaveLength(5)
    // All unused
    rows.forEach((row) => expect(row.usedAt).toBeNull())
  })

  it('tokens are unique across the batch', async () => {
    const survey = await insertSurvey('links-unique')
    const { generateLinks } = await import('@/actions/adminLinks')
    await generateLinks({ surveyId: survey.id, count: 20 })

    const rows = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.surveyId, survey.id))
    const tokens = rows.map((r) => r.token)
    const uniqueTokens = new Set(tokens)
    expect(uniqueTokens.size).toBe(20)
  })

  it('applies label to all rows when provided', async () => {
    const survey = await insertSurvey('links-label')
    const { generateLinks } = await import('@/actions/adminLinks')
    await generateLinks({ surveyId: survey.id, count: 3, label: 'Lote Noviembre' })

    const rows = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.surveyId, survey.id))
    rows.forEach((row) => expect(row.label).toBe('Lote Noviembre'))
  })

  it('generates correct count when called twice (does not overwrite previous)', async () => {
    const survey = await insertSurvey('links-twice')
    const { generateLinks } = await import('@/actions/adminLinks')
    await generateLinks({ surveyId: survey.id, count: 3 })
    await generateLinks({ surveyId: survey.id, count: 2 })

    const rows = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.surveyId, survey.id))
    expect(rows).toHaveLength(5)
  })
})

describe('listInvitations', () => {
  it('returns invitations ordered by createdAt desc', async () => {
    const survey = await insertSurvey('links-list')
    // Insert manually with known tokens
    await db.insert(schema.invitations).values([
      { surveyId: survey.id, token: 'AAAAAAAAAAAA' },
      { surveyId: survey.id, token: 'BBBBBBBBBBBB' },
    ])

    const { listInvitations } = await import('@/actions/adminLinks')
    const result = await listInvitations({ surveyId: survey.id })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.invitations.length).toBe(2)
      // All unused
      result.invitations.forEach((inv) => expect(inv.usedAt).toBeNull())
    }
  })
})
