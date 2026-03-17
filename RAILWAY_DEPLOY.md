# Railway Deploy (Monorepo)

This repo contains two deployable apps:

- **Backend (Medusa)**: `ghostmark/`
- **Storefront (Next.js)**: `ghostmark-storefront/`

Railway works best when you create **two services** (one per app) and set each service’s **Root Directory**.

## 1) Backend service (Medusa)

**Root Directory**: `.` (repo root)

**Build Command**:

- `npm run build`

**Start Command**:

- `npm start`

Notes:
- Root `build/start` scripts are wired to run the backend in `ghostmark/`.
- The backend binds to Railway’s `PORT` via the Medusa CLI (`--port` defaults to `env.PORT`).
- The backend `start` script runs Medusa with `--directory .medusa/server` so it serves the compiled output (including `public/admin/index.html`).

Important:
- `medusa build` must run before `medusa start` so the Admin assets exist (it generates `ghostmark/.medusa/client/index.html`).
- `medusa build` needs build-time tooling (`ts-node`, `typescript`, Vite/React for the admin bundle). If your Railway service is set up to install **production-only** dependencies, the build can be skipped or incomplete and you'll see: "Could not find index.html in the admin build directory".
- Use the `npm run build` command above (repo root) — it forces pnpm to install devDependencies for the build.

**Required env (minimum)**
- `DATABASE_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`

**Recommended env**
- `STORE_CORS` (your storefront URL)
- `ADMIN_CORS` (your admin/dashboard URL)
- `AUTH_CORS` (usually same as `STORE_CORS`)

## 2) Storefront service (Next.js)

**Root Directory**: `ghostmark-storefront`

**Build Command**:

- `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack enable && corepack prepare yarn@4.6.0 --activate && yarn install --immutable && yarn build`

**Start Command**:

- `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack enable && corepack prepare yarn@4.6.0 --activate && yarn start`

Notes:
- Storefront `start/dev` scripts use Railway’s `PORT` (fallback `8000` locally).
- `next.config.js` enforces required env vars at build time.

**Required env (minimum)**
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`

**Common env** (depends on your setup)
- `NEXT_PUBLIC_MEDUSA_BACKEND_URL` (or whatever your storefront uses to target the backend)
- `STRAPI_URL` / `NEXT_PUBLIC_STRAPI_URL` (if using Strapi images/content)

## Quick sanity checks

Backend:
- Service logs show the app listening on `$PORT`.

Storefront:
- Build fails fast if required `NEXT_PUBLIC_*` env vars are missing (intentional).
