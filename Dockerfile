# ---- base: shared foundation (Prisma's engines need OpenSSL; node:22-slim omits it) ----
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- deps: install once (dev deps included — builder, dev, and test all need them) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- dev: used by the `dev` and `test` compose services; compose bind-mounts the source
#      over /app, with an anonymous volume preserving this image's node_modules ----
FROM deps AS dev
ENV DATABASE_URL="file:./prisma/dev.db"
COPY . .
CMD ["npm", "run", "dev"]

# ---- builder: generate the Prisma client, compile the app, then drop dev deps ----
FROM deps AS builder
COPY . .
# Only needed so `prisma generate` has a DATABASE_URL to read — no DB connection happens here.
ENV DATABASE_URL="file:./prisma/build.db"
RUN npx prisma generate
RUN npm run build
# Drop the dev toolchain from what the runner will copy. `prisma` survives because it's a
# production dependency (migrate deploy runs at startup). Note: typescript and playwright
# (~41MB) intentionally remain — they're optional peers of @prisma/client and next, so npm
# keeps them under every install/prune mode; forcing them out would mean hand-editing
# node_modules, which isn't worth ~4% of the tree.
RUN npm prune --omit=dev

# ---- runner: slim production image ----
FROM base AS runner
ENV NODE_ENV=production

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

# ---- e2e: same Node 22 base as everything else, plus Playwright's chromium.
#      (Deliberately NOT mcr.microsoft.com/playwright — that image ships Node 24/undici 7,
#      where the Next dev server's outbound LLM calls die with "Premature close"; E2E should
#      run on the same runtime the app actually ships on anyway.) ----
FROM deps AS e2e
RUN npx playwright install --with-deps chromium
COPY . .
ENV DATABASE_URL="file:./prisma/dev.db"
RUN npx prisma generate
# playwright.config's webServer boots `npm run dev` inside this same container.
CMD ["sh", "-c", "npx prisma migrate deploy && npx playwright test"]
