---
name: add-strategy
description: Add a new question-generation strategy to the quiz app (registry entry + prompt fallback + verification). Use when asked to add, create, or register a new quiz strategy, or to remove one.
---

# Add a quiz-generation strategy

A strategy has two halves: an **identity** in the registry and a **behavior** (guidance text
injected into the generation prompt as `{{strategyGuidance}}`). Adding one is a two-file
change; everything else — `GET /api/strategies`, the request-validation Zod enum, the UI
dropdown, generation, and the LLM-judge — derives from the registry automatically.

Expected input: a strategy idea (e.g. "code-focused: questions about the code snippets").
If only a name is given, write a sensible `description` and guidance text yourself and show
them to the user in the summary.

## Steps

1. **Derive the identifiers.**
   - `id`: kebab-case, short (e.g. `code-focused`).
   - `promptName`: always `quiz-strategy-<id>` (this naming convention is what links the
     registry to Langfuse Prompt Management and to the in-code fallback).

2. **Append the identity** to the `STRATEGIES` array in
   `src/application/strategies/registry.ts`:

   ```ts
   {
     id: "<id>",
     label: "<Human Label>",
     description: "<one sentence shown under the UI dropdown>",
     promptName: "quiz-strategy-<id>",
   },
   ```

3. **Append the behavior** to `FALLBACK_PROMPTS` in
   `src/infrastructure/llm/prompts/fallbacks.ts` (key must equal `promptName`):

   ```ts
   "quiz-strategy-<id>": `<2-4 sentences of imperative guidance for the quiz author LLM:
   what to focus on, what to avoid. Mirror the tone of the existing strategy prompts.>`,
   ```

   Every prompt MUST have a fallback here — `LangfusePromptProvider` throws on a prompt
   name with no registered fallback.

4. **Verify** (all three, in order):
   - `npx tsc --noEmit` — catches a malformed entry.
   - `npx vitest run` — the suite must stay green.
   - Prove the cascade: with the dev server running (`npm run dev` or the Docker dev
     service), `curl -s localhost:3000/api/strategies` must list the new id, and a
     `POST /api/quizzes` with a bogus strategy must 400 while the new id is accepted.
     If no server can be run, state that this step was skipped.

5. **Optional — push to Langfuse.** If `LANGFUSE_*` env vars are set in `.env`, run
   `npm run seed:langfuse-prompts` (idempotent) so the new prompt is editable/versioned in
   Langfuse. Skip silently otherwise — the in-code fallback covers it.

6. **Summarize** for the user: the two entries as written, the verification results, and a
   reminder that wording tweaks later can be done in Langfuse without a deploy.

## Removing a strategy

Delete its entry from `STRATEGIES` (optionally its fallback too). Do NOT touch historical
data — `Quiz.strategy` is stored as a plain string precisely so past quizzes keep their
label after the registry entry is gone. Re-run the same verification.

## Cautions

- Never edit `STRATEGY_IDS` or `strategyIdSchema` by hand — they derive from the array.
- Keep the seed set intact unless removal is explicitly requested: `mixed` is the UI's
  default selection (first entry in the array).
- Guidance text steers question *style*; it must not contradict the structural rules in the
  main prompt (question counts, 4 options, at least one MULTIPLE) — don't restate them either.
