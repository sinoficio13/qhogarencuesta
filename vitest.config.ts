import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globals: true,
    // Setup file for integration tests: mocks next/cache, next/navigation,
    // and requireAdminAction so admin server actions can be tested without
    // a real Next.js request context.
    setupFiles: ['tests/setup/adminMocks.ts'],
    // Run all test files in a single fork, sequentially, so integration tests
    // (which share a DB) don't race against each other's beforeEach truncations.
    pool: 'forks',
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — singleFork is valid at runtime in Vitest 4 but may be missing from type defs
    singleFork: true,
    fileParallelism: false,
    // Point DATABASE_URL at the test DB so Server Actions (which import @/db
    // at module load time) use the same DB as the test assertions.
    env: {
      DATABASE_URL: 'postgres://qhogar:qhogar@localhost:5432/qhogar_test',
    },
    // Vitest automatically loads .env and .env.local via Vite's dotenv support
    // (env above overrides those for test runs)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub Next.js server-only marker so unit tests can import server modules
      'server-only': path.resolve(__dirname, 'tests/__mocks__/server-only.ts'),
    },
  },
})
