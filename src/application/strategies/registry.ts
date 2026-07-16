export interface StrategyDefinition {
  id: string;
  label: string;
  description: string;
  /** Langfuse prompt name holding this strategy's guidance text (with an in-code fallback). */
  promptName: string;
}

/**
 * Single source of truth for question-generation strategies.
 *
 * To add a strategy: append an entry here (and optionally create its Langfuse prompt —
 * `LangfusePromptProvider` falls back to `fallbackGuidance` in infrastructure/llm/prompts
 * if it isn't found). The API, request validation, and the UI dropdown all read from
 * this array — nothing else needs to change.
 *
 * To remove a strategy: delete its entry. Existing quizzes keep their stored `strategy`
 * string for history even if the entry is later removed.
 */
export const STRATEGIES: StrategyDefinition[] = [
  {
    id: "mixed",
    label: "Mixed",
    description: "A balanced mix of factual recall and conceptual understanding questions.",
    promptName: "quiz-strategy-mixed",
  },
  {
    id: "factual",
    label: "Factual",
    description: "Focuses on concrete facts, names, and specifics stated in the document.",
    promptName: "quiz-strategy-factual",
  },
  {
    id: "conceptual",
    label: "Conceptual",
    description: "Focuses on understanding concepts, purpose, and how pieces fit together.",
    promptName: "quiz-strategy-conceptual",
  },
];

export const STRATEGY_IDS = STRATEGIES.map((s) => s.id) as [string, ...string[]];

export function getStrategyById(id: string): StrategyDefinition | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

export function isValidStrategyId(id: string): boolean {
  return getStrategyById(id) !== undefined;
}
