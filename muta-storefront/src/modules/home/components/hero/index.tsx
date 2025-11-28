import { Button, Heading } from "@medusajs/ui"
import { Star } from "lucide-react"
import React from "react"


const Hero = () => {
  return (
    <div className="h-[75vh] max-w-7xl mx-auto relative ">
      <div className="absolute inset-0 z-10 grid lg:grid-cols-2 items-center px-6 md:px-10">
        {/* Left column */}
        <div className="flex flex-col items-start gap-6 max-w-2xl">
          <Heading
            level="h1"
            className="text-4xl sm:text-5xl lg:text-6xl leading-tight tracking-tight"
          >
            <span className="block">Grow your print on</span>
            <span className="block">demand business</span>
            <span className="block">with Gelato</span>
          </Heading>

          <div className="space-y-3 text-left">
            <p className="text-ui-fg-subtle text-xl">Peak season is here</p>
            <p className="text-ui-fg-subtle">
              Let&apos;s make this your most profitable quarter yet with the world&apos;s
              largest <a className="underline hover:text-ui-fg-base">print on demand</a> network
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button size="large">Create for free</Button>
            <Button size="large" variant="secondary">
              See our products
            </Button>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="text-2xl font-semibold">shopify</div>
            <div className="flex items-center gap-1 text-green-600">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current" />
              ))}
            </div>
            <span className="text-ui-fg-subtle">4.8 / 5</span>
            <span className="text-ui-fg-muted text-sm">based on 611 reviews</span>
          </div>
        </div>

        {/* Right column visual */}
        <div className="relative hidden lg:block h-full">
          <div className="absolute right-6 top-8 w-[55%] h-[75%] rounded-3xl bg-gradient-to-b from-rose-300 to-rose-500 opacity-80" />
          <div className="absolute left-0 bottom-6 w-[80%] h-[85%] rounded-3xl bg-gradient-to-b from-violet-200 to-sky-300 shadow-xl" />
          {/* Foreground mock card to give depth */}
          <div className="absolute left-8 bottom-10 right-16 top-14 rounded-3xl border border-ui-border-base bg-ui-bg-base/60 backdrop-blur-sm shadow-2xl" />
        </div>
      </div>
    </div>
  )
}

export default Hero
