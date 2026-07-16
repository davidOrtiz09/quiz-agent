export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  position: number;
}

/** Same as QuizOption but without the answer key — safe to send to the client pre-submit. */
export type PublicQuizOption = Omit<QuizOption, "isCorrect">;
