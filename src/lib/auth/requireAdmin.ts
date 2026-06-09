/**
 * requireAdmin — defense-in-depth auth guard (CVE-2025-29927).
 *
 * Middleware alone is NOT sufficient; every admin Server Action and RSC page
 * MUST call requireAdmin() (or requireAdminAction()) as its first line.
 *
 * Exports:
 *   - checkAdminAccess(result)   — PURE: decides valid/invalid from VerifyResult (unit-testable)
 *   - checkPassword(submitted, expected) — PURE: constant-time compare (unit-testable)
 *   - requireAdmin()             — Server-side page guard: reads cookie, calls verifySession, redirects
 *   - requireAdminAction()       — Server Action guard: reads cookie, calls verifySession, throws on fail
 */

import 'server-only'

import type { VerifyResult } from './session'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AccessCheckResult =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'invalid' }

// ── Pure helpers (unit-testable — no framework deps) ──────────────────────────

/**
 * Pure decision function. Receives a VerifyResult (or null when no cookie)
 * and returns whether access should be granted.
 */
export function checkAdminAccess(result: VerifyResult | null): AccessCheckResult {
  if (!result) {
    return { ok: false, reason: 'invalid' }
  }
  if (result.status === 'valid') {
    return { ok: true }
  }
  if (result.status === 'expired') {
    return { ok: false, reason: 'expired' }
  }
  return { ok: false, reason: 'invalid' }
}

/**
 * Constant-time string comparison using Web Crypto HMAC.
 * Prevents timing attacks on password comparison.
 * Both args are hashed with the same key so the comparison is always
 * between two equal-length HMAC outputs.
 */
export async function checkPassword(
  submitted: string,
  expected: string,
): Promise<boolean> {
  const enc = new TextEncoder()
  // Use a fixed per-call random key — we just need timing-safe byte comparison
  const key = await globalThis.crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const [sigA, sigB] = await Promise.all([
    globalThis.crypto.subtle.sign('HMAC', key, enc.encode(submitted)),
    globalThis.crypto.subtle.sign('HMAC', key, enc.encode(expected)),
  ])
  const a = new Uint8Array(sigA)
  const b = new Uint8Array(sigB)
  // Both are 32 bytes (SHA-256 HMAC output) — constant-time compare
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

// ── Framework-dependent guards (use next/headers + next/navigation) ───────────

/**
 * Page guard — call at the top of every admin RSC layout/page.
 * On invalid/expired cookie: redirects to /admin/login (never returns).
 * On valid cookie: returns void (execution continues).
 */
export async function requireAdmin(): Promise<void> {
  // Dynamic import to keep pure helpers testable without mocking next/headers
  const { cookies } = await import('next/headers')
  const { redirect } = await import('next/navigation')
  const { verifySession } = await import('./session')

  const cookieStore = await cookies()
  const token = cookieStore.get('qh_admin')?.value ?? null

  const verifyResult = token ? await verifySession(token) : null
  const access = checkAdminAccess(verifyResult)

  if (!access.ok) {
    redirect('/admin/login')
  }
}

/**
 * Action guard — call as the first line of every admin Server Action.
 * Throws an Error (which Next.js surfaces as a 500) on invalid/expired cookie.
 * Use this form instead of requireAdmin() inside actions because redirect()
 * inside a Server Action will bubble up correctly, but an explicit throw
 * is also acceptable and clearer.
 *
 * Note: both redirect() and throw work inside actions in Next.js 15+.
 * We use redirect() here for consistency with the page guard.
 */
export async function requireAdminAction(): Promise<void> {
  const { cookies } = await import('next/headers')
  const { redirect } = await import('next/navigation')
  const { verifySession } = await import('./session')

  const cookieStore = await cookies()
  const token = cookieStore.get('qh_admin')?.value ?? null

  const verifyResult = token ? await verifySession(token) : null
  const access = checkAdminAccess(verifyResult)

  if (!access.ok) {
    redirect('/admin/login')
  }
}
