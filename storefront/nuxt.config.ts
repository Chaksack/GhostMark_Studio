// https://nuxt.com/docs/api/configuration/nuxt-config
/// <reference types="node" />

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/medusa'],

  css: ['~/assets/tailwind.css'],

  app: {
    head: {
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },

  runtimeConfig: {
    cmsToken: process.env.STRAPI_TOKEN || '',
    public: {
      cmsBaseUrl: (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/$/, ''),
    },
  },

  medusa: {
    baseUrl: (process.env.MEDUSA_URL || 'http://localhost:9000').replace(/\/$/, ''),
    publishableKey: process.env.MEDUSA_PUBLISHABLE_KEY || '',
    debug: process.env.NODE_ENV === 'development',
    global: true,
    server: true,
    auth: {
      type: 'jwt',
      jwtTokenStorageKey: 'gms_auth_token',
      // Nuxt runs Medusa client in SSR as well; local/session storage aren't available there.
      // Use a server-safe option to avoid runtime errors during SSR.
      jwtTokenStorageMethod: 'nostore',
      fetchCredentials: 'include',
    },
  },
})