import { describe, it, expect, beforeAll } from 'vitest'
import { createSession, verifySession } from '@/lib/auth/session'

// Use a fixed 32-byte secret for all tests — isolate from env
const TEST_SECRET = 'test-secret-that-is-at-least-32-bytes-long-12345'

describe('createSession + verifySession', () => {
  describe('valid round-trip', () => {
    it('verifies a freshly created session token', async () => {
      const token = await createSession(TEST_SECRET)
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(10)

      const result = await verifySession(token, TEST_SECRET)
      expect(result.status).toBe('valid')
    })
  })

  describe('tampered signature', () => {
    it('rejects a token with altered payload', async () => {
      const token = await createSession(TEST_SECRET)
      // Tamper: flip a char in the payload portion (before the last dot)
      const parts = token.split('.')
      expect(parts.length).toBe(2) // payload.signature
      parts[0] = parts[0].slice(0, -1) + (parts[0].slice(-1) === 'A' ? 'B' : 'A')
      const tampered = parts.join('.')

      const result = await verifySession(tampered, TEST_SECRET)
      expect(result.status).toBe('invalid')
    })

    it('rejects a token with altered signature', async () => {
      const token = await createSession(TEST_SECRET)
      const parts = token.split('.')
      // Flip a char in the MIDDLE of the signature (not the last — last char may be padding-safe)
      const mid = Math.floor(parts[1].length / 2)
      const sigChars = parts[1].split('')
      sigChars[mid] = sigChars[mid] === 'A' ? 'B' : 'A'
      parts[1] = sigChars.join('')
      const tampered = parts.join('.')

      const result = await verifySession(tampered, TEST_SECRET)
      expect(result.status).toBe('invalid')
    })
  })

  describe('expired token', () => {
    it('rejects a token whose exp is in the past', async () => {
      // Create a token already expired (iat = 9h ago → exp 1h ago)
      const now = Math.floor(Date.now() / 1000)
      const iat = now - 9 * 60 * 60
      const exp = iat + 8 * 60 * 60 // expired 1h ago

      const token = await createSession(TEST_SECRET, { iat, exp })
      const result = await verifySession(token, TEST_SECRET)
      expect(result.status).toBe('expired')
    })
  })

  describe('wrong secret', () => {
    it('rejects a valid token verified with a different secret', async () => {
      const token = await createSession(TEST_SECRET)
      const result = await verifySession(token, 'completely-different-secret-xyz-1234567890')
      expect(result.status).toBe('invalid')
    })
  })

  describe('malformed token', () => {
    it('returns invalid for a random string', async () => {
      const result = await verifySession('notavalidtoken', TEST_SECRET)
      expect(result.status).toBe('invalid')
    })

    it('returns invalid for empty string', async () => {
      const result = await verifySession('', TEST_SECRET)
      expect(result.status).toBe('invalid')
    })
  })
})
