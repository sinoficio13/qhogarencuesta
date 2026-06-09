/**
 * HMAC-SHA256 session token — runs on Edge runtime (Web Crypto only).
 * No Node 'crypto' import. Uses globalThis.crypto.subtle.
 *
 * Token format: base64url(payload_json) + '.' + base64url(hmac_bytes)
 * Payload: { iat: number (unix seconds), exp: number (unix seconds) }
 *
 * Session lifetime: 8 hours.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SessionPayload {
  iat: number
  exp: number
}

export type VerifyStatus = 'valid' | 'expired' | 'invalid'

export interface VerifyResult {
  status: VerifyStatus
  payload?: SessionPayload
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const SESSION_DURATION_S = 8 * 60 * 60 // 8 hours in seconds

function toBase64Url(bytes: Uint8Array): string {
  // Convert bytes → base64 → base64url
  let b64 = ''
  for (let i = 0; i < bytes.length; i++) {
    b64 += String.fromCharCode(bytes[i])
  }
  return btoa(b64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  // base64url → base64 → bytes
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i)
  }
  return bytes
}

async function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/**
 * Constant-time comparison of two Uint8Arrays.
 * Prevents timing attacks on HMAC comparison.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a signed session token.
 * @param secret  HMAC secret (reads ADMIN_SESSION_SECRET by default)
 * @param overrides  Optional payload override — used in tests for expired tokens
 */
export async function createSession(
  secret = process.env.ADMIN_SESSION_SECRET ?? '',
  overrides?: Partial<SessionPayload>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    iat: overrides?.iat ?? now,
    exp: overrides?.exp ?? now + SESSION_DURATION_S,
  }

  const enc = new TextEncoder()
  const payloadJson = JSON.stringify(payload)
  const payloadB64 = toBase64Url(enc.encode(payloadJson))

  const key = await importKey(secret)
  const sigBytes = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(payloadB64),
  )

  const sigB64 = toBase64Url(new Uint8Array(sigBytes))
  return `${payloadB64}.${sigB64}`
}

/**
 * Verify a session token.
 * Returns { status: 'valid' | 'expired' | 'invalid', payload? }.
 */
export async function verifySession(
  token: string,
  secret = process.env.ADMIN_SESSION_SECRET ?? '',
): Promise<VerifyResult> {
  try {
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1 || dotIndex === 0 || dotIndex === token.length - 1) {
      return { status: 'invalid' }
    }

    const payloadB64 = token.slice(0, dotIndex)
    const sigB64 = token.slice(dotIndex + 1)

    // Recompute expected HMAC
    const enc = new TextEncoder()
    const key = await importKey(secret)
    const expectedSigBytes = await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      enc.encode(payloadB64),
    )

    const expectedSig = new Uint8Array(expectedSigBytes)
    let receivedSig: Uint8Array
    try {
      receivedSig = fromBase64Url(sigB64)
    } catch {
      return { status: 'invalid' }
    }

    // Constant-time compare
    if (!timingSafeEqual(expectedSig, receivedSig)) {
      return { status: 'invalid' }
    }

    // Decode payload
    let payload: SessionPayload
    try {
      const payloadBytes = fromBase64Url(payloadB64)
      const payloadJson = new TextDecoder().decode(payloadBytes)
      payload = JSON.parse(payloadJson) as SessionPayload
    } catch {
      return { status: 'invalid' }
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp <= now) {
      return { status: 'expired', payload }
    }

    return { status: 'valid', payload }
  } catch {
    return { status: 'invalid' }
  }
}
