<template>
  <footer class="border-t border-zinc-200 bg-[#F2E5D9]">
    <div class="mx-auto w-full max-w-screen-2xl px-5 py-10 sm:px-6 lg:px-8">
      <div class="mt-8 border-y border-zinc-200 py-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-wrap items-center gap-4">
            <span class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Follow us:</span>
            <a href="#" class="text-sm text-zinc-950 hover:underline">Instagram</a>
            <a href="#" class="text-sm text-zinc-950 hover:underline">LinkedIn</a>
          </div>

          <p class="text-sm text-zinc-700">
            Based in <span class="underline decoration-dotted underline-offset-4">London</span>,
            United Kingdom.
          </p>
        </div>
      </div>

      <nav class="mt-7 grid gap-8 sm:grid-cols-2 lg:grid-cols-5" aria-label="Footer">
        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Company</div>
          <div class="mt-4 grid gap-2 text-sm text-zinc-950">
            <NuxtLink to="/about" class="hover:underline">About us</NuxtLink>
            <a href="#" class="hover:underline">Environmental footprint</a>
            <a href="#" class="hover:underline">Value chain</a>
            <a href="#" class="hover:underline">People &amp; culture</a>
          </div>
        </div>

        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Services</div>
          <div class="mt-4 grid gap-2 text-sm text-zinc-950">
            <NuxtLink to="/products" class="hover:underline">Shop all</NuxtLink>
            <a href="#" class="hover:underline">Bespoke</a>
            <a href="#" class="hover:underline">Platform</a>
            <a href="#" class="hover:underline">Agencies</a>
          </div>
        </div>

        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Inspiration</div>
          <div class="mt-4 grid gap-2 text-sm text-zinc-950">
            <NuxtLink to="/blog" class="hover:underline">Blog</NuxtLink>
            <a href="#" class="hover:underline">Cases</a>
          </div>
        </div>

        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Let us help</div>
          <div class="mt-4 grid gap-2 text-sm text-zinc-950">
            <NuxtLink to="/faq" class="hover:underline">FAQ</NuxtLink>
            <a href="#" class="hover:underline">Terms &amp; conditions</a>
            <a href="#" class="hover:underline">Privacy</a>
            <a href="#" class="hover:underline">Returns</a>
            <NuxtLink to="/contact" class="hover:underline">Contact us</NuxtLink>
          </div>
        </div>

        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Account</div>
          <div class="mt-4 grid gap-2 text-sm text-zinc-950">
            <NuxtLink to="/account" class="hover:underline">Orders</NuxtLink>
            <a href="#" class="hover:underline">Preferences</a>
            <a href="#" class="hover:underline">Saved projects</a>
            <a href="#" class="hover:underline">Invoices</a>
          </div>
        </div>
      </nav>

      <div class="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div class="flex items-center gap-6">
          <div class="grid place-items-center rounded-full border border-zinc-300 bg-white p-3">
            <div class="text-center text-[10px] font-bold leading-none text-zinc-950">
              Certified<br />B
            </div>
          </div>
          <div class="grid place-items-center rounded-full border border-zinc-300 bg-white p-3">
            <div class="text-center text-[10px] font-bold leading-none text-zinc-950">
              1%<br />For the<br />Planet
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
          <span class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Secure payments:</span>
          <span class="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">AMEX</span>
          <span class="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">MC</span>
          <span class="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">PayPal</span>
          <span class="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">VISA</span>
        </div>
      </div>

      <div class="mt-8 text-xs text-zinc-500">© {{ year }} GhostMark</div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear()
</script>
