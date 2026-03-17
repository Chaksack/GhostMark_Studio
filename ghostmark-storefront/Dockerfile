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
    if [ -f pnpm-lock.yaml ]; then pnpm install --no-frozen-lockfile --prod=false; else pnpm install --prod=false; fi

# Copy source and build
COPY . .
RUN pnpm run build

# Runtime image
FROM node:20-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8000
WORKDIR /app

# Copy minimal runtime assets
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-lock.yaml* ./
COPY --from=base /app/node_modules ./node_modules

EXPOSE 8000

# Use the PORT env if provided by the platform (e.g., Railway), default to 8000
# Ensure Corepack is enabled in the runtime container so pnpm is available even if the base image didn't persist shims
CMD ["sh", "-c", "corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm start -p ${PORT:-8000}"]