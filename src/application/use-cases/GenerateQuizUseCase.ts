import type { Quiz } from "../../domain/entities/Quiz";
import { MAX_QUESTIONS, MIN_QUESTIONS } from "../../domain/schemas/generatedQuiz.schema";
import { ValidationError } from "../../shared/errors";
import type { BackgroundScheduler } from "../ports/BackgroundScheduler";
import type { MarkdownFetcher } from "../ports/MarkdownFetcher";
import type { QuizEvaluator } from "../ports/QuizEvaluator";
import type { QuizGenerator } from "../ports/QuizGenerator";
import type { QuizRepository } from "../ports/QuizRepository";
import { isValidStrategyId } from "../strategies/registry";

export interface GenerateQuizInput {
  sourceUrl: string;
  topic: string | null;
  strategyId: string;
  numQuestions: number;
}

export class GenerateQuizUseCase {
  constructor(
    private readonly markdownFetcher: MarkdownFetcher,
    private readonly quizGenerator: QuizGenerator,
    private readonly quizRepository: QuizRepository,
    private readonly quizEvaluator?: QuizEvaluator,
    private readonly backgroundScheduler?: BackgroundScheduler,
  ) {}

  async execute(input: GenerateQuizInput): Promise<Quiz> {
    if (!isValidStrategyId(input.strategyId)) {
      throw new ValidationError(`Unknown strategy: ${input.strategyId}`);
    }
    if (
      !Number.isInteger(input.numQuestions) ||
      input.numQuestions < MIN_QUESTIONS ||
      input.numQuestions > MAX_QUESTIONS
    ) {
      throw new ValidationError(`numQuestions must be an integer between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}`);
    }

    const content = await this.markdownFetcher.fetch(input.sourceUrl);

    const generated = await this.quizGenerator.generate({
      content,
      numQuestions: input.numQuestions,
      strategyId: input.strategyId,
      topic: input.topic,
    });

    const quiz = await this.quizRepository.create({
      sourceUrl: input.sourceUrl,
      topic: input.topic,
      strategy: input.strategyId,
      numQuestions: input.numQuestions,
      generated,
    });

    // Fire-and-forget: quality scoring must never add latency to quiz generation.
    if (this.quizEvaluator && this.backgroundScheduler) {
      const evaluator = this.quizEvaluator;
      const quizId = quiz.id;
      const strategyId = input.strategyId;
      this.backgroundScheduler.schedule(() =>
        evaluator.evaluate({ quizId, strategyId, sourceContent: content, quiz: generated }),
      );
    }

    return quiz;
  }
}
