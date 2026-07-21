import { describe, expect, it } from "vitest";
import { generatedQuizSchema } from "@/domain/schemas/generatedQuiz.schema";

function validQuestion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    text: "What is 2 + 2?",
    type: "SINGLE",
    options: [
      { text: "3", isCorrect: false },
      { text: "4", isCorrect: true },
      { text: "5", isCorrect: false },
      { text: "6", isCorrect: false },
    ],
    ...overrides,
  };
}

function validMultipleQuestion() {
  return {
    text: "Which are prime?",
    type: "MULTIPLE",
    options: [
      { text: "2", isCorrect: true },
      { text: "3", isCorrect: true },
      { text: "4", isCorrect: false },
      { text: "6", isCorrect: false },
    ],
  };
}

function quizWith(questions: unknown[]) {
  return { questions };
}

describe("generatedQuizSchema", () => {
  it("accepts a well-formed quiz with a MULTIPLE question and 5-8 questions", () => {
    const questions = [validMultipleQuestion(), ...Array.from({ length: 4 }, () => validQuestion())];
    const result = generatedQuizSchema.safeParse(quizWith(questions));
    expect(result.success).toBe(true);
  });

  it("rejects fewer than 5 questions", () => {
    const questions = [validMultipleQuestion(), validQuestion(), validQuestion()];
    const result = generatedQuizSchema.safeParse(quizWith(questions));
    expect(result.success).toBe(false);
  });

  it("rejects more than 8 questions", () => {
    const questions = [
      validMultipleQuestion(),
      ...Array.from({ length: 8 }, () => validQuestion()),
    ];
    const result = generatedQuizSchema.safeParse(quizWith(questions));
    expect(result.success).toBe(false);
  });

  it("rejects a quiz with no MULTIPLE question", () => {
    const questions = Array.from({ length: 5 }, () => validQuestion());
    const result = generatedQuizSchema.safeParse(quizWith(questions));
    expect(result.success).toBe(false);
  });

  it("rejects a question without exactly 4 options", () => {
    const badQuestion = validQuestion({
      options: [
        { text: "3", isCorrect: false },
        { text: "4", isCorrect: true },
      ],
    });
    const questions = [validMultipleQuestion(), badQuestion, validQuestion(), validQuestion(), validQuestion()];
    const result = generatedQuizSchema.safeParse(quizWith(questions));
    expect(result.success).toBe(false);
  });

  it("rejects a SINGLE question with zero or multiple correct options", () => {
    const noCorrect = validQuestion({
      options: [
        { text: "3", isCorrect: false },
        { text: "4", isCorrect: false },
        { text: "5", isCorrect: false },
        { text: "6", isCorrect: false },
      ],
    });
    const questions = [validMultipleQuestion(), noCorrect, validQuestion(), validQuestion(), validQuestion()];
    const result = generatedQuizSchema.safeParse(quizWith(questions));
    expect(result.success).toBe(false);
  });

  it("rejects a MULTIPLE question with fewer than 2 or all 4 correct options", () => {
    const allCorrect = {
      text: "All correct?",
      type: "MULTIPLE",
      options: [
        { text: "A", isCorrect: true },
        { text: "B", isCorrect: true },
        { text: "C", isCorrect: true },
        { text: "D", isCorrect: true },
      ],
    };
    const questions = [allCorrect, validQuestion(), validQuestion(), validQuestion(), validQuestion()];
    const result = generatedQuizSchema.safeParse(quizWith(questions));
    expect(result.success).toBe(false);
  });

  it("rejects duplicate option text within a question", () => {
    const dupQuestion = validQuestion({
      options: [
        { text: "Same", isCorrect: true },
        { text: "Same", isCorrect: false },
        { text: "Other", isCorrect: false },
        { text: "Other2", isCorrect: false },
      ],
    });
    const questions = [validMultipleQuestion(), dupQuestion, validQuestion(), validQuestion(), validQuestion()];
    const result = generatedQuizSchema.safeParse(quizWith(questions));
    expect(result.success).toBe(false);
  });
});
