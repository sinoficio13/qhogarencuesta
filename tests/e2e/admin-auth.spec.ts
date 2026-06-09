/**
 * WU-3 e2e auth spec — Playwright.
 *
 * Tests the full auth flow against the running Next.js dev server.
 * webServer config in playwright.config.ts starts `npm run dev` automatically.
 *
 * Run with: npm run test:e2e
 *
 * Scenarios:
 * 1. Unauthenticated /admin → redirects to /admin/login
 * 2. Wrong password → shows error, stays on /admin/login
 * 3. Correct password → redirects to /admin
 * 4. Logout → subsequent /admin access redirects to /admin/login
 */

import { test, expect } from '@playwright/test'

const CORRECT_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme'

test.describe('Admin auth flow', () => {
  test('unauthenticated /admin redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('wrong password shows error, stays on login page', async ({ page }) => {
    await page.goto('/admin/login')
    await page.fill('input[name="password"]', 'definitely-wrong-password')
    await page.click('button[type="submit"]')
    // Should stay on login page
    await expect(page).toHaveURL(/\/admin\/login/)
    // Should show an error message — use role="alert" scoped to the form
    // to avoid matching unrelated elements (Next.js dev toolbar, route announcer)
    await expect(page.locator('form [role="alert"]')).toBeVisible()
  })

  test('correct password redirects to /admin', async ({ page }) => {
    await page.goto('/admin/login')
    await page.fill('input[name="password"]', CORRECT_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/admin(?!\/login)/)
    // Should see the admin panel placeholder (h1 heading)
    await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible()
  })

  test('logout clears session and /admin redirects to login', async ({ page }) => {
    // First, login
    await page.goto('/admin/login')
    await page.fill('input[name="password"]', CORRECT_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/admin(?!\/login)/)

    // Click logout button
    await page.click('button:has-text("Salir"), button:has-text("Logout"), button:has-text("Cerrar sesión")')

    // Should be back on login
    await expect(page).toHaveURL(/\/admin\/login/)

    // Navigating to /admin should redirect again
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})
