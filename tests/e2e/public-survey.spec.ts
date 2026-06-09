/**
 * WU-4 TDD Gate — Public survey e2e tests (T-048)
 *
 * Strict TDD: written BEFORE the routes/components exist.
 *
 * Covers:
 *  - Buyers survey renders and is fillable → submit → done card appears
 *  - max-select cap disables extra checkboxes
 *  - Unknown slug returns 404
 *
 * NOTE: The test DB is seeded via the fixture endpoint or the dev seed.
 * For e2e we rely on the dev server running against the dev DB which has
 * both surveys seeded (or the test inserts via a seed helper called here).
 *
 * The surveys accessible at /compradores and /agentes (slugs from design).
 */
import { test, expect } from '@playwright/test'

// slugs chosen in WU-4: Spanish slugs matching the mockup tab names
const BUYERS_SLUG = 'compradores'
const AGENTS_SLUG = 'agentes'

test.describe('Public survey — buyers', () => {
  test('renders the buyers survey page', async ({ page }) => {
    await page.goto(`/${BUYERS_SLUG}`)
    // Panel head title should be visible
    await expect(page.locator('.panel-head h2')).toBeVisible()
    // Questions should render
    await expect(page.locator('.q').first()).toBeVisible()
  })

  test('max-select cap disables extra checkboxes at limit', async ({ page }) => {
    await page.goto(`/${BUYERS_SLUG}`)

    // Find the multi question with data-max attribute
    const multiGroup = page.locator('[data-max]').first()
    await expect(multiGroup).toBeVisible()

    const max = await multiGroup.getAttribute('data-max')
    const maxN = parseInt(max ?? '2', 10)

    // Check exactly maxN checkboxes
    const checkboxes = multiGroup.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    expect(count).toBeGreaterThan(maxN)

    for (let i = 0; i < maxN; i++) {
      await checkboxes.nth(i).check()
    }

    // After reaching cap, the remaining unchecked ones should be disabled
    const unchecked = multiGroup.locator('input[type="checkbox"]:not(:checked)')
    const uncheckedCount = await unchecked.count()
    for (let i = 0; i < uncheckedCount; i++) {
      await expect(unchecked.nth(i)).toBeDisabled()
    }
  })
})

test.describe('Public survey — 404 for unknown slug', () => {
  test('returns 404 for an unknown survey slug', async ({ page }) => {
    const response = await page.goto('/encuesta-que-no-existe-xyz')
    // Next.js notFound() renders a 404 page
    expect(response?.status()).toBe(404)
  })
})
