"use client"

import { HttpTypes } from "@medusajs/types"
import { Container } from "@medusajs/ui"
import Image from "next/image"
import React, { useMemo, useState } from "react"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  const validImages = useMemo(() => images?.filter((i) => !!i.url) ?? [], [images])
  const [active, setActive] = useState(0)

  const current = validImages[active] ?? validImages[0]

  if (!validImages.length) {
    return null
  }

  return (
    <div className="relative">
      {/* Desktop: vertical thumbs on the left, main image on the right */}
      <div className="hidden md:grid grid-cols-[80px_1fr] gap-4">
        {/* Thumbnails column */}
        <div className="flex md:flex-col gap-3 overflow-auto md:max-h-[70vh] pr-1">
          {validImages.map((img, idx) => (
            <button
              key={img.id || idx}
              type="button"
              onClick={() => setActive(idx)}
              aria-label={`Show image ${idx + 1}`}
              aria-current={active === idx}
              className={`relative h-20 w-20 flex-shrink-0 rounded-md border transition-colors ${
                active === idx
                  ? "border-ui-fg-base"
                  : "border-ui-border-base hover:border-ui-fg-muted"
              }`}
            >
              <Image
                src={img.url!}
                alt={`Thumbnail ${idx + 1}`}
                fill
                sizes="80px"
                className="object-cover rounded-md"
              />
            </button>
          ))}
        </div>

        {/* Main image */}
        <Container className="relative aspect-[29/34] w-full overflow-hidden bg-ui-bg-subtle">
          <Image
            key={current.id || active}
            src={current.url!}
            priority
            className="absolute inset-0 rounded-rounded"
            alt={`Product image ${active + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            style={{ objectFit: "cover" }}
          />
        </Container>
      </div>

      {/* Mobile: main image first, horizontal thumbs below */}
      <div className="md:hidden flex flex-col gap-3">
        <Container className="relative aspect-[29/34] w-full overflow-hidden bg-ui-bg-subtle">
          <Image
            key={current.id || active}
            src={current.url!}
            priority
            className="absolute inset-0 rounded-rounded"
            alt={`Product image ${active + 1}`}
            fill
            sizes="(max-width: 576px) 100vw, 360px"
            style={{ objectFit: "cover" }}
          />
        </Container>

        {validImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pt-1">
            {validImages.map((img, idx) => (
              <button
                key={img.id || idx}
                type="button"
                onClick={() => setActive(idx)}
                aria-label={`Show image ${idx + 1}`}
                aria-current={active === idx}
                className={`relative h-16 w-16 flex-shrink-0 rounded-md border transition-colors ${
                  active === idx
                    ? "border-ui-fg-base"
                    : "border-ui-border-base hover:border-ui-fg-muted"
                }`}
              >
                <Image
                  src={img.url!}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover rounded-md"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ImageGallery
