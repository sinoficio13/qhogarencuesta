/**
 * QHogar Encuestas — Drizzle schema
 *
 * Driver: drizzle-orm/pg-core (shared; adapter in src/db/index.ts picks
 * neon-http for production or node-postgres for local docker dev/test).
 *
 * Position strategy: gap-based multiples of 10.
 *   - Insert at end → max(position)+10
 *   - Reorder → rewrite full sibling set as 10,20,30,… in one tx
 *   - UNIQUE(parent,position) is always satisfied because the whole
 *     sibling set is rewritten atomically.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── surveys ─────────────────────────────────────────────────────────────────

export const surveys = pgTable('surveys', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  metaChips: jsonb('meta_chips').$type<string[]>(),
  noteHtml: text('note_html'), // sanitized on save
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ─── questions ────────────────────────────────────────────────────────────────

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    type: text('type', { enum: ['single', 'multi', 'scale', 'open'] }).notNull(),
    text: text('text').notNull(),
    hint: text('hint'),
    hintWhy: text('hint_why'),
    isRequired: boolean('is_required').notNull().default(true),
    maxSelect: integer('max_select'), // multi cap; NULL = unlimited
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('questions_survey_pos_uq').on(t.surveyId, t.position),
    index('questions_survey_idx').on(t.surveyId),
    check(
      'questions_type_chk',
      sql`${t.type} in ('single','multi','scale','open')`
    ),
    // maxSelect only meaningful for multi; non-positive rejected
    check(
      'questions_maxselect_chk',
      sql`${t.maxSelect} is null or (${t.type}='multi' and ${t.maxSelect} > 0)`
    ),
  ]
)

// ─── options ─────────────────────────────────────────────────────────────────

export const options = pgTable(
  'options',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    text: text('text').notNull(),
    isControl: boolean('is_control').notNull().default(false),
  },
  (t) => [
    uniqueIndex('options_q_pos_uq').on(t.questionId, t.position),
    index('options_q_idx').on(t.questionId),
  ]
)

// ─── scale_rows ───────────────────────────────────────────────────────────────

export const scaleRows = pgTable(
  'scale_rows',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    labelHtml: text('label_html').notNull(), // sanitized; <b> allowed
  },
  (t) => [
    uniqueIndex('scalerows_q_pos_uq').on(t.questionId, t.position),
    index('scalerows_q_idx').on(t.questionId),
  ]
)

// ─── responses ───────────────────────────────────────────────────────────────

export const responses = pgTable(
  'responses',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => surveys.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondentMeta: jsonb('respondent_meta').$type<Record<string, unknown>>(),
  },
  (t) => [index('responses_survey_idx').on(t.surveyId)]
)

// ─── answers ─────────────────────────────────────────────────────────────────

export const answers = pgTable(
  'answers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    responseId: uuid('response_id')
      .notNull()
      .references(() => responses.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    optionIds: uuid('option_ids').array(), // single/multi
    scaleValues: jsonb('scale_values').$type<Record<string, number>>(), // {rowId: 1..5}
    textValue: text('text_value'), // open
  },
  (t) => [
    index('answers_question_idx').on(t.questionId),
    index('answers_response_idx').on(t.responseId),
    // GIN index for = ANY / && queries on uuid arrays
    index('answers_optionids_gin').using('gin', t.optionIds),
    // Exactly ONE payload column must be populated (tightened from <= 1 in explore)
    check(
      'answers_one_of_chk',
      sql`(
        (${t.optionIds} is not null)::int +
        (${t.scaleValues} is not null)::int +
        (${t.textValue} is not null)::int
      ) = 1`
    ),
  ]
)
