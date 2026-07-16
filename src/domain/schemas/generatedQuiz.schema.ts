import { z } from "zod";
import { QUESTION_TYPES } from "../value-objects/QuestionType";

export const MIN_QUESTIONS = 5;
export const MAX_QUESTIONS = 8;
export const OPTIONS_PER_QUESTION = 4;

const generatedOptionSchema = z.object({
  text: z.string().trim().min(1).max(280),
  isCorrect: z.boolean(),
});

export const generatedQuestionSchema = z
  .object({
    text: z.string().trim().min(1).max(500),
    type: z.enum(QUESTION_TYPES),
    options: z.array(generatedOptionSchema).length(OPTIONS_PER_QUESTION),
  })
  .superRefine((question, ctx) => {
    const correctCount = question.options.filter((option) => option.isCorrect).length;

    const normalizedTexts = question.options.map((option) => option.text.toLowerCase());
    if (new Set(normalizedTexts).size !== normalizedTexts.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Options must have distinct text",
        path: ["options"],
      });
    }

    if (question.type === "SINGLE" && correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SINGLE questions must have exactly one correct option",
        path: ["options"],
      });
    }

    if (question.type === "MULTIPLE" && (correctCount < 2 || correctCount > OPTIONS_PER_QUESTION - 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MULTIPLE questions must have between 2 and 3 correct options",
        path: ["options"],
      });
    }
  });

export const generatedQuizSchema = z
  .object({
    questions: z.array(generatedQuestionSchema).min(MIN_QUESTIONS).max(MAX_QUESTIONS),
  })
  .superRefine((quiz, ctx) => {
    const hasMultiple = quiz.questions.some((question) => question.type === "MULTIPLE");
    if (!hasMultiple) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quiz must include at least one MULTIPLE question",
        path: ["questions"],
      });
    }
  });

export type GeneratedOption = z.infer<typeof generatedOptionSchema>;
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GeneratedQuiz = z.infer<typeof generatedQuizSchema>;
