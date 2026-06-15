// PURE — no DB, no framework imports

// ── Type-change guard ──────────────────────────────────────────────────────────

export interface GuardTypeChangeInput {
  hasAnswers: boolean
}

export interface GuardOk {
  ok: true
}

export interface GuardError {
  ok: false
  error: string
}

export type GuardResult = GuardOk | GuardError

/**
 * Prevent changing the type of a question that already has answers.
 * The `hasAnswers` flag must be pre-computed by the caller (e.g. SELECT 1
 * FROM answers WHERE question_id = $1 LIMIT 1) — this function is pure.
 */
export function guardTypeChange(input: GuardTypeChangeInput): GuardResult {
  if (input.hasAnswers) {
    return {
      ok: false,
      error: 'Cannot change type: this question already has answered responses.',
    }
  }
  return { ok: true }
}

// ── Position reorder ───────────────────────────────────────────────────────────

export interface PositionEntry {
  id: string
  position: number
}

/**
 * Given an ordered list of ids, returns {id, position} pairs with positions
 * 10, 20, 30, … (gap-based, multiples of 10).
 * The caller is responsible for persisting these in a single transaction.
 */
export function reorderPositions(orderedIds: string[]): PositionEntry[] {
  return orderedIds.map((id, index) => ({
    id,
    position: (index + 1) * 10,
  }))
}

/**
 * Compute the next position for a new item at the end of a sibling list.
 * Returns max(existingPositions) + 10, or 10 if the list is empty.
 */
export function nextPosition(existingPositions: number[]): number {
  if (existingPositions.length === 0) return 10
  return Math.max(...existingPositions) + 10
}

// ── Watermark (marca de agua por encuesta) ──────────────────────────────────────

export const WATERMARK_STYLE_VALUES = ['none', 'centered', 'tiled', 'corner'] as const
export type WatermarkStyleValue = (typeof WATERMARK_STYLE_VALUES)[number]

/** True si el valor es un patrón de marca de agua válido. */
export function isWatermarkStyle(value: unknown): value is WatermarkStyleValue {
  return (
    typeof value === 'string' &&
    (WATERMARK_STYLE_VALUES as readonly string[]).includes(value)
  )
}

/** Tipos de imagen aceptados para la marca de agua. SVG queda excluido a propósito (XSS). */
export const WATERMARK_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const WATERMARK_MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export interface ImageMeta {
  type: string
  size: number
}

/**
 * Valida tipo y tamaño de un archivo de imagen para marca de agua. Puro:
 * el caller extrae {type, size} del File antes de llamar.
 */
export function validateWatermarkImage(meta: ImageMeta): GuardResult {
  if (!(WATERMARK_ALLOWED_TYPES as readonly string[]).includes(meta.type)) {
    return { ok: false, error: 'Formato no permitido. Usá PNG, JPG o WebP.' }
  }
  if (meta.size <= 0) {
    return { ok: false, error: 'El archivo está vacío.' }
  }
  if (meta.size > WATERMARK_MAX_BYTES) {
    return { ok: false, error: 'La imagen supera el máximo de 2 MB.' }
  }
  return { ok: true }
}
