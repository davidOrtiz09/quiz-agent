import type { JudgeStatus, QuizStatus } from "../value-objects/QuizStatus";
import type { PublicQuizQuestion, QuizQuestion } from "./Question";
import type { QuizResponse } from "./Response";

export interface Quiz {
  id: string;
  sourceUrl: string;
  topic: string | null;
  strategy: string;
  numQuestions: number;
  status: QuizStatus;
  finalScore: number | null;
  finalPercent: number | null;
  judgeScore: number | null;
  judgeStatus: JudgeStatus | null;
  createdAt: Date;
  completedAt: Date | null;
  questions: QuizQuestion[];
  /** Empty until the quiz is submitted. */
  responses: QuizResponse[];
}

/** Quiz shape safe to send to the client before submission — no answer key. */
export type PublicQuiz = Omit<Quiz, "questions"> & {
  questions: PublicQuizQuestion[];
};

export function toPublicQuiz(quiz: Quiz): PublicQuiz {
  return {
    ...quiz,
    questions: quiz.questions.map((question) => ({
      ...question,
      options: question.options.map(({ id, text, position }) => ({ id, text, position })),
    })),
  };
}
