FROM node:22-slim AS base
# Prisma's engines need libssl at build and run time; the slim image lacks it.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Standalone output drops the Prisma CLI's own dependencies, so install the
# CLI (same version as the app) on its own for `migrate deploy` at startup.
FROM base AS prisma-cli
WORKDIR /prisma-cli
COPY package.json /tmp/app-package.json
RUN npm init -y >/dev/null \
  && npm install --no-audit --no-fund "prisma@$(node -p "require('/tmp/app-package.json').dependencies.prisma")"

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so
# the real public LiveKit WebSocket URL must be supplied as a build ARG
# (docker-compose passes it from infra/.env) — a runtime env_file value
# would arrive too late to affect the already-built browser bundle.
ARG NEXT_PUBLIC_LIVEKIT_WS_URL
ENV NEXT_PUBLIC_LIVEKIT_WS_URL=${NEXT_PUBLIC_LIVEKIT_WS_URL}

# Build-time-only placeholders for server-only vars: these are read from
# the container's runtime environment (docker-compose env_file) instead,
# so the values here never reach production.
ENV SESSION_SECRET="build-time-placeholder-not-used-at-runtime-000000"
ENV ENCRYPTION_KEY="build-time-placeholder-not-used-at-runtime"
ENV LIVEKIT_API_KEY="build-time-placeholder"
ENV LIVEKIT_API_SECRET="build-time-placeholder-not-used-at-runtime-00"
ENV LIVEKIT_HTTP_URL="http://localhost:7880"
ENV DATABASE_URL="file:./dev.db"
RUN npx prisma generate
RUN nice -n 19 npm run build

FROM base AS runner
WORKDIR /app
# Also read at runtime by server code (lib/livekit.ts) via a dynamic lookup
# that Next can't inline, so it must be in the runner's environment too.
ARG NEXT_PUBLIC_LIVEKIT_WS_URL
ENV NEXT_PUBLIC_LIVEKIT_WS_URL=${NEXT_PUBLIC_LIVEKIT_WS_URL}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd -r nodejs && useradd -r -g nodejs nextjs
# ffmpeg converts uploaded videos (e.g. iPhone HEVC) to H.264 that every
# browser and the stream output can play.
RUN apt-get update -y && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=prisma-cli /prisma-cli/node_modules ./prisma-cli/node_modules
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data && chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV DATABASE_URL="file:/app/data/show.db"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
