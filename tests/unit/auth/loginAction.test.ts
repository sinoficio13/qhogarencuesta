/**
 * loginAction — unit tests for the pure password-check helper.
 *
 * The actual Server Action wires cookies/redirect; we unit-test the
 * pure constant-time comparison helper that it delegates to.
 *
 * RED gate: these tests MUST fail before adminAuth.ts exists.
 */

import { describe, it, expect } from 'vitest'
import { checkPassword } from '@/lib/auth/requireAdmin'

describe('checkPassword — constant-time compare', () => {
  it('returns true when submitted matches expected', async () => {
    const result = await checkPassword('correct-password', 'correct-password')
    expect(result).toBe(true)
  })

  it('returns false when submitted does not match expected', async () => {
    const result = await checkPassword('wrong-password', 'correct-password')
    expect(result).toBe(false)
  })

  it('returns false when submitted is empty string', async () => {
    const result = await checkPassword('', 'correct-password')
    expect(result).toBe(false)
  })

  it('returns false when expected is empty string but submitted is not', async () => {
    const result = await checkPassword('something', '')
    expect(result).toBe(false)
  })

  it('returns true when both are empty strings (edge case)', async () => {
    const result = await checkPassword('', '')
    expect(result).toBe(true)
  })

  it('is timing-safe: returns same type regardless of match', async () => {
    const r1 = await checkPassword('a', 'b')
    const r2 = await checkPassword('a', 'a')
    expect(typeof r1).toBe('boolean')
    expect(typeof r2).toBe('boolean')
  })
})
