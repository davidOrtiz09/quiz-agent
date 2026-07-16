import { z } from "zod";

export const submitQuizRequestSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      selectedOptionIds: z.array(z.string().min(1)),
    }),
  ),
});

export type SubmitQuizRequest = z.infer<typeof submitQuizRequestSchema>;
