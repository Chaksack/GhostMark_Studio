/**
 * Image DPI extraction utility
 * Extracts DPI/PPI information from image EXIF data and file metadata
 * Following Context7 patterns for reliable image processing
 */

export interface ImageMetadata {
  width: number
  height: number
  dpi?: number
  ppi?: number
  physicalWidth?: number  // in inches
  physicalHeight?: number // in inches
  colorDepth?: number
  format?: string
  fileSize?: number
  quality?: 'low' | 'medium' | 'high' | 'print-ready'
  warnings?: string[]
  recommendations?: string[]
  // Enhanced metadata for Gelato-style processing
  aspectRatio?: number
  isVector?: boolean
  compression?: string
  colorSpace?: string
  hasTransparency?: boolean
}

export interface DPIExtractionResult {
  metadata: ImageMetadata
  isHighQuality: boolean
  isPrintReady: boolean
  qualityScore: number // 0-100
  suggestedUse: 'web-only' | 'small-print' | 'medium-print' | 'large-print' | 'commercial-print'
}

/**
 * Extract DPI from image file using multiple methods
 */
export async function extractImageDPI(file: File): Promise<DPIExtractionResult> {
  const metadata: ImageMetadata = {
    width: 0,
    height: 0,
    fileSize: file.size,
    format: file.type,
    warnings: [],
    recommendations: []
  }

  try {
    // Method 1: Extract from EXIF data
    const exifDPI = await extractDPIFromEXIF(file)
    if (exifDPI) {
      metadata.dpi = exifDPI.dpi
      metadata.ppi = exifDPI.ppi
    }

    // Method 2: Load image to get dimensions
    const imageElement = await loadImageFromFile(file)
    metadata.width = imageElement.naturalWidth
    metadata.height = imageElement.naturalHeight

    // Method 3: Calculate DPI from canvas if available
    if (!metadata.dpi) {
      const canvasDPI = await extractDPIFromCanvas(imageElement)
      if (canvasDPI) {
        metadata.dpi = canvasDPI
        metadata.ppi = canvasDPI
      }
    }

    // Method 4: Estimate DPI based on file size and dimensions (fallback)
    if (!metadata.dpi) {
      const estimatedDPI = estimateDPIFromFileData(metadata.width, metadata.height, file.size, file.type)
      metadata.dpi = estimatedDPI
      metadata.ppi = estimatedDPI
      metadata.warnings?.push('DPI estimated from file characteristics - actual resolution may vary')
    }

    // Calculate physical dimensions
    if (metadata.dpi && metadata.dpi > 0) {
      metadata.physicalWidth = metadata.width / metadata.dpi
      metadata.physicalHeight = metadata.height / metadata.dpi
    }

    // Determine quality and suitability
    const qualityAnalysis = analyzeImageQuality(metadata)
    
    return {
      metadata,
      isHighQuality: qualityAnalysis.isHighQuality,
      isPrintReady: qualityAnalysis.isPrintReady,
      qualityScore: qualityAnalysis.qualityScore,
      suggestedUse: qualityAnalysis.suggestedUse
    }

  } catch (error) {
    console.warn('Error extracting image DPI:', error)
    
    // Fallback to basic analysis
    const imageElement = await loadImageFromFile(file).catch(() => null)
    if (imageElement) {
      metadata.width = imageElement.naturalWidth
      metadata.height = imageElement.naturalHeight
      metadata.dpi = 72 // Default web DPI
      metadata.ppi = 72
      metadata.warnings?.push('Could not extract DPI - using default 72 DPI')
    }

    return {
      metadata,
      isHighQuality: false,
      isPrintReady: false,
      qualityScore: 30,
      suggestedUse: 'web-only'
    }
  }
}

/**
 * Extract DPI from EXIF data
 */
async function extractDPIFromEXIF(file: File): Promise<{ dpi: number; ppi: number } | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const dataView = new DataView(arrayBuffer)

    // Check for JPEG EXIF data
    if (file.type === 'image/jpeg') {
      return extractJPEGEXIFDPI(dataView)
    }

    // Check for PNG metadata
    if (file.type === 'image/png') {
      return extractPNGDPI(dataView)
    }

    return null
  } catch (error) {
    console.warn('Error reading EXIF data:', error)
    return null
  }
}

/**
 * Extract DPI from JPEG EXIF data
 */
function extractJPEGEXIFDPI(dataView: DataView): { dpi: number; ppi: number } | null {
  try {
    // JPEG files start with 0xFFD8
    if (dataView.getUint16(0) !== 0xFFD8) return null

    let offset = 2
    while (offset < dataView.byteLength) {
      const marker = dataView.getUint16(offset)
      offset += 2

      // Look for APP1 marker (EXIF data)
      if (marker === 0xFFE1) {
        const length = dataView.getUint16(offset)
        offset += 2

        // Check for EXIF identifier
        const exifIdentifier = new Uint8Array(dataView.buffer, offset, 4)
        const exifString = String.fromCharCode(...exifIdentifier)
        if (exifString === 'Exif') {
          offset += 6 // Skip EXIF identifier and padding

          // Parse TIFF header
          const tiffHeader = dataView.getUint16(offset)
          const isLittleEndian = tiffHeader === 0x4949

          // Skip to IFD
          offset += 4
          const ifdOffset = dataView.getUint32(offset, isLittleEndian)
          offset += ifdOffset

          // Read IFD entries
          const entryCount = dataView.getUint16(offset, isLittleEndian)
          offset += 2

          for (let i = 0; i < entryCount; i++) {
            const tag = dataView.getUint16(offset, isLittleEndian)
            const type = dataView.getUint16(offset + 2, isLittleEndian)
            const count = dataView.getUint32(offset + 4, isLittleEndian)
            const value = dataView.getUint32(offset + 8, isLittleEndian)

            // Tag 282 = X Resolution, Tag 283 = Y Resolution
            if (tag === 282 || tag === 283) {
              if (type === 5) { // Rational type
                const numerator = dataView.getUint32(value, isLittleEndian)
                const denominator = dataView.getUint32(value + 4, isLittleEndian)
                const dpi = numerator / denominator
                return { dpi, ppi: dpi }
              }
            }

            offset += 12
          }
        }
        break
      } else {
        // Skip this segment
        const segmentLength = dataView.getUint16(offset)
        offset += segmentLength
      }
    }

    return null
  } catch (error) {
    console.warn('Error parsing JPEG EXIF:', error)
    return null
  }
}

/**
 * Extract DPI from PNG metadata
 */
function extractPNGDPI(dataView: DataView): { dpi: number; ppi: number } | null {
  try {
    // PNG files start with PNG signature
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    for (let i = 0; i < pngSignature.length; i++) {
      if (dataView.getUint8(i) !== pngSignature[i]) return null
    }

    let offset = 8

    while (offset < dataView.byteLength) {
      const chunkLength = dataView.getUint32(offset)
      const chunkType = String.fromCharCode(
        dataView.getUint8(offset + 4),
        dataView.getUint8(offset + 5),
        dataView.getUint8(offset + 6),
        dataView.getUint8(offset + 7)
      )

      if (chunkType === 'pHYs') {
        // Physical pixel dimensions chunk
        const pixelsPerUnitX = dataView.getUint32(offset + 8)
        const pixelsPerUnitY = dataView.getUint32(offset + 12)
        const unit = dataView.getUint8(offset + 16)

        if (unit === 1) { // Meters
          const dpiX = Math.round(pixelsPerUnitX * 0.0254) // Convert to inches
          const dpiY = Math.round(pixelsPerUnitY * 0.0254)
          const avgDPI = Math.round((dpiX + dpiY) / 2)
          return { dpi: avgDPI, ppi: avgDPI }
        }
      }

      offset += 8 + chunkLength + 4 // Skip chunk header, data, and CRC
    }

    return null
  } catch (error) {
    console.warn('Error parsing PNG metadata:', error)
    return null
  }
}

/**
 * Extract DPI from canvas context (HTML5 method)
 */
async function extractDPIFromCanvas(imageElement: HTMLImageElement): Promise<number | null> {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    canvas.width = 1
    canvas.height = 1
    ctx.drawImage(imageElement, 0, 0, 1, 1)

    // Try to get device pixel ratio for better DPI estimation
    const devicePixelRatio = window.devicePixelRatio || 1
    const backingStoreRatio = (ctx as any).webkitBackingStorePixelRatio ||
                             (ctx as any).mozBackingStorePixelRatio ||
                             (ctx as any).msBackingStorePixelRatio ||
                             (ctx as any).oBackingStorePixelRatio ||
                             (ctx as any).backingStorePixelRatio || 1

    const ratio = devicePixelRatio / backingStoreRatio
    
    // This is a rough estimation - actual DPI may vary
    return Math.round(72 * ratio)
  } catch (error) {
    console.warn('Error extracting DPI from canvas:', error)
    return null
  }
}

/**
 * Estimate DPI based on file characteristics
 */
function estimateDPIFromFileData(width: number, height: number, fileSize: number, fileType: string): number {
  const totalPixels = width * height
  const bytesPerPixel = fileSize / totalPixels

  // Rough estimation based on common patterns
  if (bytesPerPixel > 3) {
    // High quality image, likely high DPI
    return 300
  } else if (bytesPerPixel > 1.5) {
    // Medium quality
    return 150
  } else if (bytesPerPixel > 0.5) {
    // Standard quality
    return 96
  } else {
    // Low quality or heavily compressed
    return 72
  }
}

/**
 * Load image from file as HTMLImageElement
 */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Analyze image quality and provide recommendations (Enhanced for POD/Gelato-style requirements)
 */
function analyzeImageQuality(metadata: ImageMetadata): {
  isHighQuality: boolean
  isPrintReady: boolean
  qualityScore: number
  suggestedUse: 'web-only' | 'small-print' | 'medium-print' | 'large-print' | 'commercial-print'
} {
  const { width, height, dpi = 72, fileSize = 0, format, isVector } = metadata
  const totalPixels = width * height
  
  let qualityScore = 0
  let isHighQuality = false
  let isPrintReady = false
  let suggestedUse: 'web-only' | 'small-print' | 'medium-print' | 'large-print' | 'commercial-print' = 'web-only'
  
  // Vector files get special treatment (similar to Gelato's SVG handling)
  if (isVector || format?.toLowerCase().includes('svg')) {
    qualityScore = 95
    isHighQuality = true
    isPrintReady = true
    suggestedUse = 'commercial-print'
    return { isHighQuality, isPrintReady, qualityScore, suggestedUse }
  }

  // DPI scoring
  if (dpi >= 300) {
    qualityScore += 40
    isPrintReady = true
  } else if (dpi >= 150) {
    qualityScore += 30
  } else if (dpi >= 96) {
    qualityScore += 20
  } else {
    qualityScore += 10
  }

  // Resolution scoring
  if (totalPixels >= 16000000) { // 16MP+
    qualityScore += 30
    isHighQuality = true
  } else if (totalPixels >= 8000000) { // 8MP+
    qualityScore += 25
  } else if (totalPixels >= 2000000) { // 2MP+
    qualityScore += 20
  } else if (totalPixels >= 1000000) { // 1MP+
    qualityScore += 15
  } else {
    qualityScore += 5
  }

  // File size scoring (indicates compression/quality)
  const bytesPerPixel = fileSize / totalPixels
  if (bytesPerPixel >= 3) {
    qualityScore += 20
  } else if (bytesPerPixel >= 1.5) {
    qualityScore += 15
  } else if (bytesPerPixel >= 0.5) {
    qualityScore += 10
  } else {
    qualityScore += 5
  }

  // Format-specific scoring (aligned with Gelato's file type preferences)
  const formatLower = format?.toLowerCase() || ''
  if (formatLower.includes('pdf')) {
    qualityScore += 15 // PDF is excellent for print
    isPrintReady = true
  } else if (formatLower.includes('png')) {
    qualityScore += 10 // PNG is good for print
  } else if (formatLower.includes('jpeg') || formatLower.includes('jpg')) {
    qualityScore += 5 // JPEG can be good but depends on compression
  } else if (formatLower.includes('webp') || formatLower.includes('gif')) {
    qualityScore -= 10 // These formats may have print issues
    metadata.warnings?.push('Format may not be optimal for print production')
  }

  // Aspect ratio bonus (standard print ratios)
  const aspectRatio = width / height
  const commonRatios = [1, 4/3, 3/2, 16/9, 5/4]
  const isStandardRatio = commonRatios.some(ratio => Math.abs(aspectRatio - ratio) < 0.1)
  if (isStandardRatio) {
    qualityScore += 10
  }

  // Determine suggested use
  if (qualityScore >= 90 && dpi >= 300) {
    suggestedUse = 'commercial-print'
  } else if (qualityScore >= 75 && dpi >= 200) {
    suggestedUse = 'large-print'
  } else if (qualityScore >= 60 && dpi >= 150) {
    suggestedUse = 'medium-print'
  } else if (qualityScore >= 40 && dpi >= 96) {
    suggestedUse = 'small-print'
  }

  // Add recommendations
  if (dpi < 150) {
    metadata.recommendations?.push('For best print quality, use images with 150+ DPI')
  }
  if (totalPixels < 2000000) {
    metadata.recommendations?.push('Higher resolution images will produce sharper prints')
  }
  if (bytesPerPixel < 0.5) {
    metadata.recommendations?.push('Image appears heavily compressed - quality may be reduced')
  }

  return {
    isHighQuality: qualityScore >= 70,
    isPrintReady: isPrintReady && qualityScore >= 60,
    qualityScore: Math.min(100, qualityScore),
    suggestedUse
  }
}