/**
 * TDD Gate — token generator unit tests (WU-5 dedup slice)
 *
 * Written FIRST (RED) before src/lib/token.ts exists.
 * Pure — no DB, no framework.
 *
 * Covers:
 *  - generateToken() returns a string of the expected length
 *  - Only URL-safe characters (no ambiguous chars like 0/O, l/I/1)
 *  - Uniqueness: N consecutive calls produce distinct tokens
 *  - Format: alphabet is [A-HJ-NP-Z2-9] (no 0/O/1/I/l)
 */
import { describe, it, expect } from 'vitest'

describe('generateToken', () => {
  it('returns a string of the expected length (~12 chars)', async () => {
    const { generateToken } = await import('@/lib/token')
    const token = generateToken()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThanOrEqual(12)
    expect(token.length).toBeLessThanOrEqual(16)
  })

  it('only contains URL-safe characters from the defined alphabet', async () => {
    const { generateToken, TOKEN_ALPHABET } = await import('@/lib/token')
    const token = generateToken()
    const allowedSet = new Set(TOKEN_ALPHABET.split(''))
    for (const ch of token) {
      expect(allowedSet.has(ch), `character '${ch}' not in alphabet`).toBe(true)
    }
  })

  it('does not include ambiguous characters (0, O, 1, I, l)', async () => {
    const { TOKEN_ALPHABET } = await import('@/lib/token')
    expect(TOKEN_ALPHABET).not.toContain('0')
    expect(TOKEN_ALPHABET).not.toContain('O')
    expect(TOKEN_ALPHABET).not.toContain('1')
    expect(TOKEN_ALPHABET).not.toContain('I')
    expect(TOKEN_ALPHABET).not.toContain('l')
  })

  it('produces unique tokens across many calls (no collisions in 500)', async () => {
    const { generateToken } = await import('@/lib/token')
    const tokens = new Set<string>()
    for (let i = 0; i < 500; i++) {
      tokens.add(generateToken())
    }
    // All 500 should be unique
    expect(tokens.size).toBe(500)
  })
})
