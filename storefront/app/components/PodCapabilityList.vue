<template>
  <dl v-if="rows.length" class="mt-3">
    <div
      v-for="row in rows"
      :key="row.label"
      class="flex items-baseline justify-between gap-3 border-t border-ink-950/10 py-1.5"
    >
      <dt class="gm-spec shrink-0 text-ink-600">{{ row.label }}</dt>
      <dd class="text-caption text-right text-ink-700">{{ row.value }}</dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
/**
 * PodCapabilityList: the four operational facts a customisable product can
 * promise, rendered UNDER a <ProductCard> inside the same grid cell.
 *
 * ============================================================================
 * STATUS 2026-08-31: THIS COMPONENT HAS NO CONSUMER. READ BEFORE DELETING.
 *
 * It was written for a /studio print-on-demand shelf that rendered it under
 * each product card. That route has since been folded back into /products and
 * the shelf is gone. A follow-up proposal to render a compact one-line form on
 * the catalogue card was then withdrawn on measured evidence: ProductCard.vue
 * :155-162 records that the meta line ALREADY wrapped to two lines in a ~97px
 * text column at a 151px mobile card, so there was never room for another row
 * under it. The `#below` slot that would have carried it has been removed and
 * ProductCard is byte-identical to its state before that slot existed.
 *
 * It is kept, not deleted, for one reason and it is a safety reason rather
 * than an optimistic one: THIS FILE IS UNTRACKED. `git ls-files` does not know
 * it, `git log` is empty, and there is no blob for it anywhere in the object
 * database. Deleting it destroys 96 lines with NO recovery path. That is not a
 * tidy-up, it is data loss.
 *
 * SO IF YOU ARE HERE TO DELETE IT: commit it first, in its own commit, then
 * delete it in the next one. Only then is "the history has it" true rather
 * than assumed. A copy also sits in this session's scratchpad under
 * bak-studio/, which is not a durable home.
 *
 * The named future consumer is the PDP's branded purchase mode, which is
 * specced but NOT BUILT. Treat that as a plan, not as justification: a comment
 * naming a consumer that does not exist is the same defect as one naming a
 * page that no longer does, with the tense changed.
 *
 * It costs nothing at runtime meanwhile. Nothing imports it, so Nuxt's
 * auto-import never resolves it and it is in no bundle.
 * ============================================================================
 *
 * WHY A SIBLING AND NOT A PROP ON ProductCard. The obvious implementation is
 * a `mode="pod-shelf"` branch inside ProductCard. It was rejected on purpose.
 * ProductCard has been measured twice this session by two different lanes:
 * the 1:1 crop, the contrast figures on both the offWhite and warmGrey
 * grounds, the elementFromPoint hit test on the wishlist button, the
 * differentiator resolver and the inverted hover swap all have recorded
 * numbers attached to the component as it stands. Rendering beside it rather
 * than inside it means every one of those measurements survives untouched and
 * this shelf cannot regress a grid it does not modify.
 *
 * WHY `MINIMUM` IS NOT ONE OF THE ROWS. ProductCard's own commerce meta line
 * already prints it, via `resolveCardCommerce`, as "per piece; min 25".
 * Repeating it here would put the same fact twice inside about 140px of
 * column, which is precisely the duplicate-chip defect the GRID lane already
 * found and fixed once ("BEST SELLER BEST SELLER"). Do not add it back.
 *
 * WHY A MISSING FIELD OMITS ITS ROW INSTEAD OF PRINTING A DASH. This list
 * exists because two products on this surface were advertising a capability
 * they do not have. A component whose entire justification is not overstating
 * what the catalogue can do must not render "TECHNIQUE  -" and let a reader
 * decide what that means. If the data is absent the claim is absent.
 */
defineOptions({ name: 'PodCapabilityList' })

interface TierLike { quantity?: unknown }
interface TechniqueLike { label?: unknown, key?: unknown }
interface LeadTimeLike { min?: unknown, max?: unknown }

const props = defineProps<{
  metadata?: Record<string, unknown> | null
}>()

interface Row { label: string, value: string }

const meta = computed<Record<string, unknown>>(() => props.metadata ?? {})

/** Tier quantities as "25 / 50 / 100 / 250". Empty string when absent. */
const breaks = computed<string>(() => {
  const tiers = meta.value.quantity_tiers
  if (!Array.isArray(tiers) || !tiers.length) return ''
  const qs = (tiers as TierLike[])
    .map(t => (typeof t?.quantity === 'number' ? t.quantity : null))
    .filter((q): q is number => q !== null)
  return qs.length ? qs.join(' / ') : ''
})

/** Human technique labels, sentence-cased by the seed already. */
const techniques = computed<string>(() => {
  const t = meta.value.techniques
  if (!Array.isArray(t) || !t.length) return ''
  const labels = (t as TechniqueLike[])
    .map(x => (typeof x?.label === 'string' ? x.label : (typeof x?.key === 'string' ? x.key : null)))
    .filter((x): x is string => !!x)
  return labels.join(', ')
})

/** "10 to 15 working days". No en dash: the project bans dash punctuation. */
const dispatch = computed<string>(() => {
  const lt = meta.value.lead_time_days as LeadTimeLike | undefined
  const min = typeof lt?.min === 'number' ? lt.min : null
  const max = typeof lt?.max === 'number' ? lt.max : null
  if (min === null && max === null) return ''
  if (min !== null && max !== null) return `${min} to ${max} working days`
  return `${min ?? max} working days`
})

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  if (breaks.value) out.push({ label: 'BREAKS', value: breaks.value })
  if (techniques.value) out.push({ label: 'TECHNIQUE', value: techniques.value })
  // The 48h e-proof is a studio-wide service commitment rather than a
  // per-product field, so it is stated only when the product is actually
  // tier-priced, i.e. when it is genuinely part of the self-serve run flow.
  if (breaks.value) out.push({ label: 'PROOF', value: '48 hours' })
  if (dispatch.value) out.push({ label: 'DISPATCH', value: dispatch.value })
  return out
})
</script>
