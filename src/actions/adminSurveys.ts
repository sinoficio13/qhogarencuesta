'use server'

/**
 * Admin server actions — survey CRUD.
 *
 * Guard: requireAdminAction() FIRST on every action (CVE-2025-29927 defense).
 * Slug: must be unique and URL-safe (slugified from raw input).
 * NoteHtml: sanitized via lib/sanitize.ts.
 *
 * All actions revalidate /admin so the list refreshes after mutations.
 */

import 'server-only'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { surveys } from '@/db/schema'
import { requireAdminAction } from '@/lib/auth/requireAdmin'
import { sanitize } from '@/lib/sanitize'
import { slugify } from '@/lib/slugify'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionOk<T> = { ok: true } & T
export type ActionError = { ok: false; errors: Record<string, string> }
export type ActionResult<T> = ActionOk<T> | ActionError

// ── createSurvey ──────────────────────────────────────────────────────────────

export interface CreateSurveyInput {
  title: string
  slug: string
  description?: string
  metaChips?: string[]
  noteHtml?: string
  identifierType?: 'email' | 'cedula'
  identifierLabel?: string
}

export async function createSurvey(
  input: CreateSurveyInput,
): Promise<ActionResult<{ survey: typeof surveys.$inferSelect }>> {
  await requireAdminAction()

  const slug = slugify(input.slug)
  if (!slug) {
    return { ok: false, errors: { slug: 'El slug no puede quedar vacío.' } }
  }

  // Check uniqueness before insert (to return a clean error, not a DB exception)
  const existing = await db
    .select({ id: surveys.id })
    .from(surveys)
    .where(eq(surveys.slug, slug))
    .limit(1)

  if (existing.length > 0) {
    return { ok: false, errors: { slug: `El slug "${slug}" ya existe. Elegí otro.` } }
  }

  const noteHtml = input.noteHtml ? sanitize(input.noteHtml) : null

  try {
    const [survey] = await db
      .insert(surveys)
      .values({
        title: input.title.trim(),
        slug,
        description: input.description?.trim() ?? null,
        metaChips: input.metaChips ?? null,
        noteHtml,
        identifierType: input.identifierType ?? 'email',
        identifierLabel: input.identifierLabel?.trim() || null,
      })
      .returning()

    revalidatePath('/admin')
    return { ok: true, survey }
  } catch (err) {
    // Unique constraint race (two concurrent creates) — surface as slug error
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { ok: false, errors: { slug: `El slug "${slug}" ya existe. Elegí otro.` } }
    }
    throw err
  }
}

// ── updateSurvey ──────────────────────────────────────────────────────────────

export interface UpdateSurveyInput {
  id: string
  title?: string
  slug?: string
  description?: string
  metaChips?: string[]
  noteHtml?: string
  identifierType?: 'email' | 'cedula'
  identifierLabel?: string
}

export async function updateSurvey(
  input: UpdateSurveyInput,
): Promise<ActionResult<{ survey: typeof surveys.$inferSelect }>> {
  await requireAdminAction()

  const patch: Partial<typeof surveys.$inferInsert> = {}

  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.description !== undefined) patch.description = input.description.trim()
  if (input.metaChips !== undefined) patch.metaChips = input.metaChips
  if (input.noteHtml !== undefined) patch.noteHtml = sanitize(input.noteHtml)
  if (input.identifierType !== undefined) patch.identifierType = input.identifierType
  if (input.identifierLabel !== undefined) patch.identifierLabel = input.identifierLabel?.trim() || null

  if (input.slug !== undefined) {
    const slug = slugify(input.slug)
    if (!slug) {
      return { ok: false, errors: { slug: 'El slug no puede quedar vacío.' } }
    }
    // Check uniqueness (excluding self)
    const existing = await db
      .select({ id: surveys.id })
      .from(surveys)
      .where(eq(surveys.slug, slug))
      .limit(1)
    if (existing.length > 0 && existing[0].id !== input.id) {
      return { ok: false, errors: { slug: `El slug "${slug}" ya existe. Elegí otro.` } }
    }
    patch.slug = slug
  }

  if (Object.keys(patch).length === 0) {
    // Nothing to update — fetch and return current
    const [survey] = await db.select().from(surveys).where(eq(surveys.id, input.id))
    return { ok: true, survey }
  }

  try {
    const [survey] = await db
      .update(surveys)
      .set(patch)
      .where(eq(surveys.id, input.id))
      .returning()

    revalidatePath('/admin')
    revalidatePath(`/admin/${input.id}`)
    return { ok: true, survey }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { ok: false, errors: { slug: 'El slug ya existe. Elegí otro.' } }
    }
    throw err
  }
}

// ── deleteSurvey ──────────────────────────────────────────────────────────────

export interface DeleteSurveyInput {
  id: string
}

export async function deleteSurvey(
  input: DeleteSurveyInput,
): Promise<ActionResult<Record<never, never>>> {
  await requireAdminAction()

  await db.delete(surveys).where(eq(surveys.id, input.id))

  revalidatePath('/admin')
  return { ok: true }
}

// ── toggleActive ──────────────────────────────────────────────────────────────

export interface ToggleActiveInput {
  id: string
}

export async function toggleActive(
  input: ToggleActiveInput,
): Promise<ActionResult<{ isActive: boolean }>> {
  await requireAdminAction()

  const [current] = await db
    .select({ isActive: surveys.isActive })
    .from(surveys)
    .where(eq(surveys.id, input.id))
    .limit(1)

  if (!current) {
    return { ok: false, errors: { id: 'Encuesta no encontrada.' } }
  }

  await db
    .update(surveys)
    .set({ isActive: !current.isActive })
    .where(eq(surveys.id, input.id))

  revalidatePath('/admin')
  return { ok: true, isActive: !current.isActive }
}
