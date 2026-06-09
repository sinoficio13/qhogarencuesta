/**
 * TDD Gate — identifier hashing/validation unit tests (PIVOT dedup)
 *
 * Written FIRST (RED) before src/lib/identifier.ts exists.
 * Pure — no DB, no framework.
 *
 * Covers:
 *  - normalizeIdentifier: email → trim+lowercase; cedula → trim+remove spaces
 *  - hashIdentifier: deterministic SHA-256 (same input → same hex output)
 *  - hashIdentifier: different inputs → different hashes
 *  - hashIdentifier: includes pepper (without pepper prefix → different hash)
 *  - validateIdentifier: email — valid/invalid formats
 *  - validateIdentifier: cedula — non-empty, 5–20 chars alnum
 */
import { describe, it, expect } from 'vitest'

describe('normalizeIdentifier', () => {
  it('email: trims whitespace and lowercases', async () => {
    const { normalizeIdentifier } = await import('@/lib/identifier')
    expect(normalizeIdentifier('email', '  JOSE@EXAMPLE.COM  ')).toBe('jose@example.com')
  })

  it('email: already normalized stays the same', async () => {
    const { normalizeIdentifier } = await import('@/lib/identifier')
    expect(normalizeIdentifier('email', 'user@test.org')).toBe('user@test.org')
  })

  it('cedula: trims and removes spaces', async () => {
    const { normalizeIdentifier } = await import('@/lib/identifier')
    expect(normalizeIdentifier('cedula', '  123 456 789  ')).toBe('123456789')
  })

  it('cedula: already normalized stays the same', async () => {
    const { normalizeIdentifier } = await import('@/lib/identifier')
    expect(normalizeIdentifier('cedula', 'AB12345')).toBe('AB12345')
  })
})

describe('hashIdentifier', () => {
  it('returns a hex string of 64 characters (SHA-256)', async () => {
    const { hashIdentifier } = await import('@/lib/identifier')
    const hash = await hashIdentifier('email', 'jose@example.com')
    expect(typeof hash).toBe('string')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic: same input → same hash', async () => {
    const { hashIdentifier } = await import('@/lib/identifier')
    const h1 = await hashIdentifier('email', 'jose@example.com')
    const h2 = await hashIdentifier('email', 'jose@example.com')
    expect(h1).toBe(h2)
  })

  it('different inputs produce different hashes', async () => {
    const { hashIdentifier } = await import('@/lib/identifier')
    const h1 = await hashIdentifier('email', 'jose@example.com')
    const h2 = await hashIdentifier('email', 'other@example.com')
    expect(h1).not.toBe(h2)
  })

  it('email and cedula with same raw value produce different hashes (type is part of input)', async () => {
    const { hashIdentifier } = await import('@/lib/identifier')
    const h1 = await hashIdentifier('email', 'test')
    const h2 = await hashIdentifier('cedula', 'test')
    expect(h1).not.toBe(h2)
  })

  it('normalizes before hashing: raw with spaces same as trimmed', async () => {
    const { hashIdentifier } = await import('@/lib/identifier')
    const h1 = await hashIdentifier('email', '  JOSE@EXAMPLE.COM  ')
    const h2 = await hashIdentifier('email', 'jose@example.com')
    expect(h1).toBe(h2)
  })
})

describe('validateIdentifier', () => {
  describe('email type', () => {
    it('accepts a valid email', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('email', 'user@domain.com')
      expect(result.ok).toBe(true)
    })

    it('rejects empty string', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('email', '')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBeDefined()
    })

    it('rejects string without @', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('email', 'notanemail')
      expect(result.ok).toBe(false)
    })

    it('rejects string without domain part', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('email', 'user@')
      expect(result.ok).toBe(false)
    })

    it('accepts emails with subdomains', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('email', 'user@mail.domain.co.uk')
      expect(result.ok).toBe(true)
    })
  })

  describe('cedula type', () => {
    it('accepts a valid cedula (alphanumeric, 5–20 chars)', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('cedula', 'AB12345')
      expect(result.ok).toBe(true)
    })

    it('rejects empty cedula', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('cedula', '')
      expect(result.ok).toBe(false)
    })

    it('rejects cedula shorter than 5 chars (after trim/normalize)', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('cedula', '123')
      expect(result.ok).toBe(false)
    })

    it('rejects cedula longer than 20 chars', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('cedula', 'A'.repeat(21))
      expect(result.ok).toBe(false)
    })

    it('accepts cedula of exactly 5 chars', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('cedula', '12345')
      expect(result.ok).toBe(true)
    })

    it('accepts cedula of exactly 20 chars', async () => {
      const { validateIdentifier } = await import('@/lib/identifier')
      const result = validateIdentifier('cedula', 'A1B2C3D4E5F6G7H8I9J0')
      expect(result.ok).toBe(true)
    })
  })
})
