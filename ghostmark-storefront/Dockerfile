# Next.js storefront Dockerfile
FROM node:20-alpine AS base

ENV NODE_ENV=production \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Install dependencies using Yarn Berry (via Corepack)
COPY package.json yarn.lock ./
RUN corepack enable && yarn set version stable && yarn install --immutable

# Copy source and build
COPY . .
RUN yarn build

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
COPY --from=base /app/yarn.lock ./yarn.lock
COPY --from=base /app/node_modules ./node_modules

EXPOSE 8000

CMD ["yarn", "start", "-p", "8000"]
