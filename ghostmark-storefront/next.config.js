const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

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

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
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
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "konva$": "konva/lib/index",
      canvas: false,
    }
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
    ],
  },
}

module.exports = nextConfig
