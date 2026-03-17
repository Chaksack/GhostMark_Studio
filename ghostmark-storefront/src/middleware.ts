import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

// NOTE: In middleware (Edge), missing env vars can cause hard 500s for all routes.
// We therefore treat configuration problems as a degraded mode and avoid throwing.
// Support both names to reduce deployment footguns.
const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  // If config is missing, we can't fetch regions. Return the existing cache (possibly empty)
  // and let the caller fall back to DEFAULT_REGION.
  if (!BACKEND_URL || !PUBLISHABLE_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Middleware.ts: Missing MEDUSA_BACKEND_URL (or NEXT_PUBLIC_MEDUSA_BACKEND_URL) and/or NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY. Skipping region fetch and falling back to DEFAULT_REGION."
      )
    }
    return regionMap
  }

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    // Fetch regions from Medusa. We can't use the JS client here because middleware is running on Edge and the client needs a Node environment.
    let response: Response
    try {
      response = await fetch(`${BACKEND_URL}/store/regions`, {
        headers: {
          "x-publishable-api-key": PUBLISHABLE_API_KEY || "",
        },
        next: {
          revalidate: 3600,
          tags: [`regions-${cacheId}`],
        },
        cache: "force-cache",
      })
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "Middleware.ts: Failed to fetch /store/regions from backend. Falling back to DEFAULT_REGION.",
          e
        )
      }
      return regionMap
    }

    // Safely parse JSON only when the response is JSON. Avoids "Unexpected token '<'" when HTML is returned.
    const contentType = response.headers.get("content-type") || ""
    let data: any = undefined

    if (contentType.includes("application/json")) {
      try {
        data = await response.json()
      } catch (e) {
        // fall through – we'll handle below
      }
    } else {
      // Non-JSON response (often an HTML error page). Read a small preview for diagnostics.
      const text = await response.text().catch(() => "")
      const preview = text?.slice(0, 200) || ""
      if (process.env.NODE_ENV === "development") {
        console.error(
          `Middleware.ts: Non-JSON response from /store/regions (${response.status} ${response.statusText}). Preview: ${preview}`
        )
      }
      return regionMap
    }

    if (!response.ok) {
      if (process.env.NODE_ENV === "development") {
        const message =
          data?.message || data?.error || JSON.stringify(data || {}) ||
          `${response.status} ${response.statusText}`
        console.error(`Middleware.ts: Failed to fetch regions. ${message}`)
      }
      return regionMap
    }

    const { regions } = (data || {}) as { regions?: HttpTypes.StoreRegion[] }

    if (!regions?.length) {
      return regionMap
    }

    // Create a map of country codes to regions.
    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => {
        regionMapCache.regionMap.set(c.iso_2 ?? "", region)
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Middleware.ts: Error getting the country code. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
      )
    }
  }
}

/**
 * Middleware to handle region selection and onboarding status.
 */
export async function middleware(request: NextRequest) {
  let redirectUrl = request.nextUrl.href

  let response = NextResponse.redirect(redirectUrl, 307)

  let cacheIdCookie = request.cookies.get("_medusa_cache_id")

  let cacheId = cacheIdCookie?.value || crypto.randomUUID()

  const regionMap = await getRegionMap(cacheId)

  // If we couldn't build a region map (missing env vars, backend unavailable, etc.),
  // avoid 500s and fall back to the default country code.
  const countryCode =
    (regionMap?.size ? await getCountryCode(request, regionMap) : undefined) ||
    DEFAULT_REGION

  const urlHasCountryCode =
    countryCode && request.nextUrl.pathname.split("/")[1].includes(countryCode)

  // if one of the country codes is in the url and the cache id is set, return next
  if (urlHasCountryCode && cacheIdCookie) {
    return NextResponse.next()
  }

  // if one of the country codes is in the url and the cache id is not set, set the cache id and redirect
  if (urlHasCountryCode && !cacheIdCookie) {
    response.cookies.set("_medusa_cache_id", cacheId, {
      maxAge: 60 * 60 * 24,
    })

    return response
  }

  // check if the url is a static asset
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname

  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  // If no country code is set, we redirect to the relevant region.
  if (!urlHasCountryCode && countryCode) {
    redirectUrl = `${request.nextUrl.origin}/${countryCode}${redirectPath}${queryString}`
    response = NextResponse.redirect(`${redirectUrl}`, 307)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
