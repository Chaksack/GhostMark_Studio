import { Button, Heading } from "@medusajs/ui"
import { Star } from "lucide-react"
import React from "react"


const Section = () => {
    return (
        <div className="h-[30vh] max-w-7xl mx-auto relative ">
            <div className="absolute inset-0 z-10 grid lg:grid-cols-2 gap-8 items-center px-6 md:px-10">
                {/* Left column */}
                <div className="flex flex-col gap-6 items-start">
                    <div>
                        <p className="text-ui-fg-subtle text-sm">Limited time offer</p>

                        <Heading
                            level="h2"
                            className="text-2xl sm:text-4xl lg:text-4xl leading-tight tracking-tight"
                        >
                            <span className="block">Grow your print on</span>
                        </Heading>
                    </div>
                    <div className="space-y-3 text-left">
                        <p className="text-ui-fg-subtle text-xl">Peak season is here</p>
                        <p className="text-ui-fg-subtle">
                            Let&apos;s make this your most profitable quarter yet with the world&apos;s
                            largest <a className="underline hover:text-ui-fg-base">print on demand</a> network
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button size="large">
                            See our products
                        </Button>
                    </div>
                </div>


                {/* Right column visual */}
                <div className="relative hidden gap-6 mr-2 lg:block w-full h-full">
                    <img
                        src="/image2.webp"
                        alt="Hero"
                        className="absolute inset-0 h-full w-full object-cover rounded-3xl"
                    />
                </div>
            </div>
        </div>
    )
}

export default Section
