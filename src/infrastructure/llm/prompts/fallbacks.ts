export const QUIZ_GENERATION_PROMPT_NAME = "quiz-generation";
export const QUIZ_EVALUATION_PROMPT_NAME = "quiz-evaluation";

/**
 * In-code defaults for every prompt used by the app. Keys must match both the Langfuse
 * prompt `name` used elsewhere (LangChainGroqGenerator, application/strategies/registry.ts)
 * and the name passed to PromptProvider.getPrompt(). These are used whenever Langfuse is
 * unreachable or a prompt hasn't been created there yet — the app never hard-fails on a
 * missing/unavailable Langfuse instance.
 */
export const FALLBACK_PROMPTS: Record<string, string> = {
  [QUIZ_GENERATION_PROMPT_NAME]: `You are an expert quiz author. Read the SOURCE MATERIAL below and write a multiple-choice quiz that tests real understanding of it.

Requirements:
- Write exactly {{numQuestions}} questions.
- Every question has exactly 4 answer options.
- Most questions are single-answer (type "SINGLE", exactly one correct option).
- At least one question must be multi-answer (type "MULTIPLE", with 2 or 3 correct options out of 4).
- Every question and every option must be grounded in the SOURCE MATERIAL — never invent facts.
- Distractors (incorrect options) must be plausible, not silly or obviously wrong.
- Do not repeat the same fact across multiple questions.
{{topicInstruction}}

Strategy for this quiz: {{strategyGuidance}}

SOURCE MATERIAL:
"""
{{content}}
"""`,

  "quiz-strategy-mixed": `Produce a balanced mix of factual-recall questions (specific facts, names, commands, configuration keys) and conceptual questions (why something exists, how pieces relate, when to use a feature).`,

  "quiz-strategy-factual": `Focus on concrete, specific facts stated in the document: exact names, commands, configuration keys, version numbers, or steps in a process. Avoid vague conceptual questions.`,

  "quiz-strategy-conceptual": `Focus on understanding: why the project or feature exists, how its components relate to each other, trade-offs, and when you'd use one approach over another. Avoid trivial fact lookups.`,

  [QUIZ_EVALUATION_PROMPT_NAME]: `You are a strict QA reviewer for an auto-generated multiple-choice quiz.

Strategy this quiz was supposed to follow: {{strategyGuidance}}

Judge the quiz below against two criteria:
1. Groundedness — every question and its correct answer(s) must be verifiably supported by the SOURCE MATERIAL, with no invented facts.
2. Strategy fit — the questions should match the strategy guidance above.

Respond with a score from 0.0 (completely fails both criteria) to 1.0 (fully grounded and on-strategy), plus a short one-sentence reasoning.

SOURCE MATERIAL:
"""
{{content}}
"""

QUIZ (JSON):
{{quizJson}}`,
};
