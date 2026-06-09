/**
 * Public survey e2e tests (T-048, updated WU-5 dedup)
 *
 * WU-5 update: /[slug] renders in PREVIEW mode — the submit button is
 * disabled and a "Vista previa" notice is shown. The real submit path
 * moved to /r/[token] (token-based links).
 *
 * Covers:
 *  - /compradores renders the survey form with questions
 *  - max-select cap disables extra checkboxes at limit
 *  - /compradores shows preview notice + submit button is disabled
 *  - Unknown slug returns 404
 */
import { test, expect } from '@playwright/test'

const BUYERS_SLUG = 'compradores'

test.describe('Public survey — buyers (preview mode)', () => {
  test('renders the buyers survey page', async ({ page }) => {
    await page.goto(`/${BUYERS_SLUG}`)
    await expect(page.locator('.panel-head h2')).toBeVisible()
    await expect(page.locator('.q').first()).toBeVisible()
  })

  test('max-select cap disables extra checkboxes at limit', async ({ page }) => {
    await page.goto(`/${BUYERS_SLUG}`)

    const multiGroup = page.locator('[data-max]').first()
    await expect(multiGroup).toBeVisible()

    const max = await multiGroup.getAttribute('data-max')
    const maxN = parseInt(max ?? '2', 10)

    const checkboxes = multiGroup.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    expect(count).toBeGreaterThan(maxN)

    for (let i = 0; i < maxN; i++) {
      await checkboxes.nth(i).check()
    }

    const unchecked = multiGroup.locator('input[type="checkbox"]:not(:checked)')
    const uncheckedCount = await unchecked.count()
    for (let i = 0; i < uncheckedCount; i++) {
      await expect(unchecked.nth(i)).toBeDisabled()
    }
  })

  test('shows preview notice and disabled submit button', async ({ page }) => {
    await page.goto(`/${BUYERS_SLUG}`)
    // Preview notice text
    await expect(page.locator('text=Vista previa')).toBeVisible()
    // Submit button should be disabled
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeDisabled()
  })
})

test.describe('Public survey — 404 for unknown slug', () => {
  test('returns 404 for an unknown survey slug', async ({ page }) => {
    const response = await page.goto('/encuesta-que-no-existe-xyz')
    expect(response?.status()).toBe(404)
  })
})
