export const QUIZ_STATUSES = ["GENERATING", "READY", "COMPLETED"] as const;
export type QuizStatus = (typeof QUIZ_STATUSES)[number];

export const JUDGE_STATUSES = ["PENDING", "COMPLETED", "FAILED"] as const;
export type JudgeStatus = (typeof JUDGE_STATUSES)[number];
