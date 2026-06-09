/**
 * Vitest setup file for admin action integration tests.
 *
 * Mocks:
 * - next/cache: revalidatePath/revalidateTag → no-ops
 * - next/navigation: redirect → throws TEST_REDIRECT (catchable in tests)
 * - @/lib/auth/requireAdmin: requireAdminAction → no-op (bypasses cookie check)
 *
 * This allows integration tests to call admin server actions directly
 * without a Next.js request context.
 */
import { vi } from 'vitest'

// Mock next/cache (revalidatePath is called after every mutation)
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

// Mock next/navigation (redirect is called by requireAdmin on auth failure)
vi.mock('next/navigation', () => ({
  redirect: vi.fn((_url: string) => {
    throw new Error(`TEST_REDIRECT:${_url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('TEST_NOT_FOUND')
  }),
}))

// Mock next/headers (cookies() is called by requireAdminAction)
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: (_name: string) => ({ value: '__test_bypass__' }),
    })
  ),
  headers: vi.fn(() => Promise.resolve(new Headers())),
}))

// Mock requireAdminAction to be a no-op in integration tests
// This is the cleanest approach: bypass auth entirely for unit/integration testing
vi.mock('@/lib/auth/requireAdmin', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/requireAdmin')>()
  return {
    ...original,
    requireAdminAction: vi.fn().mockResolvedValue(undefined),
    requireAdmin: vi.fn().mockResolvedValue(undefined),
  }
})
