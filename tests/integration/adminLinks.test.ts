/**
 * Admin links integration tests — PIVOT to identifier-based dedup.
 *
 * The invitation/token system was retired. This file now tests
 * getShareInfo which returns the public URL and response count for a survey.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import * as schema from '@/db/schema'

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
    TRUNCATE TABLE answers, responses, scale_rows, options, questions, surveys
    RESTART IDENTITY CASCADE
  `)
})

async function insertSurvey(slug = 'share-fixture') {
  const [s] = await db
    .insert(schema.surveys)
    .values({ slug, title: 'Share Test Survey', isActive: true })
    .returning()
  return s
}

describe('getShareInfo', () => {
  it('returns ok:true with slug, publicUrl, and responseCount 0 for a new survey', async () => {
    const survey = await insertSurvey('share-info-empty')
    const { getShareInfo } = await import('@/actions/adminLinks')
    const result = await getShareInfo({ surveyId: survey.id })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.slug).toBe('share-info-empty')
      expect(result.publicUrl).toContain('/share-info-empty')
      expect(result.responseCount).toBe(0)
    }
  })

  it('returns updated responseCount after responses are inserted', async () => {
    const survey = await insertSurvey('share-info-count')
    // Insert 2 responses directly
    await db.insert(schema.responses).values([
      { surveyId: survey.id, identifierHash: 'aaaaaa' + '0'.repeat(58) },
      { surveyId: survey.id, identifierHash: 'bbbbbb' + '0'.repeat(58) },
    ])

    const { getShareInfo } = await import('@/actions/adminLinks')
    const result = await getShareInfo({ surveyId: survey.id })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.responseCount).toBe(2)
    }
  })

  it('returns ok:false for a non-existent survey id', async () => {
    const { getShareInfo } = await import('@/actions/adminLinks')
    const result = await getShareInfo({ surveyId: '00000000-0000-0000-0000-000000000000' })

    expect(result.ok).toBe(false)
  })
})
