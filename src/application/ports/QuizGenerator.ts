import type { GeneratedQuiz } from "../../domain/schemas/generatedQuiz.schema";

export interface QuizGeneratorInput {
  content: string;
  numQuestions: number;
  strategyId: string;
  strategyGuidance: string;
  topic: string | null;
}

export interface QuizGenerator {
  generate(input: QuizGeneratorInput): Promise<GeneratedQuiz>;
}
