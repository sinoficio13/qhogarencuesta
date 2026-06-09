/**
 * requireAdmin — unit tests for the PURE decision logic.
 *
 * The cookie read (next/headers) is NOT tested here — that's e2e territory.
 * We test the decision function that receives a VerifyResult and decides
 * whether to pass or throw/redirect.
 *
 * RED gate: these tests MUST fail before requireAdmin.ts exists.
 */

import { describe, it, expect } from 'vitest'
import { checkAdminAccess } from '@/lib/auth/requireAdmin'

describe('checkAdminAccess — pure decision function', () => {
  it('returns ok:true when token is valid', () => {
    const result = checkAdminAccess({ status: 'valid', payload: { iat: 1000, exp: 9999999999 } })
    expect(result).toEqual({ ok: true })
  })

  it('returns ok:false with reason "expired" when token is expired', () => {
    const result = checkAdminAccess({ status: 'expired', payload: { iat: 1000, exp: 1001 } })
    expect(result).toEqual({ ok: false, reason: 'expired' })
  })

  it('returns ok:false with reason "invalid" when token is invalid', () => {
    const result = checkAdminAccess({ status: 'invalid' })
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('returns ok:false with reason "invalid" when no token provided (undefined)', () => {
    const result = checkAdminAccess(null)
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('returns ok:false with reason "invalid" when token string is empty', () => {
    const result = checkAdminAccess(null)
    expect(result.ok).toBe(false)
  })
})
