/**
 * URL-safe token generator — used for one-time invitation links (/r/<token>).
 *
 * Design decisions:
 *  - Alphabet excludes ambiguous characters: 0/O, 1/I/l (visual lookalikes).
 *  - Uses crypto.getRandomValues (CSPRNG) — available in Node ≥ 15 and browsers.
 *  - Default length: 12 characters from an alphabet of 32 = 5 bits/char = 60 bits
 *    of entropy. Plenty for a private survey link (not a password).
 *  - Pure module — no framework deps, no DB.
 *
 * Exported constants allow tests to inspect and validate the alphabet.
 */

// 32-char URL-safe alphabet — no ambiguous chars (0, O, 1, I, l removed)
export const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const DEFAULT_LENGTH = 12

/**
 * Generate a URL-safe random token.
 *
 * Uses rejection sampling to ensure uniform distribution:
 * only accepts random bytes that fall within a complete range
 * of the alphabet (avoids modulo bias).
 */
export function generateToken(length: number = DEFAULT_LENGTH): string {
  const alphabet = TOKEN_ALPHABET
  const alphabetLen = alphabet.length // 32 — power of 2, no rejection needed

  // 32 is a power of 2, so modulo bias is zero.
  // Each byte ANDed with 0x1F maps exactly to [0,31].
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  let result = ''
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] & (alphabetLen - 1)]
  }
  return result
}
