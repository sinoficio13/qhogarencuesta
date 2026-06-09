'use server'

/**
 * Admin auth Server Actions.
 *
 * loginAction  — validates password, sets qh_admin cookie, redirects to /admin
 * logoutAction — clears qh_admin cookie, redirects to /admin/login
 *
 * Cookie spec (design §4):
 *   name:     qh_admin
 *   httpOnly: true
 *   secure:   true in production (HTTPS), false in local dev
 *   sameSite: lax
 *   path:     /
 *   maxAge:   60 * 60 * 8  (8 hours)
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSession } from '@/lib/auth/session'
import { checkPassword } from '@/lib/auth/requireAdmin'

const COOKIE_NAME = 'qh_admin'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

// ── Types ──────────────────────────────────────────────────────────────────────

export type LoginResult = { ok: false; error: string }

// ── Actions ────────────────────────────────────────────────────────────────────

/**
 * loginAction — called by the /admin/login form via useActionState.
 *
 * Signature: (prevState, formData) — compatible with useActionState<State, FormData>.
 *
 * 1. Constant-time compare submitted password vs ADMIN_PASSWORD.
 * 2. On match: create signed session token, set qh_admin cookie, redirect /admin.
 * 3. On mismatch: return generic error (no user enumeration).
 *
 * redirect() throws internally in Next.js — callers should NOT wrap in try/catch.
 */
export async function loginAction(
  _prevState: LoginResult | null,
  formData: FormData,
): Promise<LoginResult> {
  const submitted = (formData.get('password') as string | null) ?? ''
  const expected = process.env.ADMIN_PASSWORD ?? ''

  const match = await checkPassword(submitted, expected)

  if (!match) {
    // Generic message — no user enumeration
    return { ok: false, error: 'Contraseña incorrecta.' }
  }

  const token = await createSession()
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })

  redirect('/admin')
}

/**
 * logoutAction — clears the session cookie and redirects to login.
 */
export async function logoutAction(): Promise<never> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  redirect('/admin/login')
}
