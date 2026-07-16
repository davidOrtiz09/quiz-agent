import type { GeneratedQuiz } from "../../domain/schemas/generatedQuiz.schema";

export interface QuizEvaluationInput {
  quizId: string;
  /** Guidance text is resolved by the adapter (via PromptProvider), not the caller. */
  strategyId: string;
  sourceContent: string;
  quiz: GeneratedQuiz;
}

/**
 * LLM-as-judge: scores whether the generated quiz matches the strategy's intent and is
 * grounded in the source content. Intended to run in the background, after the response
 * has already been sent to the user — implementations must not be awaited on the request path.
 */
export interface QuizEvaluator {
  evaluate(input: QuizEvaluationInput): Promise<void>;
}
