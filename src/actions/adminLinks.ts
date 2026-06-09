'use server'

/**
 * Admin server actions — link sharing (PIVOT: single public link, no tokens).
 *
 * The invitation/token system was retired. This module now only exposes
 * getShareInfo to retrieve the public URL and response count for a survey.
 *
 * Guard: requireAdminAction() FIRST on every action (CVE-2025-29927 defense).
 */

import 'server-only'
import { eq, count } from 'drizzle-orm'
import { db } from '@/db'
import { surveys, responses } from '@/db/schema'
import { requireAdminAction } from '@/lib/auth/requireAdmin'
import type { ActionResult } from './adminSurveys'

// ── getShareInfo ──────────────────────────────────────────────────────────────

export interface ShareInfo {
  slug: string
  publicUrl: string
  responseCount: number
}

export async function getShareInfo(
  input: { surveyId: string },
): Promise<ActionResult<ShareInfo>> {
  await requireAdminAction()

  const [survey] = await db
    .select({ slug: surveys.slug })
    .from(surveys)
    .where(eq(surveys.id, input.surveyId))
    .limit(1)

  if (!survey) {
    return { ok: false, errors: { surveyId: 'Encuesta no encontrada.' } }
  }

  const [{ value: responseCount }] = await db
    .select({ value: count() })
    .from(responses)
    .where(eq(responses.surveyId, input.surveyId))

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const publicUrl = `${baseUrl}/${survey.slug}`

  return { ok: true, slug: survey.slug, publicUrl, responseCount }
}
