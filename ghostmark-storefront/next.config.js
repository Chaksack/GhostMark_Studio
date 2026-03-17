const path = require("node:path")

const checkEnvVariables = require("./check-env-variables")
const { PHASE_PRODUCTION_BUILD } = require("next/constants")

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME
// Allow loading images from Strapi if configured
const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL
let STRAPI_HOSTNAME
let STRAPI_PROTOCOL
try {
  if (STRAPI_URL) {
    const u = new URL(STRAPI_URL)
    STRAPI_HOSTNAME = u.hostname
    STRAPI_PROTOCOL = u.protocol.replace(':', '')
  }
} catch {}

// Allow loading images from Medusa backend if images are served from the API domain (e.g., /uploads/*)
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
let MEDUSA_HOSTNAME
let MEDUSA_PROTOCOL
try {
  if (MEDUSA_BACKEND_URL) {
    const u = new URL(MEDUSA_BACKEND_URL)
    MEDUSA_HOSTNAME = u.hostname
    MEDUSA_PROTOCOL = u.protocol.replace(':', '')
  }
} catch {}

// Optional: comma-separated list of additional image hostnames or full URLs to allow in <Image>
// Example: NEXT_PUBLIC_IMAGE_HOSTNAMES="cdn.myshop.com,images.example.com,https://files.other.com"
const ADDITIONAL_IMAGE_HOSTS = (process.env.NEXT_PUBLIC_IMAGE_HOSTNAMES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    try {
      // If a full URL is provided, parse it; otherwise, treat as hostname and default protocol to https
      if (/^https?:\/\//i.test(entry)) {
        const u = new URL(entry)
        return { protocol: u.protocol.replace(':', ''), hostname: u.hostname }
      }
      return { protocol: 'https', hostname: entry }
    } catch {
      return null
    }
  })
  .filter(Boolean)

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  webpack: (config) => {
    // react-konva -> konva has a Node entry that requires the native `canvas` package.
    // During Next.js server/RSC compilation, webpack may resolve that Node entry and fail.
    // Force Konva to use the browser build and stub `canvas` to keep builds portable.
    config.resolve = config.resolve || {}
    config.resolve.alias = config.resolve.alias || {}
    config.resolve.alias["konva$"] = "konva/lib/index"
    config.resolve.alias.canvas = false
    return config
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
      ...(STRAPI_HOSTNAME
        ? [
            {
              protocol: STRAPI_PROTOCOL || "http",
              hostname: STRAPI_HOSTNAME,
            },
          ]
        : []),
      ...(MEDUSA_HOSTNAME
        ? [
            {
              protocol: MEDUSA_PROTOCOL || "http",
              hostname: MEDUSA_HOSTNAME,
            },
          ]
        : []),
      ...ADDITIONAL_IMAGE_HOSTS,
    ],
  },
}

module.exports = function nextConfigFactory(phase) {
  const requireEnvAtBuild = process.env.REQUIRE_ENV_AT_BUILD === "1"
  const skipEnvValidation = process.env.SKIP_ENV_VALIDATION === "1"

  if (!skipEnvValidation) {
    const shouldValidate = phase !== PHASE_PRODUCTION_BUILD || requireEnvAtBuild
    if (shouldValidate) {
      checkEnvVariables()
    }
  }

  return nextConfig
}
