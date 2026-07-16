import type { Quiz } from "../../domain/entities/Quiz";
import { computeFinalScore, scoreQuestion } from "../../domain/services/scoring";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import type { QuizRepository, ScoredResponseInput } from "../ports/QuizRepository";

export interface SubmitQuizAnswer {
  questionId: string;
  selectedOptionIds: string[];
}

export interface SubmitQuizInput {
  quizId: string;
  answers: SubmitQuizAnswer[];
}

export class SubmitQuizUseCase {
  constructor(private readonly quizRepository: QuizRepository) {}

  async execute(input: SubmitQuizInput): Promise<Quiz> {
    const quiz = await this.quizRepository.findById(input.quizId);
    if (!quiz) {
      throw new NotFoundError(`Quiz ${input.quizId} not found`);
    }
    if (quiz.status === "COMPLETED") {
      throw new ConflictError("This quiz has already been submitted");
    }

    const questionById = new Map(quiz.questions.map((question) => [question.id, question]));
    const answerByQuestionId = new Map(input.answers.map((answer) => [answer.questionId, answer]));

    for (const answer of input.answers) {
      const question = questionById.get(answer.questionId);
      if (!question) {
        throw new ValidationError(`Question ${answer.questionId} does not belong to this quiz`);
      }

      const validOptionIds = new Set(question.options.map((option) => option.id));
      for (const selectedId of answer.selectedOptionIds) {
        if (!validOptionIds.has(selectedId)) {
          throw new ValidationError(`Option ${selectedId} does not belong to question ${answer.questionId}`);
        }
      }

      const uniqueSelected = new Set(answer.selectedOptionIds);
      if (question.type === "SINGLE" && uniqueSelected.size > 1) {
        throw new ValidationError(
          `Question ${answer.questionId} is single-answer but multiple options were selected`,
        );
      }
    }

    // Any question with no submitted answer is treated as skipped (scores 0), not rejected —
    // this keeps partial submissions valid while every question still contributes to the average.
    const responses: ScoredResponseInput[] = quiz.questions.map((question) => {
      const answer = answerByQuestionId.get(question.id);
      const selectedOptionIds = answer ? Array.from(new Set(answer.selectedOptionIds)) : [];
      const rawScore = scoreQuestion(question, selectedOptionIds);
      return { questionId: question.id, selectedOptionIds, rawScore };
    });

    const weighted = quiz.questions.map((question, index) => ({
      rawScore: responses[index].rawScore,
      weight: question.weight,
    }));
    const { finalScore, finalPercent } = computeFinalScore(weighted);

    return this.quizRepository.recordSubmission(quiz.id, responses, { finalScore, finalPercent });
  }
}
