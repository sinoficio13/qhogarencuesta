/**
 * Identifier normalization, validation, and hashing for per-survey dedup.
 *
 * Design (PIVOT — replaces invitation token system):
 *  - Surveys configure identifierType: 'email' | 'cedula'
 *  - Respondents enter their identifier as the FIRST form field
 *  - The identifier is normalized, validated, then hashed (SHA-256 + pepper)
 *    before storage — raw identifier is NEVER persisted
 *
 * Hashing:
 *  - Uses Web Crypto subtle (Edge-safe — no Node 'crypto' import)
 *  - pepper = process.env.IDENTIFIER_PEPPER (required in production)
 *  - Input to SHA-256: pepper + ':' + type + ':' + normalized
 *    (type in the hash prefix prevents cross-type collisions)
 *  - Returns lowercase hex string (64 chars for SHA-256)
 *
 * PURE module — no DB imports, no framework deps.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type IdentifierType = 'email' | 'cedula'

export type ValidationOk = { ok: true }
export type ValidationFail = { ok: false; error: string }
export type IdentifierValidation = ValidationOk | ValidationFail

// ── Normalize ─────────────────────────────────────────────────────────────────

/**
 * Normalize a raw identifier before validation and hashing.
 *  - email: trim whitespace + lowercase
 *  - cedula: trim whitespace + remove all internal spaces
 */
export function normalizeIdentifier(type: IdentifierType, raw: string): string {
  if (type === 'email') {
    return raw.trim().toLowerCase()
  }
  // cedula: trim outer whitespace, remove all spaces
  return raw.trim().replace(/\s+/g, '')
}

// ── Validate ──────────────────────────────────────────────────────────────────

// Basic email regex: requires local-part + @ + domain with at least one dot
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validate a raw identifier (before normalization).
 * Validation is intentionally lenient for email to avoid rejecting valid addresses.
 *
 * Returns { ok: true } or { ok: false, error: '<Spanish message>' }.
 */
export function validateIdentifier(
  type: IdentifierType,
  raw: string,
): IdentifierValidation {
  const normalized = normalizeIdentifier(type, raw)

  if (type === 'email') {
    if (!normalized) {
      return { ok: false, error: 'El email es obligatorio.' }
    }
    if (!EMAIL_RE.test(normalized)) {
      return { ok: false, error: 'Ingresá un email válido (ej: nombre@dominio.com).' }
    }
    return { ok: true }
  }

  // cedula
  if (!normalized) {
    return { ok: false, error: 'La cédula es obligatoria.' }
  }
  if (normalized.length < 5) {
    return {
      ok: false,
      error: 'La cédula debe tener al menos 5 caracteres.',
    }
  }
  if (normalized.length > 20) {
    return {
      ok: false,
      error: 'La cédula no puede tener más de 20 caracteres.',
    }
  }
  return { ok: true }
}

// ── Hash ──────────────────────────────────────────────────────────────────────

/**
 * Hash an identifier using SHA-256 + pepper.
 *
 * Input to the hash: `${pepper}:${type}:${normalizedIdentifier}`
 * The type prefix ensures email and cedula hashes don't collide even if raw
 * values are the same string.
 *
 * @param type - 'email' | 'cedula'
 * @param raw - raw (unnormalized) identifier string from the user
 * @param pepper - defaults to process.env.IDENTIFIER_PEPPER
 * @returns lowercase hex SHA-256 digest (64 chars)
 */
export async function hashIdentifier(
  type: IdentifierType,
  raw: string,
  pepper = process.env.IDENTIFIER_PEPPER ?? 'dev-pepper',
): Promise<string> {
  const normalized = normalizeIdentifier(type, raw)
  const input = `${pepper}:${type}:${normalized}`

  const enc = new TextEncoder()
  const hashBuffer = await globalThis.crypto.subtle.digest(
    'SHA-256',
    enc.encode(input),
  )

  // Convert ArrayBuffer → lowercase hex string
  const hashArray = new Uint8Array(hashBuffer)
  let hex = ''
  for (let i = 0; i < hashArray.length; i++) {
    hex += hashArray[i].toString(16).padStart(2, '0')
  }
  return hex
}
