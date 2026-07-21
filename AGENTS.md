<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Quiz Agent — guide for AI agents

Generates a multiple-choice quiz from a Markdown URL via an LLM, runs it in a web UI,
scores it with a weighted average. Full human docs in `README.md`; this file is the short
version agents need to work here without breaking the load-bearing invariants.

## Architecture (dependencies point inward — never violate this)

- `src/domain/` — pure business rules. No imports from Next/Prisma/LangChain, no I/O. All
  scoring math lives in `domain/services/scoring.ts`.
- `src/application/` — use cases orchestrating the domain through **ports** (interfaces in
  `application/ports/`). Never import infrastructure here.
- `src/infrastructure/` — adapters implementing the ports (Prisma, Groq/LangChain, SSRF-guarded
  fetcher, Langfuse, LLM-judge, `after()` scheduler).
- `src/composition/container.ts` — the ONLY place adapters meet use cases.
- `src/app/` — Next.js UI + REST route handlers. Handlers are thin: Zod-validate → use case →
  map typed errors to HTTP. No business logic in routes.

Adding a feature: define/extend a port in `application`, implement it in `infrastructure`,
wire it in the container. Swapping a vendor must never touch `domain/` or `application/`.

## Conventions

- **Tests live in `tests/`, not beside source**: `tests/unit/` (Vitest, mirrors the layers,
  imports via the `@/` alias, shared fakes in `tests/unit/application/fakes.ts`) and
  `tests/e2e/` (Playwright).
- **Strategies**: use the `/add-strategy` skill (`.claude/skills/add-strategy/SKILL.md`).
  Identity in `application/strategies/registry.ts`, guidance text in
  `infrastructure/llm/prompts/fallbacks.ts`. Never hand-edit the derived `strategyIdSchema`.
- **Prompts**: every Langfuse prompt name MUST have an in-code fallback in `fallbacks.ts` —
  the provider throws otherwise. Langfuse is optional; the app must always work without it.
- **LLM retries live in ONE layer**: `maxRetries` on the ChatGroq instance (2 for generation,
  0 for the judge). Do not add retry wrappers around LangChain calls — layered retries
  multiply against rate limits.
- **Errors**: throw the typed errors from `shared/errors.ts`; `handleRouteError` maps them.
  Never let a provider's raw error body reach an API response.

## Invariants that must not break

1. `Option.isCorrect` never reaches the client before submission — pre-submit responses go
   through `toPublicQuiz()`. The result/submit endpoints are the only exceptions.
2. Question `weight` (`1.1^position`) is computed once at creation and stored — scoring must
   stay reproducible from DB rows alone.
3. The LLM-judge is fire-and-forget (`after()` via the BackgroundScheduler port): it must
   never add latency or throw on the request path; `judgeScore` stays `null` on failure.
4. A quiz submits once: 409 on resubmit, and the `Response.questionId` unique constraint
   (P2002 → ConflictError) backstops the race.
5. `HttpMarkdownFetcher`'s SSRF guard (private/loopback/link-local IP rejection) stays in
   front of every server-side fetch of user-supplied URLs.

## Commands

- Verify before committing: `npx tsc --noEmit && npx vitest run && npx eslint .`
- Docker is the primary workflow (host npm optional): `docker compose up --build` (app),
  `docker compose run --rm test` (unit), `docker compose --profile dev up dev` (hot reload).
- Prisma 7: config lives in `prisma.config.ts` (not the schema); client generates into
  `src/generated/` (gitignored) — run `npm run db:generate` after a fresh clone.

## Cost warning — E2E spends real money-equivalent quota

`docker compose run --rm e2e`, `npm run test:e2e`, and `test:e2e:demo` call the REAL Groq
API (~13K tokens per full run; free tier: 12K tokens/min, 100K/day per model). Do NOT run
E2E casually or in loops. Quota exhaustion looks like generation timeouts, not a clear
error. Structural changes can be checked quota-free with `npx playwright test --list`.
`GROQ_MODEL=openai/gpt-oss-20b` borrows a different model's quota if the default is spent.
