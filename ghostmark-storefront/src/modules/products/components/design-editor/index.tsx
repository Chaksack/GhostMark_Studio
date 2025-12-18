'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva'
import { Upload, Info, Undo, Redo, Circle, Plus, Minus, RotateCcw } from 'lucide-react';
import { ChevronDown, ChevronLeft } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { HttpTypes } from '@medusajs/types'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import OptionSelect from '@modules/products/components/product-actions/option-select'
import { isEqual } from 'lodash'

type ExportResult = { designDataJson: string; previewDataUrl: string; designOnlyDataUrl: string }

type Props = {
  // Optional mockup background image URL (product/variant image)
  mockupUrl?: string
  // Optional mockup zones describing where designs can be placed. Values are
  // normalized to the mockup image box (0..1). Example:
  // { front: { x:0.2, y:0.2, w:0.6, h:0.4 } }
  mockupZones?: Record<string, { x: number; y: number; w: number; h: number }>
  // Register an export function that callers (wrapper) can use
  onRegisterExporter?: (fn: () => Promise<ExportResult>) => void
  // Variant selection support (provided by Wrapper)
  variants?: { id: string; title?: string }[]
  selectedVariantId?: string
  onSelectVariant?: (id: string) => void
  // Human-readable price for the selected variant (already formatted)
  priceString?: string | null
  // Detailed price breakdown for dropdown
  priceDetails?: {
    currency: string | null
    productAmountMinor: number | null
    printAmountMinor: number | null
    totalAmountMinor: number | null
    productFormatted: string | null
    printFormatted: string | null
    totalFormatted: string | null
  }
  // Trigger finalize from the top toolbar
  onFinalize?: () => Promise<void> | void
  // Disable buttons/spinner state
  submitting?: boolean
  // Optional errors/warnings to display inline
  errorMessage?: string | null
  priceWarning?: string | null
  // Product (for rendering info in the left panel)
  product?: HttpTypes.StoreProduct
}

// Resilient image loader for Konva backgrounds
// - Tries crossOrigin='anonymous' for cross-origin URLs to keep canvas untainted
// - If that fails (no CORS headers), retries without crossOrigin so it still displays
//   (export may be tainted in this case; exporter guards against it)
function useHtmlImage(src?: string): { image: HTMLImageElement | null; tainted: boolean } {
  const [state, setState] = useState<{ image: HTMLImageElement | null; tainted: boolean }>({ image: null, tainted: false })

  useEffect(() => {
    let disposed = false
    if (!src) {
      setState({ image: null, tainted: false })
      return
    }

    const isDataUrl = /^data:/i.test(src)
    let urlHost: string | null = null
    try {
      urlHost = new URL(src, window.location.href).host
    } catch {
      urlHost = null
    }
    const sameOrigin = !/^https?:/i.test(src) || (urlHost !== null && urlHost === window.location.host)

    const tryLoad = (withCORS: boolean) => {
      const img = new window.Image()
      if (withCORS) img.crossOrigin = 'anonymous'
      img.src = src

      const handleLoad = () => {
        if (disposed) return
        setState({ image: img, tainted: !withCORS && !sameOrigin && !isDataUrl })
      }
      const handleError = () => {
        if (disposed) return
        // If first attempt withCORS failed on cross-origin, retry without CORS once
        if (withCORS && !sameOrigin && !isDataUrl) {
          tryLoad(false)
        } else {
          setState({ image: null, tainted: false })
        }
      }
      img.addEventListener('load', handleLoad)
      img.addEventListener('error', handleError, { once: true })
    }

    // Strategy:
    // - Same-origin or data URLs: no crossOrigin attribute needed
    // - Cross-origin: try with CORS first, then retry without on error
    if (sameOrigin || isDataUrl) {
      tryLoad(false)
    } else {
      tryLoad(true)
    }

    return () => {
      disposed = true
    }
  }, [src])

  return state
}

export default function TShirtDesigner(props: Props) {
    const { mockupUrl, mockupZones, onRegisterExporter, variants = [], selectedVariantId, onSelectVariant, priceString, priceDetails, onFinalize, submitting, errorMessage, priceWarning, product } = props
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [selectedTech, setSelectedTech] = useState('printing');
    const [selectedColor, setSelectedColor] = useState('white');
    // Trigger a short bounce+scale animation when the displayed price changes
    const [priceAnimate, setPriceAnimate] = useState(false)

    const lastPriceRef = useRef<string | null | undefined>(undefined)
    useEffect(() => {
      // Only animate when the price value actually changes to a non-empty value
      if (priceString && priceString !== lastPriceRef.current) {
        // Update last seen immediately to avoid repeated triggers while animating
        lastPriceRef.current = priceString
        setPriceAnimate(true)
        const t = setTimeout(() => setPriceAnimate(false), 700)
        return () => clearTimeout(t)
      }
      // Keep ref in sync even when priceString is falsy or unchanged
      lastPriceRef.current = priceString
    }, [priceString])

    // ---------- Editor layer state (must be declared BEFORE history hooks) ----------
    // a tiny bit of state to make Konva interactive
    const [dragTextPos, setDragTextPos] = useState({ x: 200, y: 260 })
    // Remove default placeholder text from canvas
    const [textContent, setTextContent] = useState<string>('')
    const [textVisible, setTextVisible] = useState<boolean>(false)
    const [textFontSize, setTextFontSize] = useState<number>(18)
    // uploaded image node state
    const [uploadedImg, setUploadedImg] = useState<HTMLImageElement | null>(null)
    const [uploadedPos, setUploadedPos] = useState({ x: 170, y: 190 })
    const [uploadedSize, setUploadedSize] = useState({ width: 160, height: 160 })
    // transform/selection state for uploaded image
    const [imgSelected, setImgSelected] = useState(false)
    const imgNodeRef = useRef<any>(null)
    const trRef = useRef<any>(null)

    // ---------- Simple editor history (undo/redo) ----------
    type EditorSnapshot = {
      uploadedPos: { x: number; y: number } | null
      uploadedSize: { width: number; height: number } | null
      hasImage: boolean
      dragTextPos: { x: number; y: number }
      textContent: string
      textVisible: boolean
      textFontSize: number
    }

    const [history, setHistory] = useState<EditorSnapshot[]>([])
    const [historyIndex, setHistoryIndex] = useState<number>(-1)

    const pushHistory = useCallback((snap: EditorSnapshot) => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1)
        next.push(snap)
        // limit history to last 50 entries
        return next.slice(-50)
      })
      setHistoryIndex((idx) => Math.min(idx + 1, 49))
    }, [historyIndex])

    const canUndo = historyIndex > 0
    const canRedo = historyIndex >= 0 && historyIndex < history.length - 1

    const applySnapshot = useCallback((snap: EditorSnapshot) => {
      if (!snap) return
      if (snap.hasImage === false) {
        setUploadedImg(null)
      }
      if (snap.uploadedPos) setUploadedPos({ ...snap.uploadedPos })
      if (snap.uploadedSize) setUploadedSize({ ...snap.uploadedSize })
      setDragTextPos({ ...snap.dragTextPos })
      setTextContent(snap.textContent)
      setTextVisible(snap.textVisible)
      setTextFontSize(snap.textFontSize)
    }, [])

    const handleUndo = useCallback(() => {
      if (!canUndo) return
      setHistoryIndex((idx) => {
        const nextIdx = Math.max(0, idx - 1)
        const snap = history[nextIdx]
        applySnapshot(snap)
        return nextIdx
      })
    }, [canUndo, history, applySnapshot])

    const handleRedo = useCallback(() => {
      if (!canRedo) return
      setHistoryIndex((idx) => {
        const nextIdx = Math.min(history.length - 1, idx + 1)
        const snap = history[nextIdx]
        applySnapshot(snap)
        return nextIdx
      })
    }, [canRedo, history, applySnapshot])

    const snapshotNow = useCallback((): EditorSnapshot => ({
      uploadedPos: uploadedPos ? { ...uploadedPos } : null,
      uploadedSize: uploadedSize ? { ...uploadedSize } : null,
      hasImage: !!uploadedImg,
      dragTextPos: { ...dragTextPos },
      textContent,
      textVisible,
      textFontSize,
    }), [uploadedPos, uploadedSize, uploadedImg, dragTextPos, textContent, textVisible, textFontSize])

    // Initialize history once when component mounts
    useEffect(() => {
      const snap = snapshotNow()
      setHistory([snap])
      setHistoryIndex(0)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Keyboard shortcuts for undo/redo
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const meta = e.metaKey || e.ctrlKey
        if (!meta) return
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault()
          if (e.shiftKey) {
            handleRedo()
          } else {
            handleUndo()
          }
        }
      }
      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }, [handleUndo, handleRedo])

    // ---------- Variant option state (copied from PDP style) ----------
    const optionsAsKeymap = useCallback((variantOptions: any[] | undefined) => {
      return (variantOptions || []).reduce((acc: Record<string, string>, varopt: any) => {
        if (varopt && varopt.option_id) acc[varopt.option_id] = varopt.value
        return acc
      }, {})
    }, [])

    const [optionState, setOptionState] = useState<Record<string, string | undefined>>({})

    // Initialize optionState from selectedVariantId or first variant
    useEffect(() => {
      if (!product?.variants?.length) return
      // If a variant is selected, mirror its options
      const current = product.variants.find((v: any) => v.id === selectedVariantId) || (product.variants as any[])[0]
      if (!current) return
      const map = optionsAsKeymap((current as any).options)
      setOptionState(map)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?.id])

    // When selectedVariantId changes from outside, sync local options
    useEffect(() => {
      if (!product?.variants?.length) return
      if (!selectedVariantId) return
      const selected = product.variants.find((v: any) => v.id === selectedVariantId)
      if (!selected) return
      const map = optionsAsKeymap((selected as any).options)
      setOptionState(map)
    }, [selectedVariantId, product?.variants, optionsAsKeymap])

    // Compute the variant that matches current optionState
    const matchedVariant = useMemo(() => {
      if (!product?.variants?.length) return undefined
      return (product.variants as any[]).find((v: any) => isEqual(optionsAsKeymap(v.options), optionState))
    }, [product?.variants, optionState, optionsAsKeymap])

    // Notify parent when matched variant changes
    useEffect(() => {
      if (!onSelectVariant) return
      const newId = matchedVariant?.id
      if (newId && newId !== selectedVariantId) {
        onSelectVariant(newId)
      }
    }, [matchedVariant?.id, onSelectVariant, selectedVariantId])

    const setOptionValue = useCallback((optionId: string, value: string) => {
      setOptionState((prev) => ({ ...prev, [optionId]: value }))
    }, [])
    const [selectedSize, setSelectedSize] = useState('S');
    const [selectedView, setSelectedView] = useState('front');
    // price dropdown state
    const [showPriceDetails, setShowPriceDetails] = useState(false)
    const priceBtnRef = useRef<HTMLButtonElement | null>(null)
    const priceCardRef = useRef<HTMLDivElement | null>(null)

    // Close dropdown on outside click
    useEffect(() => {
      function onDocClick(e: MouseEvent) {
        const target = e.target as Node
        if (
          showPriceDetails &&
          priceCardRef.current &&
          !priceCardRef.current.contains(target) &&
          priceBtnRef.current &&
          !priceBtnRef.current.contains(target)
        ) {
          setShowPriceDetails(false)
        }
      }
      document.addEventListener('mousedown', onDocClick)
      return () => document.removeEventListener('mousedown', onDocClick)
    }, [showPriceDetails])

    const stageRef = useRef<any>(null)
    const bgLayerRef = useRef<any>(null)
    const canvasContainerRef = useRef<HTMLDivElement | null>(null)
    const [stageSize, setStageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

    // Zoom & pan state for the Konva stage
    const [stageScale, setStageScale] = useState(1)
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
    const MIN_SCALE = 0.5
    const MAX_SCALE = 3
    const SCALE_BY = 1.1
    const DEFAULT_ZOOM = 1.25

    const { image: mockupImage, tainted: mockupTainted } = useHtmlImage(mockupUrl)

    // Compute fitted placement for the product mockup so it always shows fully on canvas
    const mockupFit = useMemo(() => {
      // Intended bounding box is responsive to the stage size with some padding
      const W = Math.max(stageSize.width, 1)
      const H = Math.max(stageSize.height, 1)
      const pad = Math.round(Math.min(W, H) * 0.08) // 8% padding for breathing room
      const bounds = { x: pad, y: pad, width: Math.max(1, W - pad * 2), height: Math.max(1, H - pad * 2) }
      if (!mockupImage) {
        return bounds
      }
      const iw = mockupImage.naturalWidth || (mockupImage as any).width || 1
      const ih = mockupImage.naturalHeight || (mockupImage as any).height || 1
      const ratio = Math.min(bounds.width / iw, bounds.height / ih)
      const w = Math.max(1, Math.round(iw * ratio))
      const h = Math.max(1, Math.round(ih * ratio))
      const x = Math.round(bounds.x + (bounds.width - w) / 2)
      const y = Math.round(bounds.y + (bounds.height - h) / 2)
      return { x, y, width: w, height: h }
    }, [mockupImage, stageSize.width, stageSize.height])

    // Attach transformer to the image node when selected
    useEffect(() => {
      if (!imgSelected) return
      const tr = trRef.current
      const node = imgNodeRef.current
      if (tr && node) {
        try {
          tr.nodes([node])
          tr.getLayer()?.batchDraw()
        } catch {}
      }
    }, [imgSelected, uploadedImg])

    // Center the canvas content and apply a pleasant default zoom when first ready
    const hasSetInitialViewRef = useRef(false)
    const computeCenteredPos = useCallback((scale: number) => {
      // Keep the viewport centered regardless of scale
      const W = Math.max(stageSize.width, 1)
      const H = Math.max(stageSize.height, 1)
      return {
        x: Math.round((1 - scale) * W / 2),
        y: Math.round((1 - scale) * H / 2),
      }
    }, [stageSize.width, stageSize.height])

    useEffect(() => {
      if (stageSize.width === 0 || stageSize.height === 0) return
      if (hasSetInitialViewRef.current) return
      // Apply initial zoom + centered position
      const nextScale = DEFAULT_ZOOM
      setStageScale(nextScale)
      setStagePos(computeCenteredPos(nextScale))
      hasSetInitialViewRef.current = true
    }, [stageSize.width, stageSize.height, computeCenteredPos])

    // Resolve active mockup zone (relative to mockup box) and convert to stage coordinates
    const activeZoneRect = useMemo(() => {
      const zones = mockupZones || {}
      const byView = zones[selectedView] || zones['default']
      if (!byView || !mockupFit) return null as null | { x: number; y: number; width: number; height: number }
      const zx = mockupFit.x + (byView.x || 0) * mockupFit.width
      const zy = mockupFit.y + (byView.y || 0) * mockupFit.height
      const zw = (byView.w || 0) * mockupFit.width
      const zh = (byView.h || 0) * mockupFit.height
      return { x: Math.round(zx), y: Math.round(zy), width: Math.round(zw), height: Math.round(zh) }
    }, [mockupZones, selectedView, mockupFit])

    // ---------- Print size (inches) resolution helpers ----------
    // Read potential print area physical dimensions from metadata (variant preferred, then product)
    const printSizeInches = useMemo(() => {
      const candidates: any[] = []
      const vMeta = (product?.variants as any[])?.find((v: any) => v.id === selectedVariantId)?.metadata
      const pMeta = (product as any)?.metadata
      if (vMeta) candidates.push(vMeta)
      if (pMeta) candidates.push(pMeta)

      const toInches = (w?: number | string | null, h?: number | string | null, unit: 'in' | 'cm' | 'mm' = 'in') => {
        const parseNum = (x: any) => {
          if (typeof x === 'number') return x
          if (!x) return undefined
          const n = parseFloat(String(x))
          return Number.isFinite(n) ? n : undefined
        }
        let W = parseNum(w)
        let H = parseNum(h)
        if (W == null || H == null) return undefined
        if (unit === 'cm') {
          W = W / 2.54
          H = H / 2.54
        } else if (unit === 'mm') {
          W = W / 25.4
          H = H / 25.4
        }
        return { widthIn: W, heightIn: H }
      }

      // Try several common metadata shapes
      for (const meta of candidates) {
        if (!meta) continue
        // 1) Flat keys in inches
        if (meta.print_area_width_in && meta.print_area_height_in) {
          const r = toInches(meta.print_area_width_in, meta.print_area_height_in, 'in')
          if (r) return r
        }
        // 2) Flat keys in cm
        if (meta.print_area_width_cm && meta.print_area_height_cm) {
          const r = toInches(meta.print_area_width_cm, meta.print_area_height_cm, 'cm')
          if (r) return r
        }
        // 3) Flat keys in mm
        if (meta.print_area_width_mm && meta.print_area_height_mm) {
          const r = toInches(meta.print_area_width_mm, meta.print_area_height_mm, 'mm')
          if (r) return r
        }
        // 4) Object: print_area_size_in { width, height }
        if (meta.print_area_size_in && (meta.print_area_size_in.width || meta.print_area_size_in.height)) {
          const r = toInches(meta.print_area_size_in.width, meta.print_area_size_in.height, 'in')
          if (r) return r
        }
        // 5) Per-view mapping
        const viewKey = selectedView
        const map = meta.print_sizes || meta.print_size_in || meta.printAreas || meta.print_area_sizes
        if (map && viewKey && map[viewKey]) {
          const v = map[viewKey]
          const r = toInches(v.width_in ?? v.w_in ?? v.width ?? v.w, v.height_in ?? v.h_in ?? v.height ?? v.h, 'in')
          if (r) return r
        }
        // 6) JSON strings
        for (const key of ['print_sizes', 'print_size_in', 'printAreas', 'print_area_sizes']) {
          const raw = meta[key]
          if (typeof raw === 'string') {
            try {
              const obj = JSON.parse(raw)
              if (obj && obj[selectedView]) {
                const v = obj[selectedView]
                const r = toInches(v.width_in ?? v.w_in ?? v.width ?? v.w, v.height_in ?? v.h_in ?? v.height ?? v.h, 'in')
                if (r) return r
              }
            } catch {}
          }
        }
      }
      return undefined as undefined | { widthIn: number; heightIn: number }
    }, [product, selectedVariantId, selectedView])

    // Compute estimated DPI from current upload placement vs print area size (inches)
    const dpiInfo = useMemo(() => {
      // Need an image and a physical print size to compute DPI
      if (!uploadedImg || !printSizeInches) {
        return { dpi: null as number | null, label: null as string | null, tone: 'neutral' as 'good' | 'fair' | 'poor' | 'neutral' }
      }

      const naturalW = uploadedImg.naturalWidth || (uploadedImg as any).width || 0
      const naturalH = uploadedImg.naturalHeight || (uploadedImg as any).height || 0
      if (!naturalW || !naturalH) return { dpi: null, label: null, tone: 'neutral' as const }

      const placedWpx = uploadedSize.width
      const placedHpx = uploadedSize.height
      if (!placedWpx || !placedHpx) return { dpi: null, label: null, tone: 'neutral' as const }

      // Use active zone when available; otherwise fall back to fitted mockup rect
      const container = activeZoneRect || mockupFit
      if (!container) return { dpi: null, label: null, tone: 'neutral' as const }

      // proportion of container occupied by image
      const propW = Math.max(0.0001, Math.min(1, placedWpx / Math.max(1, container.width)))
      const propH = Math.max(0.0001, Math.min(1, placedHpx / Math.max(1, container.height)))
      const renderWIn = Math.max(0.0001, propW * printSizeInches.widthIn)
      const renderHIn = Math.max(0.0001, propH * printSizeInches.heightIn)
      const dpiW = naturalW / renderWIn
      const dpiH = naturalH / renderHIn
      const dpi = Math.round(Math.min(dpiW, dpiH))
      let tone: 'good' | 'fair' | 'poor' = 'good'
      let label = 'Good'
      if (dpi < 150) { tone = 'poor'; label = 'Poor' }
      else if (dpi < 200) { tone = 'fair'; label = 'Fair' }
      return { dpi, label, tone }
    }, [uploadedImg, uploadedSize.width, uploadedSize.height, activeZoneRect, mockupFit, printSizeInches])

    // Helper to clamp a rectangle inside the active zone if present
    const clampIntoZone = useCallback((x: number, y: number, w: number, h: number) => {
      // Prefer active print zone; otherwise constrain to mockup rectangle so the design stays on the product
      const container = activeZoneRect || mockupFit
      if (!container) return { x, y }
      const minX = container.x
      const minY = container.y
      const maxX = container.x + container.width - w
      const maxY = container.y + container.height - h
      return {
        x: Math.min(Math.max(x, minX), Math.max(minX, maxX)),
        y: Math.min(Math.max(y, minY), Math.max(minY, maxY)),
      }
    }, [activeZoneRect, mockupFit])

    // Observe container size to make the Stage fill the entire center area
    useEffect(() => {
      const el = canvasContainerRef.current
      if (!el) return
      // Initial measure
      const rect = el.getBoundingClientRect()
      setStageSize({ width: Math.max(0, Math.floor(rect.width)), height: Math.max(0, Math.floor(rect.height)) })

      let ro: ResizeObserver | null = null
      try {
        ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const cr = entry.contentRect
            setStageSize({
              width: Math.max(0, Math.floor(cr.width)),
              height: Math.max(0, Math.floor(cr.height)),
            })
          }
        })
        ro.observe(el)
      } catch {
        // Older browsers: fallback to window resize
        const onResize = () => {
          const r = el.getBoundingClientRect()
          setStageSize({ width: Math.max(0, Math.floor(r.width)), height: Math.max(0, Math.floor(r.height)) })
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }
      return () => {
        if (ro && el) {
          try { ro.unobserve(el) } catch {}
        }
      }
    }, [])


    // Register exporter so parent can retrieve JSON + preview
    useEffect(() => {
      if (!onRegisterExporter) return
      const exporter = async (): Promise<ExportResult> => {
        const stage = stageRef.current as any
        if (!stage) return { designDataJson: JSON.stringify({}), previewDataUrl: '', designOnlyDataUrl: '' }
        // Serialize stage (includes nodes and positions)
        const designDataJson = stage.toJSON?.() || JSON.stringify({})
        // Export high-res preview including mockup and design
        let previewDataUrl = ''
        let designOnlyDataUrl = ''
        // Important: Avoid calling toDataURL on a tainted canvas to prevent Konva from
        // logging an error ("The operation is insecure"). We already detect taint via
        // the image loader. When tainted, skip export and return an empty preview.
        if (!mockupTainted) {
          try {
            previewDataUrl = stage.toDataURL?.({ pixelRatio: 2 }) || ''
          } catch {
            previewDataUrl = ''
          }
        }
        // Always try to export a design-only PNG by hiding the background layer
        try {
          const bgLayer = bgLayerRef.current as any
          const prevVisible = bgLayer?.visible?.() ?? true
          if (bgLayer && typeof bgLayer.visible === 'function') {
            bgLayer.visible(false)
            stage.draw()
          }
          designOnlyDataUrl = stage.toDataURL?.({ pixelRatio: 2 }) || ''
          if (bgLayer && typeof bgLayer.visible === 'function') {
            bgLayer.visible(prevVisible)
            stage.draw()
          }
        } catch {
          designOnlyDataUrl = ''
        }
        return { designDataJson, previewDataUrl, designOnlyDataUrl }
      }
      onRegisterExporter(exporter)
      // re-register if stage ref changes
    }, [onRegisterExporter, mockupTainted])

    const views = [
        { id: 'front', label: 'Front' },
        { id: 'back', label: 'Back' },
        { id: 'inner', label: 'Inner neck' },
        { id: 'outer', label: 'Outer neck' },
        { id: 'left', label: 'Left sleeve' },
        { id: 'right', label: 'Right sleeve' }
    ];

    // Preview modal state
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string>("")
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewNote, setPreviewNote] = useState<string | null>(null)

    // Close preview on Escape key
    useEffect(() => {
      if (!previewOpen) return
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setPreviewOpen(false)
        }
      }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }, [previewOpen])

    const handlePreview = useCallback(async () => {
      const stage = stageRef.current as any
      if (!stage) return
      setPreviewLoading(true)
      setPreviewNote(null)
      try {
        let url = ""
        if (!mockupTainted) {
          // Composite export (mockup + design)
          url = stage.toDataURL?.({ pixelRatio: 2 }) || ""
        } else {
          // Fallback: hide mockup layer temporarily to avoid tainted canvas
          const bgLayer = bgLayerRef.current as any
          const prevVisible = bgLayer?.visible?.() ?? true
          try {
            if (bgLayer && typeof bgLayer.visible === 'function') {
              bgLayer.visible(false)
              stage.draw()
            }
            url = stage.toDataURL?.({ pixelRatio: 2 }) || ""
            setPreviewNote("Preview excludes product image due to image host CORS. Final print uses your uploaded design.")
          } finally {
            if (bgLayer && typeof bgLayer.visible === 'function') {
              bgLayer.visible(prevVisible)
              stage.draw()
            }
          }
        }
        setPreviewUrl(url)
        setPreviewOpen(true)
      } catch {
        setPreviewUrl("")
        setPreviewOpen(true)
        setPreviewNote("Could not generate preview. Try a different image or check network/CORS settings.")
      } finally {
        setPreviewLoading(false)
      }
    }, [mockupTainted])

    return (
        <>
         <div className="flex h-screen bg-white">
            {/* Far Left Toolbar */}
            <div className="w-16 mx-auto px-2 bg-white flex flex-col items-center py-4 gap-1">
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Product"
                    onClick={() => router.back()}
                >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-[10px]">Back</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Product"
                >
                    <Upload className="w-5 h-5" />
                    <span className="text-[10px]">Product</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Files"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="text-[10px]">Files</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Text"
                    onClick={() => {
                      // Toggle text layer visibility and capture in history
                      setTextVisible((prev) => {
                        const next = !prev
                        // snapshot after state settles
                        setTimeout(() => pushHistory(snapshotNow()), 0)
                        return next
                      })
                    }}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    <span className="text-[10px]">Text</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Templates"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                    </svg>
                    <span className="text-[10px]">Templates</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Graphics"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px]">Graphics</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Layers"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="text-[10px]">Layers</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Shutterstock"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-[10px]">Shutterstock</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Shapes"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" strokeWidth={2} />
                        <rect x="5" y="5" width="6" height="6" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 8l-3 5 3 5" />
                    </svg>
                    <span className="text-[10px]">Shapes</span>
                </button>
                <div className="flex-1"></div>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Settings"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span className="text-[10px]">Settings</span>
                </button>
            </div>

            {/* Left Sidebar - Design Tools */}
            <div className="w-80 border-r border-gray-200 p-6 overflow-y-auto">


                {/* Product Info (dynamic) */}
                {product && (
                  <div className="mb-4" data-testid="design-left-product-info">
                    {product.collection && (
                      <LocalizedClientLink
                        href={`/collections/${product.collection.handle}`}
                        className="text-[12px] text-ui-fg-muted hover:text-ui-fg-subtle"
                      >
                        {product.collection.title}
                      </LocalizedClientLink>
                    )}
                    <h2 className="font-semibold text-base mb-1 text-ui-fg-base">
                      {product.title}
                    </h2>
                    {(() => {
                      const subtitleFromMeta = (product as any)?.metadata?.subtitle as string | undefined
                      const raw = subtitleFromMeta || product.description || ''
                      if (!raw) return null
                      const firstSentenceMatch = raw.match(/[^.!?\n]+[.!?]?/)
                      const first = firstSentenceMatch ? firstSentenceMatch[0] : raw
                      const short = first.length > 160 ? first.slice(0, 157).trim() + '…' : first
                      return <p className="text-sm text-ui-fg-subtle">{short}</p>
                    })()}
                  </div>
                )}

                {/* Variant Options (PDP-style) */}
                {product?.options && product.options.length > 0 && (
                  <div className="mb-6" data-testid="design-left-variant-options">
                    <div className="flex flex-col gap-y-4">
                      {product.options.map((option) => (
                        <div key={option.id}>
                          <OptionSelect
                            option={option}
                            current={optionState[option.id]}
                            updateOption={setOptionValue}
                            title={option.title}
                            disabled={false}
                            data-testid="option-select"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-sm mb-2">Make your design stand out</h3>
                    <p className="text-sm text-gray-700">
                        Add prints to multiple areas to create a premium, branded look.{' '}
                        <a href="#" className="text-blue-600 hover:underline">Learn More</a>
                    </p>
                </div>


            </div>

            {/* Center - Product Preview */}
            <div className="flex-1 flex flex-col">
                {/* Top Toolbar */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-gray-100 rounded">
                            <Info className="w-5 h-5" />
                        </button>
                        <button
                          className={`p-2 rounded ${canUndo ? 'hover:bg-gray-100' : 'opacity-40 cursor-not-allowed'}`}
                          title="Undo"
                          onClick={handleUndo}
                          disabled={!canUndo}
                        >
                            <Undo className="w-5 h-5" />
                        </button>
                        <button
                          className={`p-2 rounded ${canRedo ? 'hover:bg-gray-100' : 'opacity-40 cursor-not-allowed'}`}
                          title="Redo"
                          onClick={handleRedo}
                          disabled={!canRedo}
                        >
                            <Redo className="w-5 h-5" />
                        </button>
                        {/* Zoom controls */}
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            type="button"
                            className="p-2 hover:bg-gray-100 rounded"
                            title="Zoom out"
                            onClick={() => {
                              setStageScale((prev) => {
                                const next = Math.max(MIN_SCALE, prev / SCALE_BY)
                                return Number(next.toFixed(3))
                              })
                            }}
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <span className="text-sm w-14 text-center tabular-nums">
                            {Math.round(stageScale * 100)}%
                          </span>
                          <button
                            type="button"
                            className="p-2 hover:bg-gray-100 rounded"
                            title="Zoom in"
                            onClick={() => {
                              setStageScale((prev) => {
                                const next = Math.min(MAX_SCALE, prev * SCALE_BY)
                                return Number(next.toFixed(3))
                              })
                            }}
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            className="p-2 hover:bg-gray-100 rounded"
                            title="Reset view"
                            onClick={() => {
                              const next = DEFAULT_ZOOM
                              setStageScale(next)
                              setStagePos(computeCenteredPos(next))
                            }}
                          >
                            <RotateCcw className="w-5 h-5" />
                          </button>
                        </div>
                        {/* Variant selector moved to left sidebar */}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Inline warnings/errors */}
                        {priceWarning && (
                          <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                            {priceWarning}
                          </div>
                        )}
                        {errorMessage && (
                          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                            {errorMessage}
                          </div>
                        )}
                        {/* Upload image into canvas */}
                        <label className="px-6 py-2 border border-gray-500 text-sm rounded-lg hover:bg-gray-100 font-medium cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                const reader = new FileReader()
                                reader.onload = () => {
                                  const img = new window.Image()
                                  img.crossOrigin = 'anonymous'
                                  img.src = String(reader.result || '')
                                  img.onload = () => {
                                    // Fit uploaded image into active zone, else into the mockup rectangle so it sits on the product
                                    let maxW = 240, maxH = 240, originX = 120, originY = 150
                                    const container = activeZoneRect || mockupFit
                                    if (container) {
                                      maxW = Math.max(1, container.width)
                                      maxH = Math.max(1, container.height)
                                      originX = container.x
                                      originY = container.y
                                    }
                                    const ratio = Math.min(maxW / img.width, maxH / img.height, 1)
                                    setUploadedSize({ width: Math.round(img.width * ratio), height: Math.round(img.height * ratio) })
                                    setUploadedPos({ x: Math.round(originX + (maxW - Math.round(img.width * ratio)) / 2), y: Math.round(originY + (maxH - Math.round(img.height * ratio)) / 2) })
                                    setUploadedImg(img)
                                    setImgSelected(true)
                                    // push history after placing uploaded image
                                    setTimeout(() => pushHistory(snapshotNow()), 0)
                                  }
                                }
                                reader.readAsDataURL(file)
                              }}
                            />
                            Upload image
                          </label>
                        <button
                          type="button"
                          onClick={handlePreview}
                          disabled={previewLoading}
                          className="px-6 py-2 border border-gray-500 text-sm rounded-lg hover:bg-gray-100 font-medium disabled:opacity-50"
                        >
                            {previewLoading ? 'Preparing…' : 'Preview'}
                        </button>
                        <button
                          onClick={() => { if (onFinalize) onFinalize() }}
                          disabled={!!submitting}
                          className="px-6 py-2 border border-gray-900 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50"
                        >
                          {submitting ? 'Adding…' : 'Finalize & Checkout'}
                        </button>
                        <div
                          className="relative flex items-center gap-2"
                          onMouseEnter={() => setShowPriceDetails(true)}
                          onMouseLeave={() => setShowPriceDetails(false)}
                        >
                          <button
                            ref={priceBtnRef}
                            type="button"
                            className="flex items-center gap-1 text-xl font-bold px-2 py-1 rounded hover:bg-gray-100 whitespace-nowrap"
                            title="Show price details"
                            aria-expanded={showPriceDetails}
                          >
                            <span
                              className={`inline-block will-change-transform transition-transform duration-300 ${priceAnimate ? 'animate-bounce scale-110' : ''}`}
                            >
                              {priceString || '—'}
                            </span>
                            <ChevronDown className={`transition-transform ${showPriceDetails ? 'rotate-180' : ''}`} />
                          </button>
                          {/* DPI badge next to price (inline, not absolutely positioned) */}
                          <span
                            className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${dpiInfo.tone === 'good' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : dpiInfo.tone === 'fair' ? 'bg-amber-50 border-amber-200 text-amber-800' : dpiInfo.tone === 'poor' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                            title={printSizeInches ? `Estimated print DPI based on current placement${uploadedImg ? '' : ' (add an image to calculate)'}` : 'Missing print area size in metadata'}
                          >
                            DPI: {dpiInfo.dpi ?? '—'}{dpiInfo.label ? ` (${dpiInfo.label})` : ''}
                          </span>
                          {showPriceDetails && (
                            <div
                              ref={priceCardRef}
                              className="absolute right-0 mt-2 w-auto min-w-fit bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20"
                            >
                              <div className="flex justify-between text-sm py-1 gap-6">
                                <span className="text-gray-600 whitespace-nowrap">Product cost</span>
                                <span className="font-medium whitespace-nowrap">{priceDetails?.productFormatted || priceString || '—'}</span>
                              </div>
                              <div className="flex justify-between text-sm py-1 gap-6">
                                <span className="text-gray-600 whitespace-nowrap">Print cost</span>
                                <span className="font-medium whitespace-nowrap">{priceDetails?.printFormatted || '—'}</span>
                              </div>
                              <div className="flex justify-between text-sm py-1 gap-6">
                                <span className="text-gray-600 whitespace-nowrap">Estimated DPI</span>
                                <span className={`font-medium whitespace-nowrap ${dpiInfo.tone === 'good' ? 'text-emerald-700' : dpiInfo.tone === 'fair' ? 'text-amber-700' : dpiInfo.tone === 'poor' ? 'text-red-700' : 'text-gray-700'}`}>
                                  {dpiInfo.dpi ?? '—'}{dpiInfo.label ? ` (${dpiInfo.label})` : ''}
                                </span>
                              </div>
                              <div className="h-px bg-gray-200 my-2" />
                              <div className="flex justify-between text-sm py-1 gap-6">
                                <span className="text-gray-800 font-semibold whitespace-nowrap">Total</span>
                                <span
                                  className={`font-semibold whitespace-nowrap inline-block will-change-transform transition-transform duration-300 ${priceAnimate ? 'animate-bounce scale-110' : ''}`}
                                >
                                  {priceDetails?.totalFormatted || priceString || '—'}
                                </span>
                              </div>
                              <p className="mt-2 text-[11px] text-gray-500">Prices shown are estimates and may change at checkout depending on shipping and taxes.</p>
                              {!printSizeInches && (
                                <p className="mt-1 text-[11px] text-gray-500">Print area size not configured; DPI cannot be calculated accurately.</p>
                              )}
                            </div>
                          )}
                        </div>
                                {/* Removed separate Add to order button; handled by Finalize */}
                    </div>
                </div>

                {/* Product Image - Full-bleed canvas area */}
                <div className="flex-1 relative">
                    {/* Konva canvas fills the entire center area */}
                    <div ref={canvasContainerRef} className="absolute inset-0">
                        {stageSize.width > 0 && stageSize.height > 0 && (
                            <Stage
                              ref={stageRef}
                              width={stageSize.width}
                              height={stageSize.height}
                              className="block"
                              scaleX={stageScale}
                              scaleY={stageScale}
                              x={stagePos.x}
                              y={stagePos.y}
                              draggable={stageScale > 1}
                              onMouseDown={(e: any) => {
                                // Deselect when clicking empty space (stage) or non-design layers
                                const clickedOnEmpty = e.target === e.target.getStage()
                                if (clickedOnEmpty) {
                                  setImgSelected(false)
                                }
                              }}
                              onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
                              onWheel={(e: any) => {
                                e.evt.preventDefault()
                                const stage = stageRef.current
                                if (!stage) return
                                const oldScale = stageScale
                                const pointer = stage.getPointerPosition()
                                if (!pointer) return
                                const mousePointTo = {
                                  x: (pointer.x - stagePos.x) / oldScale,
                                  y: (pointer.y - stagePos.y) / oldScale,
                                }
                                const direction = e.evt.deltaY > 0 ? -1 : 1
                                const newScaleRaw = direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY
                                const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScaleRaw))
                                const newPos = {
                                  x: pointer.x - mousePointTo.x * newScale,
                                  y: pointer.y - mousePointTo.y * newScale,
                                }
                                setStageScale(Number(newScale.toFixed(3)))
                                setStagePos({ x: Math.round(newPos.x), y: Math.round(newPos.y) })
                              }}
                            >
                                {/* Background/mockup layer */}
                                <Layer listening={false} ref={bgLayerRef}>
                                    {mockupImage ? (
                                      <KonvaImage x={mockupFit.x} y={mockupFit.y} width={mockupFit.width} height={mockupFit.height} image={mockupImage} />
                                    ) : (
                                      // Neutral background without borders when no mockup is available
                                      <Rect x={0} y={0} width={stageSize.width} height={stageSize.height} fill="#f3f4f6" />
                                    )}
                                </Layer>
                                {/* Guides layer: show active mockup zone if available */}
                                <Layer listening={false}>
                                  {activeZoneRect && (
                                    <Rect
                                      x={activeZoneRect.x}
                                      y={activeZoneRect.y}
                                      width={activeZoneRect.width}
                                      height={activeZoneRect.height}
                                      stroke={"#2563eb"}
                                      strokeWidth={2}
                                      dash={[6, 4]}
                                      opacity={0.75}
                                    />
                                  )}
                                </Layer>
                                {/* Design layer */}
                                <Layer>
                                    {/* Draggable sample design */}
                                    {textVisible && (
                                      <>
                                        <Rect
                                          x={dragTextPos.x - 70}
                                          y={dragTextPos.y - 30}
                                          width={140}
                                          height={60}
                                          cornerRadius={10}
                                          fill="#111827"
                                          opacity={0.85}
                                          draggable
                                          onDragMove={(e) => setDragTextPos({ x: e.target.x() + 70, y: e.target.y() + 30 })}
                                          onDragEnd={() => pushHistory(snapshotNow())}
                                        />
                                        <Text
                                          x={dragTextPos.x - 60}
                                          y={dragTextPos.y - 14}
                                          text={textContent}
                                          fontSize={textFontSize}
                                          fill="#ffffff"
                                          fontStyle="bold"
                                          draggable
                                          onDblClick={() => {
                                            const next = window.prompt('Edit text', textContent || '')
                                            if (typeof next === 'string') {
                                              setTextContent(next)
                                              setTimeout(() => pushHistory(snapshotNow()), 0)
                                            }
                                          }}
                                          onDragMove={(e) => setDragTextPos({ x: e.target.x() + 60, y: e.target.y() + 14 })}
                                          onDragEnd={() => pushHistory(snapshotNow())}
                                        />
                                      </>
                                    )}
                                    {/* Uploaded image (if any) */}
                                    {uploadedImg && (
                                      <>
                                        <KonvaImage
                                              ref={imgNodeRef}
                                              image={uploadedImg}
                                              x={uploadedPos.x}
                                              y={uploadedPos.y}
                                              width={uploadedSize.width}
                                              height={uploadedSize.height}
                                              // Allow dragging and clamp within active zone or mockup bounds
                                              draggable
                                              onDragStart={() => setImgSelected(true)}
                                              onDragMove={(e) => {
                                                const node = e.target
                                                const w = uploadedSize.width
                                                const h = uploadedSize.height
                                                const clamped = clampIntoZone(node.x(), node.y(), w, h)
                                                if (clamped.x !== node.x() || clamped.y !== node.y()) {
                                                  node.x(clamped.x)
                                                  node.y(clamped.y)
                                                }
                                                setUploadedPos({ x: node.x(), y: node.y() })
                                              }}
                                              onDragEnd={(e) => {
                                                const node = imgNodeRef.current
                                                if (node) {
                                                  const clamped = clampIntoZone(node.x(), node.y(), uploadedSize.width, uploadedSize.height)
                                                  node.x(clamped.x)
                                                  node.y(clamped.y)
                                                  setUploadedPos({ x: clamped.x, y: clamped.y })
                                                }
                                                pushHistory(snapshotNow())
                                              }}
                                              onClick={() => setImgSelected(true)}
                                              onTap={() => setImgSelected(true)}
                                              onTransformEnd={(e) => {
                                                const node = imgNodeRef.current
                                                if (!node) return
                                            const scaleX = node.scaleX() || 1
                                            const scaleY = node.scaleY() || 1
                                            const oldW = node.width() || uploadedSize.width
                                            const oldH = node.height() || uploadedSize.height
                                            const oldX = node.x()
                                            const oldY = node.y()
                                            // preserve center while scaling
                                            const centerX = oldX + oldW / 2
                                            const centerY = oldY + oldH / 2
                                            let newW = Math.max(10, Math.round(oldW * scaleX))
                                            let newH = Math.max(10, Math.round(oldH * scaleY))
                                            const container = activeZoneRect || mockupFit
                                            if (container) {
                                              newW = Math.min(newW, container.width)
                                              newH = Math.min(newH, container.height)
                                            }
                                            let newX = Math.round(centerX - newW / 2)
                                            let newY = Math.round(centerY - newH / 2)
                                            if (container) {
                                              // Clamp so the box stays inside container
                                              const minX = container.x
                                              const minY = container.y
                                              const maxX = container.x + container.width - newW
                                              const maxY = container.y + container.height - newH
                                              newX = Math.min(Math.max(newX, minX), Math.max(minX, maxX))
                                              newY = Math.min(Math.max(newY, minY), Math.max(minY, maxY))
                                            }
                                            // reset node scale and apply final box
                                            node.scaleX(1)
                                            node.scaleY(1)
                                            node.width(newW)
                                            node.height(newH)
                                            node.x(newX)
                                            node.y(newY)
                                            setUploadedPos({ x: newX, y: newY })
                                            setUploadedSize({ width: newW, height: newH })
                                            pushHistory(snapshotNow())
                                          }}
                                        />
                                        {imgSelected && (
                                          <Transformer
                                            ref={trRef}
                                            rotateEnabled={false}
                                            centeredScaling
                                            keepRatio
                                            anchorSize={8}
                                            boundBoxFunc={(oldBox, newBox) => {
                                              // Only allow zoom (scale) while keeping the center fixed
                                              const minSize = 20
                                              const container = activeZoneRect || mockupFit
                                              // Target dimensions
                                              let targetW = Math.max(minSize, newBox.width)
                                              let targetH = Math.max(minSize, newBox.height)
                                              if (container) {
                                                targetW = Math.min(targetW, container.width)
                                                targetH = Math.min(targetH, container.height)
                                              }
                                              // Preserve center from the previous box
                                              const cx = oldBox.x + oldBox.width / 2
                                              const cy = oldBox.y + oldBox.height / 2
                                              let nx = Math.round(cx - targetW / 2)
                                              let ny = Math.round(cy - targetH / 2)
                                              if (container) {
                                                const minX = container.x
                                                const minY = container.y
                                                const maxX = container.x + container.width - targetW
                                                const maxY = container.y + container.height - targetH
                                                nx = Math.min(Math.max(nx, minX), Math.max(minX, maxX))
                                                ny = Math.min(Math.max(ny, minY), Math.max(minY, maxY))
                                              }
                                              return { x: nx, y: ny, width: targetW, height: targetH, rotation: 0 } as any
                                            }}
                                          />
                                        )}
                                      </>
                                    )}
                                </Layer>
                            </Stage>
                        )}
                    </div>
                </div>

                {/* Bottom - Design Placements */}
                <div className="content-container p-4">
                    <div className="flex gap-3 justify-center">
                        {views.map((view) => (
                            <button
                                key={view.id}
                                onClick={() => setSelectedView(view.id)}
                                className={`flex flex-col items-center gap-2 p-3 rounded transition-colors ${
                                    selectedView === view.id
                                        ? 'bg-gray-100 border-2 border-gray-900'
                                        : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                                    <div className="w-12 h-12 bg-white rounded" />
                                </div>
                                <span className="text-xs font-medium">{view.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
        {/* Preview Modal */}
        {previewOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={() => setPreviewOpen(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-[min(92vw,900px)] max-h-[80vh] overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-base font-semibold">Preview</h3>
                <div className="flex items-center gap-3">
                  {/* Price display */}
                  <span className="text-lg font-bold whitespace-nowrap">{priceString || '—'}</span>
                  {/* Place order triggers finalize */}
                  <button
                    type="button"
                    onClick={() => { if (onFinalize) onFinalize() }}
                    disabled={!!submitting}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {submitting ? 'Placing…' : 'Place order'}
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded hover:bg-gray-100"
                    aria-label="Close preview"
                    onClick={() => setPreviewOpen(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-auto" style={{ maxHeight: 'calc(80vh - 64px)' }}>
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Design preview" className="max-w-full h-auto mx-auto" />
                ) : (
                  <div className="text-sm text-gray-600">No preview available.</div>
                )}
                {previewNote && (
                  <p className="mt-3 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">{previewNote}</p>
                )}
              </div>
            </div>
          </div>
        )}
        </>
    );
}