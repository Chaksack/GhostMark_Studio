<script setup lang="ts">
// =============================================================================
// /design/[handle] — the DEDICATED DESIGN SURFACE.
//
// ┌───────────────────────────────────────────────────────────────────────────
// │ WHY THIS ROUTE IS /design/[handle] AND NOT /products/[handle]/design.
// │ DO NOT "TIDY" IT INTO A NESTED ROUTE.
// │
// │ `app/pages/products/[handle].vue` exists as a FILE. In Nuxt 4 a directory
// │ that shares a sibling page file's name becomes a NESTED route: the child
// │ renders ONLY inside a `<NuxtPage />` in the parent, and without one the
// │ route throws NUXT_E4016 at runtime.
// │   nuxt.com/docs/4.x/errors/e4016
// │   nuxt.com/docs/4.x/directory-structure/app/pages
// │
// │ Satisfying that would mean putting `<NuxtPage />` into products/[handle].vue
// │ and restructuring its template — a file that currently carries three
// │ separate load-bearing fixes from three different work streams (the
// │ `bottom-[var(--consent-height,0px)]` sticky-bar binding that stops the
// │ cookie banner eating add-to-cart, the `Math.round(u * 100) / 100` pence
// │ fix, and the .gm-spec design-token usage). A sibling route costs nothing
// │ and touches none of it.
// └───────────────────────────────────────────────────────────────────────────
//
// ── LAYOUT RATIONALE, AND AN HONEST NOTE ON PRECEDENT ───────────────────────
// NO print-on-demand storefront is indexed in Mobbin — not Printful, Printify,
// Redbubble, TeePublic, Society6, Zazzle or Custom Ink. There is no direct
// precedent for this screen. What follows is adapted from adjacent editors,
// and I am naming that rather than dressing it as a citation.
//
// The one true merch editor in the corpus is Patreon's:
//   mobbin.com/screens/b75e1dc7-8e71-47ac-923f-aeb0f44217c1
// It puts the garment preview LEFT and the controls RIGHT ("Upload artwork"
// with the file name and an `Image quality: Good / 1521 DPI` readout, then
// "Design placement" as two cards, Fill and Fit — two modes, no stretch), with
// Back / Continue at the top right. That is the two-pane split below, and it is
// also why the fit modes are what they are.
//
// Magnific's mockup surface is the shape argument:
//   mobbin.com/screens/9c9aebe1-2ecb-46c1-b6e3-fd4a7633c614
// A dedicated URL, a thin rail, the canvas taking the full viewport height, and
// ONE primary in the header. It is the reason the stage here is bounded by
// viewport height rather than by a 380px width cap.
//
// The saved-state language is the well-trodden part:
//   Pipedrive   "Your work is auto-saved" + Preview + "Save and close"
//               mobbin.com/screens/c96d8e63-823f-4da3-81f4-6a735355637c
//   Pinterest   "Changes stored!" beside a primary "Done"
//               mobbin.com/screens/c70bd27d-8f32-4e6a-9fb1-669f2e0245b4
//   GoDaddy     "All changes saved" top-left, Export + Continue top-right
//               mobbin.com/screens/85b680f5-fd87-4265-9f35-473c04610c50
//   Semrush     full-screen modal, one primary Save, green check on the title
//               mobbin.com/screens/4dd13f6a-a896-4126-b904-216caf63fe72
//
// And the save/commit SPLIT itself — a draft action sitting beside a separate
// commit action, rather than one button doing both:
//   Etsy        Cancel | Preview | "Save as draft" | Publish
//               mobbin.com/screens/39395e95-7c6c-40b9-90e8-0092aadae350
//   Discord     "Save as draft" paired with a separate Publish
//               mobbin.com/screens/e36878d4-5867-4b24-88f8-66f3e8388e15
//
// Here the split is: SAVE lives on this surface, COMMIT (add to cart) lives on
// the PDP. This surface never touches the cart — same rule the inline editor
// has had since the four-commit-controls bug. See COMMIT OWNERSHIP in
// DesignEditor.vue.
//
// ── WHAT "SAVE" ACTUALLY DOES ───────────────────────────────────────────────
// It calls the editor's `collectDesignPayload()` while the Konva stage is still
// mounted, so the 600x800 proof PNG is captured here, and stores the result in
// the draft. The PDP then commits that stored payload verbatim. That is what
// makes the split possible at all: the product page never needs a canvas.
// =============================================================================
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { StoreProduct } from '@medusajs/types'
import DesignEditor from '~/components/design-editor/DesignEditor.vue'
import {
  parsePrintLocations,
  parseTechniques,
} from '~/utils/printMetadata'
import { useDesignDrafts, DESIGN_DRAFT_VERSION } from '~/composables/useDesignDraft'
import type { DesignDraft } from '~/composables/useDesignDraft'

type Product = StoreProduct

const route = useRoute()
const sdk = useMedusaClient()
const regionState = useRegion()
const drafts = useDesignDrafts()

const handle = computed(() => String(route.params.handle || ''))
const variantIdFromQuery = computed<string | null>(() => {
  const v = route.query.variant
  return typeof v === 'string' && v ? v : null
})

await regionState.ensureRegion()

// Same fetch shape as the PDP. Kept deliberately narrow: this surface needs
// metadata, images and a thumbnail, and nothing about pricing or options.
const { data, pending } = await useAsyncData<Product | null>(
  `design-surface:${handle.value}`,
  async () => {
    const regionId = regionState.regionId.value
    const fields = 'id,title,handle,thumbnail,*images,metadata,*type,type_id,*variants.options'
    try {
      const res = await sdk.store.product.list({
        handle: handle.value,
        limit: 1,
        fields,
        ...(regionId ? { region_id: regionId } : {}),
      })
      const p = (res as { products?: Product[] }).products?.[0]
      if (p) return p
    } catch { /* fall through */ }
    try {
      const res = await sdk.store.product.retrieve(handle.value, {
        fields,
        ...(regionId ? { region_id: regionId } : {}),
      })
      return (res as { product?: Product }).product ?? null
    } catch {
      return null
    }
  },
  { watch: [handle, () => regionState.regionId.value] },
)

const product = computed<Product | null>(() => data.value ?? null)
const printLocations = computed(() => parsePrintLocations(product.value))
const techniques = computed(() => parseTechniques(product.value))
const productUrl = computed(() => `/products/${handle.value}`)

// -----------------------------------------------------------------------------
// COLD LANDING. The inline editor could assume PDP context; this route cannot.
//
// Three distinct ways to arrive here with nothing to edit, and they are NOT the
// same thing, so they do not get the same answer:
//
//   1. handle does not resolve   -> a genuine 404. Throwing gives us Nuxt's
//      error page and the right status code for a crawler, rather than a
//      soft-404 that renders 200 with an apology on it.
//   2. product exists but has no print zones -> a 200 with an explanation and a
//      link to the product. NOT a redirect: bouncing someone who followed a
//      link, with no statement of what happened, is how you get a support
//      ticket that says "the editor is broken".
//   3. product has zones but no artwork yet  -> completely normal. This is the
//      deep-link-from-an-email case and the editor's own dropzone empty state
//      already handles it. No special casing.
// -----------------------------------------------------------------------------
if (!pending.value && !product.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Product not found',
    fatal: true,
  })
}

const hasZones = computed(() => printLocations.value.length > 0)

useHead({
  title: () => (product.value ? `Design your ${product.value.title} · GhostMark Studio` : 'Design'),
  // This screen is a per-customer working surface with nothing to index, and a
  // crawler following it would only find an empty canvas.
  meta: [{ name: 'robots', content: 'noindex' }],
})

// -----------------------------------------------------------------------------
// Draft wiring.
// -----------------------------------------------------------------------------
const productId = computed(() => product.value?.id ?? '')

// Read once, BEFORE the editor mounts, so it can be handed in as `initialDraft`.
// `hydrate` is client-only and returns null on the server, so the editor mounts
// with `initialDraft: null` during SSR and gets the real draft on the client —
// which is fine, because the editor is inside <ClientOnly> anyway.
const initialDraft = ref<DesignDraft | null>(null)
onMounted(() => {
  if (!productId.value) return
  initialDraft.value = drafts.hydrate(productId.value)
})

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
const saveState = ref<SaveState>('idle')
const saveError = ref<string | null>(null)
const restoreNotice = ref<string | null>(null)

// `settled` gates dirty-tracking. Restoring a draft fires `live-preview`, and
// without this gate the surface would mark itself dirty the instant it finished
// loading a saved design — telling the customer they have unsaved changes they
// never made, on a screen whose entire job is to be trustworthy about that.
const settled = ref(false)

const anyUploaded = ref(false)
const editorRef = ref<{
  collectDesignPayload: () => Promise<
    | { ok: true; payload: { design_data: Record<string, unknown>; preview_url: string } }
    | { ok: false; error: string }
  >
  snapshotDraft: () => {
    activeKey: string
    technique: string | null
    slots: Record<string, unknown | null>
  }
  removeAllDesigns: () => void
  openFilePicker: () => void
} | null>(null)

const onDraftRestored = async (payload: { restored: number }) => {
  await nextTick()
  settled.value = true
  if (payload.restored > 0) {
    // Report the SAVED state, because that is what it is: nothing has changed
    // since the last save. Showing "unsaved changes" here would be a lie.
    saveState.value = 'saved'
  } else if (initialDraft.value) {
    restoreNotice.value =
      'We couldn’t reload your saved artwork — the file may have expired. Please upload it again.'
  }
}

// If there is no draft at all, nothing will fire `draft-restored`, so settle on
// mount instead. One tick of slack so the editor's own mount work lands first.
onMounted(async () => {
  await nextTick()
  if (!initialDraft.value) settled.value = true
})

const markDirty = () => {
  if (!settled.value) return
  if (saveState.value === 'saved') saveState.value = 'idle'
  saveError.value = null
}

const onUploadedStateChange = (payload: { anyUploaded: boolean }) => {
  anyUploaded.value = payload.anyUploaded
  markDirty()
}

const onEditorError = (message: string) => {
  saveError.value = message
}

// -----------------------------------------------------------------------------
// SAVE. Not a commit.
// -----------------------------------------------------------------------------
const onSave = async () => {
  const editor = editorRef.value
  if (!editor || !product.value) return
  if (saveState.value === 'saving') return

  saveError.value = null
  saveState.value = 'saving'
  try {
    // Collect while the stage is mounted. This is where the 600x800 proof PNG
    // is captured (see `captureStageBlob`; its `1 / stageScale` is what stops
    // the proof shrinking to the displayed size).
    const result = await editor.collectDesignPayload()
    if (!result.ok) throw new Error(result.error)

    const snapshot = editor.snapshotDraft()
    const draft: DesignDraft = {
      version: DESIGN_DRAFT_VERSION,
      productId: product.value.id,
      handle: handle.value,
      variantId: variantIdFromQuery.value,
      activeKey: snapshot.activeKey,
      technique: snapshot.technique,
      slots: snapshot.slots as DesignDraft['slots'],
      commit: result.payload,
      savedAt: Date.now(),
    }
    drafts.save(draft)
    saveState.value = 'saved'
  } catch (e) {
    saveState.value = 'error'
    saveError.value = e instanceof Error ? e.message : 'Could not save your design.'
  }
}

const onDiscard = () => {
  if (!productId.value) return
  drafts.clear(productId.value)
  editorRef.value?.removeAllDesigns()
  saveState.value = 'idle'
  saveError.value = null
  restoreNotice.value = null
}

// Navigate back carrying the variant, so the PDP reopens on the same variant
// the customer left. Two entry points that disagree about state is the failure
// mode here, so the variant travels in both directions.
const backToProductUrl = computed(() =>
  variantIdFromQuery.value
    ? `${productUrl.value}?variant=${encodeURIComponent(variantIdFromQuery.value)}`
    : productUrl.value,
)

const isDirty = computed(() => anyUploaded.value && saveState.value !== 'saved')

// Guard the one genuinely destructive navigation: leaving with artwork placed
// and unsaved. `onBeforeRouteLeave` covers in-app navigation; `beforeunload`
// covers a tab close or a typed URL.
onBeforeRouteLeave(() => {
  if (!isDirty.value) return true
  return window.confirm(
    'You have unsaved changes to your design. Leave without saving?',
  )
})

// Plain listeners, not VueUse: `@vueuse/core` is not a dependency of this
// storefront and this lane may not run `npm install`.
const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (!isDirty.value) return
  e.preventDefault()
}

// -----------------------------------------------------------------------------
// Bound the stage by viewport height so the whole print is visible without
// scrolling, which is the entire reason for a dedicated surface.
//
// MEASURED, NOT GUESSED. The first version of this used a constant
// (`innerHeight - 300`) and it was wrong on the very first render: the canvas
// ran 80px underneath the cookie banner. There are four independent things
// above and below this box and none of them is a number I get to assume —
// the fixed desktop header, this page's own title band, the page gutter, and
// the consent banner, which is 140px when present and 0 when dismissed.
//
// So we read the stage host's actual document offset and subtract the real
// `--consent-height` that ART's CookieBanner publishes. That token is why the
// PDP's sticky bar stopped eating taps; the same measurement makes the canvas
// stop hiding behind the same banner.
// -----------------------------------------------------------------------------
const surfaceHostRef = ref<HTMLElement | null>(null)
const stageMaxH = ref('70vh')

const recomputeStageMax = () => {
  if (!import.meta.client) return
  const host = surfaceHostRef.value
  if (!host) return
  // Offset from the top of the DOCUMENT, so the result does not swing with
  // scroll position. At scroll 0 this is exactly the space the canvas has.
  const docTop = host.getBoundingClientRect().top + window.scrollY
  const consentRaw = getComputedStyle(document.documentElement)
    .getPropertyValue('--consent-height')
  const consent = Number.parseFloat(consentRaw) || 0
  // Desktop clears the page gutter; mobile additionally clears the sticky
  // action bar (48px control + 2x12px padding + 1px rule = 73px, rounded up).
  const chrome = window.innerWidth >= 1024 ? 32 : 88
  const available = window.innerHeight - docTop - chrome - consent
  stageMaxH.value = `${Math.max(320, Math.round(available))}px`
}
onMounted(async () => {
  await nextTick()
  recomputeStageMax()
  // The consent banner measures itself and publishes `--consent-height` after
  // its own mount, and dismissing it animates the token back to 0. Both change
  // how much room the canvas has, so re-measure on a short settle and whenever
  // the token changes. `requestAnimationFrame` twice, not `setTimeout`: we want
  // the frame after layout, not a guess at how long layout takes.
  requestAnimationFrame(() => requestAnimationFrame(recomputeStageMax))
  window.addEventListener('resize', recomputeStageMax, { passive: true })
  window.addEventListener('beforeunload', onBeforeUnload)
  if (typeof ResizeObserver !== 'undefined') {
    consentObserver = new ResizeObserver(recomputeStageMax)
    // `box: 'border-box'` IS THE POINT, not a detail. tokens.css:273 applies
    // `body { padding-bottom: var(--consent-height) }`, and a default
    // ResizeObserver reports contentRect, which EXCLUDES padding. Observed
    // content-box, dismissing the cookie banner changes the token, changes the
    // padding, and fires nothing — so the canvas stays sized for a banner that
    // is no longer on screen for the rest of the session. Measured: the stage
    // stayed 347x463 after dismissal instead of growing to 425x567.
    consentObserver.observe(document.body, { box: 'border-box' })
  }
})

let consentObserver: ResizeObserver | null = null

onBeforeUnmount(() => {
  window.removeEventListener('resize', recomputeStageMax)
  window.removeEventListener('beforeunload', onBeforeUnload)
  consentObserver?.disconnect()
  consentObserver = null
})

const saveLabel = computed(() => {
  if (saveState.value === 'saving') return 'Saving…'
  if (saveState.value === 'saved') return 'Saved'
  return 'Save design'
})

watch(() => productId.value, (id) => {
  if (id && !initialDraft.value) initialDraft.value = drafts.hydrate(id)
})
</script>

<template>
  <div class="min-h-[60vh] bg-cream-50 font-body text-ink-700">
    <div class="mx-auto w-full max-w-rail px-gutter py-6 lg:py-8">
      <!-- ── Header band ────────────────────────────────────────────────────
        Back link, product name, and the save-state statement. The statement
        lives NEXT TO THE TITLE rather than beside the button, which is where
        Pipedrive, GoDaddy and Semrush all put it: it describes the document,
        not the control.
      -->
      <div class="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <NuxtLink
            :to="backToProductUrl"
            class="inline-flex min-h-[44px] items-center gap-2 -ml-1 pr-2 text-caption text-ink-700 underline-offset-4 transition-colors duration-fast hover:text-ink-950 hover:underline focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to {{ product?.title || 'product' }}</span>
          </NuxtLink>

          <h1 class="mt-1 font-serif text-display-sm text-ink-950 lg:text-display-md">
            Design your {{ product?.title }}
          </h1>

          <!--
            Save state. `role="status"` so a screen reader hears the transition
            to saved without the focus moving: the customer pressed a button and
            stayed where they were, which is exactly the case aria-live exists
            for.
          -->
          <p
            v-if="hasZones"
            role="status"
            aria-live="polite"
            data-test="save-state"
            class="mt-2 flex items-center gap-2 text-micro"
            :class="saveState === 'saved' ? 'text-semantic-success-fg' : 'text-ink-500'"
          >
            <template v-if="saveState === 'saved'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Your design is saved. Add it to your cart from the product page.</span>
            </template>
            <template v-else-if="saveState === 'saving'">
              <span>Saving your design…</span>
            </template>
            <template v-else-if="anyUploaded">
              <span>You have unsaved changes.</span>
            </template>
            <template v-else>
              <span>Upload your artwork to get started.</span>
            </template>
          </p>
        </div>

        <!-- Desktop actions. Mobile gets the sticky bar at the foot instead. -->
        <div v-if="hasZones" class="hidden shrink-0 items-center gap-3 lg:flex">
          <button
            v-if="anyUploaded"
            type="button"
            data-test="discard-design"
            class="inline-flex min-h-[44px] items-center rounded-[0.5rem] px-4 text-caption text-ink-700 underline-offset-4 transition-colors duration-fast hover:text-ink-950 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
            @click="onDiscard"
          >
            Discard
          </button>
          <NuxtLink
            v-if="saveState === 'saved'"
            :to="backToProductUrl"
            data-test="back-to-product-primary"
            class="inline-flex min-h-[44px] items-center justify-center rounded-[0.5rem] bg-ink-950 px-6 text-lead font-medium text-cream-50 transition-colors duration-fast hover:bg-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
          >
            Back to product
          </NuxtLink>
          <button
            v-else
            type="button"
            data-test="save-design"
            :disabled="!anyUploaded || saveState === 'saving'"
            class="inline-flex min-h-[44px] items-center justify-center rounded-[0.5rem] bg-ink-950 px-6 text-lead font-medium text-cream-50 transition-colors duration-fast hover:bg-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 disabled:cursor-not-allowed disabled:bg-ink-400 motion-reduce:transition-none"
            @click="onSave"
          >
            {{ saveLabel }}
          </button>
        </div>
      </div>

      <!-- Restore failure + save failure. Separate messages: one is about the
           past (we lost your file), one about the present (this save failed). -->
      <p
        v-if="restoreNotice"
        data-test="restore-notice"
        class="mb-5 rounded-[0.5rem] border border-semantic-warning-border bg-semantic-warning-surface px-4 py-3 text-caption text-semantic-warning-fg"
      >
        {{ restoreNotice }}
      </p>
      <p
        v-if="saveError"
        role="alert"
        data-test="save-error"
        class="mb-5 rounded-[0.5rem] border border-semantic-danger-border bg-semantic-danger-surface px-4 py-3 text-caption text-semantic-danger-fg"
      >
        {{ saveError }}
      </p>

      <!-- ── Not customisable ─────────────────────────────────────────────── -->
      <div
        v-if="!pending && !hasZones"
        data-test="surface-no-zones"
        class="rounded-[0.5rem] border border-greyLines bg-white px-5 py-8 text-center"
      >
        <p class="mx-auto max-w-[46ch] text-body text-ink-700">
          This product doesn’t have any print zones set up, so there’s nothing to
          design here yet.
        </p>
        <NuxtLink
          :to="productUrl"
          class="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[0.5rem] border border-ink-950 px-6 text-lead font-medium text-ink-950 transition-colors duration-fast hover:bg-ink-950 hover:text-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
        >
          Back to the product
        </NuxtLink>
      </div>

      <!-- ── The editor ────────────────────────────────────────────────────
        `--gm-stage-max-h` bounds the canvas by viewport height; `--gm-rail`
        sets the control column. Both are read by DesignEditor, which owns all
        of its own internal sizing (see STAGE SIZING at the top of that file).
        DO NOT wrap this in a transform: scale().
      -->
      <div
        v-else-if="product"
        ref="surfaceHostRef"
        data-test="design-surface"
        :style="{ '--gm-stage-max-h': stageMaxH, '--gm-rail': '26rem' }"
        class="pb-28 lg:pb-0"
      >
        <ClientOnly>
          <DesignEditor
            ref="editorRef"
            layout="surface"
            :product="product"
            :variant-id="variantIdFromQuery"
            :print-locations="printLocations"
            :techniques="techniques"
            :initial-draft="initialDraft"
            @error="onEditorError"
            @uploaded-state-change="onUploadedStateChange"
            @live-preview="markDirty"
            @draft-restored="onDraftRestored"
          />
          <template #fallback>
            <div class="flex h-[520px] w-full items-center justify-center rounded-[0.5rem] border border-greyLines bg-cream-tile text-caption text-ink-600">
              Loading editor&hellip;
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- ── Mobile sticky action bar ───────────────────────────────────────────
      `bottom-[var(--consent-height,0px)]` is NOT optional and NOT decoration.
      The cookie banner is `fixed bottom-0 z-[60]`; without this offset it sits
      on top of this bar and eats every tap, and a screenshot cannot see it.
      The PDP's sticky bar carries the identical binding for the identical
      reason. The `0px` fallback makes it a no-op if the token is ever absent,
      so this can never be worse than `bottom-0`.
    -->
    <div
      v-if="hasZones && product"
      data-test="surface-sticky-bar"
      class="fixed inset-x-0 z-30 border-t border-greyLines bg-cream-50/95 px-gutter py-3 backdrop-blur transition-[bottom] duration-fast lg:hidden motion-reduce:transition-none"
      :style="{ bottom: 'var(--consent-height, 0px)' }"
    >
      <div class="flex items-center gap-3">
        <NuxtLink
          v-if="saveState === 'saved'"
          :to="backToProductUrl"
          data-test="sticky-back-to-product"
          class="flex-1 inline-flex min-h-[48px] items-center justify-center rounded-[0.5rem] bg-ink-950 px-4 text-lead font-medium text-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
        >
          Back to product
        </NuxtLink>
        <button
          v-else
          type="button"
          data-test="sticky-save-design"
          :disabled="!anyUploaded || saveState === 'saving'"
          class="flex-1 inline-flex min-h-[48px] items-center justify-center rounded-[0.5rem] bg-ink-950 px-4 text-lead font-medium text-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 disabled:cursor-not-allowed disabled:bg-ink-400"
          @click="onSave"
        >
          {{ saveLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
