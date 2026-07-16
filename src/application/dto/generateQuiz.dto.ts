import { z } from "zod";
import { MAX_QUESTIONS, MIN_QUESTIONS } from "../../domain/schemas/generatedQuiz.schema";
import { strategyIdSchema } from "../strategies/registry";

export const generateQuizRequestSchema = z.object({
  sourceUrl: z.string().url(),
  topic: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  strategy: strategyIdSchema,
  numQuestions: z.number().int().min(MIN_QUESTIONS).max(MAX_QUESTIONS),
});

export type GenerateQuizRequest = z.infer<typeof generateQuizRequestSchema>;
