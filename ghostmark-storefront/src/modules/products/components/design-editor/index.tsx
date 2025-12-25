'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva'
import { Upload, Info, Undo, Redo, Circle, Plus, Minus, RotateCcw, Type, Image, Palette, Layers } from 'lucide-react';
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
    // Enhanced upload states
    const [isDragOver, setIsDragOver] = useState(false)
    const [uploadQueue, setUploadQueue] = useState<File[]>([])
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
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
    // Left sidebar state
    const [leftSidebarTab, setLeftSidebarTab] = useState<'product' | 'upload' | 'text' | 'templates' | 'layers' | 'areas'>('product')
    const [textSettings, setTextSettings] = useState({
        fontSize: 18,
        fontFamily: 'Inter',
        fontWeight: 'normal',
        color: '#000000',
        alignment: 'left'
    })
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

    // Center-locked zoom system based on Context7 patterns
    const hasSetInitialViewRef = useRef(false)
    const computeCenteredPos = useCallback((scale: number) => {
      // Always center the view around the mockup/design area
      const W = Math.max(stageSize.width, 1)
      const H = Math.max(stageSize.height, 1)
      const centerX = W / 2
      const centerY = H / 2
      
      // Calculate position to keep center point fixed during zoom
      return {
        x: centerX - (centerX * scale),
        y: centerY - (centerY * scale),
      }
    }, [stageSize.width, stageSize.height])
    
    // Enhanced zoom controls that maintain center position
    const handleZoomIn = useCallback(() => {
      setStageScale((prevScale) => {
        const newScale = Math.min(MAX_SCALE, prevScale * SCALE_BY)
        // Update position to maintain center
        setStagePos(computeCenteredPos(newScale))
        return Number(newScale.toFixed(3))
      })
    }, [computeCenteredPos])
    
    const handleZoomOut = useCallback(() => {
      setStageScale((prevScale) => {
        const newScale = Math.max(MIN_SCALE, prevScale / SCALE_BY)
        // Update position to maintain center
        setStagePos(computeCenteredPos(newScale))
        return Number(newScale.toFixed(3))
      })
    }, [computeCenteredPos])
    
    const handleZoomReset = useCallback(() => {
      const resetScale = DEFAULT_ZOOM
      setStageScale(resetScale)
      setStagePos(computeCenteredPos(resetScale))
    }, [computeCenteredPos])

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

    // Enhanced drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      const imageFiles = files.filter(file => file.type.startsWith('image/'))
      
      if (imageFiles.length > 0) {
        const file = imageFiles[0] // Use first image
        const reader = new FileReader()
        reader.onload = () => {
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          img.src = String(reader.result || '')
          img.onload = () => {
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
            setTimeout(() => pushHistory(snapshotNow()), 0)
          }
        }
        reader.readAsDataURL(file)
      }
    }, [activeZoneRect, mockupFit, pushHistory, snapshotNow])

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
        // Safe stage export function for the exporter
        const safeStageExport = (options?: any) => {
          try {
            return stage.toDataURL?.(options || { pixelRatio: 2 }) || ""
          } catch (error: any) {
            if (error.message?.includes('insecure') || error.message?.includes('tainted') || error.name === 'SecurityError') {
              console.warn('Canvas is tainted, cannot export directly:', error.message)
              return ''
            }
            return ''
          }
        }

        // Export high-res preview including mockup and design
        let previewDataUrl = ''
        let designOnlyDataUrl = ''
        // Use safe export to avoid CORS errors
        if (!mockupTainted) {
          previewDataUrl = safeStageExport({ pixelRatio: 2 })
        }
        // Always try to export a design-only PNG by hiding the background layer
        try {
          const bgLayer = bgLayerRef.current as any
          const prevVisible = bgLayer?.visible?.() ?? true
          if (bgLayer && typeof bgLayer.visible === 'function') {
            bgLayer.visible(false)
            stage.draw()
          }
          designOnlyDataUrl = safeStageExport({ pixelRatio: 2 })
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
    
    // Print areas state (enhanced Gelato-style)
    const [printAreas, setPrintAreas] = useState<any[]>([])
    const [activePrintArea, setActivePrintArea] = useState<string | null>(null)
    const [showPrintAreaBounds, setShowPrintAreaBounds] = useState(true)

    // Fetch print areas when variant changes
    useEffect(() => {
      if (!selectedVariantId) return
      
      const fetchPrintAreas = async () => {
        try {
          const response = await fetch(`/api/variants/${selectedVariantId}?countryCode=US`)
          if (response.ok) {
            const data = await response.json()
            if (data.printAreas && Array.isArray(data.printAreas)) {
              setPrintAreas(data.printAreas)
              // Auto-select first print area
              if (data.printAreas.length > 0 && !activePrintArea) {
                setActivePrintArea(data.printAreas[0].id)
              }
            }
          }
        } catch (error) {
          console.warn('Failed to fetch print areas:', error)
          // Fallback to mockup zones
          if (mockupZones) {
            const fallbackAreas = Object.entries(mockupZones).map(([key, zone], index) => ({
              id: `area_${index + 1}`,
              name: key.charAt(0).toUpperCase() + key.slice(1),
              boundaries: zone,
              type: key.includes('front') ? 'front' : key.includes('back') ? 'back' : 'custom'
            }))
            setPrintAreas(fallbackAreas)
            if (fallbackAreas.length > 0) {
              setActivePrintArea(fallbackAreas[0].id)
            }
          }
        }
      }
      
      fetchPrintAreas()
    }, [selectedVariantId, mockupZones])

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

    // Enhanced preview with CORS-safe fallback system
    const handlePreview = useCallback(async () => {
      const stage = stageRef.current as any
      if (!stage) return
      setPreviewLoading(true)
      setPreviewNote(null)
      
      try {
        // Safe stage export function that handles CORS errors gracefully
        const attemptStageExport = (options?: any) => {
          try {
            return stage.toDataURL?.(options || { pixelRatio: 2 }) || ""
          } catch (error: any) {
            // Catch any CORS/tainted canvas errors
            if (error.message?.includes('insecure') || error.message?.includes('tainted') || error.name === 'SecurityError') {
              console.warn('Canvas is tainted, cannot export directly:', error.message)
              return null
            }
            throw error // Re-throw if it's a different error
          }
        }
        
        // First try: Use Konva stage directly (best quality with full product image)
        // Only attempt if we think the canvas isn't tainted
        if (!mockupTainted) {
          const dataUrl = attemptStageExport()
          if (dataUrl && dataUrl !== "data:," && dataUrl.length > 100) {
            setPreviewUrl(dataUrl)
            setPreviewOpen(true)
            setPreviewNote(null) // Clear any previous notes
            return
          }
        }
        
        // Fallback: Create CORS-safe preview
        const tempCanvas = document.createElement('canvas')
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) throw new Error('Could not create canvas context')
        
        // Set dimensions based on mockup fit
        const scale = 2
        const baseWidth = mockupFit?.width || 400
        const baseHeight = mockupFit?.height || 400
        tempCanvas.width = baseWidth * scale
        tempCanvas.height = baseHeight * scale
        
        // Scale context for high DPI
        tempCtx.scale(scale, scale)
        
        // Fill background
        tempCtx.fillStyle = '#ffffff'
        tempCtx.fillRect(0, 0, baseWidth, baseHeight)
        
        // Try to draw the actual product mockup image
        if (mockupImage && mockupFit) {
          try {
            // Attempt to draw the mockup image
            tempCtx.drawImage(
              mockupImage,
              0, // Draw at origin since we're using mockupFit dimensions
              0,
              baseWidth,
              baseHeight
            )
          } catch (e) {
            console.warn('CORS prevented mockup image drawing, using styled placeholder')
            // Fallback: Create an attractive product placeholder
            
            // Background gradient
            const gradient = tempCtx.createLinearGradient(0, 0, 0, baseHeight)
            gradient.addColorStop(0, '#f8fafc')
            gradient.addColorStop(1, '#e2e8f0')
            tempCtx.fillStyle = gradient
            tempCtx.fillRect(0, 0, baseWidth, baseHeight)
            
            // Product shape outline (t-shirt like shape)
            tempCtx.strokeStyle = '#cbd5e1'
            tempCtx.lineWidth = 3
            tempCtx.fillStyle = '#ffffff'
            
            // Draw a t-shirt-like shape
            const centerX = baseWidth / 2
            const centerY = baseHeight / 2
            const shirtWidth = baseWidth * 0.7
            const shirtHeight = baseHeight * 0.8
            
            tempCtx.beginPath()
            // Shoulders
            tempCtx.moveTo(centerX - shirtWidth * 0.4, centerY - shirtHeight * 0.4)
            tempCtx.lineTo(centerX - shirtWidth * 0.3, centerY - shirtHeight * 0.45)
            tempCtx.lineTo(centerX - shirtWidth * 0.2, centerY - shirtHeight * 0.4)
            // Right shoulder to armpit
            tempCtx.lineTo(centerX + shirtWidth * 0.2, centerY - shirtHeight * 0.4)
            tempCtx.lineTo(centerX + shirtWidth * 0.3, centerY - shirtHeight * 0.45)
            tempCtx.lineTo(centerX + shirtWidth * 0.4, centerY - shirtHeight * 0.4)
            // Right side
            tempCtx.lineTo(centerX + shirtWidth * 0.35, centerY + shirtHeight * 0.4)
            // Bottom
            tempCtx.lineTo(centerX - shirtWidth * 0.35, centerY + shirtHeight * 0.4)
            // Left side back to start
            tempCtx.closePath()
            
            tempCtx.fill()
            tempCtx.stroke()
            
            // Add product label
            tempCtx.fillStyle = '#64748b'
            tempCtx.font = 'bold 14px Inter, sans-serif'
            tempCtx.textAlign = 'center'
            tempCtx.fillText(product?.title || 'Custom Product', centerX, baseHeight - 20)
          }
        } else {
          // No mockup available - create a generic product shape
          const gradient = tempCtx.createLinearGradient(0, 0, 0, baseHeight)
          gradient.addColorStop(0, '#f1f5f9')
          gradient.addColorStop(1, '#e2e8f0')
          tempCtx.fillStyle = gradient
          tempCtx.fillRect(0, 0, baseWidth, baseHeight)
          
          tempCtx.fillStyle = '#64748b'
          tempCtx.font = 'bold 16px Inter, sans-serif'
          tempCtx.textAlign = 'center'
          tempCtx.fillText('Product Preview', baseWidth / 2, baseHeight / 2)
        }
        
        // Draw print area boundaries for context
        if (showPrintAreaBounds && printAreas.length > 0) {
          printAreas.forEach((area) => {
            const bounds = area.boundaries || area.position
            if (!bounds) return
            
            const isActive = area.id === activePrintArea
            tempCtx.strokeStyle = isActive ? '#3b82f6' : '#94a3b8'
            tempCtx.lineWidth = isActive ? 3 : 2
            tempCtx.setLineDash(isActive ? [8, 4] : [4, 4])
            tempCtx.strokeRect(
              bounds.x || 0,
              bounds.y || 0,
              bounds.w || bounds.width || 100,
              bounds.h || bounds.height || 100
            )
            tempCtx.setLineDash([]) // Reset dash pattern
          })
        }

        // Draw uploaded design elements
        if (uploadedImg) {
          try {
            // Calculate positioning relative to the canvas/mockup area
            const scale = baseWidth / (mockupFit?.width || baseWidth)
            const relativeX = Math.max(0, (uploadedPos.x - (mockupFit?.x || 0)) * scale)
            const relativeY = Math.max(0, (uploadedPos.y - (mockupFit?.y || 0)) * scale)
            const scaledWidth = uploadedSize.width * scale
            const scaledHeight = uploadedSize.height * scale
            
            // Ensure the design stays within canvas bounds
            const finalX = Math.min(relativeX, baseWidth - scaledWidth)
            const finalY = Math.min(relativeY, baseHeight - scaledHeight)
            
            // Check if design is within active print area (visual indicator)
            let withinPrintArea = false
            if (activePrintArea && printAreas.length > 0) {
              const activeArea = printAreas.find(area => area.id === activePrintArea)
              if (activeArea && activeArea.boundaries) {
                const bounds = activeArea.boundaries
                withinPrintArea = (
                  finalX >= bounds.x &&
                  finalY >= bounds.y &&
                  finalX + scaledWidth <= bounds.x + (bounds.w || bounds.width) &&
                  finalY + scaledHeight <= bounds.y + (bounds.h || bounds.height)
                )
              }
            }
            
            // Add subtle overlay if design is outside print area
            if (!withinPrintArea && printAreas.length > 0) {
              tempCtx.save()
              tempCtx.globalAlpha = 0.7
              tempCtx.drawImage(uploadedImg, finalX, finalY, scaledWidth, scaledHeight)
              tempCtx.restore()
              
              // Add warning indicator
              tempCtx.fillStyle = '#ef4444'
              tempCtx.font = 'bold 12px Inter, sans-serif'
              tempCtx.fillText('⚠ Outside print area', finalX, finalY - 5)
            } else {
              tempCtx.drawImage(uploadedImg, finalX, finalY, scaledWidth, scaledHeight)
            }
          } catch (e) {
            console.warn('Could not draw uploaded image in preview:', e)
            // Draw an attractive placeholder for user's design
            const scale = baseWidth / (mockupFit?.width || baseWidth)
            const relativeX = Math.max(0, (uploadedPos.x - (mockupFit?.x || 0)) * scale)
            const relativeY = Math.max(0, (uploadedPos.y - (mockupFit?.y || 0)) * scale)
            const scaledWidth = uploadedSize.width * scale
            const scaledHeight = uploadedSize.height * scale
            
            // Create a gradient placeholder
            const designGradient = tempCtx.createLinearGradient(relativeX, relativeY, relativeX + scaledWidth, relativeY + scaledHeight)
            designGradient.addColorStop(0, '#ddd6fe')
            designGradient.addColorStop(1, '#c4b5fd')
            
            tempCtx.fillStyle = designGradient
            tempCtx.fillRect(relativeX, relativeY, scaledWidth, scaledHeight)
            
            // Add a stylish border
            tempCtx.strokeStyle = '#8b5cf6'
            tempCtx.lineWidth = 2
            tempCtx.strokeRect(relativeX, relativeY, scaledWidth, scaledHeight)
            
            // Add "Your Design" text
            tempCtx.fillStyle = '#6d28d9'
            tempCtx.font = 'bold 12px Inter, sans-serif'
            tempCtx.textAlign = 'center'
            tempCtx.fillText('Your Design', relativeX + scaledWidth / 2, relativeY + scaledHeight / 2)
          }
        }
        
        // Draw text if visible (always CORS-safe)
        if (textVisible && textContent) {
          const scale = baseWidth / (mockupFit?.width || baseWidth)
          const scaledFontSize = Math.max(12, textFontSize * scale)
          
          tempCtx.font = `${textSettings.fontWeight === 'bold' ? 'bold ' : ''}${scaledFontSize}px ${textSettings.fontFamily}`
          tempCtx.fillStyle = textSettings.color
          tempCtx.textAlign = 'left'
          
          // Calculate relative position and ensure it's visible
          const relativeTextX = Math.max(10, (dragTextPos.x - 60 - (mockupFit?.x || 0)) * scale)
          const relativeTextY = Math.max(scaledFontSize + 10, (dragTextPos.y - (mockupFit?.y || 0)) * scale)
          
          // Add text shadow for better visibility
          tempCtx.shadowColor = 'rgba(0, 0, 0, 0.3)'
          tempCtx.shadowBlur = 2
          tempCtx.shadowOffsetX = 1
          tempCtx.shadowOffsetY = 1
          
          tempCtx.fillText(textContent, relativeTextX, relativeTextY)
          
          // Clear shadow for subsequent draws
          tempCtx.shadowColor = 'transparent'
          tempCtx.shadowBlur = 0
          tempCtx.shadowOffsetX = 0
          tempCtx.shadowOffsetY = 0
        }
        
        // Safe canvas export to handle CORS taint
        let previewDataUrl: string
        try {
          previewDataUrl = tempCanvas.toDataURL('image/png', 0.9)
        } catch (error: any) {
          if (error.message?.includes('insecure') || error.message?.includes('tainted') || error.name === 'SecurityError') {
            console.warn('Fallback canvas is also tainted, using final fallback:', error.message)
            // Create a completely clean canvas as final fallback
            const cleanCanvas = document.createElement('canvas')
            cleanCanvas.width = 400
            cleanCanvas.height = 400
            const cleanCtx = cleanCanvas.getContext('2d')!
            
            // Clean gradient background
            const gradient = cleanCtx.createLinearGradient(0, 0, 0, 400)
            gradient.addColorStop(0, '#f8fafc')
            gradient.addColorStop(1, '#e2e8f0')
            cleanCtx.fillStyle = gradient
            cleanCtx.fillRect(0, 0, 400, 400)
            
            // Product outline
            cleanCtx.strokeStyle = '#cbd5e1'
            cleanCtx.lineWidth = 3
            cleanCtx.fillStyle = '#ffffff'
            cleanCtx.fillRect(100, 50, 200, 250)
            cleanCtx.strokeRect(100, 50, 200, 250)
            
            // Text
            cleanCtx.fillStyle = '#64748b'
            cleanCtx.font = 'bold 16px sans-serif'
            cleanCtx.textAlign = 'center'
            cleanCtx.fillText('Custom Design Preview', 200, 200)
            cleanCtx.fillText('Your design will appear here', 200, 230)
            
            previewDataUrl = cleanCanvas.toDataURL('image/png', 0.9)
          } else {
            throw error
          }
        }
        
        setPreviewUrl(previewDataUrl)
        setPreviewOpen(true)
        
        // Show informative note about the preview with print area context
        let note = ""
        if (mockupImage) {
          note = "Preview shows your design on the product. Final print quality will be optimized for production."
        } else {
          note = "Preview shows design layout. Actual product image will be included in the final result."
        }
        
        // Add print area information
        if (printAreas.length > 0 && activePrintArea) {
          const activeArea = printAreas.find(area => area.id === activePrintArea)
          if (activeArea) {
            note += ` Currently viewing "${activeArea.name}" print area.`
            if (activeArea.printMethods && activeArea.printMethods.length > 0) {
              note += ` Available methods: ${activeArea.printMethods.join(', ')}.`
            }
          }
        }
        
        setPreviewNote(note)
        
      } catch (error) {
        console.error('Preview generation failed:', error)
        
        // Final fallback: Show a basic design representation
        try {
          const fallbackCanvas = document.createElement('canvas')
          const fallbackCtx = fallbackCanvas.getContext('2d')
          if (fallbackCtx) {
            fallbackCanvas.width = 400
            fallbackCanvas.height = 400
            
            fallbackCtx.fillStyle = '#f1f5f9'
            fallbackCtx.fillRect(0, 0, 400, 400)
            
            fallbackCtx.fillStyle = '#64748b'
            fallbackCtx.font = 'bold 24px Inter, sans-serif'
            fallbackCtx.textAlign = 'center'
            fallbackCtx.fillText('Design Preview', 200, 180)
            
            fallbackCtx.font = '16px Inter, sans-serif'
            fallbackCtx.fillText('Your custom design', 200, 210)
            fallbackCtx.fillText('will appear here', 200, 235)
            
            // Safe export for final fallback canvas
            try {
              setPreviewUrl(fallbackCanvas.toDataURL())
            } catch (canvasError: any) {
              // Even the clean fallback canvas failed - set empty URL
              console.warn('Final fallback canvas export failed:', canvasError.message)
              setPreviewUrl("")
            }
            setPreviewOpen(true)
            setPreviewNote("Preview temporarily unavailable. Your design will be applied to the final product.")
          }
        } catch (fallbackError) {
          setPreviewUrl("")
          setPreviewOpen(true)
          setPreviewNote("Preview unavailable due to browser security restrictions.")
        }
      } finally {
        setPreviewLoading(false)
      }
    }, [mockupTainted, mockupFit, uploadedImg, uploadedPos, uploadedSize, textVisible, textContent, textSettings, textFontSize, dragTextPos, product])

    return (
        <>
         <div className="flex h-screen bg-gray-50">
            {/* Far Left Toolbar */}
            <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-1 shadow-sm">
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-lg gap-1 text-gray-600 transition-all duration-200"
                    title="Back to Product"
                    onClick={() => router.back()}
                >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-[9px] font-medium">Back</span>
                </button>
                <button
                    className={`w-12 h-12 flex flex-col items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-lg gap-1 transition-all duration-200 ${
                        leftSidebarTab === 'product' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                    }`}
                    title="Product Options"
                    onClick={() => setLeftSidebarTab('product')}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-[9px] font-medium">Product</span>
                </button>
                <label className={`w-12 h-12 flex flex-col items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-lg gap-1 transition-all duration-200 cursor-pointer ${
                    leftSidebarTab === 'upload' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                }`}
                  title="Upload Images"
                  onClick={() => setLeftSidebarTab('upload')}
                >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files)
                          files.forEach(file => {
                            const reader = new FileReader()
                            reader.onload = () => {
                              const img = new window.Image()
                              img.crossOrigin = 'anonymous'
                              img.src = String(reader.result || '')
                              img.onload = () => {
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
                                setTimeout(() => pushHistory(snapshotNow()), 0)
                              }
                            }
                            reader.readAsDataURL(file)
                          })
                        }
                      }}
                    />
                    <Upload className="w-5 h-5" />
                    <span className="text-[9px] font-medium">Upload</span>
                </label>
                <button
                    className={`w-12 h-12 flex flex-col items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-lg gap-1 transition-all duration-200 ${
                        leftSidebarTab === 'text' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                    }`}
                    title="Add Text"
                    onClick={() => {
                      setLeftSidebarTab('text')
                      if (!textVisible) {
                        setTextVisible(true)
                        setTimeout(() => pushHistory(snapshotNow()), 0)
                      }
                    }}
                >
                    <Type className="w-5 h-5" />
                    <span className="text-[9px] font-medium">Text</span>
                </button>
                <button
                    className={`w-12 h-12 flex flex-col items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-lg gap-1 transition-all duration-200 ${
                        leftSidebarTab === 'templates' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                    }`}
                    title="Templates"
                    onClick={() => setLeftSidebarTab('templates')}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                    </svg>
                    <span className="text-[9px] font-medium">Templates</span>
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
                    className={`w-12 h-12 flex flex-col items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-lg gap-1 transition-all duration-200 ${
                        leftSidebarTab === 'layers' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                    }`}
                    title="Layers"
                    onClick={() => setLeftSidebarTab('layers')}
                >
                    <Layers className="w-5 h-5" />
                    <span className="text-[9px] font-medium">Layers</span>
                </button>
                <button
                    className={`w-12 h-12 flex flex-col items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-lg gap-1 transition-all duration-200 ${
                        leftSidebarTab === 'areas' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                    }`}
                    title="Print Areas"
                    onClick={() => setLeftSidebarTab('areas')}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-[9px] font-medium">Areas</span>
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
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-lg gap-1 text-gray-600 transition-all duration-200"
                    title="Shapes & Graphics"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" strokeWidth={2} />
                        <rect x="5" y="5" width="6" height="6" strokeWidth={2} />
                    </svg>
                    <span className="text-[9px] font-medium">Shapes</span>
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

            {/* Left Sidebar - Product Info & Options */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                {/* Header Section */}
                <div className="p-6 border-b border-gray-100">
                    {/* Product Info (dynamic) */}
                    {product && (
                      <div className="mb-4" data-testid="design-left-product-info">
                        {product.collection && (
                          <LocalizedClientLink
                            href={`/collections/${product.collection.handle}`}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            {product.collection.title}
                          </LocalizedClientLink>
                        )}
                        <h1 className="font-bold text-lg mb-2 text-gray-900">
                          {product.title}
                        </h1>
                        {(() => {
                          const subtitleFromMeta = (product as any)?.metadata?.subtitle as string | undefined
                          const raw = subtitleFromMeta || product.description || ''
                          if (!raw) return null
                          const firstSentenceMatch = raw.match(/[^.!?\n]+[.!?]?/)
                          const first = firstSentenceMatch ? firstSentenceMatch[0] : raw
                          const short = first.length > 160 ? first.slice(0, 157).trim() + '…' : first
                          return <p className="text-sm text-gray-600 leading-relaxed">{short}</p>
                        })()}
                      </div>
                    )}
                </div>

                {/* Functional Sidebar Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6">
                        {/* Tab Content */}
                        {leftSidebarTab === 'product' && (
                            <>
                                {/* Variant Options (PDP-style) */}
                                {product?.options && product.options.length > 0 && (
                                  <div className="mb-6" data-testid="design-left-variant-options">
                                    <h3 className="font-semibold text-sm mb-4 text-gray-900">Product Options</h3>
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

                                {/* Design Tips */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 mb-6">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm mb-2 text-gray-900">Design Pro Tip</h3>
                                            <p className="text-sm text-gray-700 leading-relaxed">
                                                Add prints to multiple areas to create a premium, branded look. Use high-resolution images for best quality.
                                            </p>
                                            <a href="#" className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2 inline-block">Learn More →</a>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Upload Tab */}
                        {leftSidebarTab === 'upload' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-semibold text-sm mb-4 text-gray-900">Upload Images</h3>
                                    
                                    {/* Enhanced Upload Area */}
                                    <label className="relative block w-full h-32 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 cursor-pointer group">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    const files = Array.from(e.target.files)
                                                    files.forEach(file => {
                                                        const reader = new FileReader()
                                                        reader.onload = () => {
                                                            const img = new window.Image()
                                                            img.crossOrigin = 'anonymous'
                                                            img.src = String(reader.result || '')
                                                            img.onload = () => {
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
                                                                setTimeout(() => pushHistory(snapshotNow()), 0)
                                                            }
                                                        }
                                                        reader.readAsDataURL(file)
                                                    })
                                                }
                                            }}
                                        />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />
                                            <p className="text-sm text-gray-600 group-hover:text-blue-600 text-center">
                                                <span className="font-medium">Click to upload</span> or drag and drop
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
                                        </div>
                                    </label>
                                    
                                    {/* Upload Progress */}
                                    {Object.entries(uploadProgress).map(([filename, progress]) => (
                                        <div key={filename} className="mt-3 p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-700 truncate">{filename}</span>
                                                <span className="text-xs text-gray-500">{progress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Recent Uploads */}
                                {uploadedImg && (
                                    <div>
                                        <h4 className="font-medium text-sm text-gray-900 mb-3">Current Image</h4>
                                        <div className="p-3 border border-gray-200 rounded-lg">
                                            <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden mb-2">
                                                <img 
                                                    src={uploadedImg.src} 
                                                    alt="Current upload"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-600">Click and drag on canvas to reposition</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Text Tab */}
                        {leftSidebarTab === 'text' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-semibold text-sm mb-4 text-gray-900">Text Settings</h3>
                                    
                                    {/* Text Content */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Text Content</label>
                                        <textarea
                                            value={textContent}
                                            onChange={(e) => setTextContent(e.target.value)}
                                            placeholder="Enter your text here..."
                                            className="w-full p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                                            rows={3}
                                        />
                                    </div>

                                    {/* Font Settings */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Font Size</label>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="range"
                                                    min="12"
                                                    max="72"
                                                    value={textFontSize}
                                                    onChange={(e) => setTextFontSize(Number(e.target.value))}
                                                    className="flex-1"
                                                />
                                                <span className="text-sm font-medium text-gray-600 w-8">{textFontSize}</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
                                            <select
                                                value={textSettings.fontFamily}
                                                onChange={(e) => setTextSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                                                className="w-full p-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="Inter">Inter</option>
                                                <option value="Arial">Arial</option>
                                                <option value="Helvetica">Helvetica</option>
                                                <option value="Times New Roman">Times New Roman</option>
                                                <option value="Georgia">Georgia</option>
                                                <option value="Courier New">Courier New</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Font Weight</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['normal', 'bold', 'lighter'].map((weight) => (
                                                    <button
                                                        key={weight}
                                                        onClick={() => setTextSettings(prev => ({ ...prev, fontWeight: weight }))}
                                                        className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                                                            textSettings.fontWeight === weight
                                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                                : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        {weight.charAt(0).toUpperCase() + weight.slice(1)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="color"
                                                    value={textSettings.color}
                                                    onChange={(e) => setTextSettings(prev => ({ ...prev, color: e.target.value }))}
                                                    className="w-12 h-10 rounded-lg border border-gray-200"
                                                />
                                                <input
                                                    type="text"
                                                    value={textSettings.color}
                                                    onChange={(e) => setTextSettings(prev => ({ ...prev, color: e.target.value }))}
                                                    className="flex-1 p-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Text Actions */}
                                    <div className="pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => {
                                                if (!textVisible) {
                                                    setTextVisible(true)
                                                    setTimeout(() => pushHistory(snapshotNow()), 0)
                                                }
                                            }}
                                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                        >
                                            {textVisible ? 'Update Text' : 'Add Text to Design'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Templates Tab */}
                        {leftSidebarTab === 'templates' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-semibold text-sm mb-4 text-gray-900">Design Templates</h3>
                                    
                                    {/* Template Categories */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {['Business', 'Personal', 'Events', 'Logos'].map((category) => (
                                            <button
                                                key={category}
                                                className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-sm font-medium text-gray-700"
                                            >
                                                {category}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Template Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {Array.from({ length: 6 }, (_, i) => (
                                            <div key={i} className="aspect-square bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer border-2 border-transparent hover:border-blue-300">
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <span className="text-gray-500 text-sm">Template {i + 1}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Layers Tab */}
                        {leftSidebarTab === 'layers' && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm mb-4 text-gray-900">Layers</h3>
                                
                                {/* Layer List */}
                                <div className="space-y-2">
                                    {/* Background Layer */}
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-4 h-4 bg-gray-300 rounded"></div>
                                            <span className="text-sm text-gray-600">Background</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button className="text-gray-400 hover:text-gray-600">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Image Layer */}
                                    {uploadedImg && (
                                        <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                                            imgSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                                        }`}>
                                            <div className="flex items-center space-x-3">
                                                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                                                <span className="text-sm text-gray-700">Uploaded Image</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button 
                                                    className="text-gray-400 hover:text-gray-600"
                                                    onClick={() => setImgSelected(true)}
                                                >
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                                                    </svg>
                                                </button>
                                                <button 
                                                    className="text-red-400 hover:text-red-600"
                                                    onClick={() => {
                                                        setUploadedImg(null)
                                                        setImgSelected(false)
                                                        setTimeout(() => pushHistory(snapshotNow()), 0)
                                                    }}
                                                >
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Text Layer */}
                                    {textVisible && (
                                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border-2 border-gray-200">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-4 h-4 bg-green-500 rounded"></div>
                                                <span className="text-sm text-gray-700">Text Layer</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button className="text-gray-400 hover:text-gray-600">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                                                    </svg>
                                                </button>
                                                <button 
                                                    className="text-red-400 hover:text-red-600"
                                                    onClick={() => {
                                                        setTextVisible(false)
                                                        setTimeout(() => pushHistory(snapshotNow()), 0)
                                                    }}
                                                >
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Print Areas Tab - Gelato Style */}
                        {leftSidebarTab === 'areas' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-sm text-gray-900">Print Areas</h3>
                                    <button
                                        onClick={() => setShowPrintAreaBounds(!showPrintAreaBounds)}
                                        className={`p-2 rounded-lg transition-colors ${
                                            showPrintAreaBounds ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                                        }`}
                                        title={showPrintAreaBounds ? 'Hide boundaries' : 'Show boundaries'}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    </button>
                                </div>
                                
                                {/* Print Areas List */}
                                <div className="space-y-3">
                                    {printAreas.length > 0 ? printAreas.map((area) => (
                                        <div
                                            key={area.id}
                                            className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                                                area.id === activePrintArea 
                                                    ? 'border-blue-500 bg-blue-50 shadow-lg' 
                                                    : 'border-gray-200 bg-white hover:border-blue-300'
                                            }`}
                                            onClick={() => setActivePrintArea(area.id)}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${
                                                        area.type === 'front' ? 'bg-blue-500' : 
                                                        area.type === 'back' ? 'bg-green-500' : 
                                                        area.type === 'sleeve' ? 'bg-purple-500' : 'bg-gray-500'
                                                    }`} />
                                                    <span className="font-semibold text-sm text-gray-900">{area.name}</span>
                                                </div>
                                                {area.id === activePrintArea && (
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                                )}
                                            </div>
                                            
                                            <div className="space-y-2 text-xs text-gray-600">
                                                <div className="flex justify-between">
                                                    <span>Type:</span>
                                                    <span className="font-medium capitalize">{area.type}</span>
                                                </div>
                                                {area.constraints && (
                                                    <div className="flex justify-between">
                                                        <span>Max size:</span>
                                                        <span className="font-medium">
                                                            {area.constraints.maxWidth}×{area.constraints.maxHeight}px
                                                        </span>
                                                    </div>
                                                )}
                                                {area.printMethods && (
                                                    <div className="flex justify-between">
                                                        <span>Methods:</span>
                                                        <span className="font-medium capitalize">
                                                            {area.printMethods.join(', ')}
                                                        </span>
                                                    </div>
                                                )}
                                                {area.pricing && (
                                                    <div className="flex justify-between">
                                                        <span>Base cost:</span>
                                                        <span className="font-medium text-green-600">
                                                            ${area.pricing.basePrice?.toFixed(2)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="font-medium">No print areas configured</p>
                                            <p className="text-sm mt-1">Select a different variant to see print areas</p>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Print Area Guidelines */}
                                {printAreas.length > 0 && (
                                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <div className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div className="text-amber-800 text-sm">
                                                <p className="font-medium mb-2">Design Guidelines</p>
                                                <ul className="space-y-1 text-xs">
                                                    <li>• Keep designs within the highlighted print areas</li>
                                                    <li>• Use high-resolution images (300 DPI or higher)</li>
                                                    <li>• Avoid placing text too close to boundaries</li>
                                                    <li>• Consider print method limitations for color count</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Center - Canvas & Design Area */}
            <div className="flex-1 flex flex-col bg-white">
                {/* Modern Top Toolbar */}
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-gray-50 rounded-lg p-1 gap-1">
                            <button className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all duration-200 text-gray-600">
                                <Info className="w-4 h-4" />
                            </button>
                            <div className="w-px h-6 bg-gray-200" />
                            <button
                              className={`p-2 rounded-md transition-all duration-200 ${canUndo ? 'hover:bg-white hover:shadow-sm text-gray-700' : 'opacity-40 cursor-not-allowed text-gray-400'}`}
                              title="Undo"
                              onClick={handleUndo}
                              disabled={!canUndo}
                            >
                                <Undo className="w-4 h-4" />
                            </button>
                            <button
                              className={`p-2 rounded-md transition-all duration-200 ${canRedo ? 'hover:bg-white hover:shadow-sm text-gray-700' : 'opacity-40 cursor-not-allowed text-gray-400'}`}
                              title="Redo"
                              onClick={handleRedo}
                              disabled={!canRedo}
                            >
                                <Redo className="w-4 h-4" />
                            </button>
                        </div>
                        {/* Modern Zoom Controls */}
                        <div className="flex items-center bg-gray-50 rounded-lg p-1 gap-1 ml-3">
                            <button
                              type="button"
                              className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all duration-200 text-gray-700"
                              title="Zoom out"
                              onClick={handleZoomOut}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-sm w-16 text-center tabular-nums font-medium text-gray-700 bg-white rounded-md py-2 px-3 shadow-sm">
                              {Math.round(stageScale * 100)}%
                            </span>
                            <button
                              type="button"
                              className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all duration-200 text-gray-700"
                              title="Zoom in"
                              onClick={handleZoomIn}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <div className="w-px h-6 bg-gray-200" />
                            <button
                              type="button"
                              className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all duration-200 text-gray-700"
                              title="Reset view"
                              onClick={handleZoomReset}
                            >
                              <RotateCcw className="w-4 h-4" />
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
                        {/* Modern Upload Button */}
                        <label className="px-4 py-2.5 bg-white border-2 border-gray-300 text-sm rounded-xl hover:border-blue-400 hover:bg-blue-50 font-medium cursor-pointer transition-all duration-200 flex items-center gap-2 shadow-sm">
                            <Upload className="w-4 h-4" />
                            <span>Upload Image</span>
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
                        </label>
                        <button
                          type="button"
                          onClick={handlePreview}
                          disabled={previewLoading}
                          className="px-4 py-2.5 bg-white border-2 border-gray-300 text-sm rounded-xl hover:border-gray-400 hover:bg-gray-50 font-medium disabled:opacity-50 transition-all duration-200 shadow-sm"
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
                            className="flex items-center gap-2 text-xl font-bold px-3 py-2 rounded-xl hover:bg-gray-50 whitespace-nowrap transition-all duration-200"
                            title="Show price details"
                            aria-expanded={showPriceDetails}
                          >
                            <span
                              className={`inline-block will-change-transform transition-transform duration-300 ${priceAnimate ? 'animate-bounce scale-110' : ''}`}
                            >
                              {priceString || '—'}
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showPriceDetails ? 'rotate-180' : ''}`} />
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

                {/* Modern Canvas Area with Drag & Drop */}
                <div 
                    className={`flex-1 relative transition-all duration-200 ${
                        isDragOver ? 'bg-blue-100 border-4 border-dashed border-blue-400' : 'bg-gray-50'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Professional canvas container with subtle pattern */}
                    <div ref={canvasContainerRef} className="absolute inset-0" style={{
                        backgroundImage: isDragOver ? 'none' : `radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                        backgroundSize: '20px 20px'
                    }}>
                        {/* Drag overlay */}
                        {isDragOver && (
                            <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 backdrop-blur-sm">
                                <div className="text-center">
                                    <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-blue-700 mb-2">Drop your image here</h3>
                                    <p className="text-blue-600">Release to add to your design</p>
                                </div>
                            </div>
                        )}
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
                              draggable={false}
                              onMouseDown={(e: any) => {
                                // Deselect when clicking empty space (stage) or non-design layers
                                const clickedOnEmpty = e.target === e.target.getStage()
                                if (clickedOnEmpty) {
                                  setImgSelected(false)
                                }
                              }}
                              onWheel={(e: any) => {
                                e.evt.preventDefault()
                                const direction = e.evt.deltaY > 0 ? -1 : 1
                                const newScaleRaw = direction > 0 ? stageScale * SCALE_BY : stageScale / SCALE_BY
                                const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScaleRaw))
                                
                                // Center-locked zoom: always zoom towards center
                                setStageScale(Number(newScale.toFixed(3)))
                                setStagePos(computeCenteredPos(newScale))
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
                                {/* Enhanced Print Areas Layer - Gelato Style */}
                                <Layer listening={false}>
                                  {showPrintAreaBounds && printAreas.map((area, index) => {
                                    const isActive = area.id === activePrintArea
                                    const bounds = area.boundaries || area.position
                                    if (!bounds) return null
                                    
                                    return (
                                      <React.Fragment key={area.id}>
                                        {/* Print area boundary */}
                                        <Rect
                                          x={bounds.x || 0}
                                          y={bounds.y || 0}
                                          width={bounds.w || bounds.width || 100}
                                          height={bounds.h || bounds.height || 100}
                                          stroke={isActive ? "#3b82f6" : "#94a3b8"}
                                          strokeWidth={isActive ? 3 : 2}
                                          dash={isActive ? [8, 4] : [4, 4]}
                                          opacity={isActive ? 0.9 : 0.6}
                                        />
                                        {/* Print area label */}
                                        <Rect
                                          x={(bounds.x || 0) - 2}
                                          y={(bounds.y || 0) - 24}
                                          width={Math.max(60, area.name.length * 8)}
                                          height={20}
                                          fill={isActive ? "#3b82f6" : "#64748b"}
                                          cornerRadius={4}
                                          opacity={0.9}
                                        />
                                        <Text
                                          x={(bounds.x || 0) + 6}
                                          y={(bounds.y || 0) - 20}
                                          text={area.name}
                                          fontSize={12}
                                          fontFamily="Inter, sans-serif"
                                          fill="white"
                                          fontWeight="600"
                                        />
                                        {/* Corner markers for active area */}
                                        {isActive && (
                                          <>
                                            {/* Top-left */}
                                            <Rect x={bounds.x - 3} y={bounds.y - 3} width={10} height={10} fill="#3b82f6" />
                                            {/* Top-right */}
                                            <Rect x={bounds.x + (bounds.w || bounds.width) - 7} y={bounds.y - 3} width={10} height={10} fill="#3b82f6" />
                                            {/* Bottom-left */}
                                            <Rect x={bounds.x - 3} y={bounds.y + (bounds.h || bounds.height) - 7} width={10} height={10} fill="#3b82f6" />
                                            {/* Bottom-right */}
                                            <Rect x={bounds.x + (bounds.w || bounds.width) - 7} y={bounds.y + (bounds.h || bounds.height) - 7} width={10} height={10} fill="#3b82f6" />
                                          </>
                                        )}
                                      </React.Fragment>
                                    )
                                  })}
                                  
                                  {/* Fallback: Legacy mockup zone display if no print areas */}
                                  {printAreas.length === 0 && activeZoneRect && (
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
                                          text={textContent || 'Sample Text'}
                                          fontSize={textFontSize}
                                          fill={textSettings.color}
                                          fontFamily={textSettings.fontFamily}
                                          fontStyle={textSettings.fontWeight === 'bold' ? 'bold' : 'normal'}
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

                {/* Modern Bottom Panel - View Selector */}
                <div className="bg-white border-t border-gray-200 p-6">
                    <div className="max-w-4xl mx-auto">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 text-center">Design Areas</h3>
                        <div className="flex gap-4 justify-center">
                            {views.map((view) => (
                                <button
                                    key={view.id}
                                    onClick={() => setSelectedView(view.id)}
                                    className={`flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-200 ${
                                        selectedView === view.id
                                            ? 'bg-blue-50 border-2 border-blue-500 shadow-lg transform scale-105'
                                            : 'bg-white border-2 border-gray-200 hover:border-blue-300 hover:shadow-md hover:scale-102'
                                    }`}
                                >
                                    <div className={`w-20 h-20 rounded-xl flex items-center justify-center transition-colors ${
                                        selectedView === view.id ? 'bg-blue-100' : 'bg-gray-50'
                                    }`}>
                                        <div className={`w-14 h-14 rounded-lg transition-colors ${
                                            selectedView === view.id ? 'bg-white shadow-sm' : 'bg-white'
                                        }`} />
                                    </div>
                                    <span className={`text-sm font-medium transition-colors ${
                                        selectedView === view.id ? 'text-blue-700' : 'text-gray-700'
                                    }`}>{view.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        {/* Enhanced Preview Modal */}
        {previewOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={() => setPreviewOpen(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-[min(95vw,1200px)] max-h-[90vh] overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Enhanced Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Design Preview</h3>
                    <p className="text-sm text-gray-600">Your customized {product?.title || 'product'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* DPI Quality Indicator */}
                  {dpiInfo.dpi && (
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${dpiInfo.tone === 'good' ? 'bg-emerald-100 text-emerald-700' : dpiInfo.tone === 'fair' ? 'bg-amber-100 text-amber-700' : dpiInfo.tone === 'poor' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {dpiInfo.dpi} DPI - {dpiInfo.label}
                    </div>
                  )}
                  {/* Price Display */}
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Total Price</div>
                    <div className="text-xl font-bold text-gray-900">{priceString || '—'}</div>
                  </div>
                  {/* Close Button */}
                  <button
                    type="button"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Close preview"
                    onClick={() => setPreviewOpen(false)}
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Preview Content */}
              <div className="p-8 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                {previewUrl ? (
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="relative">
                      {/* Drop shadow container */}
                      <div className="absolute inset-0 translate-x-2 translate-y-2 bg-black/20 rounded-2xl blur-xl"></div>
                      {/* Preview image */}
                      <img 
                        src={previewUrl} 
                        alt="Design preview" 
                        className="relative bg-white rounded-2xl shadow-2xl max-w-full h-auto border-8 border-white"
                        style={{ maxHeight: '600px', objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">No preview available</p>
                      <p className="text-gray-500 text-sm mt-1">Add some design elements to see a preview</p>
                    </div>
                  </div>
                )}
                
                {/* Preview Notes */}
                {previewNote && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <p className="text-amber-800 text-sm">{previewNote}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Enhanced Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-white">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={previewLoading}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Refresh Preview
                  </button>
                  <div className="text-sm text-gray-500">
                    High-resolution preview ready for production
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Continue Editing
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (onFinalize) onFinalize() }}
                    disabled={!!submitting}
                    className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-semibold shadow-lg"
                  >
                    {submitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Adding to Cart...
                      </div>
                    ) : (
                      'Add to Cart'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </>
    );
}