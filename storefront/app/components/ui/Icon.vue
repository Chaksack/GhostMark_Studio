<template>
  <!--
    Icon — single source of truth for inline SVG chrome.

    Why this exists (v17 merchery audit):
      Header icons drifted (cart 22, heart 18, user 18, search 20) and stroke-
      width was inconsistent (search 1.75, others 2). Every icon was an inline
      <svg> copy-pasted across components, so any future taxonomy change had
      to be replayed by hand. This component centralises the path data into a
      registry and standardises the wrapper attributes.

    Render strategy:
      We use Vue's `h()` render function (Vue 3.4+) instead of v-html for the
      path bodies. This keeps the SVG inside Vue's vnode tree — no innerHTML
      parse, no XSS surface, and Vue can statically hoist the registry once.
      The `<component :is="path" />` slot calls the registered factory and
      returns a vnode, so each icon is just a tiny function reference.

    Sizing & colour discipline:
      - Single 24x24 viewBox so all path data shares the same coordinate
        space and visual weight, even when the rendered size varies.
      - `stroke="currentColor"` and `fill="none"` by default — colour follows
        the surrounding text, fill is opt-in per path (used by social marks
        and the wishlist-filled state).
      - `stroke-width` defaults to 2; pass-through prop allows e.g. the
        chevron in tight chrome to drop to 1.5 if a designer requests it,
        but we deliberately removed the 1.75 search-only outlier.

    Accessibility:
      - `aria-hidden="true"` when no `ariaLabel` is supplied (decorative).
      - When `ariaLabel` is present we set `role="img"` and the label, so
        the SVG becomes a meaningful image for assistive tech. Most call
        sites wrap Icon in a <button aria-label="..."> and want decorative
        treatment — that path is the default and requires no extra props.
  -->
  <svg
    :viewBox="viewBox"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="ariaLabel ? null : 'true'"
    :aria-label="ariaLabel || null"
    :role="ariaLabel ? 'img' : null"
    class="transition-colors duration-200"
  >
    <component :is="path" />
  </svg>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'

export type IconName =
  | 'cart'
  | 'wishlist'
  | 'wishlist-filled'
  | 'user'
  | 'search'
  | 'burger'
  | 'close'
  | 'chevron-down'
  | 'chevron-right'
  | 'arrow-right'
  | 'instagram'
  | 'linkedin'
  | 'pinterest'
  | 'twitter'
  | 'globe'
  | 'check'
  | 'truck'
  | 'people'
  | 'star'
  | 'plus'
  | 'minus'
  | 'share'
  | 'upload'
  | 'image-placeholder'
  | 'heart-outline'
  | 'mail'

interface Props {
  name: IconName
  size?: number | string
  strokeWidth?: number | string
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 20,
  strokeWidth: 2,
})

const viewBox = computed(() => '0 0 24 24')

// Registry of icon path factories. Each factory returns a vnode (or vnode
// list) that lives INSIDE the wrapping <svg>. Factories — not raw vnodes —
// because vnodes are not safely shareable across renders; calling the
// factory yields a fresh tree every time the component mounts.
const PATHS: Record<IconName, () => any> = {
  cart: () => h('g', null, [
    h('path', { d: 'M6 6h15l-1.5 9h-12z' }),
    h('path', { d: 'M6 6l-2-3H1' }),
    h('circle', { cx: 9, cy: 20, r: 1 }),
    h('circle', { cx: 18, cy: 20, r: 1 }),
  ]),
  // Symmetric heart from Lucide — clean curve, mirrors across the y-axis,
  // recognisable shape. The earlier custom path was asymmetric and read as
  // a melted teardrop instead of a heart.
  wishlist: () => h('path', {
    d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z',
  }),
  'wishlist-filled': () => h('path', {
    d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z',
    fill: 'currentColor',
  }),
  'heart-outline': () => h('path', {
    d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z',
  }),
  user: () => h('g', null, [
    h('circle', { cx: 12, cy: 8, r: 4 }),
    h('path', { d: 'M4 21c0-4 4-7 8-7s8 3 8 7' }),
  ]),
  search: () => h('g', null, [
    h('circle', { cx: 11, cy: 11, r: 7 }),
    h('path', { d: 'M20 20l-3.2-3.2' }),
  ]),
  burger: () => h('path', { d: 'M3 6h18M3 12h18M3 18h18' }),
  close: () => h('path', { d: 'M18 6 6 18M6 6l12 12' }),
  'chevron-down': () => h('path', { d: 'm6 9 6 6 6-6' }),
  'chevron-right': () => h('path', { d: 'M9 6l6 6-6 6' }),
  'arrow-right': () => h('path', { d: 'M5 12h14M13 6l6 6-6 6' }),
  instagram: () => h('g', null, [
    h('rect', { x: 2, y: 2, width: 20, height: 20, rx: 5 }),
    h('path', { d: 'M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z' }),
    h('circle', { cx: 17.5, cy: 6.5, r: 1, fill: 'currentColor', stroke: 'none' }),
  ]),
  linkedin: () => h('g', null, [
    h('path', { d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 1 0-4 0v7h-4v-13h4v2c.7-1.3 2.4-2 4-2z' }),
    h('rect', { x: 2, y: 9, width: 4, height: 12 }),
    h('circle', { cx: 4, cy: 4, r: 2 }),
  ]),
  pinterest: () => h('g', null, [
    h('circle', { cx: 12, cy: 12, r: 10 }),
    h('path', { d: 'M11.5 17.5l1.5-7' }),
  ]),
  twitter: () => h('path', {
    d: 'M22 4.5a8.5 8.5 0 0 1-2.4.7 4.2 4.2 0 0 0 1.8-2.3 8.4 8.4 0 0 1-2.7 1A4.2 4.2 0 0 0 11.5 8a11.9 11.9 0 0 1-8.6-4.4 4.2 4.2 0 0 0 1.3 5.6A4.2 4.2 0 0 1 2.4 8.7v.1A4.2 4.2 0 0 0 5.8 13a4.2 4.2 0 0 1-1.9.1 4.2 4.2 0 0 0 3.9 2.9 8.4 8.4 0 0 1-5.2 1.8 11.9 11.9 0 0 0 6.5 1.9c7.7 0 12-6.4 12-12v-.5A8.5 8.5 0 0 0 22 4.5z',
  }),
  globe: () => h('g', null, [
    h('circle', { cx: 12, cy: 12, r: 10 }),
    h('path', { d: 'M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }),
  ]),
  check: () => h('path', { d: 'M5 12l5 5 9-11' }),
  truck: () => h('g', null, [
    h('rect', { x: 1, y: 6, width: 13, height: 11 }),
    h('path', { d: 'M14 9h4l3 4v4h-7' }),
    h('circle', { cx: 6, cy: 19, r: 2 }),
    h('circle', { cx: 17, cy: 19, r: 2 }),
  ]),
  people: () => h('g', null, [
    h('circle', { cx: 9, cy: 8, r: 3 }),
    h('path', { d: 'M3 21c0-4 3-6 6-6s6 2 6 6' }),
    h('circle', { cx: 17, cy: 9, r: 3 }),
    h('path', { d: 'M21 21c0-3.3-2.7-6-6-6' }),
  ]),
  star: () => h('path', { d: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z' }),
  plus: () => h('path', { d: 'M12 5v14M5 12h14' }),
  minus: () => h('path', { d: 'M5 12h14' }),
  share: () => h('g', null, [
    h('path', { d: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7' }),
    h('path', { d: 'M16 6l-4-4-4 4' }),
    h('path', { d: 'M12 2v13' }),
  ]),
  upload: () => h('g', null, [
    h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    h('path', { d: 'M17 8l-5-5-5 5' }),
    h('path', { d: 'M12 3v12' }),
  ]),
  'image-placeholder': () => h('g', null, [
    h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
    h('circle', { cx: 8.5, cy: 8.5, r: 1.5 }),
    h('path', { d: 'm21 15-5-5L5 21' }),
  ]),
  mail: () => h('g', null, [
    h('rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }),
    h('path', { d: 'M2 6l10 7 10-7' }),
  ]),
}

const path = computed(() => PATHS[props.name])
</script>
