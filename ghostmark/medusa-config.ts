import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
   modules: [
    // Auth module with Google provider
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          // Email + Password authentication provider
          {
            resolve: "@medusajs/auth-emailpass",
            id: "emailpass",
            options: {
              // You can configure additional options here if needed (e.g., email templates, password policies)
              // Keeping minimal config so the provider registers and routes become available.
            },
          },
          {
            resolve: "@medusajs/auth-google",
            id: "google",
            options: {
              // Required Google OAuth credentials
              clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
              clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
              // Callback URL where Medusa will redirect after Google login
              callbackUrl: process.env.AUTH_GOOGLE_CALLBACK_URL,
              // Optional auth flow paths/redirects
              authPath: process.env.AUTH_GOOGLE_AUTH_PATH,
              successRedirectUrl: process.env.AUTH_GOOGLE_SUCCESS_REDIRECT_URL,
              failureRedirectUrl: process.env.AUTH_GOOGLE_FAILURE_REDIRECT_URL,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
            },
          },
        ],
      },
    },
  ],
})
