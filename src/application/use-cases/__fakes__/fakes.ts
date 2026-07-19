import type { Quiz } from "../../../domain/entities/Quiz";
import type { GeneratedQuiz } from "../../../domain/schemas/generatedQuiz.schema";
import { computeWeight } from "../../../domain/services/scoring";
import type { BackgroundScheduler } from "../../ports/BackgroundScheduler";
import type { MarkdownFetcher } from "../../ports/MarkdownFetcher";
import type { QuizEvaluationInput, QuizEvaluator } from "../../ports/QuizEvaluator";
import type { QuizGenerator, QuizGeneratorInput } from "../../ports/QuizGenerator";
import type { CreateQuizInput, QuizRepository, ScoredResponseInput } from "../../ports/QuizRepository";

export function sampleGeneratedQuiz(): GeneratedQuiz {
  return {
    questions: [
      {
        text: "Which are prime numbers?",
        type: "MULTIPLE",
        options: [
          { text: "2", isCorrect: true },
          { text: "3", isCorrect: true },
          { text: "4", isCorrect: false },
          { text: "6", isCorrect: false },
        ],
      },
      ...Array.from({ length: 4 }, (_, i) => ({
        text: `Question ${i + 2}?`,
        type: "SINGLE" as const,
        options: [
          { text: "A", isCorrect: i % 4 === 0 },
          { text: "B", isCorrect: i % 4 === 1 },
          { text: "C", isCorrect: i % 4 === 2 },
          { text: "D", isCorrect: i % 4 === 3 },
        ],
      })),
    ],
  };
}

export class FakeMarkdownFetcher implements MarkdownFetcher {
  public lastUrl: string | undefined;
  constructor(private readonly content: string = "# Sample content") {}

  async fetch(url: string): Promise<string> {
    this.lastUrl = url;
    return this.content;
  }
}

export class FakeQuizGenerator implements QuizGenerator {
  public lastInput: QuizGeneratorInput | undefined;
  public callCount = 0;

  constructor(private readonly quiz: GeneratedQuiz = sampleGeneratedQuiz()) {}

  async generate(input: QuizGeneratorInput): Promise<GeneratedQuiz> {
    this.lastInput = input;
    this.callCount += 1;
    return this.quiz;
  }
}

export class FakeQuizRepository implements QuizRepository {
  public quizzes = new Map<string, Quiz>();
  private counter = 0;

  async create(input: CreateQuizInput): Promise<Quiz> {
    const id = `quiz-${++this.counter}`;
    const questions = input.generated.questions.map((question, questionIndex) => ({
      id: `${id}-q${questionIndex}`,
      quizId: id,
      text: question.text,
      type: question.type,
      position: questionIndex,
      weight: computeWeight(questionIndex),
      options: question.options.map((option, optionIndex) => ({
        id: `${id}-q${questionIndex}-o${optionIndex}`,
        text: option.text,
        isCorrect: option.isCorrect,
        position: optionIndex,
      })),
    }));

    const quiz: Quiz = {
      id,
      sourceUrl: input.sourceUrl,
      topic: input.topic,
      strategy: input.strategy,
      numQuestions: input.numQuestions,
      status: "READY",
      finalScore: null,
      finalPercent: null,
      judgeScore: null,
      judgeStatus: null,
      createdAt: new Date(0),
      completedAt: null,
      questions,
      responses: [],
    };

    this.quizzes.set(id, quiz);
    return quiz;
  }

  async findById(id: string): Promise<Quiz | null> {
    return this.quizzes.get(id) ?? null;
  }

  async recordSubmission(
    quizId: string,
    responses: ScoredResponseInput[],
    result: { finalScore: number; finalPercent: number },
  ): Promise<Quiz> {
    const quiz = this.quizzes.get(quizId);
    if (!quiz) throw new Error(`Fake repository: quiz ${quizId} not found`);

    const updated: Quiz = {
      ...quiz,
      status: "COMPLETED",
      finalScore: result.finalScore,
      finalPercent: result.finalPercent,
      completedAt: new Date(0),
      responses: responses.map((response, index) => ({
        id: `${quizId}-r${index}`,
        quizId,
        questionId: response.questionId,
        selectedOptionIds: response.selectedOptionIds,
        rawScore: response.rawScore,
        createdAt: new Date(0),
      })),
    };

    this.quizzes.set(quizId, updated);
    return updated;
  }

  async updateJudgeResult(
    quizId: string,
    judgeScore: number | null,
    judgeStatus: "COMPLETED" | "FAILED",
  ): Promise<void> {
    const quiz = this.quizzes.get(quizId);
    if (quiz) this.quizzes.set(quizId, { ...quiz, judgeScore, judgeStatus });
  }
}

export class FakeQuizEvaluator implements QuizEvaluator {
  public calls: QuizEvaluationInput[] = [];

  async evaluate(input: QuizEvaluationInput): Promise<void> {
    this.calls.push(input);
  }
}

export class FakeBackgroundScheduler implements BackgroundScheduler {
  public scheduled: Array<() => Promise<void>> = [];

  schedule(task: () => Promise<void>): void {
    this.scheduled.push(task);
  }

  /** Test helper: actually run everything that was scheduled. */
  async flush(): Promise<void> {
    const tasks = this.scheduled;
    this.scheduled = [];
    await Promise.all(tasks.map((task) => task()));
  }
}
