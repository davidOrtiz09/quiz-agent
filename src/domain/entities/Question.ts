import type { QuestionType } from "../value-objects/QuestionType";
import type { PublicQuizOption, QuizOption } from "./Option";

export interface QuizQuestion {
  id: string;
  quizId: string;
  text: string;
  type: QuestionType;
  position: number;
  weight: number;
  options: QuizOption[];
}

export type PublicQuizQuestion = Omit<QuizQuestion, "options"> & {
  options: PublicQuizOption[];
};
