import { describe, expect, it } from "vitest";
import type { QuizOption } from "@/domain/entities/Option";
import { computeFinalScore, computeWeight, QUESTION_MAX_SCORE, scoreQuestion } from "@/domain/services/scoring";

function makeOptions(correctFlags: boolean[]): QuizOption[] {
  return correctFlags.map((isCorrect, i) => ({
    id: `opt-${i}`,
    text: `Option ${i}`,
    isCorrect,
    position: i,
  }));
}

describe("computeWeight", () => {
  it("starts at 1.0 for the first question", () => {
    expect(computeWeight(0)).toBe(1);
  });

  it("grows 10% per subsequent question (geometric sequence)", () => {
    expect(computeWeight(1)).toBeCloseTo(1.1, 10);
    expect(computeWeight(2)).toBeCloseTo(1.21, 10);
    expect(computeWeight(3)).toBeCloseTo(1.331, 10);
  });
});

describe("scoreQuestion — SINGLE", () => {
  const options = makeOptions([false, true, false, false]);
  const question = { type: "SINGLE" as const, options };

  it("awards full marks for selecting exactly the correct option", () => {
    expect(scoreQuestion(question, ["opt-1"])).toBe(QUESTION_MAX_SCORE);
  });

  it("awards zero for selecting a wrong option", () => {
    expect(scoreQuestion(question, ["opt-0"])).toBe(0);
  });

  it("awards zero when nothing is selected", () => {
    expect(scoreQuestion(question, [])).toBe(0);
  });

  it("awards zero when the correct option is selected alongside another", () => {
    expect(scoreQuestion(question, ["opt-1", "opt-2"])).toBe(0);
  });
});

describe("scoreQuestion — MULTIPLE", () => {
  // 2 correct (opt-0, opt-1), 2 incorrect (opt-2, opt-3)
  const options = makeOptions([true, true, false, false]);
  const question = { type: "MULTIPLE" as const, options };

  it("awards (correct selected − incorrect selected) when both correct options are picked", () => {
    expect(scoreQuestion(question, ["opt-0", "opt-1"])).toBe(2);
  });

  it("penalizes an extra wrong pick", () => {
    expect(scoreQuestion(question, ["opt-0", "opt-1", "opt-2"])).toBe(1);
  });

  it("clamps to zero rather than going negative", () => {
    expect(scoreQuestion(question, ["opt-0", "opt-2", "opt-3"])).toBe(0);
  });

  it("awards zero for an empty selection", () => {
    expect(scoreQuestion(question, [])).toBe(0);
  });

  it("clamps to QUESTION_MAX_SCORE even if more than 4 correct options existed", () => {
    const manyCorrect = makeOptions([true, true, true, true, true]);
    const manyCorrectQuestion = { type: "MULTIPLE" as const, options: manyCorrect };
    expect(
      scoreQuestion(
        manyCorrectQuestion,
        manyCorrect.map((o) => o.id),
      ),
    ).toBe(QUESTION_MAX_SCORE);
  });
});

describe("computeFinalScore", () => {
  it("returns 0/0 for no results", () => {
    expect(computeFinalScore([])).toEqual({ finalScore: 0, finalPercent: 0 });
  });

  it("returns the raw score directly for a single question", () => {
    const result = computeFinalScore([{ rawScore: 4, weight: 1 }]);
    expect(result.finalScore).toBe(4);
    expect(result.finalPercent).toBe(1);
  });

  it("computes the weighted average across a geometric weight sequence", () => {
    const weights = [computeWeight(0), computeWeight(1), computeWeight(2)];
    const rawScores = [4, 0, 4];
    const results = rawScores.map((rawScore, i) => ({ rawScore, weight: weights[i] }));

    const expectedWeightedSum = rawScores.reduce((sum, raw, i) => sum + raw * weights[i], 0);
    const expectedTotalWeight = weights.reduce((sum, w) => sum + w, 0);
    const expectedFinalScore = expectedWeightedSum / expectedTotalWeight;

    const { finalScore, finalPercent } = computeFinalScore(results);
    expect(finalScore).toBeCloseTo(expectedFinalScore, 10);
    expect(finalPercent).toBeCloseTo(expectedFinalScore / QUESTION_MAX_SCORE, 10);
  });
});
