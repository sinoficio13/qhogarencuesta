/**
 * WU-0 smoke test — proves vitest is configured correctly.
 * This file has no application logic; WU-2 is where TDD begins.
 */
import { describe, it, expect } from 'vitest'

describe('vitest bootstrap', () => {
  it('runs and the test runner works', () => {
    expect(1 + 1).toBe(2)
  })
})
