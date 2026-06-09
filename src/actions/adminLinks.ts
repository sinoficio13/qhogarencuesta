'use server'

/**
 * Admin server actions — invitation link generation + listing.
 *
 * Guard: requireAdminAction() FIRST on every action (CVE-2025-29927 defense).
 * Token: generated via lib/token.ts (URL-safe, 60-bit entropy).
 */

import 'server-only'
import { revalidatePath } from 'next/cache'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { invitations } from '@/db/schema'
import { requireAdminAction } from '@/lib/auth/requireAdmin'
import { generateToken } from '@/lib/token'
import type { ActionResult } from './adminSurveys'

// ── generateLinks ─────────────────────────────────────────────────────────────

export interface GenerateLinksInput {
  surveyId: string
  count: number
  label?: string
}

export async function generateLinks(
  input: GenerateLinksInput,
): Promise<ActionResult<{ count: number }>> {
  await requireAdminAction()

  if (input.count < 1 || input.count > 500) {
    return { ok: false, errors: { count: 'La cantidad debe estar entre 1 y 500.' } }
  }

  const rows = Array.from({ length: input.count }, () => ({
    surveyId: input.surveyId,
    token: generateToken(),
    label: input.label ?? null,
  }))

  await db.insert(invitations).values(rows)

  revalidatePath(`/admin/${input.surveyId}/links`)
  return { ok: true, count: input.count }
}

// ── listInvitations ───────────────────────────────────────────────────────────

export interface ListInvitationsInput {
  surveyId: string
}

export async function listInvitations(
  input: ListInvitationsInput,
): Promise<ActionResult<{ invitations: (typeof invitations.$inferSelect)[] }>> {
  await requireAdminAction()

  const rows = await db
    .select()
    .from(invitations)
    .where(eq(invitations.surveyId, input.surveyId))
    .orderBy(desc(invitations.createdAt))

  return { ok: true, invitations: rows }
}
