// Shared unit conversion utilities for POD
// Stores admin-defined print areas in centimeters, converts at render/export time

export const DEFAULT_DPI = 300

/**
 * Convert centimeters to pixels using specified DPI (dots per inch)
 * 1 inch = 2.54 cm
 */
export function cmToPx(cm: number, dpi: number = DEFAULT_DPI): number {
  if (!Number.isFinite(cm) || !Number.isFinite(dpi) || dpi <= 0) return 0
  return (cm / 2.54) * dpi
}

/**
 * Convert pixels to centimeters using specified DPI (dots per inch)
 */
export function pxToCm(px: number, dpi: number = DEFAULT_DPI): number {
  if (!Number.isFinite(px) || !Number.isFinite(dpi) || dpi <= 0) return 0
  return (px / dpi) * 2.54
}

export type SideKey = 'front' | 'back' | 'left_sleeve' | 'right_sleeve'
