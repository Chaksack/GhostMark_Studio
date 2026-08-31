// Phase 7: register vue-konva on the client only.
//
// Konva uses the browser <canvas> API; importing it during SSR throws
// (`canvas is not defined`). The `.client.ts` filename suffix tells Nuxt to
// only execute this plugin in the browser, so the server bundle never pulls
// the Konva CJS entry. Components must still be wrapped in <ClientOnly> to
// avoid SSR rendering of <v-stage> tags (which Vue would otherwise emit as
// custom elements during the SSR pass).
import VueKonva from 'vue-konva'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueKonva)
})
