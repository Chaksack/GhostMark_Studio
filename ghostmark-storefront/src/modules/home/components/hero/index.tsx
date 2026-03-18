import { Button, Heading } from "@medusajs/ui"
import React from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type HeroProps = Readonly<{
  title?: string
  subtitle?: string
  description?: string
  primaryCtaLabel?: string
  secondaryCtaLabel?: string
  imageUrl?: string
  imageCaptionTitle?: string
  imageCaptionSubtitle?: string
  imagePagerCount?: number
  imagePagerActiveIndex?: number
}>

const Hero = ({
  title,
  subtitle,
  description,
  primaryCtaLabel,
  secondaryCtaLabel,
  imageUrl,
  imageCaptionTitle,
  imageCaptionSubtitle,
  imagePagerCount,
  imagePagerActiveIndex,
}: HeroProps) => {
  const defaultTitle = (
    <>
      <span className="block">Good merch,</span>
      <span className="block">for good brands.</span>
    </>
  )

  const pagerCount = Math.max(0, imagePagerCount ?? 5)
  const pagerActive = Math.max(0, Math.min(pagerCount - 1, imagePagerActiveIndex ?? 0))

  return (
    <section className="content-container py-10 small:py-14">
      <div className="grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-none">
        <div className="bg-mono-50 px-6 py-10 small:px-10 small:py-14 lg:px-14 lg:py-16 flex flex-col justify-between min-h-[420px]">
          <div className="space-y-6">
            <Heading level="h1" className="text-5xl small:text-6xl leading-[1.02] tracking-tight text-mono-1000">
              {title ? <span className="block whitespace-pre-line">{title}</span> : defaultTitle}
            </Heading>

            {(subtitle || description) && (
              <div className="space-y-2 max-w-xl">
                {subtitle && <p className="text-mono-800 text-base small:text-lg">{subtitle}</p>}
                {description && <p className="text-mono-700">{description}</p>}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <LocalizedClientLink href="/products">
                <Button
                  size="large"
                  className="bg-mono-1000 text-mono-0 border border-mono-1000 hover:bg-mono-900"
                >
                  {primaryCtaLabel || "Shop all products"}
                </Button>
              </LocalizedClientLink>
              <LocalizedClientLink href="/support">
                <Button
                  size="large"
                  variant="secondary"
                  className="bg-mono-0 text-mono-1000 border border-mono-200 hover:bg-mono-50"
                >
                  {secondaryCtaLabel || "Talk to our team"}
                </Button>
              </LocalizedClientLink>
            </div>
          </div>

          <div className="pt-10">
            <div className="flex items-center gap-3 text-mono-700">
              <div className="h-10 w-10 rounded-full border border-mono-900 flex items-center justify-center text-mono-900 font-semibold">
                B
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold uppercase tracking-wide text-mono-900">
                  Certified
                </div>
                <div className="text-xs">B Corporation</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative min-h-[420px]">
          <img
            src={imageUrl || "/hero1.webp"}
            alt="Featured"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-x-0 bottom-0 p-6 small:p-8">
            <div className="flex items-end justify-between gap-6">
              <div className="text-mono-0 drop-shadow-sm">
                <div className="text-base small:text-lg font-medium">
                  {imageCaptionTitle || "Featured kit"}
                </div>
                <div className="text-sm text-mono-0/90">
                  {imageCaptionSubtitle || "GhostMark"}
                </div>
              </div>

              {pagerCount > 0 && (
                <div className="flex items-center gap-2" aria-hidden="true">
                  {Array.from({ length: pagerCount }).map((_, idx) => (
                    <span
                      key={idx}
                      className={
                        idx === pagerActive
                          ? "h-2 w-2 rounded-full bg-mono-0"
                          : "h-2 w-2 rounded-full bg-mono-0/40"
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
