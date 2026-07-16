import { describe, expect, it } from "vitest";
import { ValidationError } from "../../shared/errors";
import {
  FakeBackgroundScheduler,
  FakeMarkdownFetcher,
  FakeQuizEvaluator,
  FakeQuizGenerator,
  FakeQuizRepository,
  sampleGeneratedQuiz,
} from "./__fakes__/fakes";
import { GenerateQuizUseCase } from "./GenerateQuizUseCase";

function makeUseCase(overrides: Partial<{ evaluator: FakeQuizEvaluator; scheduler: FakeBackgroundScheduler }> = {}) {
  const markdownFetcher = new FakeMarkdownFetcher("# Some README content");
  const quizGenerator = new FakeQuizGenerator();
  const quizRepository = new FakeQuizRepository();

  const useCase = new GenerateQuizUseCase(
    markdownFetcher,
    quizGenerator,
    quizRepository,
    overrides.evaluator,
    overrides.scheduler,
  );

  return { useCase, markdownFetcher, quizGenerator, quizRepository };
}

describe("GenerateQuizUseCase", () => {
  it("rejects an unknown strategy id", async () => {
    const { useCase } = makeUseCase();
    await expect(
      useCase.execute({ sourceUrl: "https://x.com/r.md", topic: null, strategyId: "nonsense", numQuestions: 5 }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects numQuestions outside [5,8]", async () => {
    const { useCase } = makeUseCase();
    await expect(
      useCase.execute({ sourceUrl: "https://x.com/r.md", topic: null, strategyId: "mixed", numQuestions: 3 }),
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ sourceUrl: "https://x.com/r.md", topic: null, strategyId: "mixed", numQuestions: 9 }),
    ).rejects.toThrow(ValidationError);
  });

  it("fetches the source, generates, and persists a quiz", async () => {
    const { useCase, markdownFetcher, quizGenerator, quizRepository } = makeUseCase();

    const quiz = await useCase.execute({
      sourceUrl: "https://github.com/org/repo/blob/main/README.md",
      topic: "installation",
      strategyId: "factual",
      numQuestions: 5,
    });

    expect(markdownFetcher.lastUrl).toBe("https://github.com/org/repo/blob/main/README.md");
    expect(quizGenerator.lastInput).toMatchObject({
      numQuestions: 5,
      strategyId: "factual",
      topic: "installation",
      content: "# Some README content",
    });
    expect(quiz.status).toBe("READY");
    expect(quiz.questions).toHaveLength(5);
    expect(quizRepository.quizzes.get(quiz.id)).toBe(quiz);
  });

  it("computes a geometric weight per question position", async () => {
    const { useCase } = makeUseCase();
    const quiz = await useCase.execute({
      sourceUrl: "https://x.com/r.md",
      topic: null,
      strategyId: "mixed",
      numQuestions: 5,
    });

    expect(quiz.questions.map((q) => q.weight)).toEqual([1, 1.1, 1.2100000000000002, 1.3310000000000004, 1.4641000000000006]);
  });

  it("schedules a background evaluation without blocking the result", async () => {
    const evaluator = new FakeQuizEvaluator();
    const scheduler = new FakeBackgroundScheduler();
    const { useCase } = makeUseCase({ evaluator, scheduler });

    const quiz = await useCase.execute({
      sourceUrl: "https://x.com/r.md",
      topic: null,
      strategyId: "conceptual",
      numQuestions: 5,
    });

    // Not awaited by the use case — nothing has run yet.
    expect(evaluator.calls).toHaveLength(0);
    expect(scheduler.scheduled).toHaveLength(1);

    await scheduler.flush();

    expect(evaluator.calls).toHaveLength(1);
    expect(evaluator.calls[0]).toMatchObject({
      quizId: quiz.id,
      strategyId: "conceptual",
      sourceContent: "# Some README content",
      quiz: sampleGeneratedQuiz(),
    });
  });

  it("does not schedule anything when no evaluator/scheduler is configured", async () => {
    const { useCase } = makeUseCase();
    await expect(
      useCase.execute({ sourceUrl: "https://x.com/r.md", topic: null, strategyId: "mixed", numQuestions: 5 }),
    ).resolves.toBeDefined();
  });
});
