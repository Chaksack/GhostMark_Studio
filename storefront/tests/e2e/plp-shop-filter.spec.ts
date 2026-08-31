/**
 * PLP type-scoping suite. Three contracts:
 *  - /shop is the D2C surface; clicking through any card lands on an
 *    apparel PDP (per-unit price, no MOQ).
 *  - /products is the mixed catalogue; the H1 reflects the unscoped
 *    headline "Branded objects for studios & teams".
 *  - /products?type=pod scopes to POD type; clicking through any card
 *    lands on a POD PDP (from-price, MOQ caption).
 */
import { test, expect } from '@playwright/test'
import { PlpPage } from './pages/PlpPage'

test.describe('PLP: type scoping', () => {
  test('/shop renders the Studio Canon surface and links to apparel PDPs', async ({ page }) => {
    const plp = new PlpPage(page)
    await plp.gotoShop()
    await expect(plp.h1).toContainText(/shop the studio/i)
    await plp.expectAtLeastOneCard()

    const href = await plp.firstCardHref()
    expect(href).toMatch(/^\/products\//)
    if (href) {
      await page.goto(href)
      // Apparel chrome contract: the per-unit price label is the
      // canonical signal that we landed on apparel.
      await expect(page.locator('[data-test="apparel-price"]')).toBeVisible()
      await expect(page.locator('[data-test="from-price"]')).toHaveCount(0)
    }
  })

  test('/products mixed catalogue carries the unscoped headline', async ({ page }) => {
    const plp = new PlpPage(page)
    await plp.gotoProducts()
    await expect(plp.h1).toContainText(/Branded objects for studios & teams/i)
    await plp.expectAtLeastOneCard()
  })

  test('/products?type=pod scopes to POD-typed products', async ({ page }) => {
    const plp = new PlpPage(page)
    await plp.gotoProducts('?type=pod')
    await plp.expectAtLeastOneCard()

    const href = await plp.firstCardHref()
    expect(href).toMatch(/^\/products\//)
    if (href) {
      await page.goto(href)
      // POD chrome contract: from-price + MOQ caption are mutually
      // exclusive with the apparel-price label.
      await expect(page.locator('[data-test="from-price"]')).toBeVisible()
      await expect(page.locator('[data-test="moq-caption"]')).toBeVisible()
      await expect(page.locator('[data-test="apparel-price"]')).toHaveCount(0)
    }
  })
})
