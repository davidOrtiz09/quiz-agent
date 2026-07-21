# AI Quiz Agent

Generate a short multiple-choice quiz from any Markdown file (e.g. a GitHub README), take it
in the browser, and get a weighted score — built as a small, production-shaped Node.js/TypeScript
app rather than a proof of concept.

- **LLM**: [Groq](https://console.groq.com) (free tier) via [LangChain.js](https://js.langchain.com)
- **Persistence**: SQLite via [Prisma](https://www.prisma.io) 7
- **Web UI + REST API**: [Next.js](https://nextjs.org) (App Router)
- **Observability + prompt management**: [Langfuse](https://langfuse.com) (optional)
- **Testing**: Vitest (unit + use-case) and Playwright (E2E, real LLM)
- **Deployment**: Docker / Docker Compose

## Contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Data flow](#data-flow)
- [Scoring](#scoring)
- [Strategies](#strategies)
- [Prompts & observability (Langfuse)](#prompts--observability-langfuse)
- [REST API](#rest-api)
- [Testing](#testing)
- [Docker](#docker)
- [Judgment calls](#judgment-calls)

## Quick start (Docker only — no Node/npm needed on the host)

```bash
cp .env.example .env        # then fill in GROQ_API_KEY at least
docker compose up --build   # production app on http://localhost:3000
```

Open the app, pick one of the two preset READMEs (or paste any raw-markdown-serving URL),
choose a strategy and question count, and generate a quiz.

Everything else also runs through Docker:

| Command | What it does |
|---|---|
| `docker compose up --build` | Production app (migrations apply automatically on start) |
| `docker compose --profile dev up dev` | Dev server with hot reload (source bind-mounted) |
| `docker compose run --rm test` | Unit tests (Vitest — domain + use-case logic, no LLM/network) |
| `docker compose run --rm e2e` | Playwright E2E against the **real** Groq LLM (see note below) |
| `docker compose --profile e2e up e2e-ui` | Watchable E2E — open http://localhost:8080, press play, and see the tests drive the app live |

After changing `package.json`, rebuild the dev image:
`docker compose --profile dev build dev && docker compose --profile dev up --force-recreate dev`.

> **E2E and Groq's free tier.** The E2E suite intentionally exercises the real LLM (no
> mocking), which costs real tokens: a full run is roughly 13K tokens including the
> background judge calls, against free-tier budgets of ~12K tokens/minute and 100K
> tokens/day for `llama-3.3-70b-versatile` (limits are **per model**). If the day's budget
> is spent, generations stall behind rate-limit retries and tests time out — that's quota,
> not a bug. `GROQ_MODEL=openai/gpt-oss-20b docker compose run --rm e2e` runs the suite
> against a different model's (separate) quota.

<details>
<summary>Local development without Docker (optional — needs Node 22+)</summary>

```bash
npm install
cp .env.example .env        # then fill in GROQ_API_KEY at least
npm run db:migrate          # creates prisma/dev.db and applies the schema
npm run dev                 # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm test` / `npm run test:e2e` | Unit tests / Playwright E2E |
| `npm run test:e2e:demo` | **Demo mode**: opens your real Chrome and visibly clicks through both tests in slow motion |
| `npm run build` / `npm run start` | Production build/run |
| `npm run db:studio` | Browse the SQLite data in Prisma Studio |
| `npm run seed:langfuse-prompts` | Push/update prompts in Langfuse (no-ops without Langfuse env vars) |

</details>

## Architecture

The app follows **Clean Architecture**: dependencies only point inward. `domain` has zero
external dependencies (no Next.js, no Prisma, no LangChain) — it can be unit-tested with
nothing running. `application` orchestrates the domain via **ports** (interfaces); it doesn't
know which concrete LLM, database, or web framework is behind them. `infrastructure` is where
Groq, Prisma, and Langfuse actually get imported. `composition/container.ts` is the *only*
place a concrete adapter and a use case are wired together.

```
src/
  domain/                     # Pure business rules — no I/O
    entities/                 #   Quiz, Question, Option, Response
    value-objects/             #   QuestionType, QuizStatus, JudgeStatus
    schemas/                   #   generatedQuiz.schema.ts — Zod shape for LLM output
    services/                  #   scoring.ts — weighted geometric average

  application/                 # Use cases — orchestrate domain via ports
    ports/                     #   QuizRepository, QuizGenerator, MarkdownFetcher,
                                #   PromptProvider, QuizEvaluator, Tracer, BackgroundScheduler
    strategies/registry.ts     #   single source of truth for generation strategies
    use-cases/                 #   GenerateQuizUseCase, SubmitQuizUseCase, GetQuizUseCase
    dto/                       #   Zod request schemas for the API layer

  infrastructure/               # Adapters implementing the ports
    persistence/prisma/         #   PrismaQuizRepository, client singleton (WAL mode)
    markdown/                   #   HttpMarkdownFetcher — SSRF-guarded fetch + GitHub URL fix-up
    llm/                        #   LangChainGroqGenerator; prompts/ (Langfuse + fallbacks)
    evaluation/                  #   LangChainQuizEvaluator — LLM-as-judge
    observability/               #   LangfuseTracer
    runtime/                     #   NextAfterScheduler — wraps next/server's after()

  composition/container.ts      # Wires adapters to use cases — the only place they meet

  app/                          # Next.js App Router = the "interface" layer
    api/                        #   REST route handlers (thin controllers)
    page.tsx, quiz/[id]/, result/[id]/  # Web UI

  shared/                       # Cross-cutting: env validation, error types

tests/
  unit/                         # Vitest — mirrors src/ (domain, application, infrastructure)
  e2e/                          # Playwright — full browser flow against the real LLM
```

**Why this shape pays off in practice:** `domain/services/scoring.ts` and the Zod schema in
`domain/schemas/` are tested with zero LLM/DB/HTTP (`tests/unit/domain/`). The use cases
are tested against in-memory fakes for every port (`tests/unit/application/fakes.ts`
and its `*.test.ts` neighbors) — no real database or LLM call, still full coverage of the orchestration and
validation logic. Swapping Groq for another provider, or SQLite for Postgres, only touches
`infrastructure/` and `composition/container.ts` — nothing in `domain/` or `application/` changes.

## Data model

SQLite via Prisma (`prisma/schema.prisma`):

```
Quiz
 ├─ id, sourceUrl, topic?, strategy, numQuestions
 ├─ status: GENERATING | READY | COMPLETED
 ├─ finalScore?, finalPercent?        (set once submitted)
 ├─ judgeScore?, judgeStatus?         (set later, async, by the LLM-as-judge)
 └─ questions: Question[]
      ├─ text, type: SINGLE | MULTIPLE, position, weight (Float)
      └─ options: Option[]
           └─ text, isCorrect (Bool), position

Response  (one per question, created only at submission time)
 ├─ quizId, questionId (unique — one response per question)
 ├─ selectedOptionIds: JSON-encoded string[]   (SQLite has no native array type)
 └─ rawScore: Float
```

Notes on the modelling decisions:

- **Weight is stored on the `Question` row, not recomputed at score time.** It's set once,
  at generation time, from the question's position (`weight = 1.1^position`). This makes the
  final score reproducible and auditable straight from the stored rows — you don't need to
  re-derive "was this the 3rd question" from anything else.
- **One `Quiz` row = one run/attempt.** There's no separate `Attempt` table. If multiple
  people needed to take the *same* generated quiz independently, the natural extension is a
  `Attempt` table (`quizId`, `userId`, its own `Response`s, its own final score) sitting
  between `Quiz` and `Response` — deliberately left out here since the task describes a
  single generate → take → score run per quiz.
- **The answer key never reaches the client before submission.** `GET /api/quizzes/:id`
  strips `isCorrect` from every option (`toPublicQuiz` in `domain/entities/Quiz.ts`);
  `POST /api/quizzes/:id/submit` and `GET /api/quizzes/:id/result` are the only places the
  full quiz (with `isCorrect`) is returned, and only once a submission exists.

## Data flow

```
Browser
  │
  ├─ POST /api/quizzes {sourceUrl, topic?, strategy, numQuestions}
  │     └─ GenerateQuizUseCase
  │           1. MarkdownFetcher.fetch(sourceUrl)      — SSRF-checked, GitHub blob URL → raw
  │           2. QuizGenerator.generate(...)            — Groq + LangChain, strict Zod schema
  │           3. QuizRepository.create(...)              — persists Quiz+Question+Option, computes weight
  │           4. schedule(QuizEvaluator.evaluate(...))    — fire-and-forget, via next/server's after()
  │     ← sanitized Quiz (no isCorrect)
  │
  ├─ GET /api/quizzes/:id                                — sanitized Quiz, for rendering the quiz page
  │
  ├─ POST /api/quizzes/:id/submit {answers: [...]}
  │     └─ SubmitQuizUseCase
  │           1. validates every answer's questionId/optionIds actually belong to this quiz
  │           2. rejects >1 selection on a SINGLE question
  │           3. domain scoreQuestion() + computeFinalScore() — pure, no I/O
  │           4. QuizRepository.recordSubmission(...)     — persists Responses, marks COMPLETED
  │     ← full Quiz (answer key revealed) + per-question responses
  │
  └─ GET /api/quizzes/:id/result                          — same shape as submit's response;
        409s if the quiz hasn't been submitted yet
```

The async judge (`QuizEvaluator`, step 4 above) runs **after** the response has already gone
out — it never adds latency to quiz generation. It scores groundedness + strategy fit with its
own Groq call, records the score on the `Quiz` row (`judgeScore`/`judgeStatus`) and, if Langfuse
is configured, as a Langfuse score linked to its own trace. Every failure in this path is caught
and logged, never thrown — nothing is waiting on it.

## Scoring

- **SINGLE-answer question:** 4 points if the one correct option was selected (and nothing
  else), 0 otherwise.
- **MULTIPLE-answer question:** `raw = clamp((#correct selected) − (#incorrect selected), 0, 4)`.
  This is one reasonable reading of the task's "between 0 and 4 — number of correctly selected
  answers" — it penalizes guessing every option. The literal alternative (just count correct
  picks, no penalty for wrong ones) is a one-line change in `domain/services/scoring.ts`.
- **Final score** is the weighted average of every question's raw score, where the weight of
  the *i*-th question (0-indexed) is `1.1^i` — a geometric sequence starting at 1.0, growing
  10% per question. `finalPercent = finalScore / 4`.
- An **unanswered question is treated as a skip (raw score 0)**, not a rejected submission —
  you can submit a partial attempt and every question still contributes to the average.

All of this lives in one pure module, `domain/services/scoring.ts`, with unit tests in
`tests/unit/domain/scoring.test.ts` covering both question types, clamping, and the weighted-average math.

## Strategies

A strategy steers *how* the quiz is generated (e.g. "factual" vs. "conceptual"). They're
defined in one place, `application/strategies/registry.ts`:

```ts
{ id: "factual", label: "Factual", description: "...", promptName: "quiz-strategy-factual" }
```

- **The registry is the single source of truth.** `GET /api/strategies` returns it (the UI's
  dropdown is data-driven, not hardcoded), and the `strategy` field on `POST /api/quizzes` is
  validated against a Zod enum *derived from this array* — an unknown strategy is a `400`.
- **To add a strategy:** add an entry to the registry (and, optionally, create its prompt in
  Langfuse — see below; an in-code fallback covers you if you don't). Nothing else changes.
- **To remove one:** delete the entry. Past quizzes keep their stored `strategy` string for
  history even after that.

**Does a generated quiz "make sense" for its strategy?** Two different, independent checks:

1. **Structural validity — synchronous, blocking.** `domain/schemas/generatedQuiz.schema.ts`
   enforces 5–8 questions, exactly 4 options each, correct-option counts appropriate to the
   question type, no duplicate option text, and **at least one MULTIPLE question** (so the
   multi-answer scoring path is always exercised). `LangChainGroqGenerator` retries generation
   once on a validation failure before giving up — the user can never receive a malformed quiz.
2. **Quality/fit — asynchronous, non-blocking.** The LLM-as-judge (`LangChainQuizEvaluator`)
   scores whether the questions are actually grounded in the source and match the strategy's
   guidance. This runs in the background (see [Data flow](#data-flow)) precisely so a "how good
   is this, really" check never slows down the response.

## Prompts & observability (Langfuse)

Langfuse is **optional** and serves two purposes here — LLM tracing and prompt management —
both of which degrade gracefully:

- **Tracing:** `LangfuseTracer` wraps LangChain's native `CallbackHandler`. When Langfuse env
  vars are unset, `getCallbackHandler()` returns `undefined` and generation runs untraced.
- **Prompts:** all four prompts (`quiz-generation`, `quiz-strategy-mixed/factual/conceptual`,
  `quiz-evaluation`) live in Langfuse Prompt Management as the source of truth, fetched via
  `LangfusePromptProvider`. **Every prompt has an in-code fallback** (`infrastructure/llm/prompts/fallbacks.ts`)
  used automatically if Langfuse is unreachable or a prompt hasn't been created there yet —
  the app is never hard-coupled to Langfuse being up.
- The fetched prompt's **version** is attached to the generation's trace metadata, so you can
  see in Langfuse exactly which prompt version produced which quiz.

**Switching between Langfuse Cloud and self-hosted is a pure env change** — `LANGFUSE_BASEURL`,
`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`. No code changes either way.

To run Langfuse locally (self-hosted Langfuse v2 + its own Postgres — Langfuse cannot use this
app's SQLite file, it needs its own datastore):

```bash
docker compose -f docker-compose.langfuse.yml up -d
# The stack self-provisions on first boot (LANGFUSE_INIT_* in the compose file): user, org,
# project, and API keys — no signup clicking. Put the matching values into .env:
#   LANGFUSE_BASEURL="http://localhost:3001"            # host tools (seed script, npm run dev)
#   LANGFUSE_BASEURL_DOCKER="http://langfuse:3000"      # the Docker app reaches it by service name
#   LANGFUSE_PUBLIC_KEY="pk-lf-quiz-agent-local-demo"
#   LANGFUSE_SECRET_KEY="sk-lf-quiz-agent-local-demo"
docker compose up -d --force-recreate app   # app picks up the env
npm run seed:langfuse-prompts               # idempotent — safe to re-run
# UI: http://localhost:3001 — log in as demo@quiz-agent.local / QuizAgent-Demo-2026
```

Or point the same three env vars at [Langfuse Cloud](https://cloud.langfuse.com) instead —
same seed script, no other changes.

## REST API

| Method | Path | Notes |
|---|---|---|
| `GET`  | `/api/strategies` | Drives the UI's strategy dropdown |
| `POST` | `/api/quizzes` | `{ sourceUrl, topic?, strategy, numQuestions }` → sanitized Quiz |
| `GET`  | `/api/quizzes/:id` | Sanitized Quiz (no answer key) |
| `POST` | `/api/quizzes/:id/submit` | `{ answers: [{questionId, selectedOptionIds}] }` → full result |
| `GET`  | `/api/quizzes/:id/result` | Full result; `409` until submitted |
| `GET`  | `/api/health` | Pings the DB — used by Docker's healthcheck |

Errors are consistent JSON: `{ "error": { "code": "...", "message": "..." } }` with the
matching HTTP status (`400` validation, `404` not found, `409` conflict, `502` upstream/LLM
failure, `500` unexpected).

## Testing

- **Unit** (`npm test`) — pure domain logic: scoring (both question types, clamping, the
  weighted average) and the generated-quiz Zod schema. No LLM, DB, or HTTP.
- **Use-case** (also `npm test`) — `GenerateQuizUseCase` / `SubmitQuizUseCase` against
  in-memory fakes for every port (`tests/unit/application/fakes.ts`). Fast and deterministic;
  this is what demonstrates the payoff of the ports/clean-architecture design — the
  orchestration, validation, and scheduling logic are fully covered without a real database,
  LLM, or web server.
- **E2E** (`docker compose run --rm e2e`, or `npm run test:e2e` locally; needs
  `GROQ_API_KEY`) — Playwright drives the full browser flow (config → generate → answer →
  submit → result) against the **real** Groq LLM, run once for each of the two required
  READMEs (langchainjs first — it's the smaller source, and both tests share the free tier's
  per-minute token window). Because generation is nondeterministic, assertions target
  structure (exact question/option counts, input types, a numeric score), never exact
  wording. Skips cleanly (not a failure) if the key is absent. Consumes real quota — see the
  rate-limit note in [Quick start](#quick-start-docker-only--no-nodenpm-needed-on-the-host).

## Docker

The whole project runs through Docker — see [Quick start](#quick-start-docker-only--no-nodenpm-needed-on-the-host)
for the four commands. How it's put together:

- **One Dockerfile, several targets.** `base` (Node 22 + OpenSSL, which Prisma's engines
  need) → `deps` (npm ci) → `builder` (prisma generate + next build + `npm prune --omit=dev`)
  → `runner` (slim production image, non-root user). A `dev` target backs the `dev`/`test`
  compose services, and an `e2e` target adds Playwright's chromium **on the same Node 22
  base** — deliberately not the official Playwright image, which ships Node 24, where the
  dev server's outbound LLM calls died with "Premature close" during verification. E2E runs
  on the runtime the app actually ships on.
- **Production (`app`)**: migrations apply automatically on container start
  (`docker-entrypoint.sh` runs `prisma migrate deploy` before `next start`); the SQLite file
  lives in the `quiz-data` named volume mounted at `/app/data`, so data survives restarts.
  The image ships without the dev toolchain (`npm prune --omit=dev`; typescript/playwright
  remain as npm-mandated optional peers of prod deps, ~4% of the tree).
- **Dev (`dev` profile)**: your working tree is bind-mounted for hot reload; `node_modules`
  and `.next` stay in container-local volumes.
- **Config**: `GROQ_API_KEY`/`GROQ_MODEL`/`LANGFUSE_*` are interpolated from your shell or
  the `.env` file next to `docker-compose.yml`.

Self-hosted Langfuse is a **separate, optional** compose file
(`docker-compose.langfuse.yml`) — see [above](#prompts--observability-langfuse).

## Judgment calls

A couple of places the task spec was ambiguous enough that a real decision had to be made —
worth surfacing rather than hiding:

- **Multiple-answer scoring**: penalizing wrong picks (`#correct − #incorrect`, clamped) vs.
  literally counting only correct picks. Chosen: penalize, to discourage "select everything."
  One-line swap in `domain/services/scoring.ts` if the literal reading is preferred.
- **One quiz = one attempt** vs. a separate `Attempt` table for multiple people re-taking the
  same generated quiz. Chosen: one run per quiz, for simplicity — see [Data model](#data-model)
  for the natural extension.
