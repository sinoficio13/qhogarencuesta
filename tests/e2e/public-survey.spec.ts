/**
 * Public survey e2e tests — PIVOT to identifier-based dedup.
 *
 * /[slug] is now the fully answerable public link (not preview-only).
 * The identifier field (email) is the first field of the form.
 *
 * Covers:
 *  - /compradores renders the survey form with questions
 *  - identifier field is present and required
 *  - max-select cap disables extra checkboxes at limit
 *  - Unknown slug returns 404
 */
import { test, expect } from '@playwright/test'

const BUYERS_SLUG = 'compradores'

test.describe('Public survey — buyers (answerable)', () => {
  test('renders the buyers survey page', async ({ page }) => {
    await page.goto(`/${BUYERS_SLUG}`)
    await expect(page.locator('.panel-head h2')).toBeVisible()
    await expect(page.locator('.q').first()).toBeVisible()
  })

  test('identifier field is the first input and is required', async ({ page }) => {
    await page.goto(`/${BUYERS_SLUG}`)
    // The identifier field has id="survey-identifier-field"
    const identifierField = page.locator('#survey-identifier-field')
    await expect(identifierField).toBeVisible()
    // Input inside it should be required
    const input = identifierField.locator('input')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('required')
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

    // Wait for React to re-render and disable extra checkboxes after reaching cap
    await page.waitForFunction(
      ({ selector, expectedMax }: { selector: string; expectedMax: number }) => {
        const group = document.querySelector(selector)
        if (!group) return false
        const checked = group.querySelectorAll('input[type="checkbox"]:checked')
        return checked.length >= expectedMax
      },
      { selector: '[data-max]', expectedMax: maxN },
    )

    const unchecked = multiGroup.locator('input[type="checkbox"]:not(:checked)')
    const uncheckedCount = await unchecked.count()
    for (let i = 0; i < uncheckedCount; i++) {
      await expect(unchecked.nth(i)).toBeDisabled()
    }
  })

  test('submit button is enabled (not preview mode)', async ({ page }) => {
    await page.goto(`/${BUYERS_SLUG}`)
    // Submit button should be enabled (no preview mode)
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeEnabled()
    // No preview notice
    await expect(page.locator('text=Vista previa')).not.toBeVisible()
  })
})

test.describe('Public survey — 404 for unknown slug', () => {
  test('returns 404 for an unknown survey slug', async ({ page }) => {
    const response = await page.goto('/encuesta-que-no-existe-xyz')
    expect(response?.status()).toBe(404)
  })
})
