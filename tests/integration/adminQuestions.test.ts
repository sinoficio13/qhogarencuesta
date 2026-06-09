/**
 * WU-5 TDD Gate — admin questions integration tests (RED first)
 *
 * Covers:
 *  1. createQuestion: assigns position via computeNextPosition
 *  2. updateQuestion: updates text/hint fields
 *  3. updateQuestion: CANNOT change type if question has answers (guardTypeChange)
 *  4. updateQuestion: CAN change type if question has NO answers
 *  5. deleteQuestion: removes question and cascades to options
 *  6. reorderQuestions: persists gap-based positions (10, 20, 30, …)
 *  7. addOption / removeOption / reorderOptions
 *  8. addScaleRow: sanitizes labelHtml
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import * as schema from '@/db/schema'
import { eq, and } from 'drizzle-orm'

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

// ── Fixture ───────────────────────────────────────────────────────────────────

async function insertSurvey(slug = 'q-fixture') {
  const [s] = await db
    .insert(schema.surveys)
    .values({ slug, title: 'Q Fixture Survey', isActive: true })
    .returning()
  return s
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createQuestion', () => {
  it('assigns next position (first question gets 10)', async () => {
    const survey = await insertSurvey()
    const { createQuestion } = await import('@/actions/adminQuestions')
    const result = await createQuestion({
      surveyId: survey.id,
      type: 'open',
      text: 'What do you think?',
      isRequired: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.question.position).toBe(10)
    }
  })

  it('assigns position after existing questions', async () => {
    const survey = await insertSurvey('q-pos-after')
    await db.insert(schema.questions).values([
      { surveyId: survey.id, position: 10, type: 'open', text: 'Q1', isRequired: true },
      { surveyId: survey.id, position: 20, type: 'open', text: 'Q2', isRequired: true },
    ])
    const { createQuestion } = await import('@/actions/adminQuestions')
    const result = await createQuestion({
      surveyId: survey.id,
      type: 'open',
      text: 'Q3',
      isRequired: false,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.question.position).toBe(30)
    }
  })
})

describe('updateQuestion', () => {
  it('updates text and hint', async () => {
    const survey = await insertSurvey('q-update')
    const [q] = await db
      .insert(schema.questions)
      .values({ surveyId: survey.id, position: 10, type: 'open', text: 'Original', isRequired: true })
      .returning()

    const { updateQuestion } = await import('@/actions/adminQuestions')
    const result = await updateQuestion({ id: q.id, text: 'Updated', hint: 'New hint' })
    expect(result.ok).toBe(true)

    const [updated] = await db.select().from(schema.questions).where(eq(schema.questions.id, q.id))
    expect(updated.text).toBe('Updated')
    expect(updated.hint).toBe('New hint')
  })

  it('BLOCKS type change when question has answers', async () => {
    const survey = await insertSurvey('q-guard-block')
    const [q] = await db
      .insert(schema.questions)
      .values({ surveyId: survey.id, position: 10, type: 'open', text: 'Open Q', isRequired: true })
      .returning()
    // Insert a response + answer to this question
    const [resp] = await db.insert(schema.responses).values({ surveyId: survey.id }).returning()
    await db.insert(schema.answers).values({
      responseId: resp.id,
      questionId: q.id,
      textValue: 'Some answer',
    })

    const { updateQuestion } = await import('@/actions/adminQuestions')
    const result = await updateQuestion({ id: q.id, type: 'single' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.type).toBeDefined()
    }
  })

  it('ALLOWS type change when question has NO answers', async () => {
    const survey = await insertSurvey('q-guard-allow')
    const [q] = await db
      .insert(schema.questions)
      .values({ surveyId: survey.id, position: 10, type: 'open', text: 'Open Q', isRequired: true })
      .returning()

    const { updateQuestion } = await import('@/actions/adminQuestions')
    // Note: changing from open to single requires no options — just validates guard
    // The DB check on maxSelect won't be triggered since type=single has no maxSelect constraint
    const result = await updateQuestion({ id: q.id, type: 'single' })
    // Should succeed (no answers exist)
    expect(result.ok).toBe(true)
  })
})

describe('deleteQuestion', () => {
  it('removes question and cascades to options', async () => {
    const survey = await insertSurvey('q-del')
    const [q] = await db
      .insert(schema.questions)
      .values({ surveyId: survey.id, position: 10, type: 'single', text: 'Q1', isRequired: true })
      .returning()
    await db.insert(schema.options).values({ questionId: q.id, position: 10, text: 'Opt A' })

    const { deleteQuestion } = await import('@/actions/adminQuestions')
    const result = await deleteQuestion({ id: q.id })
    expect(result.ok).toBe(true)

    const qs = await db.select().from(schema.questions).where(eq(schema.questions.id, q.id))
    expect(qs).toHaveLength(0)

    const opts = await db.select().from(schema.options).where(eq(schema.options.questionId, q.id))
    expect(opts).toHaveLength(0)
  })
})

describe('reorderQuestions', () => {
  it('persists gap-based positions (10, 20, 30, …) in new order', async () => {
    const survey = await insertSurvey('q-reorder')
    const [q1] = await db.insert(schema.questions).values({ surveyId: survey.id, position: 10, type: 'open', text: 'A', isRequired: true }).returning()
    const [q2] = await db.insert(schema.questions).values({ surveyId: survey.id, position: 20, type: 'open', text: 'B', isRequired: true }).returning()
    const [q3] = await db.insert(schema.questions).values({ surveyId: survey.id, position: 30, type: 'open', text: 'C', isRequired: true }).returning()

    const { reorderQuestions } = await import('@/actions/adminQuestions')
    // Reverse the order: C, A, B
    const result = await reorderQuestions({ surveyId: survey.id, orderedIds: [q3.id, q1.id, q2.id] })
    expect(result.ok).toBe(true)

    const rows = await db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.surveyId, survey.id))
      .orderBy(schema.questions.position)

    expect(rows[0].id).toBe(q3.id)
    expect(rows[0].position).toBe(10)
    expect(rows[1].id).toBe(q1.id)
    expect(rows[1].position).toBe(20)
    expect(rows[2].id).toBe(q2.id)
    expect(rows[2].position).toBe(30)
  })
})

describe('addOption / removeOption / reorderOptions', () => {
  it('adds option with next position', async () => {
    const survey = await insertSurvey('opt-add')
    const [q] = await db.insert(schema.questions).values({ surveyId: survey.id, position: 10, type: 'single', text: 'Q1', isRequired: true }).returning()

    const { addOption } = await import('@/actions/adminQuestions')
    const r1 = await addOption({ questionId: q.id, text: 'First', isControl: false })
    expect(r1.ok).toBe(true)
    if (r1.ok) expect(r1.option.position).toBe(10)

    const r2 = await addOption({ questionId: q.id, text: 'Second', isControl: false })
    expect(r2.ok).toBe(true)
    if (r2.ok) expect(r2.option.position).toBe(20)
  })

  it('removes an option', async () => {
    const survey = await insertSurvey('opt-remove')
    const [q] = await db.insert(schema.questions).values({ surveyId: survey.id, position: 10, type: 'single', text: 'Q1', isRequired: true }).returning()
    const [opt] = await db.insert(schema.options).values({ questionId: q.id, position: 10, text: 'A' }).returning()

    const { removeOption } = await import('@/actions/adminQuestions')
    const result = await removeOption({ id: opt.id })
    expect(result.ok).toBe(true)

    const rows = await db.select().from(schema.options).where(eq(schema.options.id, opt.id))
    expect(rows).toHaveLength(0)
  })

  it('reorders options to gap-based positions', async () => {
    const survey = await insertSurvey('opt-reorder')
    const [q] = await db.insert(schema.questions).values({ surveyId: survey.id, position: 10, type: 'single', text: 'Q1', isRequired: true }).returning()
    const [o1] = await db.insert(schema.options).values({ questionId: q.id, position: 10, text: 'A' }).returning()
    const [o2] = await db.insert(schema.options).values({ questionId: q.id, position: 20, text: 'B' }).returning()
    const [o3] = await db.insert(schema.options).values({ questionId: q.id, position: 30, text: 'C' }).returning()

    const { reorderOptions } = await import('@/actions/adminQuestions')
    const result = await reorderOptions({ questionId: q.id, orderedIds: [o3.id, o1.id, o2.id] })
    expect(result.ok).toBe(true)

    const rows = await db.select().from(schema.options).where(eq(schema.options.questionId, q.id)).orderBy(schema.options.position)
    expect(rows[0].id).toBe(o3.id)
    expect(rows[0].position).toBe(10)
    expect(rows[1].id).toBe(o1.id)
    expect(rows[1].position).toBe(20)
    expect(rows[2].id).toBe(o2.id)
    expect(rows[2].position).toBe(30)
  })
})

describe('addScaleRow', () => {
  it('sanitizes labelHtml (strips script tags, keeps <b>)', async () => {
    const survey = await insertSurvey('scale-san')
    const [q] = await db.insert(schema.questions).values({ surveyId: survey.id, position: 10, type: 'scale', text: 'Scale Q', isRequired: true }).returning()

    const { addScaleRow } = await import('@/actions/adminQuestions')
    const result = await addScaleRow({
      questionId: q.id,
      labelHtml: '<b>Good</b><script>evil()</script>',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.scaleRow.labelHtml).not.toContain('<script>')
      expect(result.scaleRow.labelHtml).toContain('<b>Good</b>')
      expect(result.scaleRow.position).toBe(10)
    }
  })
})
