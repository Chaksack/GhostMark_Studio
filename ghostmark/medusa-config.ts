import crypto from 'node:crypto'
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

/* ------------------------------------------------------------------------ *
 * Boot-time configuration guards
 *
 * Medusa's own starter template ships `jwtSecret: process.env.JWT_SECRET ||
 * "supersecret"`. That fallback is not a safe default: "supersecret" is a
 * dictionary entry in every off-the-shelf JWT cracking wordlist, so anyone who
 * knows the deployment uses it can mint an HS256 token with
 * `actor_type: "user"` and own the entire Admin API.
 *
 * We therefore refuse to start with a guessable signing key rather than
 * quietly substituting one.
 * ------------------------------------------------------------------------ */

const IS_PRODUCTION = (process.env.NODE_ENV || "development") === "production"

/** Minimum length for a hand-set secret. 32 chars ~= 24 bytes of entropy. */
const MIN_SECRET_LENGTH = 32

/**
 * Secrets that are refused even when explicitly configured. These are the
 * values that appear in framework templates, tutorials and cracking wordlists.
 * Compared case-insensitively.
 */
const REJECTED_SECRETS: ReadonlySet<string> = new Set([
  "supersecret",
  "super_secret",
  "super-secret",
  "secret",
  "mysecret",
  "changeme",
  "change_me",
  "change-me",
  "medusa",
  "medusa-secret",
  "medusa_secret",
  "test",
  "dev",
  "development",
  "password",
  "some_secret",
  "your-secret-here",
  "dev-insecure-review-token-secret",
])

const GENERATE_SECRET_CMD =
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

/**
 * Resolve a signing secret, failing loudly instead of falling back to a
 * hardcoded constant.
 *
 * - production: a missing, well-known or too-short value throws at boot.
 * - development: an ephemeral random value is generated and loudly announced.
 *   Sessions signed with it do not survive a restart, which is the intended
 *   nudge to set a real value in `.env`.
 *
 * The secret itself is never logged.
 */
function resolveSigningSecret(name: string): string {
  const value = (process.env[name] ?? "").trim()

  let weakness: string | null = null
  if (!value) {
    weakness = "it is not set"
  } else if (REJECTED_SECRETS.has(value.toLowerCase())) {
    weakness =
      "it is set to a well-known placeholder that ships in public JWT brute-force wordlists"
  } else if (value.length < MIN_SECRET_LENGTH) {
    weakness = `it is shorter than the ${MIN_SECRET_LENGTH}-character minimum`
  }

  if (!weakness) {
    return value
  }

  if (IS_PRODUCTION) {
    throw new Error(
      [
        "",
        "==============================================================================",
        ` FATAL: ${name} cannot be used because ${weakness}.`,
        "==============================================================================",
        "",
        ` ${name} signs authentication tokens. A guessable value lets anyone forge an`,
        " admin session, so the server refuses to boot in production without a strong",
        " one. There is deliberately no override flag.",
        "",
        " Generate a replacement with:",
        `   ${GENERATE_SECRET_CMD}`,
        "",
        ` then set ${name} in the deployment environment.`,
        " Rotating it invalidates every existing session; that is expected.",
        "==============================================================================",
        "",
      ].join("\n")
    )
  }

  const ephemeral = crypto.randomBytes(32).toString("base64url")
  console.warn(
    [
      "",
      "------------------------------------------------------------------------------",
      ` WARNING: ${name} cannot be used because ${weakness}.`,
      "",
      " A random ephemeral value has been generated for this process only. Every",
      " restart invalidates all sessions signed with it, and this WILL throw instead",
      " of falling back once NODE_ENV=production.",
      "",
      " Generate a persistent value with:",
      `   ${GENERATE_SECRET_CMD}`,
      ` then set ${name} in ghostmark/.env`,
      "------------------------------------------------------------------------------",
      "",
    ].join("\n")
  )
  return ephemeral
}

const JWT_SECRET = resolveSigningSecret("JWT_SECRET")
const COOKIE_SECRET = resolveSigningSecret("COOKIE_SECRET")

/* ------------------------------------------------------------------------ *
 * File storage (S3)
 *
 * Without the S3 file module Medusa falls back to the local-disk file
 * provider. On an ephemeral filesystem (Fargate, Heroku, any rebuilt
 * container) that means uploaded customer artwork is destroyed on every
 * deploy. Silence is the wrong failure mode, so say so at boot.
 * ------------------------------------------------------------------------ */

const S3_REQUIRED_ENV_VARS = [
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET",
  "S3_REGION",
  "S3_FILE_URL",
] as const

const MISSING_S3_ENV_VARS = S3_REQUIRED_ENV_VARS.filter(
  (key) => !(process.env[key] ?? "").trim()
)

// Register the S3 provider only when it is fully configured. Registering it
// with, say, a missing bucket would defer the failure to the first upload.
const S3_FILE_MODULE_ENABLED = MISSING_S3_ENV_VARS.length === 0

if (!S3_FILE_MODULE_ENABLED) {
  console.warn(
    [
      "",
      "------------------------------------------------------------------------------",
      IS_PRODUCTION
        ? " CRITICAL: the S3 file module is NOT registered in production."
        : " WARNING: the S3 file module is not registered.",
      "",
      " Uploads (including customer design artwork) will be written to ephemeral",
      " local disk and LOST on restart, redeploy or container replacement. There is",
      " no recovery path once the container is gone.",
      "",
      ` Missing: ${MISSING_S3_ENV_VARS.join(", ")}`,
      ` Required: ${S3_REQUIRED_ENV_VARS.join(", ")}`,
      " See ghostmark/.env.template for descriptions.",
      "------------------------------------------------------------------------------",
      "",
    ].join("\n")
  )
}

/* ------------------------------------------------------------------------ *
 * Redis cache
 *
 * The cache module reads CACHE_REDIS_URL. `.env`/`.env.template` historically
 * only defined REDIS_URL, which nothing read - so Redis looked configured
 * while the in-memory cache was silently in use. Accept both names, preferring
 * the canonical one, and say which one won.
 * ------------------------------------------------------------------------ */

const CACHE_REDIS_URL = (
  process.env.CACHE_REDIS_URL ||
  process.env.REDIS_URL ||
  ""
).trim()

if (CACHE_REDIS_URL) {
  console.log(
    `[ghostmark] Redis cache enabled via ${
      (process.env.CACHE_REDIS_URL ?? "").trim() ? "CACHE_REDIS_URL" : "REDIS_URL (deprecated alias - rename to CACHE_REDIS_URL)"
    }`
  )
} else if (IS_PRODUCTION) {
  console.warn(
    "[ghostmark] WARNING: CACHE_REDIS_URL is not set. Falling back to the in-memory cache, " +
      "which is not shared between instances and is discarded on restart."
  )
}


module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:8000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:7001",
      authCors: process.env.AUTH_CORS || process.env.STORE_CORS || "http://localhost:8000",
      jwtSecret: JWT_SECRET,
      cookieSecret: COOKIE_SECRET,
    },
    // Enhanced features (commented out: current framework types may not include `features` in ProjectConfigOptions)
    // features: {
    //   product_categories: true,
    //   product_variants: true,
    //   product_tags: true,
    //   tax_inclusive_pricing: process.env.TAX_INCLUSIVE_PRICING === "true" || false,
    // },
    // Session configuration for enhanced cart management
    sessionOptions: {
      ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
    }
  },
  modules: [
    // Auth module with enhanced provider options
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/auth-emailpass",
            id: "emailpass",
            options: {
              hashRounds: 12,
              allowEmailLogin: true,
              allowRegistration: true,
            },
          },
          {
            resolve: "@medusajs/auth-google",
            id: "google",
            options: {
              clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
              clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
              callbackUrl: process.env.AUTH_GOOGLE_CALLBACK_URL,
              authPath: process.env.AUTH_GOOGLE_AUTH_PATH,
              successRedirectUrl: process.env.AUTH_GOOGLE_SUCCESS_REDIRECT_URL,
              failureRedirectUrl: process.env.AUTH_GOOGLE_FAILURE_REDIRECT_URL,
              // Enhanced scopes for corporate customers
              scope: "openid email profile",
            },
          },
        ],
      },
    },
    // Fulfillment module with Manual + ShipStation providers
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          // Always register ShipStation so it appears in Admin as a fulfillment provider.
          // If credentials are missing, provider will still expose options but avoid live API calls
          // until a fulfillment is actually created.
          {
            resolve: "./src/modules/shipstation",
            id: "shipstation",
            options: {
              api_key: process.env.SHIPSTATION_API_KEY || "",
              api_secret: process.env.SHIPSTATION_API_SECRET || "",
              store_id: process.env.SHIPSTATION_STORE_ID,
              base_url: process.env.SHIPSTATION_BASE_URL || "https://ssapi.shipstation.com",
            },
          },
        ],
      },
    },
    // Enhanced payment module with multiple providers
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              // Enhanced features for bulk orders
              capturePayment: false, // Manual capture for large orders
              automaticPaymentMethods: true,
              // Webhook configuration for order tracking
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            },
          },
          // Add PayPal for corporate customers
          ...(process.env.PAYPAL_CLIENT_ID ? [{
            resolve: "@medusajs/medusa/payment-paypal",
            id: "paypal",
            options: {
              clientId: process.env.PAYPAL_CLIENT_ID,
              clientSecret: process.env.PAYPAL_CLIENT_SECRET,
              // Sandbox mode for testing
              sandbox: process.env.NODE_ENV !== "production",
            },
          }] : []),
        ],
      },
    },
    // Enhanced file service for design assets (optional - enable when S3 is configured)
    ...(S3_FILE_MODULE_ENABLED ? [{
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-s3",
            id: "s3",
            options: {
              file_url: process.env.S3_FILE_URL,
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: process.env.S3_REGION,
              bucket: process.env.S3_BUCKET,
              // Enhanced settings for design files
              prefix: "designs",
              cache_control: "max-age=31536000", // 1 year cache for static assets
            },
          },
        ],
      },
    }] : []),
    // Resend email notification service
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          // Resend provider - modern email API
          {
            resolve: "./src/modules/resend-notification",
            id: "resend",
            options: {
              channels: ["email"],
              api_key: process.env.RESEND_API_KEY?.replace(/['"]/g, ''),
              from_email: process.env.RESEND_FROM_EMAIL?.replace(/['"]/g, '') || 'onboarding@resend.dev',
              from_name: "GhostMark Studio",
            },
          },
        ],
      },
    },
    // Cache service for performance optimization (optional - enable when Redis is available)
    ...(CACHE_REDIS_URL ? [{
      resolve: "@medusajs/medusa/cache-redis",
      options: {
        redisUrl: CACHE_REDIS_URL,
        ttl: 3600, // 1 hour default TTL
        // Enhanced caching for bulk pricing calculations
        keyPrefix: process.env.CACHE_KEY_PREFIX || "ghostmark:",
      },
    }] : []),
    // Search service for product filtering (commented out until proper package is installed)
    // {
    //   resolve: "@medusajs/search-meilisearch",
    //   options: {
    //     config: {
    //       host: process.env.MEILISEARCH_HOST,
    //       apiKey: process.env.MEILISEARCH_API_KEY,
    //     },
    //     settings: {
    //       // Enhanced search configuration for clothes2order.com-style filtering
    //       products: {
    //         searchableAttributes: [
    //           "title",
    //           "description",
    //           "tags",
    //           "categories",
    //           "material",
    //           "print_methods",
    //           "target_market"
    //         ],
    //         filterableAttributes: [
    //           "type",
    //           "categories",
    //           "tags",
    //           "price_range",
    //           "material",
    //           "color",
    //           "size",
    //           "print_methods",
    //           "target_market",
    //           "bulk_available"
    //         ],
    //         sortableAttributes: [
    //           "created_at",
    //           "updated_at",
    //           "price",
    //           "popularity"
    //         ]
    //       }
    //     },
    //   },
    // },
  ],
  // Enhanced admin configuration with GhostMark Studio branding  
  admin: {
    vite: (config) => {
      config.define = config.define || {}
      config.define.__APP_TITLE__ = JSON.stringify("GhostMark Studio")
      config.define.__APP_DESCRIPTION__ = JSON.stringify("Professional Print-on-Demand Management")

      // Use Medusa's default dashboard CSS. Remove any custom alias that
      // redirects "@medusajs/dashboard/css" to a local file, so Vite can
      // resolve the package's built-in stylesheet.
      // If an alias was previously set elsewhere, ensure we don't add one here.
      config.resolve = config.resolve || {}
      const existingAliases = (config.resolve as any).alias || {}
      // Explicitly remove an overriding alias if present.
      if (typeof existingAliases === "object" && existingAliases["@medusajs/dashboard/css"]) {
        const { ["@medusajs/dashboard/css"]: _omit, ...rest } = existingAliases as Record<string, any>
        ;(config.resolve as any).alias = rest
      }

      // Filter out the duplicate react-refresh plugin to fix the "symbol already declared" error
      {
        // Medusa/Vite can provide plugins as nested arrays (Plugin | Plugin[])[],
        // so we flatten first; otherwise duplicates inside sub-arrays survive.
        const flattenPlugins = (plugins: any[]): any[] => {
          const out: any[] = []
          for (const p of plugins) {
            if (Array.isArray(p)) {
              out.push(...flattenPlugins(p))
            } else {
              out.push(p)
            }
          }
          return out
        }

        const flattened = flattenPlugins((config.plugins as any[]) || [])

        const isRefreshPlugin = (plugin: any): boolean => {
          const name = plugin?.name
          if (typeof name !== "string") return false

          // Common names seen across Vite React plugins and wrappers.
          return (
            name === "vite:react-refresh" ||
            name === "@vitejs/plugin-react-refresh" ||
            name.includes("react-refresh")
          )
        }

        const refreshPlugins = flattened.filter(isRefreshPlugin)

        if (process.env.GM_VITE_DEBUG === "1" && !(globalThis as any).__GM_VITE_PLUGINS_LOGGED__) {
          ;(globalThis as any).__GM_VITE_PLUGINS_LOGGED__ = true
          const names = flattened
            .map((p: any) => p?.name)
            .filter((n: any) => typeof n === "string")
          const refreshNames = refreshPlugins
            .map((p: any) => p?.name)
            .filter((n: any) => typeof n === "string")
          // eslint-disable-next-line no-console
          console.log("[ghostmark] admin.vite plugins:", names)
          // eslint-disable-next-line no-console
          console.log("[ghostmark] detected refresh plugins:", refreshNames)
        }

        // Keep the plugins Medusa provides, but Vite/Medusa can end up registering some
        // of them twice in the final resolved config (notably react-babel + admin-vite-plugin).
        // That duplication is what triggers the double react-refresh preamble injection.
        config.plugins = flattened

        // De-dupe the resolved plugin list after all plugins are collected.
        // This runs late (post) so it can remove duplicates introduced by other plugins.
        config.plugins = config.plugins || []
        ;(config.plugins as any[]).push({
          name: "ghostmark:dedupe-vite-plugins",
          enforce: "post",
          configResolved(resolved: any) {
            if ((globalThis as any).__GM_VITE_PLUGIN_DEDUPE_DONE__) {
              return
            }
            ;(globalThis as any).__GM_VITE_PLUGIN_DEDUPE_DONE__ = true

            const plugins: any[] = Array.isArray(resolved?.plugins) ? resolved.plugins : []

            // Keep only the first instance of these plugins. Duplicates of any of these
            // can cause react-refresh preamble duplication and esbuild parse errors.
            const dedupeByName = new Set([
              "vite:react-babel",
              "vite:react-refresh",
              "@medusajs/admin-vite-plugin",
              "medusa:write-static-files",
              "medusa:inject-tailwindcss",
              "ghostmark:dedupe-vite-plugins",
            ])

            const seen = new Set<string>()
            const next: any[] = []
            for (const p of plugins) {
              const name = p?.name
              if (typeof name === "string" && dedupeByName.has(name)) {
                if (seen.has(name)) continue
                seen.add(name)
              }
              next.push(p)
            }

            if (next.length !== plugins.length) {
              plugins.length = 0
              plugins.push(...next)
            }

            if (process.env.GM_VITE_DEBUG === "1" && !(globalThis as any).__GM_VITE_RESOLVED_PLUGINS_LOGGED__) {
              ;(globalThis as any).__GM_VITE_RESOLVED_PLUGINS_LOGGED__ = true
              const names = plugins
                .map((p: any) => p?.name)
                .filter((n: any) => typeof n === "string")
              // eslint-disable-next-line no-console
              console.log("[ghostmark] resolved vite plugins:", names)
            }
          },
        })
      }
      
      return config
    },
  }
})
