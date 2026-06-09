/**
 * Stub for 'next/cache' in Vitest integration tests.
 * revalidatePath / revalidateTag are no-ops in tests.
 */
export function revalidatePath(_path: string): void {
  // no-op in tests
}

export function revalidateTag(_tag: string): void {
  // no-op in tests
}
