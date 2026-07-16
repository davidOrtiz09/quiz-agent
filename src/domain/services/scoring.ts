import type { QuizOption } from "../entities/Option";
import type { QuestionType } from "../value-objects/QuestionType";

export const QUESTION_MAX_SCORE = 4;
export const WEIGHT_GROWTH_RATE = 0.1;

/**
 * Weight for the question at `position` (0-based) in a geometric sequence
 * starting at 1.0 and growing 10% per subsequent question: 1.0, 1.1, 1.21, ...
 */
export function computeWeight(position: number): number {
  return Math.pow(1 + WEIGHT_GROWTH_RATE, position);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Scores a single question against the selected option ids.
 *
 * - SINGLE: 4 points if the one correct option was selected (and nothing else), else 0.
 * - MULTIPLE: (# correct options selected) − (# incorrect options selected), clamped to [0,4].
 *   This penalizes wrong picks rather than only counting correct ones — a deliberate,
 *   documented interpretation of the spec's "number of correctly selected answers".
 */
export function scoreQuestion(
  question: { type: QuestionType; options: QuizOption[] },
  selectedOptionIds: string[],
): number {
  const selected = new Set(selectedOptionIds);

  if (question.type === "SINGLE") {
    const correctOption = question.options.find((option) => option.isCorrect);
    const isExactMatch = selected.size === 1 && correctOption !== undefined && selected.has(correctOption.id);
    return isExactMatch ? QUESTION_MAX_SCORE : 0;
  }

  let correctSelected = 0;
  let incorrectSelected = 0;
  for (const option of question.options) {
    if (!selected.has(option.id)) continue;
    if (option.isCorrect) correctSelected += 1;
    else incorrectSelected += 1;
  }

  return clamp(correctSelected - incorrectSelected, 0, QUESTION_MAX_SCORE);
}

export interface WeightedResult {
  rawScore: number;
  weight: number;
}

/**
 * Final score = weighted average of per-question raw scores, in [0, QUESTION_MAX_SCORE].
 * finalPercent expresses the same value as a 0-1 fraction.
 */
export function computeFinalScore(results: WeightedResult[]): {
  finalScore: number;
  finalPercent: number;
} {
  if (results.length === 0) {
    return { finalScore: 0, finalPercent: 0 };
  }

  const weightedSum = results.reduce((sum, r) => sum + r.rawScore * r.weight, 0);
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  const finalScore = weightedSum / totalWeight;

  return { finalScore, finalPercent: finalScore / QUESTION_MAX_SCORE };
}
