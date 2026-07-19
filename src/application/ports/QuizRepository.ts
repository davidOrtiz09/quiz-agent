import type { Quiz } from "../../domain/entities/Quiz";
import type { GeneratedQuiz } from "../../domain/schemas/generatedQuiz.schema";

export interface CreateQuizInput {
  sourceUrl: string;
  topic: string | null;
  strategy: string;
  numQuestions: number;
  generated: GeneratedQuiz;
}

export interface ScoredResponseInput {
  questionId: string;
  selectedOptionIds: string[];
  rawScore: number;
}

export interface QuizRepository {
  create(input: CreateQuizInput): Promise<Quiz>;
  findById(id: string): Promise<Quiz | null>;
  recordSubmission(
    quizId: string,
    responses: ScoredResponseInput[],
    result: { finalScore: number; finalPercent: number },
  ): Promise<Quiz>;
  /** judgeScore is null when the judge failed to run — distinct from a genuine zero rating. */
  updateJudgeResult(quizId: string, judgeScore: number | null, judgeStatus: "COMPLETED" | "FAILED"): Promise<void>;
}
