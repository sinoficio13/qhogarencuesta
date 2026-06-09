/**
 * Stub for 'next/headers' in Vitest integration tests.
 * Returns a mock cookie store with a valid admin session marker,
 * so requireAdminAction() passes without a real Next.js request context.
 *
 * The actual session verification (verifySession) is also bypassed:
 * this mock makes cookies() return a fake 'qh_admin' cookie value.
 * requireAdmin.ts dynamically imports next/headers, so we alias the module.
 */
export function cookies() {
  return Promise.resolve({
    get: (_name: string) => ({ value: '__test_admin_mock__' }),
  })
}

export function headers() {
  return Promise.resolve(new Headers())
}
