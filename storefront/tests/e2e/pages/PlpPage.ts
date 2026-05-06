/**
 * Product-list-page object covering both /shop (D2C apparel-scoped) and
 * /products (mixed catalogue with `?type=` filter). Stays small — only
 * what the spec suite calls is exposed.
 */
import { Page, Locator, expect } from '@playwright/test'

export class PlpPage {
  readonly page: Page
  readonly h1: Locator
  readonly grid: Locator
  readonly productCards: Locator

  constructor(page: Page) {
    this.page = page
    this.h1 = page.locator('h1').first()
    // Both /shop and /products render the cards into <ul class="grid …">.
    this.grid = page.locator('ul.grid').first()
    // ProductCard's root is <li> with a <NuxtLink to="/products/<handle>">.
    this.productCards = this.grid.locator('> li')
  }

  async gotoShop(): Promise<void> {
    await this.page.goto('/shop')
    await this.h1.waitFor({ state: 'visible' })
  }

  async gotoProducts(query = ''): Promise<void> {
    await this.page.goto(`/products${query}`)
    await this.h1.waitFor({ state: 'visible' })
  }

  /**
   * Returns the PDP href of the first card in the grid, or null if the
   * grid is empty (e.g. filter returned 0 results).
   */
  async firstCardHref(): Promise<string | null> {
    await this.grid.waitFor({ state: 'visible', timeout: 10_000 })
    const first = this.productCards.first().locator('a[href^="/products/"]').first()
    if ((await first.count()) === 0) return null
    return first.getAttribute('href')
  }

  async expectAtLeastOneCard(): Promise<void> {
    await expect.poll(async () => this.productCards.count(), {
      timeout: 10_000,
    }).toBeGreaterThan(0)
  }
}
