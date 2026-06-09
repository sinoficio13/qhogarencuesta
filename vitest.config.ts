import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globals: true,
    // Vitest automatically loads .env and .env.local via Vite's dotenv support
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub Next.js server-only marker so unit tests can import server modules
      'server-only': path.resolve(__dirname, 'tests/__mocks__/server-only.ts'),
    },
  },
})
