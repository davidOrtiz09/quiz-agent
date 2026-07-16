export interface QuizResponse {
  id: string;
  quizId: string;
  questionId: string;
  selectedOptionIds: string[];
  rawScore: number;
  createdAt: Date;
}
