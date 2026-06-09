'use server'

/**
 * Admin server actions — question/option/scaleRow CRUD + reorder.
 *
 * Guard: requireAdminAction() FIRST on every action (CVE-2025-29927 defense).
 * Type-change guard: checks whether the question has answers; blocks if it does.
 * Position: gap-based (computeNextPosition / rebalancePositions from lib/position.ts).
 * Scale labelHtml: sanitized via lib/sanitize.ts.
 */

import 'server-only'
import { revalidatePath } from 'next/cache'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { questions, options, scaleRows, answers } from '@/db/schema'
import { requireAdminAction } from '@/lib/auth/requireAdmin'
import { guardTypeChange } from '@/lib/validation/crud'
import { computeNextPosition, rebalancePositions } from '@/lib/position'
import { sanitize } from '@/lib/sanitize'
import type { ActionResult } from './adminSurveys'

// ── createQuestion ────────────────────────────────────────────────────────────

export interface CreateQuestionInput {
  surveyId: string
  type: 'single' | 'multi' | 'scale' | 'open'
  text: string
  hint?: string
  hintWhy?: string
  isRequired: boolean
  maxSelect?: number
}

export async function createQuestion(
  input: CreateQuestionInput,
): Promise<ActionResult<{ question: typeof questions.$inferSelect }>> {
  await requireAdminAction()

  // Compute next position for this survey's questions
  const existing = await db
    .select({ position: questions.position })
    .from(questions)
    .where(eq(questions.surveyId, input.surveyId))

  const position = computeNextPosition(existing.map((r) => r.position))

  const [question] = await db
    .insert(questions)
    .values({
      surveyId: input.surveyId,
      type: input.type,
      text: input.text.trim(),
      hint: input.hint?.trim() ?? null,
      hintWhy: input.hintWhy?.trim() ?? null,
      isRequired: input.isRequired,
      maxSelect: input.maxSelect ?? null,
      position,
    })
    .returning()

  revalidatePath(`/admin/${input.surveyId}`)
  return { ok: true, question }
}

// ── updateQuestion ────────────────────────────────────────────────────────────

export interface UpdateQuestionInput {
  id: string
  text?: string
  hint?: string
  hintWhy?: string
  isRequired?: boolean
  maxSelect?: number | null
  type?: 'single' | 'multi' | 'scale' | 'open'
}

export async function updateQuestion(
  input: UpdateQuestionInput,
): Promise<ActionResult<{ question: typeof questions.$inferSelect }>> {
  await requireAdminAction()

  // If type change requested, check if question already has answers
  if (input.type !== undefined) {
    const [current] = await db
      .select({ type: questions.type, surveyId: questions.surveyId })
      .from(questions)
      .where(eq(questions.id, input.id))
      .limit(1)

    if (!current) {
      return { ok: false, errors: { id: 'Pregunta no encontrada.' } }
    }

    if (input.type !== current.type) {
      const hasAnswerRows = await db
        .select({ id: answers.id })
        .from(answers)
        .where(eq(answers.questionId, input.id))
        .limit(1)

      const guard = guardTypeChange({ hasAnswers: hasAnswerRows.length > 0 })
      if (!guard.ok) {
        return {
          ok: false,
          errors: {
            type: 'No se puede cambiar el tipo de pregunta: ya tiene respuestas registradas.',
          },
        }
      }
    }
  }

  const patch: Partial<typeof questions.$inferInsert> = {}
  if (input.text !== undefined) patch.text = input.text.trim()
  if (input.hint !== undefined) patch.hint = input.hint.trim()
  if (input.hintWhy !== undefined) patch.hintWhy = input.hintWhy.trim()
  if (input.isRequired !== undefined) patch.isRequired = input.isRequired
  if (input.maxSelect !== undefined) patch.maxSelect = input.maxSelect
  if (input.type !== undefined) patch.type = input.type

  if (Object.keys(patch).length === 0) {
    const [question] = await db.select().from(questions).where(eq(questions.id, input.id))
    return { ok: true, question }
  }

  const [question] = await db
    .update(questions)
    .set(patch)
    .where(eq(questions.id, input.id))
    .returning()

  // Revalidate the survey editor page
  revalidatePath(`/admin/${question.surveyId}`)
  return { ok: true, question }
}

// ── deleteQuestion ────────────────────────────────────────────────────────────

export interface DeleteQuestionInput {
  id: string
}

export async function deleteQuestion(
  input: DeleteQuestionInput,
): Promise<ActionResult<Record<never, never>>> {
  await requireAdminAction()

  const [q] = await db
    .select({ surveyId: questions.surveyId })
    .from(questions)
    .where(eq(questions.id, input.id))
    .limit(1)

  await db.delete(questions).where(eq(questions.id, input.id))

  if (q) revalidatePath(`/admin/${q.surveyId}`)
  return { ok: true }
}

// ── reorderQuestions ──────────────────────────────────────────────────────────

export interface ReorderQuestionsInput {
  surveyId: string
  orderedIds: string[]
}

export async function reorderQuestions(
  input: ReorderQuestionsInput,
): Promise<ActionResult<Record<never, never>>> {
  await requireAdminAction()

  const entries = rebalancePositions(input.orderedIds)

  // Update in one transaction using a two-pass approach to avoid unique constraint
  // violations during intermediate states: first shift all positions to high
  // temporary values (offset by 10000), then set the final gap-based positions.
  await db.transaction(async (tx) => {
    // Pass 1: shift to temporary positions to avoid constraint conflicts
    for (const { id, position } of entries) {
      await tx
        .update(questions)
        .set({ position: position + 10000 })
        .where(eq(questions.id, id))
    }
    // Pass 2: set final positions
    for (const { id, position } of entries) {
      await tx
        .update(questions)
        .set({ position })
        .where(eq(questions.id, id))
    }
  })

  revalidatePath(`/admin/${input.surveyId}`)
  return { ok: true }
}

// ── addOption ────────────────────────────────────────────────────────────────

export interface AddOptionInput {
  questionId: string
  text: string
  isControl: boolean
}

export async function addOption(
  input: AddOptionInput,
): Promise<ActionResult<{ option: typeof options.$inferSelect }>> {
  await requireAdminAction()

  const existing = await db
    .select({ position: options.position })
    .from(options)
    .where(eq(options.questionId, input.questionId))

  const position = computeNextPosition(existing.map((r) => r.position))

  const [option] = await db
    .insert(options)
    .values({
      questionId: input.questionId,
      text: input.text.trim(),
      isControl: input.isControl,
      position,
    })
    .returning()

  // Find surveyId to revalidate
  const [q] = await db
    .select({ surveyId: questions.surveyId })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1)
  if (q) revalidatePath(`/admin/${q.surveyId}`)

  return { ok: true, option }
}

// ── updateOption ──────────────────────────────────────────────────────────────

export interface UpdateOptionInput {
  id: string
  text?: string
  isControl?: boolean
}

export async function updateOption(
  input: UpdateOptionInput,
): Promise<ActionResult<{ option: typeof options.$inferSelect }>> {
  await requireAdminAction()

  const patch: Partial<typeof options.$inferInsert> = {}
  if (input.text !== undefined) patch.text = input.text.trim()
  if (input.isControl !== undefined) patch.isControl = input.isControl

  const [option] = await db
    .update(options)
    .set(patch)
    .where(eq(options.id, input.id))
    .returning()

  const [q] = await db
    .select({ surveyId: questions.surveyId })
    .from(questions)
    .where(eq(questions.id, option.questionId))
    .limit(1)
  if (q) revalidatePath(`/admin/${q.surveyId}`)

  return { ok: true, option }
}

// ── removeOption ──────────────────────────────────────────────────────────────

export interface RemoveOptionInput {
  id: string
}

export async function removeOption(
  input: RemoveOptionInput,
): Promise<ActionResult<Record<never, never>>> {
  await requireAdminAction()

  const [opt] = await db
    .select({ questionId: options.questionId })
    .from(options)
    .where(eq(options.id, input.id))
    .limit(1)

  await db.delete(options).where(eq(options.id, input.id))

  if (opt) {
    const [q] = await db
      .select({ surveyId: questions.surveyId })
      .from(questions)
      .where(eq(questions.id, opt.questionId))
      .limit(1)
    if (q) revalidatePath(`/admin/${q.surveyId}`)
  }

  return { ok: true }
}

// ── reorderOptions ────────────────────────────────────────────────────────────

export interface ReorderOptionsInput {
  questionId: string
  orderedIds: string[]
}

export async function reorderOptions(
  input: ReorderOptionsInput,
): Promise<ActionResult<Record<never, never>>> {
  await requireAdminAction()

  const entries = rebalancePositions(input.orderedIds)

  await db.transaction(async (tx) => {
    // Two-pass: avoid unique constraint violation during intermediate states
    for (const { id, position } of entries) {
      await tx.update(options).set({ position: position + 10000 }).where(eq(options.id, id))
    }
    for (const { id, position } of entries) {
      await tx.update(options).set({ position }).where(eq(options.id, id))
    }
  })

  const [q] = await db
    .select({ surveyId: questions.surveyId })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1)
  if (q) revalidatePath(`/admin/${q.surveyId}`)

  return { ok: true }
}

// ── addScaleRow ───────────────────────────────────────────────────────────────

export interface AddScaleRowInput {
  questionId: string
  labelHtml: string
}

export async function addScaleRow(
  input: AddScaleRowInput,
): Promise<ActionResult<{ scaleRow: typeof scaleRows.$inferSelect }>> {
  await requireAdminAction()

  const existing = await db
    .select({ position: scaleRows.position })
    .from(scaleRows)
    .where(eq(scaleRows.questionId, input.questionId))

  const position = computeNextPosition(existing.map((r) => r.position))
  const labelHtml = sanitize(input.labelHtml)

  const [scaleRow] = await db
    .insert(scaleRows)
    .values({
      questionId: input.questionId,
      labelHtml,
      position,
    })
    .returning()

  const [q] = await db
    .select({ surveyId: questions.surveyId })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1)
  if (q) revalidatePath(`/admin/${q.surveyId}`)

  return { ok: true, scaleRow }
}

// ── updateScaleRow ────────────────────────────────────────────────────────────

export interface UpdateScaleRowInput {
  id: string
  labelHtml: string
}

export async function updateScaleRow(
  input: UpdateScaleRowInput,
): Promise<ActionResult<{ scaleRow: typeof scaleRows.$inferSelect }>> {
  await requireAdminAction()

  const [scaleRow] = await db
    .update(scaleRows)
    .set({ labelHtml: sanitize(input.labelHtml) })
    .where(eq(scaleRows.id, input.id))
    .returning()

  const [q] = await db
    .select({ surveyId: questions.surveyId })
    .from(questions)
    .where(eq(questions.id, scaleRow.questionId))
    .limit(1)
  if (q) revalidatePath(`/admin/${q.surveyId}`)

  return { ok: true, scaleRow }
}

// ── removeScaleRow ────────────────────────────────────────────────────────────

export interface RemoveScaleRowInput {
  id: string
}

export async function removeScaleRow(
  input: RemoveScaleRowInput,
): Promise<ActionResult<Record<never, never>>> {
  await requireAdminAction()

  const [sr] = await db
    .select({ questionId: scaleRows.questionId })
    .from(scaleRows)
    .where(eq(scaleRows.id, input.id))
    .limit(1)

  await db.delete(scaleRows).where(eq(scaleRows.id, input.id))

  if (sr) {
    const [q] = await db
      .select({ surveyId: questions.surveyId })
      .from(questions)
      .where(eq(questions.id, sr.questionId))
      .limit(1)
    if (q) revalidatePath(`/admin/${q.surveyId}`)
  }

  return { ok: true }
}

// ── reorderScaleRows ──────────────────────────────────────────────────────────

export interface ReorderScaleRowsInput {
  questionId: string
  orderedIds: string[]
}

export async function reorderScaleRows(
  input: ReorderScaleRowsInput,
): Promise<ActionResult<Record<never, never>>> {
  await requireAdminAction()

  const entries = rebalancePositions(input.orderedIds)

  await db.transaction(async (tx) => {
    // Two-pass: avoid unique constraint violation during intermediate states
    for (const { id, position } of entries) {
      await tx.update(scaleRows).set({ position: position + 10000 }).where(eq(scaleRows.id, id))
    }
    for (const { id, position } of entries) {
      await tx.update(scaleRows).set({ position }).where(eq(scaleRows.id, id))
    }
  })

  const [q] = await db
    .select({ surveyId: questions.surveyId })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1)
  if (q) revalidatePath(`/admin/${q.surveyId}`)

  return { ok: true }
}
