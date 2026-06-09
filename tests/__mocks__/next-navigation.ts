/**
 * Stub for 'next/navigation' in Vitest integration tests.
 * redirect() is a no-op in tests (we test actions directly, not middleware).
 */
export function redirect(_url: string): never {
  throw new Error(`TEST_REDIRECT:${_url}`)
}

export function notFound(): never {
  throw new Error('TEST_NOT_FOUND')
}
