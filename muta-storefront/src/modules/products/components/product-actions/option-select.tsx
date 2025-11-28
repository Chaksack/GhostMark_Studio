import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
}) => {
  const filteredOptions = (option.values ?? []).map((v) => v.value)
  const isColorOption = /(^|\s)color(\s|$)/i.test(title || "")
  const isSizeOption = /(^|\s)size(\s|$)/i.test(title || "")
  const isTechnologyOption = /(^|\s)technology(\s|$)/i.test(title || "")

  const NAME_TO_HEX: Record<string, string> = {
    black: "#000000",
    white: "#FFFFFF",
    gray: "#808080",
    grey: "#808080",
    silver: "#C0C0C0",
    red: "#FF0000",
    maroon: "#800000",
    orange: "#FFA500",
    amber: "#FFBF00",
    yellow: "#FFFF00",
    gold: "#FFD700",
    lime: "#00FF00",
    green: "#008000",
    teal: "#008080",
    cyan: "#00FFFF",
    aqua: "#00FFFF",
    blue: "#0000FF",
    navy: "#000080",
    indigo: "#4B0082",
    violet: "#8F00FF",
    purple: "#800080",
    magenta: "#FF00FF",
    pink: "#FFC0CB",
    brown: "#8B4513",
    beige: "#F5F5DC",
    tan: "#D2B48C",
    khaki: "#F0E68C",
    olive: "#808000",
    coral: "#FF7F50",
    salmon: "#FA8072",
  }

  const resolveColor = (val: string): string | undefined => {
    if (!val) return undefined
    const v = String(val).trim()
    // If value is a HEX or CSS color function, allow directly
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(v)) return v
    // Try name lookup
    const hex = NAME_TO_HEX[v.toLowerCase()]
    if (hex) return hex
    // Some values might include the hex in metadata-like form e.g. "Blue (#0000FF)"
    const match = v.match(/#([0-9a-f]{3}|[0-9a-f]{6})/i)
    if (match) return `#${match[1]}`
    return undefined
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Select {title}</span>
        {/(^|\s)size(\s|$)/i.test(title || "") && (
          <a
            href="#"
            className="text-xs text-ui-fg-muted hover:text-ui-fg-subtle underline"
            onClick={(e) => e.preventDefault()}
          >
            Size guide
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-2" data-testid={dataTestId}>
        {filteredOptions.map((v) => {
          const color = isColorOption ? resolveColor(v) : undefined
          const isSelected = v === current
          if (isColorOption && color) {
            const isLight = (() => {
              // simple luminance check for hex colors to decide border
              try {
                const hex = color.startsWith("#") ? color.substring(1) : undefined
                if (hex && (hex.length === 3 || hex.length === 6)) {
                  const h = hex.length === 3
                    ? hex.split("").map((c) => c + c).join("")
                    : hex
                  const r = parseInt(h.substring(0, 2), 16)
                  const g = parseInt(h.substring(2, 4), 16)
                  const b = parseInt(h.substring(4, 6), 16)
                  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
                  return luminance > 0.75 // very light
                }
              } catch {}
              return false
            })()

            return (
              <button
                onClick={() => updateOption(option.id, v)}
                key={v}
                className={clx(
                  "relative inline-flex items-center justify-center rounded-lg border h-10 w-10",
                  isSelected ? "border-ui-border-interactive" : "border-ui-border-base",
                  disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-elevation-card-rest transition-shadow ease-in-out duration-150"
                )}
                aria-label={v}
                title={v}
                disabled={disabled}
                data-testid="option-button"
              >
                <span
                  aria-hidden
                  className={clx(
                    "h-8 w-8 rounded-lg",
                    isLight ? "ring-1 ring-gray-200" : ""
                  )}
                  style={{ backgroundColor: color }}
                />
                <span className="sr-only">{v}</span>
              </button>
            )
          }

          // Helper: compact label for size options
          const compactSizeLabel = (() => {
            const raw = String(v || "").trim()
            if (!raw) return raw
            // Common full-word mappings
            if (/^extra\s*small$/i.test(raw) || /^x[-\s]*small$/i.test(raw)) return "XS"
            if (/^small$/i.test(raw)) return "S"
            if (/^medium$/i.test(raw)) return "M"
            if (/^large$/i.test(raw)) return "L"
            if (/^extra\s*large$/i.test(raw) || /^x[-\s]*large$/i.test(raw)) return "XL"
            if (/^extra\s*extra\s*large$/i.test(raw) || /^xxl$/i.test(raw)) return "XXL"
            // If it already looks like a code (e.g., S, M, L, XL, 2XL), keep it
            if (/^(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl)$/i.test(raw)) return raw.toUpperCase()
            // Otherwise, use the first letter/char
            return raw.charAt(0).toUpperCase()
          })()

          // Default text option button
          return (
            <button
              onClick={() => updateOption(option.id, v)}
              key={v}
              className={clx(
                isSizeOption
                  ? // Compact square buttons for size options
                    "border-ui-border-base bg-ui-bg-subtle border h-8 w-8 rounded-md p-0 inline-flex items-center justify-center text-xs font-medium"
                  : isTechnologyOption
                  ? // Auto-width, single-line tech buttons so text fits without wrapping/moving down
                    "border-ui-border-base bg-ui-bg-subtle border rounded-md px-3 py-2 h-10 inline-flex items-center justify-center text-sm whitespace-nowrap"
                  : // Default button for other text options
                    "border-ui-border-base bg-ui-bg-subtle border text-small-regular h-10 rounded-rounded p-2 flex-1 ",
                {
                  "bg-black text-white border-ui-border-interactive": isSelected,
                  "hover:shadow-elevation-card-rest transition-shadow ease-in-out duration-150": !isSelected,
                }
              )}
              disabled={disabled}
              data-testid="option-button"
              aria-label={v}
              title={v}
            >
              {isSizeOption ? compactSizeLabel : v}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OptionSelect
