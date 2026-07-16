export const QUESTION_TYPES = ["SINGLE", "MULTIPLE"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
