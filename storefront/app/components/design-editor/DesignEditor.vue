<script setup lang="ts">
// =============================================================================
// DesignEditor: print-on-demand canvas, data-driven from product.metadata.
//
// Konva strategy for arbitrary print locations:
//   - We keep ONE Konva stage with ONE design layer.
//   - Per-location state lives in `designs: Record<string, SideState | null>`,
//     keyed by `location.key`. Each slot owns its own File, HTMLImageElement,
//     position, scale, rotation. A location with `null` has no upload yet.
//   - The `<v-image>` for the design is bound to a `current` computed and
//     re-mounted whenever `activeKey` flips because we `:key` the node on
//     the active key. Re-mount = transformer must re-attach, which we do in
//     a `nextTick` watcher on `activeKey`.
//   - The mockup background image is fetched per-location via the
//     `mockup_url` of the active PrintLocation, with a graceful fallback
//     to `props.product.thumbnail`.
//   - `collectDesignPayload()` gathers ALL locations' designs into a
//     `design_data` object so the fulfilment side can render a per-location
//     proof. The shape is forward-compatible with the per-side payload:
//     `design_data.designs` is a `Record<string, SidePayload | null>` keyed
//     by location key.
//
// ┌───────────────────────────────────────────────────────────────────────────
// │ STAGE SIZING: READ BEFORE WRAPPING THIS COMPONENT IN ANYTHING.
// │
// │ This component sizes its own canvas. It measures its container with a
// │ ResizeObserver and scales the Konva stage to fit. DO NOT wrap it in a
// │ `transform: scale()` envelope, and do not give it a fixed width or
// │ height. It fills what it is given, at 1:1, at any width from ~280px up.
// │
// │ It used to be wrapped that way, in products/[handle].vue, and that
// │ wrapper was the direct cause of every defect this rebuild was called in
// │ to fix:
// │
// │   - `transform: scale()` does not change the layout box, so the wrapper
// │     reserved h-[920px] regardless of what this component rendered. That
// │     is where the "~245px of dead space" came from. The card was not
// │     padded, it was reserved.
// │   - The 390px canvas overflow was pure wrapper arithmetic:
// │     600px inner * scale-[0.55] = 330px rendered into a 327px card.
// │   - Every control in here rendered at 0.46–0.65x, so a nominal 44px
// │     touch target was really ~20px and 13px body copy was really 8.45px.
// │     That is why the mobile upload button had to be lifted OUT of this
// │     component and re-implemented in the page, an escape hatch that
// │     exists only because of the scale wrapper.
// │
// │ The VIRTUAL COORDINATE SPACE IS 600x800 AND MUST NOT CHANGE. Every
// │ persisted number (`design_data.area`, `.position`, `.scale`) is
// │ expressed in it, and it is read back downstream by the order
// │ confirmation email and the admin uploaded-designs widget. `stageScale`
// │ is a *presentation* transform applied to the stage node only; no shape
// │ config below is ever multiplied by it. That is what keeps the payload
// │ byte-identical across any container width.
// │
// │ Two things DO have to be divided by `stageScale`, because they are
// │ measured in rendered pixels rather than virtual units:
// │   1. Capture resolution. `toCanvas()`/`toDataURL()` render at the
// │      stage's *displayed* size, so the proof image would silently drop
// │      from 600x800 to whatever the container happens to be. See
// │      `captureStageBlob` / `emitLivePreview`.
// │   2. Chrome that should stay a constant on-screen thickness, the
// │      transformer anchors and the dashed print-area outline.
// └───────────────────────────────────────────────────────────────────────────
//
// COMMIT OWNERSHIP: read before adding a button to this file.
//   This component does NOT add anything to the cart. It used to: an
//   "Add customised item" button lived at the foot of the helper panel and
//   POSTed to /api/custom-cart directly, which meant the PDP carried FOUR
//   commit controls (this one, the inline ATC, the desktop sticky bar, the
//   mobile sticky bar) of which exactly one attached the artwork. The other
//   three called `addItem(variantId, qty)` and silently dropped the design,
//   a data-loss path that also made the cart's artwork thumbnail and its
//   "E-proof needed" badge unreachable, since only this button could ever
//   populate them.
//
//   The editor is now a *design surface*, not a commit surface. It exposes
//   `collectDesignPayload()`; the PDP's single `onAddToCart` calls it and
//   owns the network hop, the quantity, the error copy and the success
//   state. If you find yourself wanting a second "add" button in here, the
//   answer is to emit / expose instead.
//
// Why this over "N parallel layers + visibility toggle":
//   - vue-konva's transformer needs to be told which node to attach to. With
//     N nodes alive simultaneously we'd have to manage which one the
//     transformer points at on every location toggle AND every upload. The
//     `:key`-driven re-mount is the simplest correct path and trivially
//     scales to 3, 5, or 10 print zones.
//
// Techniques:
//   - The `techniques` prop is rendered AFTER any design exists.
//   - Selection persists across location switches (one technique applies
//     to the whole order, matches merchery/Sandqvist behaviour).
//
// SSR contract: this component MUST be wrapped in <ClientOnly>.
//
// ┌───────────────────────────────────────────────────────────────────────────
// │ NEXT STEP: MIGRATING TO A DEDICATED DESIGN SURFACE.
// │
// │ Two independent research passes concluded that a manipulable canvas does
// │ not belong inline in a product column, and the Mobbin corpus backs it:
// │ nobody embeds one. Magnific navigates to a dedicated mockup surface
// │ (artwork pinned left, blanks right: artwork first, product second).
// │ Semrush opens a full-screen modal editor with ONE primary Save and an
// │ explicit "Your design is saved" confirmation. The only inline
// │ personalisation in the corpus is Etsy's, and that is inline precisely
// │ because it is a character-limited textarea, not a canvas.
// │
// │ This file is deliberately shaped so that migration is a re-mount, not a
// │ rewrite. What it would take:
// │
// │   1. The layout below is a single column with a width-capped stage. On a
// │      dedicated surface it becomes two panes: stage left (uncapped,
// │      `max-w-none`, filling the viewport height), controls right. That is
// │      a change to ONE wrapper div, the stage already sizes to whatever
// │      box it is handed, so nothing else in here moves.
// │   2. `collectDesignPayload()` already returns a plain result object and
// │      touches neither cart nor route. A surface at /products/[handle]/design
// │      would call it on "Save", stash the result (Pinia or route state),
// │      and return to the PDP, which commits it with the rest of the line
// │      item. NOTHING in this file needs to learn about routing.
// │   3. What genuinely does NOT exist yet, and is the real cost:
// │      - a persistence hop, so a design survives the navigation back to
// │        the PDP (today the artwork lives in a per-slot object URL that
// │        dies with the component). `originalUrl` is already a durable
// │        server URL, so the restore path is "rehydrate SideState from
// │        originalUrl", see the `filename: string | null` note on
// │        AttachedDesign, which was written for exactly this case.
// │      - an explicit save/commit split with a confirmation state
// │        (Semrush's "Your design is saved" + "Back to editing").
// │      - entry/exit affordances on the PDP, which is NOT this file's
// │        lane: products/[handle].vue owns the mount.
// │
// │ Estimated 3–5 days, and it touches the mount, which is why this pass
// │ deliberately stopped at making the card good inside its container.
// └───────────────────────────────────────────────────────────────────────────
// =============================================================================
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { StoreProduct } from '@medusajs/types'
import UiButton from '~/components/ui/UiButton.vue'
import UiSpinner from '~/components/ui/UiSpinner.vue'

// -----------------------------------------------------------------------------
// Konva node typings (narrow surface, same rationale as before).
// -----------------------------------------------------------------------------
interface KonvaImageNode {
  x(): number
  x(v: number): void
  y(): number
  y(v: number): void
  width(): number
  height(): number
  scaleX(): number
  scaleX(v: number): void
  scaleY(): number
  scaleY(v: number): void
  rotation(): number
  rotation(v: number): void
}
interface KonvaStageNode {
  toCanvas(config?: { pixelRatio?: number }): HTMLCanvasElement
  toDataURL(config?: { pixelRatio?: number; mimeType?: string; quality?: number }): string
}
interface KonvaTransformerNode {
  nodes(nodes: unknown[]): void
  getLayer(): { batchDraw(): void } | null
}
interface VueKonvaStageRef { getNode(): KonvaStageNode }
interface VueKonvaImageRef { getNode(): KonvaImageNode }
interface VueKonvaTransformerRef { getNode(): KonvaTransformerNode }

// -----------------------------------------------------------------------------
// Public contract: see app/types/print.ts for re-exported shapes.
// -----------------------------------------------------------------------------
export interface DesignArea { x: number; y: number; width: number; height: number }

/**
 * Real-world size of a print zone.
 *
 * OPTIONAL, and dormant today: 0 of 26 catalogue products carry it. The
 * `print_locations[].area` this component actually receives is pixels in the
 * 600x800 virtual space and nothing else. So the cm chip and the DPI readout
 * below render ONLY when a merchant has supplied a real physical size. We do
 * not guess.
 *
 * Guessing is not a harmless default here: a customer who reads "30 x 40 cm"
 * off a card and gets 20 x 26 has grounds for a refund, and a print service
 * lives or dies on that number being true. Absent the field we fall back to
 * statements that are true with the data that exists, the artwork's native
 * pixel dimensions, and whether it is being enlarged past them.
 *
 * ─ NAMING IS DELIBERATE, DO NOT "SIMPLIFY" IT ────────────────────────────
 * `width_cm` / `height_cm` / `dpi` mirror the EXISTING house contract at
 * `product.metadata.pod.print_areas[side]`, written by the admin POD editor
 * (ghostmark/src/admin/routes/design/pod/page.tsx:164) and consumed by
 * ghostmark/src/utils/units.ts (cmToPx/pxToCm, DEFAULT_DPI = 300).
 *
 * An earlier draft of this interface used `width_mm` / `height_mm`. That was
 * wrong, not incorrect maths, but a FOURTH spelling in a codebase whose own
 * model file already documents two competing area-key namespaces and warns
 * "do not unify them" (ghostmark/src/models/design-area.ts:74-81). Adding a
 * third unit convention to that pile is how the next person ends up dividing
 * by 10 in one place and not another.
 *
 * NOT the same thing as the `design_area` MODEL, which is explicitly dead:
 * no module, unregistered, and its tables do not exist (see the "THESE MODELS
 * ARE NOT LIVE" banner in that file). The store route that serves them backs
 * onto an in-memory mock. Do not wire this component to that subsystem.
 *
 * Backend follow-up, in the live namespace only: populate
 * `metadata.pod.print_areas[side].{x_cm,y_cm,width_cm,height_cm,dpi}` and map
 * it onto `print_locations[].print_size` where the PDP builds this prop.
 */
export interface PrintSize {
  width_cm: number
  height_cm: number
  /** Per-area override for the print resolution target. Defaults to 300. */
  dpi?: number
}

export interface PrintLocation {
  key: string
  label: string
  mockup_url?: string | null
  area?: DesignArea
  /** Physical size of `area`. When present, unlocks the cm chip + true DPI. */
  print_size?: PrintSize | null
}

export interface Technique {
  key: string
  label: string
  surcharge?: number
}

/**
 * One print location that currently carries artwork. Emitted upward on every
 * `uploaded-state-change` so the PDP can render the "design attached"
 * confirmation (thumbnail + which zone + which file) without reaching into
 * this component's internals.
 *
 * `filename` is nullable because a slot's `File` handle is the only place the
 * customer-facing name lives, and a future restore-from-server path would
 * legitimately have a design with no local File.
 */
export interface AttachedDesign {
  key: string
  label: string
  filename: string | null
}

/**
 * What `collectDesignPayload()` hands back to the PDP: everything
 * /api/custom-cart needs on the line item, and nothing about quantity or
 * cart identity (both of which the PDP owns).
 */
export interface DesignCommitPayload {
  design_data: Record<string, unknown>
  preview_url: string
}

export type CollectDesignResult =
  | { ok: true; payload: DesignCommitPayload }
  | { ok: false; error: string }

/**
 * The subset of a saved draft this component can rehydrate from.
 *
 * Declared here rather than imported from `useDesignDraft.ts` so the component
 * keeps zero knowledge of where a draft is stored, which storage medium backs
 * it, or that a route exists at all. The composable's `DesignDraftSlot` is
 * structurally compatible; that is the whole contract.
 *
 * `originalUrl` is REQUIRED, not nullable. A slot with no durable server URL
 * has nothing to restore from: its only copy was an object URL that died with
 * the previous mount. Such slots are written out as `null` by `snapshotDraft`.
 */
export interface RestorableDraftSlot {
  originalUrl: string
  originalFilename: string | null
  originalMimeType: string | null
  position: { x: number; y: number }
  scale: number
  rotation: number
  fitMode: string
}

export interface RestorableDraft {
  activeKey: string
  technique: string | null
  slots: Record<string, RestorableDraftSlot | null>
}

interface Props {
  product: StoreProduct
  variantId?: string | null
  /** Required: the merchant-curated set of print zones for this product. */
  printLocations: PrintLocation[]
  /** Optional decoration techniques shown after the first upload. */
  techniques?: Technique[]
  /** Default print area used when a location omits its own `area`. */
  defaultArea?: DesignArea
  /**
   * Which shape to render in.
   *
   *   'inline'  — single column, stage capped at 380px. The PDP card. DEFAULT,
   *               so every existing mount keeps today's behaviour with no
   *               change at the call site.
   *   'surface' — two panes, stage uncapped and bounded by viewport height
   *               instead. The dedicated /design/[handle] route.
   *
   * This is a PRESENTATION switch and nothing else. It does not reach the
   * Konva stage config, the virtual coordinate space, or `collectDesignPayload`.
   * The stage measures its own container either way (see STAGE SIZING at the
   * top), so widening the box is all this has to do.
   */
  layout?: 'inline' | 'surface'
  /**
   * A previously saved draft to rehydrate on mount. See useDesignDraft.ts.
   * Restores artwork from the durable `originalUrl` rather than an object URL,
   * because object URLs do not survive the navigation that made a draft
   * necessary in the first place.
   */
  initialDraft?: RestorableDraft | null
}

const props = withDefaults(defineProps<Props>(), {
  variantId: null,
  techniques: () => [],
  defaultArea: undefined,
  layout: 'inline',
  initialDraft: null,
})

const isSurface = computed<boolean>(() => props.layout === 'surface')

/**
 * Stage box sizing.
 *
 * Inline: aspect ratio only. The `max-w-[380px]` class does the capping.
 *
 * Surface: the constraint flips from width to HEIGHT. The left pane at 1440 is
 * ~900px wide, and 900px at 3:4 is a 1200px-tall canvas the customer would
 * have to scroll to see the bottom of, on the one screen whose entire job is
 * showing them the whole print. So we cap the height at
 * `--gm-stage-max-h` (the page sets it from the viewport) and derive the width
 * from it: width = height * 600/800 = height * 0.75.
 */
const stageWrapStyle = computed<Record<string, string>>(() => {
  const base = { aspectRatio: `${STAGE_W} / ${STAGE_H}` }
  if (!isSurface.value) return base
  return { ...base, maxWidth: `calc(var(--gm-stage-max-h, 70vh) * ${STAGE_W / STAGE_H})` }
})

const emit = defineEmits<{
  (e: 'error', message: string): void
  (e: 'design-uploaded', payload: { locationKey: string }): void
  // Fires whenever the on-stage composite (mockup + design) changes so
  // the parent PDP can mirror it onto the LEFT sticky image pane in real
  // time. `dataUrl` is null when no design is present (revert to bare product).
  (e: 'live-preview', payload: { dataUrl: string | null }): void
  // Strict signal for the parent's ATC gate: derived from `anyUploaded`,
  // which checks whether ANY location has a real `image` set. This is
  // distinct from `live-preview`, the stage is capturable as soon as
  // the bare mockup loads, so a non-null preview dataUrl is NOT a valid
  // proxy for "user has uploaded a design".
  //
  // `attached` rides along on the same event because the PDP's "design
  // attached" confirmation needs to name the zone(s), and a second event
  // would let the boolean and the list drift out of sync.
  (
    e: 'uploaded-state-change',
    payload: { anyUploaded: boolean; attached: AttachedDesign[] },
  ): void
  // Fires once on mount when an `initialDraft` was supplied, reporting how
  // many zones actually came back. `restored: 0` with a non-empty draft means
  // the artwork could not be re-fetched (reaped from disk, or a print zone the
  // merchant has since deleted) and the surface should say so rather than
  // present an empty canvas as though nothing had been saved.
  (e: 'draft-restored', payload: { restored: number }): void
}>()

/*
 * NOTE: there is deliberately no `added` event any more. It existed to tell
 * the PDP that this component had put something in the cart; nothing in here
 * touches the cart now. See "COMMIT OWNERSHIP" in the file header.
 */

// -----------------------------------------------------------------------------
// Placement modes.
//
// This replaces raw Scale/Rotation as the PRIMARY control. Both research
// passes asked for it and the Mobbin corpus is unambiguous: Patreon's merch
// editor exposes placement as two labelled "Design placement" cards, Fill and
// Fit, and Canva's Position panel puts semantic Arrange/Align first and hides
// Width/Height/X/Y/Rotate under an "Advanced" disclosure. Neither surfaces a
// raw scale percentage as the first thing you see.
//
// `custom` is not a button; it is what the segmented control reports when the
// customer has dragged or resized on the canvas and no longer matches any
// preset. Showing a preset as selected when the artwork has since been moved
// would be a lie, and it is the specific lie that makes people distrust an
// editor.
// -----------------------------------------------------------------------------
type FitMode = 'fit' | 'fill' | 'actual' | 'custom'

const FIT_MODES: ReadonlyArray<{ key: Exclude<FitMode, 'custom'>; label: string; hint: string }> = [
  { key: 'fit', label: 'Fit to print area', hint: 'Whole design inside the print area' },
  { key: 'fill', label: 'Fill', hint: 'Covers the print area, edges may be trimmed' },
  { key: 'actual', label: 'Actual size', hint: 'One artwork pixel per print pixel' },
]

// -----------------------------------------------------------------------------
// Per-location state container.
// -----------------------------------------------------------------------------
interface SideState {
  file: File | null
  imageUrl: string // object URL, owned by this slot, must be revoked
  image: HTMLImageElement | null
  position: { x: number; y: number }
  scale: number
  rotation: number
  // Which placement preset the current transform corresponds to, or 'custom'
  // once the customer has dragged/resized past it. Presentation only, it is
  // derivable from `scale`/`position` and is deliberately NOT written into the
  // payload, because the payload contract must stay byte-identical.
  fitMode: FitMode
  // Persisted upload of the ORIGINAL file (not the preview screenshot).
  // Filled in asynchronously by `loadDesign` so the user can keep
  // positioning while the upload races to completion. When
  // `collectDesignPayload` runs, these fields are read into `sidePayload`
  // so the line item metadata carries the durable URL: production needs the original
  // artwork to render high-quality print files, the preview screenshot
  // is too lossy.
  //
  //   originalUrl:         server-relative URL (e.g. /uploads/designs/…)
  //   originalFilename:    what the customer named the file (for support)
  //   originalMimeType:    image/png | image/jpeg | image/webp
  //   uploadingOriginal:   true while the network request is in flight
  //   originalUploadError: non-null if the upload failed; we still
  //     allow ATC because the customer can re-upload from order detail
  //     later, but we surface a warning in the UI.
  originalUrl: string | null
  originalFilename: string | null
  originalMimeType: string | null
  uploadingOriginal: boolean
  originalUploadError: string | null
}

// VIRTUAL coordinate space. Every persisted number is in these units.
// See the STAGE SIZING block at the top of this file before touching them.
const STAGE_W = 600
const STAGE_H = 800

const fallbackArea: DesignArea = {
  x: STAGE_W * 0.25,
  y: STAGE_H * 0.25,
  width: STAGE_W * 0.5,
  height: STAGE_H * 0.5,
}

// Resolve printable area for a given location: location.area > prop default >
// global fallback. Each accessor is keyed by location to keep area flips
// reactive when the merchant edits metadata.
const areaForKey = (key: string): DesignArea => {
  const loc = props.printLocations.find((l) => l.key === key)
  return loc?.area ?? props.defaultArea ?? fallbackArea
}

const printSizeForKey = (key: string): PrintSize | null => {
  const loc = props.printLocations.find((l) => l.key === key)
  const ps = loc?.print_size
  if (!ps || !(ps.width_cm > 0) || !(ps.height_cm > 0)) return null
  return ps
}

const makeEmptySide = (key: string): SideState => {
  const a = areaForKey(key)
  return {
    file: null,
    imageUrl: '',
    image: null,
    position: { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    scale: 1,
    rotation: 0,
    fitMode: 'fit',
    originalUrl: null,
    originalFilename: null,
    originalMimeType: null,
    uploadingOriginal: false,
    originalUploadError: null,
  }
}

// `designs` is keyed by location.key and seeded for every location in props
// up-front so the v-for over locations can read it without optional chaining.
// `null` means "no upload yet", we keep the key alive for the dot indicator
// without holding an empty SideState.
const designs = ref<Record<string, SideState | null>>({})
const sideImages = shallowRef<Record<string, HTMLImageElement | null>>({})

const seedKeys = (keys: string[]) => {
  const nextDesigns: Record<string, SideState | null> = { ...designs.value }
  const nextImages: Record<string, HTMLImageElement | null> = { ...sideImages.value }
  let mutated = false
  for (const k of keys) {
    if (!(k in nextDesigns)) { nextDesigns[k] = null; mutated = true }
    if (!(k in nextImages)) { nextImages[k] = null; mutated = true }
  }
  // Reap removed keys (merchant may have rewritten metadata mid-session).
  for (const k of Object.keys(nextDesigns)) {
    if (!keys.includes(k)) {
      const slot = nextDesigns[k]
      if (slot?.imageUrl) URL.revokeObjectURL(slot.imageUrl)
      delete nextDesigns[k]
      delete nextImages[k]
      mutated = true
    }
  }
  if (mutated) {
    designs.value = nextDesigns
    sideImages.value = nextImages
  }
}

const activeKey = ref<string>(props.printLocations[0]?.key ?? '')

// Initial seed + re-seed when print_locations prop changes. Runs immediately
// so v-for over locations can read `designs[key]` without optional chaining.
watch(
  () => props.printLocations.map((l) => l.key).join('|'),
  () => {
    const keys = props.printLocations.map((l) => l.key)
    seedKeys(keys)
    if (!keys.includes(activeKey.value) && keys[0]) activeKey.value = keys[0]
  },
  { immediate: true },
)

const currentArea = computed<DesignArea>(() => areaForKey(activeKey.value))
const currentPrintSize = computed<PrintSize | null>(() => printSizeForKey(activeKey.value))

const current = computed<SideState | null>(() => designs.value[activeKey.value] ?? null)
const currentImage = computed<HTMLImageElement | null>(() => sideImages.value[activeKey.value] ?? null)

// -----------------------------------------------------------------------------
// Responsive stage sizing.
//
// The stage renders at `STAGE_* x stageScale` CSS pixels and the stage node
// carries a matching `scaleX/scaleY`, so the 600x800 virtual space maps onto
// whatever width the container gives us. No shape config is ever multiplied by
// this value: see the STAGE SIZING block at the top of the file.
// -----------------------------------------------------------------------------
const stageWrapRef = ref<HTMLElement | null>(null)
// Seeded at 1 so the very first (pre-measure) render is a correct 1:1 stage
// rather than a zero-sized one; the observer corrects it on the first frame.
const stageScale = ref(1)
let resizeObserver: ResizeObserver | null = null

const applyStageWidth = (width: number) => {
  if (!(width > 0)) return
  // Clamp the low end so a display:none / collapsed ancestor can never drive
  // stageScale to ~0 and make the capture compensation below divide by it.
  stageScale.value = Math.max(width / STAGE_W, 0.05)
}

onMounted(() => {
  const el = stageWrapRef.value
  if (!el) return
  applyStageWidth(el.getBoundingClientRect().width)
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width
    if (typeof w === 'number') applyStageWidth(w)
  })
  resizeObserver.observe(el)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

const stageConfig = computed(() => ({
  width: STAGE_W * stageScale.value,
  height: STAGE_H * stageScale.value,
  scaleX: stageScale.value,
  scaleY: stageScale.value,
}))

// Chrome that must hold a constant ON-SCREEN thickness has to be divided by
// the stage scale, because Konva strokes and anchors are expressed in virtual
// units and therefore shrink with the stage.
const chrome = computed(() => {
  const s = stageScale.value || 1
  return {
    anchorSize: 8 / s,
    strokeWidth: 1 / s,
    dash: [6 / s, 4 / s],
  }
})

// -----------------------------------------------------------------------------
// Mockup resolution per location.
// -----------------------------------------------------------------------------
const mockupUrlForKey = (key: string): string => {
  const loc = props.printLocations.find((l) => l.key === key)
  if (loc?.mockup_url) return loc.mockup_url
  return props.product?.thumbnail || ''
}
const activeMockupUrl = computed<string>(() => mockupUrlForKey(activeKey.value))

const mockupImage = shallowRef<HTMLImageElement | null>(null)
const mockupLoading = ref(false)

watch(
  activeMockupUrl,
  (url) => {
    if (!url || typeof window === 'undefined') {
      mockupImage.value = null
      return
    }
    mockupLoading.value = true
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      mockupImage.value = img
      mockupLoading.value = false
    }
    img.onerror = () => {
      mockupImage.value = null
      mockupLoading.value = false
    }
    img.src = url
  },
  { immediate: true },
)

const mockupGeometry = computed(() => {
  const img = mockupImage.value
  if (!img) return { x: 0, y: 0, width: STAGE_W, height: STAGE_H }
  const ratio = Math.max(STAGE_W / img.width, STAGE_H / img.height)
  const w = img.width * ratio
  const h = img.height * ratio
  return { x: (STAGE_W - w) / 2, y: (STAGE_H - h) / 2, width: w, height: h }
})

// -----------------------------------------------------------------------------
// Konva refs.
// -----------------------------------------------------------------------------
const fileInput = ref<HTMLInputElement | null>(null)
const stageRef = ref<VueKonvaStageRef | null>(null)
const designImageRef = ref<VueKonvaImageRef | null>(null)
const transformerRef = ref<VueKonvaTransformerRef | null>(null)

// -----------------------------------------------------------------------------
// File loading: per-active-key.
// -----------------------------------------------------------------------------
// Rejections are shown BOTH locally (under the dropzone, where the customer
// is looking and where the fix lives) and emitted upward (so the PDP can
// clear any stale "add to cart" state). Previously they were emit-only,
// which meant a rejected file rendered its explanation next to a button
// three cards further down the page.
const rejectFile = (message: string): void => {
  errorMessage.value = message
  emit('error', message)
}

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp']
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const onPickFile = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!ACCEPTED_MIME.includes(file.type)) {
    rejectFile('Unsupported file type. PNG, JPEG, or WebP only.')
    return
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    rejectFile('Design file too large (max 10MB).')
    return
  }
  errorMessage.value = null
  loadDesign(file, activeKey.value)
}

// Persist the ORIGINAL design file to the server (not the preview
// screenshot, that flow is in `collectDesignPayload`). This is what production
// uses to render high-quality print files, so it has to survive the
// browser session. We POST the same multipart shape as the existing
// /api/uploads/image endpoint accepts, then patch the slot with the
// returned URL when the response lands.
//
// Errors are NOT fatal: we set `originalUploadError` on the slot so
// the UI can show a "retry" hint, but `collectDesignPayload` will still
// ship the metadata (just with `originalUrl: null`). This means a user with
// a flaky connection can still place an order; support can chase the
// missing artwork from order detail.
const uploadOriginalFile = async (file: File, key: string): Promise<void> => {
  // Mark in-flight so `waitForOriginalUploads` holds the commit until done.
  const cur = designs.value[key]
  if (!cur) return
  designs.value = {
    ...designs.value,
    [key]: { ...cur, uploadingOriginal: true, originalUploadError: null },
  }
  try {
    const fd = new FormData()
    fd.append('image', file, file.name || 'design')
    const res = await $fetch<{ url: string; bytes: number; mime: string }>(
      '/api/uploads/image',
      { method: 'POST', body: fd },
    )
    // Re-read the slot at write time: the user may have removed the
    // design or swapped a new file while this upload was racing. In
    // either case we drop the result on the floor rather than clobber.
    const after = designs.value[key]
    if (!after || after.file !== file) return
    designs.value = {
      ...designs.value,
      [key]: {
        ...after,
        originalUrl: res.url,
        originalFilename: file.name || null,
        originalMimeType: file.type || res.mime || null,
        uploadingOriginal: false,
        originalUploadError: null,
      },
    }
  } catch (e: unknown) {
    const after = designs.value[key]
    if (!after || after.file !== file) return
    const message = e instanceof Error ? e.message : 'Upload failed'
    designs.value = {
      ...designs.value,
      [key]: {
        ...after,
        uploadingOriginal: false,
        originalUploadError: message,
      },
    }
    emit('error', `Couldn't upload the original design file: ${message}. You can still add to cart. We'll request the file again from your order page.`)
  }
}

const loadDesign = (file: File, key: string) => {
  const prev = designs.value[key]
  if (prev?.imageUrl) URL.revokeObjectURL(prev.imageUrl)

  const url = URL.createObjectURL(file)
  const img = new window.Image()
  img.onload = () => {
    const a = areaForKey(key)
    // Unchanged from the original: `fit` IS this formula, so a fresh upload
    // lands on exactly the scale it always did. Preserving this keeps the
    // payload identical for the default (upload-then-commit) path.
    const initialScale = Math.min(
      a.width / img.width,
      a.height / img.height,
      1,
    )
    designs.value = {
      ...designs.value,
      [key]: {
        file,
        imageUrl: url,
        image: img,
        position: { x: a.x + a.width / 2, y: a.y + a.height / 2 },
        scale: initialScale,
        rotation: 0,
        fitMode: 'fit',
        // Original-file persistence kicks off below; seed the metadata
        // fields with sensible defaults so the type contract holds
        // even if the user smashes "Add to cart" before the upload
        // settles.
        originalUrl: null,
        originalFilename: file.name || null,
        originalMimeType: file.type || null,
        uploadingOriginal: true,
        originalUploadError: null,
      },
    }
    sideImages.value = { ...sideImages.value, [key]: img }
    if (key === activeKey.value) void nextTick(attachTransformer)
    emit('design-uploaded', { locationKey: key })
    void nextTick(emitLivePreview)
    // Fire-and-forget. `uploadOriginalFile` reads the slot, mutates
    // it on completion, and is safe across re-renders + file swaps.
    void uploadOriginalFile(file, key)
  }
  img.src = url
}

// -----------------------------------------------------------------------------
// Draft rehydration: restore artwork that outlived this component's last mount.
//
// The inline editor never needed this. A dedicated surface does: the customer
// positions artwork at /design/[handle], navigates back to the PDP, and every
// object URL this component owned has been revoked by `onBeforeUnmount`. The
// durable copy is `originalUrl`, written server-side at drop time.
// -----------------------------------------------------------------------------

/**
 * Only ever restore from our OWN upload directory.
 *
 * This is not defensive theatre. A draft comes back out of sessionStorage,
 * which any script on the origin can write, and a cross-origin image URL loads
 * perfectly happily into a Konva stage and then TAINTS the canvas. The failure
 * would not appear here: it would appear later, as a SecurityError thrown by
 * `canvas.toBlob()` inside `collectDesignPayload`, i.e. at the moment the
 * customer presses save, with no way to explain it to them. Rejecting the URL
 * at restore time turns a silent commit-time failure into a re-upload.
 *
 * Relative same-origin paths only, and no protocol-relative `//host` smuggling.
 */
const isRestorableUrl = (url: string): boolean =>
  typeof url === 'string' && url.startsWith('/uploads/') && !url.startsWith('//')

const loadImageFromUrl = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new window.Image()
    // Deliberately NOT setting `crossOrigin`. These are same-origin paths, and
    // setting it would force a CORS preflight the static handler does not
    // answer, turning a working load into a failure.
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })

/**
 * Rehydrate from a saved draft. Best-effort per slot: a zone whose artwork has
 * been reaped from disk, or whose print location the merchant has since
 * deleted, is skipped rather than failing the whole restore. Losing one zone
 * is recoverable by re-uploading it; losing all four because one 404'd is not.
 */
const restoreDraft = async (draft: RestorableDraft): Promise<number> => {
  if (!draft || !draft.slots) return 0
  const validKeys = new Set(props.printLocations.map((l) => l.key))
  let restored = 0

  const loaded = await Promise.all(
    Object.entries(draft.slots).map(async ([key, slot]) => {
      if (!slot || !validKeys.has(key) || !isRestorableUrl(slot.originalUrl)) return null
      const img = await loadImageFromUrl(slot.originalUrl)
      return img ? ({ key, slot, img } as const) : null
    }),
  )

  const nextDesigns = { ...designs.value }
  const nextImages = { ...sideImages.value }
  for (const entry of loaded) {
    if (!entry) continue
    const { key, slot, img } = entry
    nextDesigns[key] = {
      // No File handle: the customer's original File object is genuinely gone.
      // `filename: string | null` on AttachedDesign was written for exactly
      // this case, and `originalFilename` below keeps the name for the UI.
      file: null,
      // The durable URL stands in for the object URL. Note this is a strict
      // improvement on what a blob URL carried into the payload: a `blob:`
      // handle is dead the moment the tab closes, this one resolves.
      imageUrl: slot.originalUrl,
      image: img,
      position: { x: slot.position.x, y: slot.position.y },
      scale: slot.scale,
      rotation: slot.rotation,
      fitMode: (['fit', 'fill', 'actual', 'custom'] as const).includes(slot.fitMode as FitMode)
        ? (slot.fitMode as FitMode)
        : 'custom',
      originalUrl: slot.originalUrl,
      originalFilename: slot.originalFilename,
      originalMimeType: slot.originalMimeType,
      uploadingOriginal: false,
      originalUploadError: null,
    }
    nextImages[key] = img
    restored += 1
  }
  if (!restored) return 0

  designs.value = nextDesigns
  sideImages.value = nextImages
  if (draft.activeKey && validKeys.has(draft.activeKey)) activeKey.value = draft.activeKey
  if (draft.technique && props.techniques.some((t) => t.key === draft.technique)) {
    selectedTechnique.value = draft.technique
  }
  await nextTick()
  attachTransformer()
  void emitLivePreview()
  return restored
}

/**
 * The inverse. Produces a structured-clone-safe snapshot; anything that cannot
 * survive JSON (File, HTMLImageElement, object URL) is dropped by construction
 * rather than by a serialiser silently turning it into `{}`.
 *
 * A slot with no `originalUrl` is written as `null`: its background upload
 * either failed or is still racing, so there is nothing durable to come back
 * to. `waitForOriginalUploads()` is what makes that rare on the save path.
 */
const snapshotDraft = (): RestorableDraft => {
  const slots: Record<string, RestorableDraftSlot | null> = {}
  for (const loc of props.printLocations) {
    const slot = designs.value[loc.key]
    slots[loc.key] = slot && slot.image && slot.originalUrl
      ? {
          originalUrl: slot.originalUrl,
          originalFilename: slot.originalFilename,
          originalMimeType: slot.originalMimeType,
          position: { x: slot.position.x, y: slot.position.y },
          scale: slot.scale,
          rotation: slot.rotation,
          fitMode: slot.fitMode,
        }
      : null
  }
  return { activeKey: activeKey.value, technique: selectedTechnique.value, slots }
}

const attachTransformer = () => {
  const t = transformerRef.value?.getNode()
  const node = designImageRef.value?.getNode()
  if (!t) return
  if (!node) {
    t.nodes([])
    t.getLayer()?.batchDraw()
    return
  }
  t.nodes([node])
  t.getLayer()?.batchDraw()
}

// When the user toggles locations the <v-image>'s `:key` flips, so Vue
// re-mounts the node. We need to re-attach the transformer to the freshly
// mounted node.
watch(activeKey, () => {
  void nextTick(() => {
    attachTransformer()
    void emitLivePreview()
  })
})

// First-mount attach (e.g. SSR rehydration on a location that already has a
// design, won't happen with object URLs but is correct in principle).
watch(currentImage, (img) => {
  if (img) void nextTick(attachTransformer)
})

const onTransformEnd = () => {
  const node = designImageRef.value?.getNode()
  const slot = designs.value[activeKey.value]
  if (!node || !slot) return
  const next = node.scaleX()
  node.scaleY(next)
  slot.scale = next
  slot.rotation = node.rotation()
  slot.position = { x: node.x(), y: node.y() }
  // Hand-resized: no preset describes this any more.
  slot.fitMode = 'custom'
  void emitLivePreview()
}

const onDragEnd = () => {
  const node = designImageRef.value?.getNode()
  const slot = designs.value[activeKey.value]
  if (!node || !slot) return
  slot.position = { x: node.x(), y: node.y() }
  slot.fitMode = 'custom'
  void emitLivePreview()
}

// `capturing` hides the dashed area outline + transformer handles while the
// stage is being snapshotted so the LEFT pane gets a clean composite.
const capturing = ref(false)

const emitLivePreview = async () => {
  // Nothing to mirror if no design exists on any location.
  const anyImage = Object.values(designs.value).some((s) => !!s?.image)
  if (!anyImage) {
    emit('live-preview', { dataUrl: null })
    return
  }
  const stage = stageRef.value?.getNode()
  if (!stage) return
  capturing.value = true
  await nextTick()
  try {
    // pixelRatio is divided by the stage scale so the emitted preview is
    // 1200x1600 at EVERY container width. Without the division this would
    // silently shrink with the viewport. See the STAGE SIZING block.
    const dataUrl = stage.toDataURL({
      pixelRatio: 2 / (stageScale.value || 1),
      mimeType: 'image/png',
    })
    emit('live-preview', { dataUrl })
  } finally {
    capturing.value = false
  }
}

// -----------------------------------------------------------------------------
// Placement presets.
//
// Each preset is a pure function of (artwork intrinsic size, print area), so
// re-applying one is idempotent and switching between them is lossless. All
// three re-centre, because a preset that preserved an off-centre drag would
// not be a preset.
// -----------------------------------------------------------------------------
const scaleForMode = (mode: Exclude<FitMode, 'custom'>, img: HTMLImageElement, a: DesignArea): number => {
  if (mode === 'actual') return 1
  if (mode === 'fill') return Math.max(a.width / img.width, a.height / img.height)
  // 'fit': identical to the on-upload formula, including the `1` clamp that
  // stops small artwork being blown up just to fill the box.
  return Math.min(a.width / img.width, a.height / img.height, 1)
}

const applyFit = (mode: Exclude<FitMode, 'custom'>) => {
  const slot = designs.value[activeKey.value]
  if (!slot?.image) return
  const a = currentArea.value
  slot.position = { x: a.x + a.width / 2, y: a.y + a.height / 2 }
  slot.scale = scaleForMode(mode, slot.image, a)
  slot.rotation = 0
  slot.fitMode = mode
  void nextTick(() => {
    attachTransformer()
    void emitLivePreview()
  })
}

const activeFitMode = computed<FitMode>(() => current.value?.fitMode ?? 'fit')

// Roving-tabindex target for the segmented control: the selected option owns
// the tab stop, or the first option when the transform is 'custom'. This is
// the WAI-ARIA radiogroup pattern (one tab stop for the group, arrows to move
// within it) rather than three separate tab stops.
const fitRovingKey = computed<string>(() => {
  const m = activeFitMode.value
  return m === 'custom' ? FIT_MODES[0]!.key : m
})

const onFitKeydown = (e: KeyboardEvent, index: number) => {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(e.key)) return
  e.preventDefault()
  const last = FIT_MODES.length - 1
  let next = index
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index === last ? 0 : index + 1
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index === 0 ? last : index - 1
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = last
  const mode = FIT_MODES[next]
  if (!mode) return
  applyFit(mode.key)
  void nextTick(() => {
    const el = document.querySelector<HTMLButtonElement>(`[data-test="fit-mode-${mode.key}"]`)
    el?.focus()
  })
}

// -----------------------------------------------------------------------------
// Drag & drop wiring.
// -----------------------------------------------------------------------------
const isDragging = ref(false)
const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}
const onDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
}
const onDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  if (!ACCEPTED_MIME.includes(file.type)) {
    rejectFile('Drop a PNG, JPEG, or WebP. Vector files (PDF/AI/EPS) need our vectorisation team.')
    return
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    rejectFile('Design file too large (max 10MB).')
    return
  }
  errorMessage.value = null
  loadDesign(file, activeKey.value)
}

const removeDesign = () => {
  const key = activeKey.value
  const slot = designs.value[key]
  if (slot?.imageUrl) URL.revokeObjectURL(slot.imageUrl)
  designs.value = { ...designs.value, [key]: null }
  sideImages.value = { ...sideImages.value, [key]: null }
  errorMessage.value = null
  if (fileInput.value) fileInput.value.value = ''
  void nextTick(() => {
    attachTransformer()
    void emitLivePreview()
  })
}

/**
 * Drop the artwork on EVERY location.
 *
 * Exposed for the PDP's "design attached" confirmation strip, whose `Remove`
 * affordance is a promise about the whole order line, not about whichever
 * zone tab happens to be active behind it. Removing only the active zone
 * there would leave a second zone silently attached and the confirmation
 * still showing, the exact class of silent-state bug this round exists to
 * close.
 */
const removeAllDesigns = (): void => {
  const nextDesigns: Record<string, SideState | null> = {}
  const nextImages: Record<string, HTMLImageElement | null> = {}
  for (const key of Object.keys(designs.value)) {
    const slot = designs.value[key]
    if (slot?.imageUrl) URL.revokeObjectURL(slot.imageUrl)
    nextDesigns[key] = null
    nextImages[key] = null
  }
  designs.value = nextDesigns
  sideImages.value = nextImages
  errorMessage.value = null
  if (fileInput.value) fileInput.value.value = ''
  void nextTick(() => {
    attachTransformer()
    void emitLivePreview()
  })
}

// -----------------------------------------------------------------------------
// Slider models: bind through to the active location. These now live behind
// the `Advanced` disclosure; the presets above are the primary control.
// -----------------------------------------------------------------------------
const showAdvanced = ref(false)

const scalePct = computed<number>({
  get: () => Math.round((current.value?.scale ?? 1) * 100),
  set: (v) => {
    const slot = designs.value[activeKey.value]
    if (!slot) return
    const next = Math.max(0.05, Math.min(3, v / 100))
    slot.scale = next
    slot.fitMode = 'custom'
  },
})
const rotationDeg = computed<number>({
  get: () => Math.round(current.value?.rotation ?? 0),
  set: (v) => {
    const slot = designs.value[activeKey.value]
    if (!slot) return
    slot.rotation = ((v % 360) + 360) % 360
    slot.fitMode = 'custom'
  },
})

// -----------------------------------------------------------------------------
// Artwork resolution reporting.
//
// Patreon's merch editor puts "Image quality: Good / 1521 DPI" directly on the
// uploaded-file row, next to Replace file. We do the same, but we only claim a
// DPI figure when we can actually compute one.
//
// With `print_size`, DPI is exact. The artwork's intrinsic width in pixels is
// rendered across `img.width * scale` virtual units, and the area spans
// `print_size.width_cm` across `area.width` virtual units, so:
//
//   cmPerUnit        = print_size.width_cm / area.width
//   physicalWidthCm  = img.width * scale * cmPerUnit
//   dpi              = img.width / (physicalWidthCm / 2.54)
//                    = 2.54 / (scale * cmPerUnit)
//
// which collapses to a function of the current scale alone, so the readout
// tracks the sliders live, which is the entire point of showing it.
//
// 2.54 is the same inch used by units.ts's cmToPx/pxToCm, so a figure shown
// here and a figure computed server-side agree by construction.
//
// Without `print_size` no honest DPI exists, so we report the one thing that
// is still true and still actionable: whether the raster is being enlarged
// past its native size. `scale > 1` means each artwork pixel is being
// stretched across more than one print pixel, which is what actually makes a
// logo look soft.
//
// 300 DPI is not an invented threshold. It is `DEFAULT_DPI` in
// ghostmark/src/utils/units.ts:4, the constant the admin POD editor and both
// design-area routes already default to, and it is the figure published to
// customers on the help page. A per-zone `print_size.dpi` overrides it, which
// mirrors `print_areas[side].dpi` overriding `pod.dpi` on the backend.
// -----------------------------------------------------------------------------
const MIN_PRINT_DPI = 300

interface QualityReport {
  tone: 'success' | 'warning' | 'danger'
  label: string
  detail: string
  dpi: number | null
}

const qualityReport = computed<QualityReport | null>(() => {
  const slot = current.value
  const img = currentImage.value
  if (!slot || !img) return null

  const ps = currentPrintSize.value
  const a = currentArea.value

  if (ps) {
    const cmPerUnit = ps.width_cm / a.width
    const dpi = Math.round(2.54 / (slot.scale * cmPerUnit))
    const target = ps.dpi && ps.dpi > 0 ? ps.dpi : MIN_PRINT_DPI
    if (dpi >= target) {
      return { tone: 'success', label: 'Good', dpi, detail: `${dpi} DPI at this size` }
    }
    if (dpi >= target / 2) {
      return {
        tone: 'warning',
        label: 'Borderline',
        dpi,
        detail: `${dpi} DPI, below our ${target} DPI target. Scale it down or send larger artwork.`,
      }
    }
    return {
      tone: 'danger',
      label: 'Too low',
      dpi,
      detail: `${dpi} DPI, well below our ${target} DPI target. This will look soft in print.`,
    }
  }

  // No physical size declared for this zone: report what we can prove.
  if (slot.scale > 1.01) {
    return {
      tone: 'warning',
      label: 'Enlarged',
      dpi: null,
      detail: `Scaled to ${Math.round(slot.scale * 100)}% of its original size, may look soft in print.`,
    }
  }
  return {
    tone: 'success',
    label: 'Good',
    dpi: null,
    detail: `${img.naturalWidth} x ${img.naturalHeight} px at original size or smaller`,
  }
})

const printSizeLabel = computed<string | null>(() => {
  const ps = currentPrintSize.value
  if (!ps) return null
  const cm = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
  return `${cm(ps.width_cm)} × ${cm(ps.height_cm)} cm`
})

// -----------------------------------------------------------------------------
// Per-location dot indicator.
// -----------------------------------------------------------------------------
const hasDesign = (key: string): boolean => sideImages.value[key] != null

const anyUploaded = computed<boolean>(() =>
  Object.values(sideImages.value).some((v) => v != null),
)

// The zones that currently carry artwork, in merchant-declared order (we
// iterate `printLocations`, not the `designs` object, so "Front, Back" never
// renders as "Back, Front" just because the customer uploaded back-first).
const attachedDesigns = computed<AttachedDesign[]>(() =>
  props.printLocations
    .filter((loc) => sideImages.value[loc.key] != null)
    .map((loc) => ({
      key: loc.key,
      label: loc.label,
      filename: designs.value[loc.key]?.file?.name ?? null,
    })),
)

// Mirror `anyUploaded` to the parent so the PDP ATC gate can fire on
// real upload state instead of inferring it from the stage's capturable
// dataUrl (which is non-null even before any upload). `immediate` so the
// initial false propagates on mount and the parent's ref is correctly
// seeded.
//
// The watch source is now the *serialised* attached list rather than the
// bare boolean: swapping the file on an already-attached zone doesn't flip
// `anyUploaded`, but it does change what the PDP's confirmation strip should
// be naming. Keying on `key:filename` pairs fires for both transitions and
// still no-ops on pure drag/scale/rotate edits.
watch(
  () => attachedDesigns.value.map((d) => `${d.key}:${d.filename ?? ''}`).join('|'),
  () => {
    emit('uploaded-state-change', {
      anyUploaded: anyUploaded.value,
      attached: attachedDesigns.value,
    })
  },
  { immediate: true },
)

// -----------------------------------------------------------------------------
// Techniques: pill row, default-select first, persists across location flips.
// -----------------------------------------------------------------------------
const selectedTechnique = ref<string | null>(props.techniques[0]?.key ?? null)
watch(
  () => props.techniques.map((t) => t.key).join('|'),
  () => {
    if (!props.techniques.length) {
      selectedTechnique.value = null
      return
    }
    if (!selectedTechnique.value || !props.techniques.find((t) => t.key === selectedTechnique.value)) {
      selectedTechnique.value = props.techniques[0]?.key ?? null
    }
  },
)

const showTablist = computed<boolean>(() => props.printLocations.length >= 2)

// True while any slot's original-file upload is still in flight. We use
// this to block submit so the line item metadata always carries a real
// URL when possible, the design-editor → cart hop is the only chance
// to attach the original artwork, so a half-second wait here saves a
// support round-trip later.
const anyUploadingOriginal = computed<boolean>(() =>
  Object.values(designs.value).some((s) => s?.uploadingOriginal === true),
)

// -----------------------------------------------------------------------------
// Payload collection: capture the stage to PNG, persist it, and hand the
// whole design_data bundle back to the caller.
//
// This used to be `onSubmit`: it did all of the below AND posted to
// /api/custom-cart AND owned its own success/error copy. It is now a pure
// (well, network-effectful but cart-free) collector, because the PDP owns the
// single commit control. See "COMMIT OWNERSHIP" in the file header.
// -----------------------------------------------------------------------------

// Surfaced next to the dropzone. Reserved for problems the customer caused
// and can fix *here*: wrong file type, file too large, artwork upload failed.
// Cart-level failures are the PDP's to narrate, next to the PDP's button.
const errorMessage = ref<string | null>(null)

const captureStageBlob = async (): Promise<Blob | null> => {
  const stage = stageRef.value?.getNode()
  if (!stage) return null
  // `1 / stageScale` restores the full 600x800 virtual space. Konva renders
  // toCanvas() at the stage's DISPLAYED size, so omitting this would ship a
  // proof image that silently shrinks with the customer's viewport, a
  // ~380x507 proof on a phone instead of 600x800.
  const canvas = stage.toCanvas({ pixelRatio: 1 / (stageScale.value || 1) })
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
}

/**
 * Wait for any in-flight original-artwork upload to settle.
 *
 * The old `onSubmit` refused outright ("Hang on, your design is still
 * uploading"). That was defensible when this component owned its own button:
 * the customer could see the pill spinner and press again. It is NOT
 * defensible now that the click arrives from the page's one and only
 * "Add to cart", refusing the primary CTA because of a background request
 * the customer never saw is exactly the kind of dead-end that produces
 * abandoned carts.
 *
 * So we wait instead, bounded. If the upload has not landed inside the
 * budget we proceed anyway with `originalUrl: null`, which the payload
 * already documents as a valid ship path (support can chase the file from
 * order detail). Waiting is the better default; waiting forever is not.
 */
const ORIGINAL_UPLOAD_WAIT_MS = 20_000
const ORIGINAL_UPLOAD_POLL_MS = 150

const waitForOriginalUploads = async (): Promise<void> => {
  const deadline = Date.now() + ORIGINAL_UPLOAD_WAIT_MS
  while (anyUploadingOriginal.value && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, ORIGINAL_UPLOAD_POLL_MS))
  }
}

/**
 * Gather everything the line item needs to carry the customer's artwork.
 *
 * Returns a result object rather than throwing so the PDP can render the
 * failure in its own error slot, next to its own button, without a try/catch
 * around a component method. Never touches the cart.
 *
 * Side effects: captures the Konva stage to PNG and POSTs it to
 * /api/uploads/image (the durable proof image). The per-location ORIGINAL
 * files were already uploaded in the background at drop time; this only
 * waits on them.
 *
 * PAYLOAD STABILITY: every field below is in the 600x800 virtual space and is
 * unaffected by `stageScale`. Do not add presentation state (e.g. `fitMode`)
 * to `sidePayload`: downstream consumers pin this shape.
 */
const collectDesignPayload = async (): Promise<CollectDesignResult> => {
  errorMessage.value = null

  if (!anyUploaded.value) {
    return { ok: false, error: 'Upload a design on at least one print location first.' }
  }

  await waitForOriginalUploads()

  try {
    const blob = await captureStageBlob()
    if (!blob) throw new Error('Could not capture your design preview.')

    const fd = new FormData()
    fd.append('image', blob, 'preview.png')
    const uploadRes = await $fetch<{ url: string }>('/api/uploads/image', {
      method: 'POST',
      body: fd,
    })

    const sidePayload = (key: string) => {
      const slot = designs.value[key]
      if (!slot?.image) return null
      return {
        imageUrl: slot.imageUrl,
        position: slot.position,
        scale: slot.scale,
        rotation: slot.rotation,
        mockupUrl: mockupUrlForKey(key),
        area: areaForKey(key),
        // Original-file URL: durable server-side copy of what the
        // customer actually uploaded. This is what production needs
        // for high-quality rendering. May be null if the background
        // upload failed or was still in flight past the wait budget:
        // both cases are valid ship paths (see `waitForOriginalUploads`
        // and the warning emitted from `uploadOriginalFile`).
        originalUrl: slot.originalUrl,
        originalFilename: slot.originalFilename,
        originalMimeType: slot.originalMimeType,
      }
    }

    const designsPayload: Record<string, ReturnType<typeof sidePayload>> = {}
    for (const loc of props.printLocations) {
      designsPayload[loc.key] = sidePayload(loc.key)
    }

    return {
      ok: true,
      payload: {
        preview_url: uploadRes.url,
        design_data: {
          designs: designsPayload,
          activeLocation: activeKey.value,
          area: currentArea.value,
          technique: selectedTechnique.value,
          // Back-compat shim: the /api/custom-cart route only stringifies
          // the payload, but downstream consumers (admin widgets, the
          // fulfilment proof renderer) may still look up `front` / `back`
          // by name.
          front: designsPayload['front'] ?? null,
          back: designsPayload['back'] ?? null,
          activeSide: activeKey.value,
        },
      },
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Could not prepare your design.'
    errorMessage.value = msg
    return { ok: false, error: msg }
  }
}

// -----------------------------------------------------------------------------
// Cleanup: revoke EVERY location's object URL on unmount.
// -----------------------------------------------------------------------------
onBeforeUnmount(() => {
  for (const slot of Object.values(designs.value)) {
    if (slot?.imageUrl) URL.revokeObjectURL(slot.imageUrl)
  }
})

// -----------------------------------------------------------------------------
// Drag bound function: clamp the design center to the active print area.
// -----------------------------------------------------------------------------
const dragBoundFunc = (pos: { x: number; y: number }): { x: number; y: number } => {
  const a = currentArea.value
  return {
    x: Math.max(a.x, Math.min(a.x + a.width, pos.x)),
    y: Math.max(a.y, Math.min(a.y + a.height, pos.y)),
  }
}

// Pretty caption for the file pill: uses the location label, not the key.
const activeLabel = computed<string>(() => {
  const loc = props.printLocations.find((l) => l.key === activeKey.value)
  return loc?.label ?? activeKey.value
})

const fileSizeLabel = computed<string | null>(() => {
  const f = current.value?.file
  if (!f) return null
  const mb = f.size / 1024 / 1024
  return mb < 0.1 ? `${Math.max(1, Math.round(f.size / 1024))} KB` : `${mb.toFixed(1)} MB`
})

// -----------------------------------------------------------------------------
// Public API: exposed via defineExpose for the parent PDP to drive the
// hidden <input type="file"> without resorting to a DOM querySelector.
//
// `openFilePicker()` exists because the PDP renders its own upload button.
// That button was originally forced OUTSIDE this component because the PDP
// wrapped the editor in `transform: scale()`, which shrank any visible button
// in here to ~26px and failed WCAG 2.5.5 / Apple HIG 44pt. That wrapper is on
// its way out (see the STAGE SIZING block at the top): once it is gone, the
// dropzone in here is a real 44px+ target and the page-level button becomes
// optional rather than a workaround. The method stays exposed regardless, a
// parent driving the picker is a legitimate contract, not just a patch.
//
// `collectDesignPayload()` and `removeAllDesigns()` join it because the PDP
// owns the page's single commit control and the "design attached"
// confirmation strip, and both need to drive this editor from outside.
// Exposing three named methods is a far narrower contract than the
// alternative (lifting the whole `designs` map into the page, or leaving a
// second add-to-cart button in here that only sometimes agrees with the
// first one).
//
// Keep this surface MINIMAL: every method exposed here becomes part of the
// component's public contract for parents.
// -----------------------------------------------------------------------------
function openFilePicker(): void {
  fileInput.value?.click()
}

// -----------------------------------------------------------------------------
// Apply `initialDraft` exactly once, whenever it arrives.
//
// TWO ENTRY POINTS ON PURPOSE, because the prop can land on either side of this
// component's mount and I do not want the restore to depend on which.
//
// The parent reads sessionStorage in ITS `onMounted` (it must: reading storage
// during setup renders "saved" on the client and "not saved" on the server,
// which is a hydration mismatch on a path that ends at the cart). Vue runs a
// child's `onMounted` BEFORE its parent's, so on paper the prop is still null
// when this component mounts. In practice it works today only because
// <ClientOnly> defers rendering this subtree until after the parent has
// mounted — i.e. the restore currently depends on an implementation detail of
// a wrapper component.
//
// That is an accident, not a contract. The watcher makes it a contract: mount
// first or prop first, the draft is applied once and only once.
// -----------------------------------------------------------------------------
let draftApplied = false

const applyInitialDraft = async (draft: RestorableDraft | null): Promise<void> => {
  if (!draft || draftApplied) return
  draftApplied = true
  // One tick so the `printLocations` seed watcher (immediate: true) and the
  // stage refs are settled before `restoreDraft` validates keys against them.
  await nextTick()
  const restored = await restoreDraft(draft)
  emit('draft-restored', { restored })
}

onMounted(() => { void applyInitialDraft(props.initialDraft) })
watch(() => props.initialDraft, (draft) => { void applyInitialDraft(draft) })

defineExpose({
  openFilePicker,
  collectDesignPayload,
  removeAllDesigns,
  // Draft I/O. Added for the dedicated surface; the inline mount never calls
  // them and is unaffected by their existence.
  snapshotDraft,
  restoreDraft,
})
</script>

<template>
  <!--
    Outer chrome: intentionally invisible. The PDP right column already owns
    the card surface, so a background/ring here would be a card-in-card. The
    Konva stage keeps its own `bg-cream-tile` panel because that IS canvas
    chrome, not a container.

    LAYOUT: single column. This used to be
    `lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)]`, which needed 944px of
    internal width and is precisely why the page had to wrap the component in
    `transform: scale()` to squeeze it into a ~490-700px rail. Stacking means
    the component fits any column it is given, the controls get full width
    instead of a 208px rail, and the scale wrapper has no reason to exist.
  -->
  <div
    class="w-full font-body text-ink-700"
    :class="isSurface
      ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,var(--gm-rail,26rem))] lg:items-start lg:gap-10'
      : 'space-y-5'"
    :data-layout="layout"
  >
    <!--
      PANE A: the canvas and the zone tabs that address it.
      PANE B (below): upload, placement, technique.

      This split IS the migration the header block describes. In `inline` both
      panes are plain `space-y-5` boxes inside a `space-y-5` root, so the five
      children render in the same order at the same rhythm as the single
      column did. In `surface` the root becomes a two-column grid and pane A
      drops its width cap.
    -->
    <div :class="isSurface ? 'space-y-4 lg:sticky lg:top-6' : 'space-y-5'">
      <!-- Zone tabs: only when 2+ locations. Solid dot = uploaded, hollow ring = empty. -->
    <div
      v-if="showTablist"
      class="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Design location"
      data-test="design-tablist"
    >
      <button
        v-for="loc in printLocations"
        :key="loc.key"
        role="tab"
        :aria-selected="activeKey === loc.key"
        type="button"
        :data-test="`side-tab-${loc.key}`"
        :data-has-design="hasDesign(loc.key) ? 'true' : 'false'"
        class="inline-flex min-h-[44px] items-center gap-2 rounded-md border px-4 py-2 text-caption capitalize transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
        :class="activeKey === loc.key
          ? 'border-ink-950 bg-ink-950 text-cream-50'
          : 'border-ink-200 bg-white text-ink-900 hover:border-ink-300 hover:bg-ink-50'"
        @click="activeKey = loc.key"
      >
        <span
          :data-test="`side-dot-${loc.key}`"
          :data-state="hasDesign(loc.key) ? 'filled' : 'empty'"
          class="inline-block h-2 w-2 rounded-full ring-1"
          :class="[
            hasDesign(loc.key)
              ? activeKey === loc.key ? 'bg-cream-50 ring-cream-50' : 'bg-ink-950 ring-ink-950'
              : activeKey === loc.key ? 'bg-transparent ring-cream-50' : 'bg-transparent ring-ink-400',
          ]"
          aria-hidden="true"
        />
        <span>{{ loc.label }}</span>
        <span class="sr-only">
          {{ hasDesign(loc.key) ? 'has uploaded design' : 'no design uploaded' }}
        </span>
      </button>
    </div>

    <!-- Stage ---------------------------------------------------------------
      The wrapper is width-capped and centred rather than filling the column.
      A 3:4 canvas at full column width would be ~820px tall in a 614px rail
      and would dominate a step that also has to hold upload, placement and
      technique controls. 380px caps it at 380x507, the same canvas the
      scaled version rendered, in a card that is now actual content rather
      than reserved emptiness.
    -->
    <div>
      <div
        ref="stageWrapRef"
        data-test="design-stage-wrap"
        class="relative mx-auto w-full overflow-hidden rounded-md bg-cream-tile"
        :class="isSurface ? 'max-w-none' : 'max-w-[380px]'"
        :style="stageWrapStyle"
      >
        <div
          v-if="mockupLoading"
          class="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <UiSpinner class="h-6 w-6 text-ink-500" />
        </div>

        <v-stage ref="stageRef" :config="stageConfig" class="block">
          <!-- Mockup background: keyed on URL so a location swap forces a
               clean v-image re-mount even if Konva's image diff misses
               the source change. -->
          <v-layer>
            <v-image
              v-if="mockupImage"
              :key="`mockup-${activeMockupUrl}`"
              :config="{
                image: mockupImage,
                x: mockupGeometry.x,
                y: mockupGeometry.y,
                width: mockupGeometry.width,
                height: mockupGeometry.height,
                listening: false,
              }"
            />
          </v-layer>

          <!-- Design layer (clipped to the printable area). The <v-image>
               is keyed on `activeKey` so flipping locations re-mounts the
               node. The transformer re-attach happens in nextTick(). -->
          <v-layer
            :config="{
              clipX: currentArea.x,
              clipY: currentArea.y,
              clipWidth: currentArea.width,
              clipHeight: currentArea.height,
            }"
          >
            <v-image
              v-if="currentImage && current"
              :key="`design-${activeKey}`"
              ref="designImageRef"
              :config="{
                image: currentImage,
                x: current.position.x,
                y: current.position.y,
                offsetX: currentImage.width / 2,
                offsetY: currentImage.height / 2,
                scaleX: current.scale,
                scaleY: current.scale,
                rotation: current.rotation,
                draggable: true,
                dragBoundFunc,
              }"
              @dragend="onDragEnd"
              @transformend="onTransformEnd"
            />
          </v-layer>

          <!-- Print-area outline + transformer. Hidden during live-preview
               capture so the LEFT pane gets a clean mockup+design composite.
               Stroke widths and anchor size are divided by the stage scale so
               they hold a constant on-screen thickness. -->
          <v-layer :config="{ visible: !capturing }">
            <v-rect
              :config="{
                x: currentArea.x,
                y: currentArea.y,
                width: currentArea.width,
                height: currentArea.height,
                stroke: '#6E6A60',
                strokeWidth: chrome.strokeWidth,
                dash: chrome.dash,
                listening: false,
              }"
            />
            <v-transformer
              ref="transformerRef"
              :config="{
                rotateEnabled: true,
                keepRatio: true,
                anchorSize: chrome.anchorSize,
                anchorStrokeWidth: chrome.strokeWidth,
                borderStrokeWidth: chrome.strokeWidth,
                borderStroke: '#141210',
                anchorStroke: '#141210',
                anchorFill: '#FBF7F1',
                ignoreStroke: true,
              }"
            />
          </v-layer>
        </v-stage>
      </div>

      <!--
        Print-area caption. The physical size renders ONLY when the merchant
        declared `print_size` on the location: see the PrintSize docblock.
        No product carries it yet, so today this line is the drag hint alone.
      -->
      <p class="mx-auto mt-2 max-w-[380px] text-micro text-ink-500 [text-wrap:pretty]">
        <span v-if="printSizeLabel" class="text-ink-700">
          Print area {{ printSizeLabel }}.
        </span>
        Drag or resize your design inside the dashed area.
      </p>
      </div>
    </div>
    <!-- /PANE A -->

    <!-- PANE B: the control layer. Identical in both layouts. -->
    <div class="space-y-5">
    <!-- Upload ---------------------------------------------------------------
      Empty state = dropzone. Filled state = a compact file row (Patreon's
      "Replace file" pattern), which is roughly 80px shorter than the dropzone
      and matters because the filled state is where customers actually spend
      their time.
    -->
    <div>
      <div
        v-if="!current?.file"
        :class="[
          'flex min-h-[9rem] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none',
          isDragging
            ? 'border-ink-950 bg-cream-100 text-ink-950'
            : 'border-ink-300 bg-cream-50 text-ink-700 hover:border-ink-400 hover:bg-cream-100',
        ]"
        role="button"
        tabindex="0"
        :aria-label="`Upload your ${activeLabel.toLowerCase()} design, click or drag and drop`"
        data-test="design-dropzone"
        @click="fileInput?.click()"
        @keydown.enter.prevent="fileInput?.click()"
        @keydown.space.prevent="fileInput?.click()"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <svg class="h-6 w-6 shrink-0 text-ink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span class="text-body font-medium text-ink-900 [text-wrap:balance]">
          Drop your {{ activeLabel.toLowerCase() }} artwork here
        </span>
        <span class="text-caption text-ink-600">or click to browse</span>
        <span class="mt-1 text-micro text-ink-500">PNG, JPEG or WebP &middot; up to 10 MB</span>
        <!--
          Vectorisation note lives INSIDE the dropzone rather than as a
          separate paragraph below it. Patreon does the same with its
          "By uploading, you verify that you own this artwork" line, which sits
          directly under Replace file rather than floating as its own block.
          Folding it in also stops it reading as a second, competing message.
        -->
        <span class="mt-1 text-micro text-ink-500 [text-wrap:pretty]">
          Vector art? Send raster. Free vectorisation included.
        </span>
      </div>

      <!--
        Filled state. Thumbnail + name + size + live quality verdict, with
        Replace and Remove as the two verbs. Mirrors Patreon's uploaded-artwork
        row, which pairs the filename with an "Image quality" readout in exactly
        this position.
      -->
      <div
        v-else
        class="rounded-lg border border-ink-200 bg-cream-50 p-3"
        data-test="design-file-pill"
      >
        <div class="flex items-start gap-3">
          <img
            v-if="current.imageUrl"
            :src="current.imageUrl"
            alt=""
            class="h-12 w-12 shrink-0 rounded-md bg-white object-contain outline outline-1 -outline-offset-1 outline-ink-950/10"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-caption font-medium text-ink-900" :title="current.file.name">
              {{ current.file.name }}
            </p>
            <p class="mt-0.5 text-micro text-ink-500">
              {{ activeLabel }} &middot; <span class="tabular-nums">{{ fileSizeLabel }}</span>
            </p>
          </div>
          <button
            type="button"
            data-test="design-replace"
            class="inline-flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-caption text-ink-700 underline-offset-4 transition-colors duration-fast hover:text-ink-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
            @click="fileInput?.click()"
          >
            Replace
          </button>
        </div>

        <!--
          Live resolution verdict. `aria-live="polite"` because it changes as a
          consequence of the customer moving a slider rather than as a direct
          response to a press, it should be announced, but it must not
          interrupt.
        -->
        <p
          v-if="qualityReport"
          data-test="design-quality"
          :data-tone="qualityReport.tone"
          aria-live="polite"
          class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-micro [text-wrap:pretty]"
          :class="{
            'border-semantic-success-border bg-semantic-success-surface text-semantic-success-fg': qualityReport.tone === 'success',
            'border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning-fg': qualityReport.tone === 'warning',
            'border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger-fg': qualityReport.tone === 'danger',
          }"
        >
          <span class="font-medium">Print quality: {{ qualityReport.label }}</span>
          <span class="tabular-nums">{{ qualityReport.detail }}</span>
        </p>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="hidden"
        aria-label="Upload design image"
        @change="onPickFile"
      />

      <!--
        File-level rejection copy. Lives here, immediately under the control
        that produced it, rather than beside the page's Add-to-cart button
        three cards further down, WCAG 3.3.1/3.3.3 want the error where the
        correction happens. `role="alert"` because the customer just acted
        and needs to know the action failed; the softer polite regions on
        the PDP are for state the customer did not directly trigger.
      -->
      <p
        v-if="errorMessage"
        role="alert"
        data-test="design-editor-error"
        class="mt-2 rounded-md border border-semantic-danger-border bg-semantic-danger-surface px-3 py-2 text-micro text-semantic-danger-fg [text-wrap:pretty]"
      >
        {{ errorMessage }}
      </p>

    </div>

    <!-- Placement ------------------------------------------------------------
      Semantic fit modes as the PRIMARY control, per Patreon's "Design
      placement" Fill/Fit cards and Canva's Position panel. The raw numeric
      transforms live under `Advanced` below.
    -->
    <div v-if="currentImage" data-test="placement-row">
      <p id="placement-label" class="text-eyebrow uppercase text-ink-500">Placement</p>
      <div
        class="mt-2 grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-labelledby="placement-label"
      >
        <button
          v-for="(mode, i) in FIT_MODES"
          :key="mode.key"
          type="button"
          role="radio"
          :aria-checked="activeFitMode === mode.key"
          :tabindex="fitRovingKey === mode.key ? 0 : -1"
          :data-test="`fit-mode-${mode.key}`"
          :title="mode.hint"
          class="inline-flex min-h-[44px] items-center justify-center rounded-md border px-2 py-2 text-center text-caption transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
          :class="activeFitMode === mode.key
            ? 'border-ink-950 bg-ink-950 text-cream-50'
            : 'border-ink-200 bg-white text-ink-900 hover:border-ink-300 hover:bg-ink-50'"
          @click="applyFit(mode.key)"
          @keydown="onFitKeydown($event, i)"
        >
          {{ mode.label }}
        </button>
      </div>
      <p class="mt-2 text-micro text-ink-500 [text-wrap:pretty]" aria-live="polite">
        <template v-if="activeFitMode === 'custom'">
          Custom placement. Pick a preset above to reset it.
        </template>
        <template v-else>
          {{ FIT_MODES.find((m) => m.key === activeFitMode)?.hint }}
        </template>
      </p>

      <!--
        Advanced disclosure. Native <details> so it is keyboard- and
        screen-reader-correct for free, and so the numeric controls stay in the
        DOM order they read in. Canva does the same thing with Width/Height/
        X/Y/Rotate under an "Advanced" heading.
      -->
      <details class="group mt-3 rounded-md border border-ink-200 bg-white">
        <summary
          data-test="advanced-toggle"
          class="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-3 text-caption text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 [&::-webkit-details-marker]:hidden"
        >
          <span>Advanced: scale &amp; rotation</span>
          <svg
            class="h-4 w-4 shrink-0 text-ink-500 transition-transform duration-fast group-open:rotate-180 motion-reduce:transition-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>

        <div class="space-y-4 border-t border-ink-100 px-3 py-4">
          <label class="block">
            <span class="flex items-baseline justify-between text-caption text-ink-700">
              <span>Scale</span>
              <span class="tabular-nums text-ink-500">{{ scalePct }}%</span>
            </span>
            <input
              v-model.number="scalePct"
              type="range"
              min="5"
              max="300"
              step="1"
              class="mt-1 h-11 w-full cursor-pointer accent-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
              :disabled="!currentImage"
              aria-label="Design scale, percent"
            />
          </label>
          <label class="block">
            <span class="flex items-baseline justify-between text-caption text-ink-700">
              <span>Rotation</span>
              <span class="tabular-nums text-ink-500">{{ rotationDeg }}&deg;</span>
            </span>
            <input
              v-model.number="rotationDeg"
              type="range"
              min="0"
              max="360"
              step="1"
              class="mt-1 h-11 w-full cursor-pointer accent-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
              :disabled="!currentImage"
              aria-label="Design rotation, degrees"
            />
          </label>
          <div class="flex flex-wrap gap-2 pt-1">
            <UiButton variant="outline" size="sm" shape="rounded" :disabled="!currentImage" @click="applyFit('fit')">
              Reset placement
            </UiButton>
            <UiButton variant="ghost" size="sm" shape="rounded" data-test="design-remove" @click="removeDesign">
              Remove design
            </UiButton>
          </div>
        </div>
      </details>
    </div>

    <!-- Technique pill row: only AFTER any upload + when techniques exist. -->
    <div v-if="anyUploaded && techniques.length" data-test="technique-row">
      <p id="technique-label" class="text-eyebrow uppercase text-ink-500">Technique</p>
      <div class="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="technique-label">
        <button
          v-for="t in techniques"
          :key="t.key"
          type="button"
          role="radio"
          :aria-checked="selectedTechnique === t.key"
          :data-test="`technique-${t.key}`"
          class="inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-caption transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
          :class="selectedTechnique === t.key
            ? 'border-ink-950 bg-ink-950 text-cream-50'
            : 'border-ink-200 bg-white text-ink-900 hover:border-ink-300 hover:bg-ink-50'"
          @click="selectedTechnique = t.key"
        >
          <span>{{ t.label }}</span>
          <!--
            ⚠️ THE `/ 100` IS LOAD-BEARING. DO NOT "TIDY" IT.

            `metadata.techniques[].surcharge` holds MINOR-UNIT money (250 =
            £2.50) by design, and is deliberately excluded from every price
            migration that has run. This divide is a local compensating
            conversion, not leftover cruft; it is the only reason the
            surcharge renders correctly anywhere in the app.

            It looks exactly like the `money.ts` cleanup done earlier in this
            session, which WAS correct there. This one is not the same thing.
            Delete it and every technique surcharge renders 100x too high,
            indistinguishable from the `quantity_tiers` bug.

            This template is the value's ONLY consumer, the PDP parses
            `surcharge` but never renders it, so there is no second place
            that would catch the mistake. Changing it requires changing the
            data and this line together, by one owner, in one pass.
          -->
          <span
            v-if="t.surcharge"
            class="tabular-nums opacity-80"
          >+{{ (t.surcharge / 100).toFixed(2) }}</span>
        </button>
      </div>
    </div>

    <!--
      The "Add customised item" button used to close out this panel. It is
      gone on purpose: see "COMMIT OWNERSHIP" at the top of <script setup>.
      The page's single "Add to cart" now calls `collectDesignPayload()`
      and posts the design with the line item, so there is nothing left in
      here for a customer to press that could commit half an order.

      That still holds on the dedicated surface. /design/[handle] renders a
      "Save design" button, but Save is not a commit: it collects the payload
      and hands it to the draft store. The cart is still touched in exactly
      one place, the PDP's onAddToCart.
    -->
    </div>
    <!-- /PANE B -->
  </div>
</template>
