# Medusa backend Dockerfile
FROM node:20-alpine AS base

ENV NODE_ENV=production \
    CI=true

WORKDIR /app

# Install OS deps (if any native modules are used)
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Prefer npm ci if package-lock is present to avoid Yarn/NPM mismatch
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      corepack enable && yarn install --immutable --mode=skip-build; \
    fi

# Copy the rest of the app
COPY . .

# Build the medusa project (this generates the dist folder)
RUN if [ -f package-lock.json ]; then \
      npm run build; \
    else \
      yarn build; \
    fi

# Runtime image
FROM node:20-alpine AS runner
ENV NODE_ENV=production \
    PORT=9000
WORKDIR /app

# Copy node_modules and build artifacts
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/dist ./dist
## Copy Medusa build artifacts (includes admin static files)
COPY --from=base /app/.medusa ./.medusa

# Copy any necessary runtime files (e.g., medusa config, etc.)
COPY --from=base /app/medusa-config.* ./

EXPOSE 9000

# Use medusa start and bind to the provided PORT (e.g., Railway), default to 9000
CMD ["sh", "-c", "node node_modules/.bin/medusa start --port ${PORT:-9000}"]
