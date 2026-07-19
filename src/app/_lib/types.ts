export interface Strategy {
  id: string;
  label: string;
  description: string;
  promptName: string;
}

export type QuestionType = "SINGLE" | "MULTIPLE";
export type QuizStatus = "GENERATING" | "READY" | "COMPLETED";

export interface ApiOption {
  id: string;
  text: string;
  position: number;
  /** Present only once the quiz has been submitted (result view). */
  isCorrect?: boolean;
}

export interface ApiQuestion {
  id: string;
  text: string;
  type: QuestionType;
  position: number;
  weight: number;
  options: ApiOption[];
}

export interface ApiQuizResponse {
  id: string;
  quizId: string;
  questionId: string;
  selectedOptionIds: string[];
  rawScore: number;
  createdAt: string;
}

export interface ApiQuiz {
  id: string;
  sourceUrl: string;
  topic: string | null;
  strategy: string;
  numQuestions: number;
  status: QuizStatus;
  finalScore: number | null;
  finalPercent: number | null;
  judgeScore: number | null;
  judgeStatus: string | null;
  createdAt: string;
  completedAt: string | null;
  questions: ApiQuestion[];
  responses: ApiQuizResponse[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
