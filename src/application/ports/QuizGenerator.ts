import type { GeneratedQuiz } from "../../domain/schemas/generatedQuiz.schema";

export interface QuizGeneratorInput {
  content: string;
  numQuestions: number;
  /** Resolved (guidance text fetched from the strategy's prompt) by the adapter, not the caller. */
  strategyId: string;
  topic: string | null;
}

export interface QuizGenerator {
  generate(input: QuizGeneratorInput): Promise<GeneratedQuiz>;
}
