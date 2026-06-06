<script setup lang="ts">
// =============================================================================
// DesignEditor — print-on-demand canvas, data-driven from product.metadata.
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
//   - "Add to cart" submits ALL locations' designs in `design_data` so the
//     fulfilment side can render a per-location proof. The shape is
//     forward-compatible with the per-side payload — `design_data.designs`
//     is now a `Record<string, SidePayload | null>` keyed by location key.
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
//     to the whole order — matches merchery/Sandqvist behaviour).
//
// SSR contract: this component MUST be wrapped in <ClientOnly>.
// =============================================================================
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { StoreProduct } from '@medusajs/types'
import UiButton from '~/components/ui/UiButton.vue'
import UiSpinner from '~/components/ui/UiSpinner.vue'

// -----------------------------------------------------------------------------
// Konva node typings (narrow surface — same rationale as before).
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
  toCanvas(): HTMLCanvasElement
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
// Public contract — see app/types/print.ts for re-exported shapes.
// -----------------------------------------------------------------------------
export interface DesignArea { x: number; y: number; width: number; height: number }

export interface PrintLocation {
  key: string
  label: string
  mockup_url?: string | null
  area?: DesignArea
}

export interface Technique {
  key: string
  label: string
  surcharge?: number
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
}

const props = withDefaults(defineProps<Props>(), {
  variantId: null,
  techniques: () => [],
  defaultArea: undefined,
})

const emit = defineEmits<{
  (e: 'added', payload: { previewUrl: string; cartId: string | null }): void
  (e: 'error', message: string): void
  (e: 'design-uploaded', payload: { locationKey: string }): void
  // Fires whenever the on-stage composite (mockup + design) changes so
  // the parent PDP can mirror it onto the LEFT sticky image pane in real
  // time. `dataUrl` is null when no design is present (revert to bare product).
  (e: 'live-preview', payload: { dataUrl: string | null }): void
  // Strict signal for the parent's ATC gate: derived from `anyUploaded`,
  // which checks whether ANY location has a real `image` set. This is
  // distinct from `live-preview` — the stage is capturable as soon as
  // the bare mockup loads, so a non-null preview dataUrl is NOT a valid
  // proxy for "user has uploaded a design".
  (e: 'uploaded-state-change', payload: { anyUploaded: boolean }): void
}>()

// -----------------------------------------------------------------------------
// Per-location state container.
// -----------------------------------------------------------------------------
interface SideState {
  file: File | null
  imageUrl: string // object URL — owned by this slot, must be revoked
  image: HTMLImageElement | null
  position: { x: number; y: number }
  scale: number
  rotation: number
  // Persisted upload of the ORIGINAL file (not the preview screenshot).
  // Filled in asynchronously by `loadDesign` so the user can keep
  // positioning while the upload races to completion. When `onSubmit`
  // runs, these fields are read into `sidePayload` so the line item
  // metadata carries the durable URL — production needs the original
  // artwork to render high-quality print files, the preview screenshot
  // is too lossy.
  //
  //   originalUrl     — server-relative URL (e.g. /uploads/designs/…)
  //   originalFilename — what the customer named the file (for support)
  //   originalMimeType — image/png | image/jpeg | image/webp
  //   uploadingOriginal — true while the network request is in flight
  //   originalUploadError — non-null if the upload failed; we still
  //     allow ATC because the customer can re-upload from order detail
  //     later, but we surface a warning in the UI.
  originalUrl: string | null
  originalFilename: string | null
  originalMimeType: string | null
  uploadingOriginal: boolean
  originalUploadError: string | null
}

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

const makeEmptySide = (key: string): SideState => {
  const a = areaForKey(key)
  return {
    file: null,
    imageUrl: '',
    image: null,
    position: { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    scale: 1,
    rotation: 0,
    originalUrl: null,
    originalFilename: null,
    originalMimeType: null,
    uploadingOriginal: false,
    originalUploadError: null,
  }
}

// `designs` is keyed by location.key and seeded for every location in props
// up-front so the v-for over locations can read it without optional chaining.
// `null` means "no upload yet" — we keep the key alive for the dot indicator
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

const current = computed<SideState | null>(() => designs.value[activeKey.value] ?? null)
const currentImage = computed<HTMLImageElement | null>(() => sideImages.value[activeKey.value] ?? null)

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
// File loading — per-active-key.
// -----------------------------------------------------------------------------
const onPickFile = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    emit('error', 'Unsupported file type. PNG, JPEG, or WebP only.')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    emit('error', 'Design file too large (max 10MB).')
    return
  }
  loadDesign(file, activeKey.value)
}

// Persist the ORIGINAL design file to the server (not the preview
// screenshot — that flow is in `onSubmit`). This is what production
// uses to render high-quality print files, so it has to survive the
// browser session. We POST the same multipart shape as the existing
// /api/uploads/image endpoint accepts, then patch the slot with the
// returned URL when the response lands.
//
// Errors are NOT fatal — we set `originalUploadError` on the slot so
// the UI can show a "retry" hint, but `onSubmit` will still ship the
// metadata (just with `originalUrl: null`). This means a user with a
// flaky connection can still place an order; support can chase the
// missing artwork from order detail.
const uploadOriginalFile = async (file: File, key: string): Promise<void> => {
  // Mark in-flight so anyUploadingOriginal blocks ATC until done.
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
    emit('error', `Couldn't upload the original design file: ${message}. You can still add to cart — we'll request the file again from your order page.`)
  }
}

const loadDesign = (file: File, key: string) => {
  const prev = designs.value[key]
  if (prev?.imageUrl) URL.revokeObjectURL(prev.imageUrl)

  const url = URL.createObjectURL(file)
  const img = new window.Image()
  img.onload = () => {
    const a = areaForKey(key)
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
// design — won't happen with object URLs but is correct in principle).
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
  void emitLivePreview()
}

const onDragEnd = () => {
  const node = designImageRef.value?.getNode()
  const slot = designs.value[activeKey.value]
  if (!node || !slot) return
  slot.position = { x: node.x(), y: node.y() }
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
    const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
    emit('live-preview', { dataUrl })
  } finally {
    capturing.value = false
  }
}

const resetTransform = () => {
  const slot = designs.value[activeKey.value]
  if (!slot) return
  const a = currentArea.value
  slot.position = { x: a.x + a.width / 2, y: a.y + a.height / 2 }
  slot.scale = slot.image
    ? Math.min(a.width / slot.image.width, a.height / slot.image.height, 1)
    : 1
  slot.rotation = 0
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
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    emit('error', 'Drop a PNG, JPEG, or WebP. Vector files (PDF/AI/EPS) need our vectorisation team.')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    emit('error', 'Design file too large (max 10MB).')
    return
  }
  loadDesign(file, activeKey.value)
}

const removeDesign = () => {
  const key = activeKey.value
  const slot = designs.value[key]
  if (slot?.imageUrl) URL.revokeObjectURL(slot.imageUrl)
  designs.value = { ...designs.value, [key]: null }
  sideImages.value = { ...sideImages.value, [key]: null }
  if (fileInput.value) fileInput.value.value = ''
  void nextTick(() => {
    attachTransformer()
    void emitLivePreview()
  })
}

// -----------------------------------------------------------------------------
// Slider models — bind through to the active location.
// -----------------------------------------------------------------------------
const scalePct = computed<number>({
  get: () => Math.round((current.value?.scale ?? 1) * 100),
  set: (v) => {
    const slot = designs.value[activeKey.value]
    if (!slot) return
    const next = Math.max(0.05, Math.min(3, v / 100))
    slot.scale = next
  },
})
const rotationDeg = computed<number>({
  get: () => Math.round(current.value?.rotation ?? 0),
  set: (v) => {
    const slot = designs.value[activeKey.value]
    if (!slot) return
    slot.rotation = ((v % 360) + 360) % 360
  },
})

// -----------------------------------------------------------------------------
// Per-location dot indicator.
// -----------------------------------------------------------------------------
const hasDesign = (key: string): boolean => sideImages.value[key] != null

const anyUploaded = computed<boolean>(() =>
  Object.values(sideImages.value).some((v) => v != null),
)

// Mirror `anyUploaded` to the parent so the PDP ATC gate can fire on
// real upload state instead of inferring it from the stage's capturable
// dataUrl (which is non-null even before any upload). `immediate` so the
// initial false propagates on mount and the parent's ref is correctly
// seeded.
watch(
  anyUploaded,
  (val) => {
    emit('uploaded-state-change', { anyUploaded: val })
  },
  { immediate: true },
)

// -----------------------------------------------------------------------------
// Techniques — pill row, default-select first, persists across location flips.
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
// URL when possible — the design-editor → cart hop is the only chance
// to attach the original artwork, so a half-second wait here saves a
// support round-trip later.
const anyUploadingOriginal = computed<boolean>(() =>
  Object.values(designs.value).some((s) => s?.uploadingOriginal === true),
)

// -----------------------------------------------------------------------------
// Submit — capture stage to PNG, upload preview, post ALL locations' designs.
// -----------------------------------------------------------------------------
const submitting = ref(false)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

const captureStageBlob = async (): Promise<Blob | null> => {
  const stage = stageRef.value?.getNode()
  if (!stage) return null
  const canvas = stage.toCanvas()
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
}

const onSubmit = async () => {
  errorMessage.value = null
  successMessage.value = null
  if (!props.variantId) {
    errorMessage.value = 'Please select a variant first.'
    emit('error', errorMessage.value)
    return
  }
  if (!anyUploaded.value) {
    errorMessage.value = 'Upload a design on at least one location before adding to cart.'
    emit('error', errorMessage.value)
    return
  }
  if (anyUploadingOriginal.value) {
    // The background upload of the original file is what production
    // will render from. Submitting now would attach a `null` originalUrl
    // to the line item, leaving support to chase the customer for the
    // artwork. A second's wait is much cheaper.
    errorMessage.value = 'Hang on — your design is still uploading. This usually takes a second.'
    emit('error', errorMessage.value)
    return
  }

  submitting.value = true
  try {
    const blob = await captureStageBlob()
    if (!blob) throw new Error('Could not capture preview')

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
        // upload failed or was still in flight at submit time — both
        // cases are valid ship paths (see `anyUploadingOriginal` and
        // the warning emitted from `uploadOriginalFile`).
        originalUrl: slot.originalUrl,
        originalFilename: slot.originalFilename,
        originalMimeType: slot.originalMimeType,
      }
    }

    const designsPayload: Record<string, ReturnType<typeof sidePayload>> = {}
    for (const loc of props.printLocations) {
      designsPayload[loc.key] = sidePayload(loc.key)
    }

    const cartRes = await $fetch<{
      ok: boolean
      cart_id: string | null
      _offline?: boolean
      error?: string
    }>('/api/custom-cart', {
      method: 'POST',
      body: {
        variant_id: props.variantId,
        quantity: 1,
        design_data: {
          designs: designsPayload,
          activeLocation: activeKey.value,
          area: currentArea.value,
          technique: selectedTechnique.value,
          // Back-compat shim — the legacy /api/custom-cart route only
          // stringifies the payload, but downstream consumers may still
          // look up `front` / `back` by name.
          front: designsPayload['front'] ?? null,
          back: designsPayload['back'] ?? null,
          activeSide: activeKey.value,
        },
        preview_url: uploadRes.url,
      },
    })

    if (!cartRes.ok && cartRes._offline) {
      successMessage.value = 'Preview saved (cart backend offline).'
    } else if (!cartRes.ok) {
      throw new Error(cartRes.error || 'Add to cart failed')
    } else {
      successMessage.value = 'Added to cart!'
    }
    emit('added', { previewUrl: uploadRes.url, cartId: cartRes.cart_id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to add design.'
    errorMessage.value = msg
    emit('error', msg)
  } finally {
    submitting.value = false
  }
}

// -----------------------------------------------------------------------------
// Cleanup — revoke EVERY location's object URL on unmount.
// -----------------------------------------------------------------------------
onBeforeUnmount(() => {
  for (const slot of Object.values(designs.value)) {
    if (slot?.imageUrl) URL.revokeObjectURL(slot.imageUrl)
  }
})

// -----------------------------------------------------------------------------
// Drag bound function — clamp the design center to the active print area.
// -----------------------------------------------------------------------------
const dragBoundFunc = (pos: { x: number; y: number }): { x: number; y: number } => {
  const a = currentArea.value
  return {
    x: Math.max(a.x, Math.min(a.x + a.width, pos.x)),
    y: Math.max(a.y, Math.min(a.y + a.height, pos.y)),
  }
}

// Pretty caption for the file pill — uses the location label, not the key.
const activeLabel = computed<string>(() => {
  const loc = props.printLocations.find((l) => l.key === activeKey.value)
  return loc?.label ?? activeKey.value
})

// -----------------------------------------------------------------------------
// Public API — exposed via defineExpose for the parent PDP to drive the
// hidden <input type="file"> without resorting to a DOM querySelector.
//
// The PDP renders a native-size mobile upload button OUTSIDE this component's
// transform: scale() wrapper (the wrapper would shrink any visible button to
// ~26px and fail WCAG 2.5.5 / Apple HIG 44pt). That button calls into
// `editorRef.value?.openFilePicker()` which forwards to the actual file input
// living in the helper panel. CSS transforms do not affect programmatic
// .click(), so the picker opens normally.
//
// Keep this surface MINIMAL: every method exposed here becomes part of the
// component's public contract for parents.
// -----------------------------------------------------------------------------
function openFilePicker(): void {
  fileInput.value?.click()
}

defineExpose({ openFilePicker })
</script>

<template>
  <!--
    Outer chrome (post-native-fix):
    Previously this component opened with `rounded-xl bg-white shadow-sm
    ring-1 ring-zinc-100` — a card-in-card that broke the visual contract
    of the PDP right column (the column already owns the surface). Now the
    wrapper is invisible: zero background, zero ring, zero shadow. The
    Konva stage keeps its own `bg-cream-tile` panel below because that IS
    the canvas chrome, not a container card.
  -->
  <div class="space-y-6">
    <!--
      Mobile-only upload affordance was previously rendered here (Bug 6 round)
      as an `lg:hidden` pill. It has been removed because the parent PDP
      now owns a native-size button OUTSIDE the editor's transform: scale()
      wrapper — the inner pill rendered at ~26px through the scale and
      failed the 44pt touch target. The parent triggers the file picker
      via the exposed `openFilePicker()` method (see defineExpose at the
      bottom of <script setup>), so source order, a11y and SSR are intact
      while the visible affordance lives at native size in the parent.
    -->
    <div class="grid gap-6 lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
    <!-- Stage column ------------------------------------------------------- -->
    <div class="relative">
      <div
        class="relative overflow-hidden rounded-md bg-cream-tile"
        :style="{ width: '100%', maxWidth: `${STAGE_W}px`, aspectRatio: `${STAGE_W} / ${STAGE_H}` }"
      >
        <div
          v-if="mockupLoading"
          class="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <UiSpinner class="h-6 w-6 text-ink-500" />
        </div>

        <v-stage
          ref="stageRef"
          :config="{ width: STAGE_W, height: STAGE_H }"
          class="block h-full w-full"
        >
          <!-- Mockup background — keyed on URL so a location swap forces a
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
               capture so the LEFT pane gets a clean mockup+design composite. -->
          <v-layer :config="{ visible: !capturing }">
            <v-rect
              :config="{
                x: currentArea.x,
                y: currentArea.y,
                width: currentArea.width,
                height: currentArea.height,
                stroke: '#737373',
                strokeWidth: 1,
                dash: [6, 4],
                listening: false,
              }"
            />
            <v-transformer
              ref="transformerRef"
              :config="{
                rotateEnabled: true,
                keepRatio: true,
                anchorSize: 8,
                borderStroke: '#1f1f1f',
                anchorStroke: '#1f1f1f',
                anchorFill: '#ffffff',
                ignoreStroke: true,
              }"
            />
          </v-layer>
        </v-stage>
      </div>
      <p class="mt-2 font-body text-caption text-ink-500">
        Drag, pinch the corners, or rotate to position your design within the dashed area.
      </p>
    </div>

    <!-- Toolbar column ----------------------------------------------------- -->
    <div class="space-y-6">
      <div>
        <!-- Tabs — only when 2+ locations. Solid dot = uploaded, hollow ring = empty. -->
        <div
          v-if="showTablist"
          class="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Design location"
          data-test="design-tablist"
        >
          <!--
            Location tab. min-h-[44px] satisfies WCAG 2.5.5 / Apple HIG
            44pt at native render. The PDP scales the editor to ~55%-65%
            on small viewports, so the on-screen tab pill ends up smaller
            visually — but the underlying hit-test rectangle stays at
            44pt because CSS transforms scale visuals, not the layout
            box used by hit-testing libraries / accessibility tools.
          -->
          <button
            v-for="loc in printLocations"
            :key="loc.key"
            role="tab"
            :aria-selected="activeKey === loc.key"
            type="button"
            :data-test="`side-tab-${loc.key}`"
            :data-has-design="hasDesign(loc.key) ? 'true' : 'false'"
            class="inline-flex items-center gap-2 min-h-[44px] rounded-md border px-4 py-2 text-[13px] capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
            :class="activeKey === loc.key
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300'"
            @click="activeKey = loc.key"
          >
            <span
              :data-test="`side-dot-${loc.key}`"
              :data-state="hasDesign(loc.key) ? 'filled' : 'empty'"
              class="inline-block h-2 w-2 rounded-full ring-1 motion-reduce:transition-none"
              :class="[
                hasDesign(loc.key)
                  ? activeKey === loc.key ? 'bg-white ring-white' : 'bg-zinc-900 ring-zinc-900'
                  : activeKey === loc.key ? 'bg-transparent ring-white' : 'bg-transparent ring-zinc-400',
              ]"
              aria-hidden="true"
            />
            <span>{{ loc.label }}</span>
            <span class="sr-only">
              {{ hasDesign(loc.key) ? 'has uploaded design' : 'no design uploaded' }}
            </span>
          </button>
        </div>

        <!--
          Drag-drop upload zone. Padding (px-4) prevents the prompt text
          ("Drop your front logo here, or click to browse") from kissing
          the dashed border. The label is allowed to wrap onto two lines
          on the narrow helper column at lg (the column is ~320px).
        -->
        <div
          :class="[
            showTablist ? 'mt-3' : '',
            'flex min-h-[9rem] w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-4 text-center text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 motion-reduce:transition-none',
            isDragging
              ? 'border-zinc-900 bg-zinc-50 text-zinc-900'
              : 'border-zinc-300 bg-zinc-50 text-zinc-600 hover:border-zinc-400',
          ]"
          role="button"
          tabindex="0"
          aria-label="Upload design — click or drag and drop"
          data-test="design-dropzone"
          @click="fileInput?.click()"
          @keydown.enter.prevent="fileInput?.click()"
          @keydown.space.prevent="fileInput?.click()"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <div class="mb-1 flex flex-wrap items-center justify-center gap-2 text-zinc-700">
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span class="break-words">{{ current?.file ? `Replace ${activeLabel} design` : `Drop your ${activeLabel.toLowerCase()} logo here, or click to browse` }}</span>
          </div>
          <div class="text-[11px] text-zinc-500">PNG, JPG, WebP up to 10 MB</div>
          <input
            ref="fileInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="hidden"
            aria-label="Upload design image"
            @change="onPickFile"
          />
        </div>

        <p class="mt-2 text-[11px] text-zinc-500">
          Free vectorisation included. We can convert raster art if your logo needs it.
        </p>

        <!-- Active file pill — shows the file for the currently selected location. -->
        <div
          v-if="current?.file"
          class="mt-3 flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700"
          data-test="design-file-pill"
        >
          <span class="truncate">
            <span class="text-zinc-400">{{ activeLabel }} ·</span>
            {{ current.file.name }}
            <span class="text-zinc-400">· {{ (current.file.size / 1024 / 1024).toFixed(2) }} MB</span>
          </span>
          <button
            type="button"
            class="text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
            aria-label="Remove design"
            @click="removeDesign"
          >
            Remove
          </button>
        </div>
      </div>

      <!-- Technique pill row — only AFTER any upload + when techniques exist. -->
      <div v-if="anyUploaded && techniques.length" data-test="technique-row">
        <p class="font-body text-eyebrow uppercase text-ink-500">Technique</p>
        <div class="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Decoration technique">
          <button
            v-for="t in techniques"
            :key="t.key"
            type="button"
            role="radio"
            :aria-checked="selectedTechnique === t.key"
            :data-test="`technique-${t.key}`"
            class="inline-flex items-center gap-2 min-h-[44px] rounded-full border px-4 py-2 text-[12px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
            :class="selectedTechnique === t.key
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300'"
            @click="selectedTechnique = t.key"
          >
            <span>{{ t.label }}</span>
            <span
              v-if="t.surcharge"
              class="text-[11px] tabular-nums opacity-80"
            >+{{ (t.surcharge / 100).toFixed(2) }}</span>
          </button>
        </div>
      </div>

      <div>
        <p class="font-body text-eyebrow uppercase text-ink-500">Adjust</p>
        <div class="mt-3 space-y-4">
          <label class="block">
            <span class="font-body text-caption text-ink-700">Scale: {{ scalePct }}%</span>
            <input
              v-model.number="scalePct"
              type="range"
              min="5"
              max="300"
              step="1"
              class="mt-1 w-full accent-ink-900"
              :disabled="!currentImage"
              aria-label="Design scale"
            />
          </label>
          <label class="block">
            <span class="font-body text-caption text-ink-700">Rotation: {{ rotationDeg }}&deg;</span>
            <input
              v-model.number="rotationDeg"
              type="range"
              min="0"
              max="360"
              step="1"
              class="mt-1 w-full accent-ink-900"
              :disabled="!currentImage"
              aria-label="Design rotation"
            />
          </label>
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="!currentImage"
            @click="resetTransform"
          >
            Reset position
          </UiButton>
        </div>
      </div>

      <div>
        <UiButton
          variant="merchery"
          size="lg"
          shape="square"
          block
          class="mt-3"
          :loading="submitting"
          :disabled="!anyUploaded || !variantId || submitting"
          @click="onSubmit"
        >
          Add customised item
        </UiButton>
        <p v-if="errorMessage" class="mt-3 font-body text-caption text-red-700" role="alert">
          {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="mt-3 font-body text-caption text-ink-700" role="status">
          {{ successMessage }}
        </p>
      </div>
    </div>
    </div>
  </div>
</template>
