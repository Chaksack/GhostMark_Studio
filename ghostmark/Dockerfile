# Medusa backend Dockerfile
FROM node:20-alpine AS base

ENV NODE_ENV=production \
    CI=true

WORKDIR /app

# Install OS deps (if any native modules are used)
RUN apk add --no-cache python3 make g++

# Install dependencies (support pnpm, npm, or yarn based on available lockfile)
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Use the package manager that matches the lockfile
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && corepack prepare pnpm@9.15.4 --activate && \
      pnpm install --frozen-lockfile --prefer-offline; \
    elif [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    elif [ -f yarn.lock ]; then \
      corepack enable && yarn install --immutable --mode=skip-build; \
    else \
      echo "No lockfile found. Please commit a lockfile." && exit 1; \
    fi

# Copy the rest of the app
COPY . .

# Build the medusa project (this generates the dist folder and .medusa admin assets)
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm run build; \
      pnpm prune --prod; \
    elif [ -f package-lock.json ]; then \
      npm run build; \
      npm prune --omit=dev; \
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
## Copy Medusa build artifacts (includes admin static files)
COPY --from=base /app/.medusa ./.medusa

# Copy any necessary runtime files (e.g., medusa config, etc.)
COPY --from=base /app/medusa-config.* ./

EXPOSE 9000

# Use medusa start and bind to the provided PORT (e.g., Railway), default to 9000
CMD ["sh", "-c", "cd .medusa/server && ../../node_modules/.bin/medusa start --port ${PORT:-9000}"]
