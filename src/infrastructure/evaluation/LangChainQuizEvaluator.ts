import { ChatGroq } from "@langchain/groq";
import { CallbackHandler } from "langfuse-langchain";
import { z } from "zod";
import type { PromptProvider } from "../../application/ports/PromptProvider";
import type { QuizEvaluationInput, QuizEvaluator } from "../../application/ports/QuizEvaluator";
import type { QuizRepository } from "../../application/ports/QuizRepository";
import { getStrategyById } from "../../application/strategies/registry";
import { getEnv, isLangfuseEnabled } from "../../shared/env";
import { QUIZ_EVALUATION_PROMPT_NAME } from "../llm/prompts/fallbacks";

const judgeOutputSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
});

/**
 * LLM-as-judge: scores a freshly-generated quiz for groundedness and strategy fit.
 * Always runs AFTER the quiz has already been persisted and returned to the user (see
 * GenerateQuizUseCase + BackgroundScheduler) — every failure here is caught and logged,
 * never thrown, since nothing downstream is awaiting this result on the request path.
 */
export class LangChainQuizEvaluator implements QuizEvaluator {
  constructor(
    private readonly promptProvider: PromptProvider,
    private readonly quizRepository: QuizRepository,
  ) {}

  async evaluate(input: QuizEvaluationInput): Promise<void> {
    const env = getEnv();
    if (!env.GROQ_API_KEY) {
      return;
    }

    try {
      const strategy = getStrategyById(input.strategyId);
      const strategyPromptHandle = strategy ? await this.promptProvider.getPrompt(strategy.promptName) : undefined;
      const strategyGuidance = strategyPromptHandle?.compile({}) ?? "";

      const judgePromptHandle = await this.promptProvider.getPrompt(QUIZ_EVALUATION_PROMPT_NAME);
      const promptText = judgePromptHandle.compile({
        strategyGuidance,
        content: input.sourceContent,
        quizJson: JSON.stringify(input.quiz),
      });

      const model = new ChatGroq({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, temperature: 0 });
      const structuredModel = model.withStructuredOutput(judgeOutputSchema, { name: "judge_quiz" });

      const handler = isLangfuseEnabled(env)
        ? new CallbackHandler({
            publicKey: env.LANGFUSE_PUBLIC_KEY,
            secretKey: env.LANGFUSE_SECRET_KEY,
            baseUrl: env.LANGFUSE_BASEURL,
            metadata: { quizId: input.quizId, strategyId: input.strategyId, purpose: "quiz-evaluation" },
          })
        : undefined;

      const raw = await structuredModel.invoke(promptText, { callbacks: handler ? [handler] : undefined });
      const { score, reasoning } = judgeOutputSchema.parse(raw);

      if (handler?.traceId) {
        handler.langfuse.score({ traceId: handler.traceId, name: "quiz-quality", value: score, comment: reasoning });
      }
      await handler?.flushAsync();

      await this.quizRepository.updateJudgeResult(input.quizId, score, "COMPLETED");
    } catch (error) {
      console.error(`Quiz evaluation failed for quiz ${input.quizId}`, error);
      await this.quizRepository.updateJudgeResult(input.quizId, null, "FAILED").catch(() => {});
    }
  }
}
