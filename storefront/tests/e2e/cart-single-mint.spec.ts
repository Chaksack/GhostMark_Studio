/**
 * Regression guard: a page load must mint AT MOST ONE backend cart.
 *
 * `ensureCart()` is called from several independent onMounted hooks on the
 * same page. On the homepage that is three: pages/index.vue, plus
 * <CartDropdown> twice, since AppHeader mounts it in the desktop rail and
 * again in the mobile rail. Each call is an async check-then-act — it
 * reads `cart.value?.id`, then awaits `ensureRegion()` and a cart retrieve
 * before writing the result back. Concurrent callers therefore all observe
 * an empty cart and all POST /store/carts, leaving orphaned empty cart rows
 * in the database and (when the losing writer's id lands in the cookie
 * last) a cart page that reads an empty cart after a successful add.
 *
 * Unguarded this counted 3 creates per cold homepage load, 3/3 runs.
 */
import { test, expect } from '@playwright/test'

test.describe('cart minting', () => {
  test('a cold homepage load creates at most one cart', async ({ page }) => {
    const creates: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/store\/carts(\?|$)/.test(req.url())) {
        creates.push(req.url())
      }
    })

    await page.goto('/')
    // Both ensureCart() callers live in onMounted; give hydration and the
    // region + cart round-trips room to settle before counting.
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    expect(creates.length).toBeLessThanOrEqual(1)
  })
})
