import { beforeEach, describe, expect, it } from "vitest";
import { computeFinalScore, scoreQuestion } from "@/domain/services/scoring";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import { FakeQuizRepository, sampleGeneratedQuiz } from "./fakes";
import { SubmitQuizUseCase } from "@/application/use-cases/SubmitQuizUseCase";

async function seedQuiz(repository: FakeQuizRepository) {
  return repository.create({
    sourceUrl: "https://x.com/r.md",
    topic: null,
    strategy: "mixed",
    numQuestions: 5,
    generated: sampleGeneratedQuiz(),
  });
}

describe("SubmitQuizUseCase", () => {
  let repository: FakeQuizRepository;
  let useCase: SubmitQuizUseCase;

  beforeEach(() => {
    repository = new FakeQuizRepository();
    useCase = new SubmitQuizUseCase(repository);
  });

  it("throws NotFoundError for an unknown quiz", async () => {
    await expect(useCase.execute({ quizId: "nope", answers: [] })).rejects.toThrow(NotFoundError);
  });

  it("throws ConflictError when the quiz was already submitted", async () => {
    const quiz = await seedQuiz(repository);
    await useCase.execute({ quizId: quiz.id, answers: [] });

    await expect(useCase.execute({ quizId: quiz.id, answers: [] })).rejects.toThrow(ConflictError);
  });

  it("rejects an answer referencing a question outside the quiz", async () => {
    const quiz = await seedQuiz(repository);
    await expect(
      useCase.execute({ quizId: quiz.id, answers: [{ questionId: "not-a-question", selectedOptionIds: [] }] }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects an answer referencing an option outside the question", async () => {
    const quiz = await seedQuiz(repository);
    const question = quiz.questions[1]; // a SINGLE question
    await expect(
      useCase.execute({
        quizId: quiz.id,
        answers: [{ questionId: question.id, selectedOptionIds: ["bogus-option"] }],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects multiple selections on a SINGLE question", async () => {
    const quiz = await seedQuiz(repository);
    const question = quiz.questions[1]; // SINGLE
    await expect(
      useCase.execute({
        quizId: quiz.id,
        answers: [{ questionId: question.id, selectedOptionIds: question.options.map((o) => o.id) }],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("treats an unanswered question as skipped (score 0) rather than rejecting", async () => {
    const quiz = await seedQuiz(repository);
    const [multiQuestion] = quiz.questions;
    const correctIds = multiQuestion.options.filter((o) => o.isCorrect).map((o) => o.id);

    const result = await useCase.execute({
      quizId: quiz.id,
      answers: [{ questionId: multiQuestion.id, selectedOptionIds: correctIds }],
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.responses).toHaveLength(5);
    const skipped = result.responses.filter((r) => r.questionId !== multiQuestion.id);
    expect(skipped.every((r) => r.rawScore === 0 && r.selectedOptionIds.length === 0)).toBe(true);
  });

  it("scores a best-possible submission (selecting exactly the correct options) correctly", async () => {
    const quiz = await seedQuiz(repository);

    const answers = quiz.questions.map((question) => ({
      questionId: question.id,
      selectedOptionIds: question.options.filter((o) => o.isCorrect).map((o) => o.id),
    }));

    const result = await useCase.execute({ quizId: quiz.id, answers });

    // Independently recompute the expected weighted average from the domain scoring
    // functions rather than hardcoding a number — a MULTIPLE question with 2 correct
    // options out of 4 maxes out at raw score 2, not 4, so "best possible" isn't a flat 4.
    const expected = computeFinalScore(
      quiz.questions.map((question, i) => ({
        rawScore: scoreQuestion(question, answers[i].selectedOptionIds),
        weight: question.weight,
      })),
    );

    expect(result.finalScore).toBeCloseTo(expected.finalScore, 10);
    expect(result.finalPercent).toBeCloseTo(expected.finalPercent, 10);
  });

  it("scores a fully-wrong submission at zero", async () => {
    const quiz = await seedQuiz(repository);

    const answers = quiz.questions.map((question) => ({
      questionId: question.id,
      // For SINGLE questions only one option may be selected, so pick a single wrong one;
      // for MULTIPLE, selecting every incorrect option still nets a raw score of 0.
      selectedOptionIds:
        question.type === "SINGLE"
          ? [question.options.find((o) => !o.isCorrect)!.id]
          : question.options.filter((o) => !o.isCorrect).map((o) => o.id),
    }));

    const result = await useCase.execute({ quizId: quiz.id, answers });

    expect(result.finalScore).toBe(0);
    expect(result.finalPercent).toBe(0);
  });

  it("deduplicates repeated option ids within a single answer", async () => {
    const quiz = await seedQuiz(repository);
    const question = quiz.questions[1]; // SINGLE
    const correctOptionId = question.options.find((o) => o.isCorrect)!.id;

    const result = await useCase.execute({
      quizId: quiz.id,
      answers: [{ questionId: question.id, selectedOptionIds: [correctOptionId, correctOptionId] }],
    });

    const response = result.responses.find((r) => r.questionId === question.id)!;
    expect(response.selectedOptionIds).toEqual([correctOptionId]);
    expect(response.rawScore).toBe(4);
  });
});
