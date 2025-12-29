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
    },
    // Enhanced features for clothes2order.com-style functionality
    features: {
      product_categories: true,
      product_variants: true,
      product_tags: true,
      tax_inclusive_pricing: process.env.TAX_INCLUSIVE_PRICING === "true" || false,
    },
    // Multi-currency support like clothes2order.com
    currencies: ["USD", "EUR", "GBP", "CAD", "AUD"],
    // Session configuration for enhanced cart management
    session_options: {
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
    ...(process.env.S3_ACCESS_KEY_ID ? [{
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
    ...(process.env.CACHE_REDIS_URL ? [{
      resolve: "@medusajs/medusa/cache-redis",
      options: {
        redisUrl: process.env.CACHE_REDIS_URL,
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
      
      // Basic optimization without interfering with React plugins
      config.optimizeDeps = config.optimizeDeps || {}
      config.optimizeDeps.include = config.optimizeDeps.include || []
      config.optimizeDeps.include.push(
        'react',
        'react-dom',
        '@medusajs/admin-sdk',
        '@medusajs/ui',
        '@tanstack/react-query'
      )
      
      // Customize HTML template
      config.build = config.build || {}
      config.build.rollupOptions = config.build.rollupOptions || {}
      config.build.rollupOptions.input = config.build.rollupOptions.input || {}
      
      // Add custom HTML transformations and inject custom CSS for branding
      config.plugins = config.plugins || []
      config.plugins.push({
        name: 'custom-html-transform',
        transformIndexHtml: {
          enforce: 'pre',
          transform(html, ctx) {
            return html
              .replace(/<title>.*?<\/title>/, '<title>GhostMark Studio Admin</title>')
              .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/png" href="/icon.png">')
              .replace(/<link rel="shortcut icon"[^>]*>/, '<link rel="shortcut icon" type="image/x-icon" href="/icon.png">')
              .replace(/<meta name="description"[^>]*>/, '<meta name="description" content="Professional Print-on-Demand Management System">')
              .replace(/<\/head>/, `
                <style>
                  /* Custom branding for login page */
                  svg[data-testid="medusa-logo"],
                  [data-testid="medusa-logo"],
                  .medusa-logo {
                    display: none !important;
                  }
                  
                  /* Custom logo container */
                  .ghostmark-logo {
                    width: 64px;
                    height: 64px;
                    margin: 0 auto 24px auto;
                    display: block;
                    background-image: url('/icon.png');
                    background-size: contain;
                    background-repeat: no-repeat;
                    background-position: center;
                  }
                </style>
                <script>
                  // Wait for DOM to load and replace login page content
                  document.addEventListener('DOMContentLoaded', function() {
                    function updateLoginPage() {
                      // Replace "Welcome to Medusa" with "Welcome to GhostMark Studio"
                      const headings = document.querySelectorAll('h1, h2, h3');
                      headings.forEach(function(heading) {
                        if (heading.textContent && heading.textContent.includes('Welcome to Medusa')) {
                          heading.textContent = 'Welcome to GhostMark Studio';
                        }
                        if (heading.textContent && heading.textContent.includes('Medusa')) {
                          heading.textContent = heading.textContent.replace(/Medusa/g, 'GhostMark Studio');
                        }
                      });
                      
                      // Replace Medusa logo with GhostMark logo
                      const logos = document.querySelectorAll('svg[data-testid="medusa-logo"], [data-testid="medusa-logo"], .medusa-logo');
                      logos.forEach(function(logo) {
                        const customLogo = document.createElement('div');
                        customLogo.className = 'ghostmark-logo';
                        if (logo.parentNode) {
                          logo.parentNode.replaceChild(customLogo, logo);
                        }
                      });
                    }
                    
                    // Run immediately and also observe for dynamic content
                    updateLoginPage();
                    
                    // Use MutationObserver to catch dynamic content changes
                    const observer = new MutationObserver(function(mutations) {
                      mutations.forEach(function(mutation) {
                        if (mutation.type === 'childList') {
                          updateLoginPage();
                        }
                      });
                    });
                    
                    observer.observe(document.body, {
                      childList: true,
                      subtree: true
                    });
                  });
                </script>
                </head>`)
          }
        }
      })
      
      return config
    },
  }
})
