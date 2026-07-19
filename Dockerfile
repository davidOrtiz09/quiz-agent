# ---- deps: install once, reused by the build stage ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate the Prisma client and compile the Next.js app ----
FROM node:22-slim AS builder
WORKDIR /app
# Prisma's schema-engine binary needs OpenSSL to detect the right build; node:22-slim omits it.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Only needed so `prisma generate` has a DATABASE_URL to read — no DB connection happens here.
ENV DATABASE_URL="file:./prisma/build.db"
RUN npx prisma generate
RUN npm run build

# ---- runner: slim production image ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Needed at runtime too: docker-entrypoint.sh runs `prisma migrate deploy` on startup.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
