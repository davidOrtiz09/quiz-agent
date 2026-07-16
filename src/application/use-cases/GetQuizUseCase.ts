import type { Quiz } from "../../domain/entities/Quiz";
import { NotFoundError } from "../../shared/errors";
import type { QuizRepository } from "../ports/QuizRepository";

export class GetQuizUseCase {
  constructor(private readonly quizRepository: QuizRepository) {}

  async execute(quizId: string): Promise<Quiz> {
    const quiz = await this.quizRepository.findById(quizId);
    if (!quiz) {
      throw new NotFoundError(`Quiz ${quizId} not found`);
    }
    return quiz;
  }
}
