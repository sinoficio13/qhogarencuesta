'use server'

/**
 * Admin server actions — marca de agua por encuesta.
 *
 * Guard: requireAdminAction() PRIMERO en cada action (defensa CVE-2025-29927).
 * Upload: Vercel Blob (put server-side). Requiere BLOB_READ_WRITE_TOKEN en el
 * entorno. Las imágenes son chicas (<100 KB), por eso put() server-side alcanza
 * sin necesidad del flujo client-upload (handleUpload).
 */

import 'server-only'
import { put, del } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { surveys } from '@/db/schema'
import { requireAdminAction } from '@/lib/auth/requireAdmin'
import { isWatermarkStyle, validateWatermarkImage } from '@/lib/validation/crud'
import type { ActionResult } from './adminSurveys'

function revalidateSurvey(surveyId: string) {
  revalidatePath(`/admin/${surveyId}/ajustes`)
  revalidatePath(`/admin/${surveyId}/preview`)
  revalidatePath('/admin')
}

// ── uploadWatermarkImage ────────────────────────────────────────────────────────

export async function uploadWatermarkImage(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  await requireAdminAction()

  const surveyId = formData.get('surveyId')
  const file = formData.get('file')

  if (typeof surveyId !== 'string' || !surveyId) {
    return { ok: false, errors: { surveyId: 'Falta la encuesta.' } }
  }
  if (!(file instanceof File)) {
    return { ok: false, errors: { file: 'Adjuntá una imagen.' } }
  }

  const check = validateWatermarkImage({ type: file.type, size: file.size })
  if (!check.ok) {
    return { ok: false, errors: { file: check.error } }
  }

  // Best-effort: borrar la imagen anterior para no dejar blobs huérfanos.
  const [current] = await db
    .select({ watermarkImage: surveys.watermarkImage })
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)

  const blob = await put(`watermarks/${surveyId}`, file, {
    access: 'public',
    addRandomSuffix: true,
  })

  await db
    .update(surveys)
    .set({ watermarkImage: blob.url })
    .where(eq(surveys.id, surveyId))

  if (current?.watermarkImage) {
    try {
      await del(current.watermarkImage)
    } catch {
      // huérfano tolerable — no romper el guardado por un borrado fallido
    }
  }

  revalidateSurvey(surveyId)
  return { ok: true, url: blob.url }
}

// ── setWatermarkStyle ───────────────────────────────────────────────────────────

export async function setWatermarkStyle(input: {
  surveyId: string
  style: string
}): Promise<ActionResult<{ style: string }>> {
  await requireAdminAction()

  if (!isWatermarkStyle(input.style)) {
    return { ok: false, errors: { style: 'Patrón inválido.' } }
  }

  await db
    .update(surveys)
    .set({ watermarkStyle: input.style })
    .where(eq(surveys.id, input.surveyId))

  revalidateSurvey(input.surveyId)
  return { ok: true, style: input.style }
}

// ── removeWatermarkImage ────────────────────────────────────────────────────────

export async function removeWatermarkImage(input: {
  surveyId: string
}): Promise<ActionResult<Record<never, never>>> {
  await requireAdminAction()

  const [current] = await db
    .select({ watermarkImage: surveys.watermarkImage })
    .from(surveys)
    .where(eq(surveys.id, input.surveyId))
    .limit(1)

  await db
    .update(surveys)
    .set({ watermarkImage: null })
    .where(eq(surveys.id, input.surveyId))

  if (current?.watermarkImage) {
    try {
      await del(current.watermarkImage)
    } catch {
      // ignore
    }
  }

  revalidateSurvey(input.surveyId)
  return { ok: true }
}
