/**
 * Canonical route constants for the two commerce surfaces.
 *
 * WHY THIS FILE EARNED ITS KEEP. The catalogue is addressed from at least
 * four places: the desktop nav band, the mobile burger, the footer, and the
 * `?type=` redirect on /shop. Each of those used to spell its destination
 * inline, so changing it meant finding all four and hoping there was not a
 * fifth.
 *
 * That hope was tested immediately. This constant has been repointed TWICE
 * in one day, `/products?type=pod` to `/studio` to `/products`, as the IA
 * decision changed underneath it. Both moves cost one line here instead of a
 * hunt through the components, which is the entire argument for the file.
 *
 * Anything that needs to LINK to the catalogue should import
 * {@link POD_SURFACE} rather than writing the path. Anything that needs to
 * detect whether the visitor is currently ON it should use
 * {@link isPodSurface}. Do not re-inline a path at a call site.
 */

/**
 * Where "print on demand" lives: the single catalogue.
 *
 * PRINT ON DEMAND IS A PRODUCTION METHOD, NOT A PRODUCT CATEGORY. Any object
 * we sell can be printed to order, and the catalogue data says so directly:
 * all 20 apparel products carry `is_customizable`, `moq`, `print_locations`
 * and `quantity_tiers`, exactly as the two products typed `pod` do. There is
 * no POD catalogue to separate out. There is one catalogue, and two ways to
 * buy from it, as-is or customised.
 *
 * This briefly pointed at a dedicated /studio shelf that listed the products
 * whose Medusa `type` happens to read 'pod'. That was the wrong model twice
 * over: it split one catalogue into two, and the `type` field does not even
 * describe the capability, since two of those products cannot be customised
 * at all and a third is a test fixture.
 *
 * `/shop` stays separate on purpose. It is the own-brand D2C line, not a
 * filtered view of this catalogue.
 */
export const POD_SURFACE = '/products'

/**
 * The catalogue, NARROWED to print-on-demand.
 *
 * Folding POD back into one catalogue settled the question "is print on demand
 * a separate shelf". It did NOT settle "what should a visitor who explicitly
 * asked for print on demand be shown", and those are different questions.
 * Answering the first with an unfiltered list answers the second by accident,
 * and answers it wrongly: they asked for 5 products and would receive 24.
 *
 * `?type=pod` is a real server-side `type_id` filter that returns exactly the
 * 5 typed-pod SKUs. It costs nothing to honour and it is the whole difference
 * between redirecting a request and discarding one.
 *
 * Built from POD_SURFACE rather than written out, so that if the catalogue
 * moves again, or ever gains a query of its own, this composes instead of
 * silently disagreeing with it.
 */
export function podFilteredUrl(): string {
  const [path, existing] = POD_SURFACE.split('?')
  const params = new URLSearchParams(existing ?? '')
  params.set('type', 'pod')
  return `${path}?${params.toString()}`
}

/** Where own-brand apparel lives. Stable; here for symmetry with POD. */
export const APPAREL_SURFACE = '/shop'

/**
 * True when a path + query pair addresses the catalogue.
 *
 * Matches `/products` in any form, filtered or not, because a filter is a
 * view of the catalogue and not a different destination. `/studio` is still
 * accepted so that the nav entry stays lit through the redirect rather than
 * going dark for one frame while it resolves.
 */
export function isPodSurface(path: string, query: Record<string, unknown>): boolean {
  void query
  return path === '/products'
    || path.startsWith('/products/')
    || path === '/studio'
}
