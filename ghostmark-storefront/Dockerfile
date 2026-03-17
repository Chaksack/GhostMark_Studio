# Next.js storefront Dockerfile (pnpm + Railway friendly)
FROM node:20-alpine AS base

ENV NODE_ENV=production \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Install dependencies using pnpm via Corepack (project is configured with packageManager=pnpm)
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate && \
    if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --prod=false; else pnpm install --prod=false; fi

# Copy source and build
COPY . .
RUN pnpm run build

# Runtime image
FROM node:20-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8000 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

# Copy minimal runtime assets
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-lock.yaml* ./
COPY --from=base /app/node_modules ./node_modules

EXPOSE 8000

# Pre-activate pnpm in the runner image so `pnpm` is on PATH even if the platform overrides the Docker CMD
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Default start (some platforms override CMD; having pnpm pre-activated avoids "pnpm not found")
CMD ["pnpm", "start"]