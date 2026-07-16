import { ChatGroq } from "@langchain/groq";
import type { PromptProvider } from "../../application/ports/PromptProvider";
import type { QuizGenerator, QuizGeneratorInput } from "../../application/ports/QuizGenerator";
import type { Tracer } from "../../application/ports/Tracer";
import { getStrategyById } from "../../application/strategies/registry";
import { generatedQuizSchema, type GeneratedQuiz } from "../../domain/schemas/generatedQuiz.schema";
import { getEnv } from "../../shared/env";
import { UpstreamError, ValidationError } from "../../shared/errors";
import { isRetryableLlmError, retryWithBackoff } from "../../shared/retry";
import { QUIZ_GENERATION_PROMPT_NAME } from "./prompts/fallbacks";

const MAX_VALIDATION_ATTEMPTS = 2;

export class LangChainGroqGenerator implements QuizGenerator {
  constructor(
    private readonly promptProvider: PromptProvider,
    private readonly tracer?: Tracer,
  ) {}

  async generate(input: QuizGeneratorInput): Promise<GeneratedQuiz> {
    const env = getEnv();
    if (!env.GROQ_API_KEY) {
      throw new UpstreamError("GROQ_API_KEY is not configured");
    }

    const strategy = getStrategyById(input.strategyId);
    if (!strategy) {
      throw new ValidationError(`Unknown strategy: ${input.strategyId}`);
    }

    const [promptHandle, strategyPromptHandle] = await Promise.all([
      this.promptProvider.getPrompt(QUIZ_GENERATION_PROMPT_NAME),
      this.promptProvider.getPrompt(strategy.promptName),
    ]);
    const strategyGuidance = strategyPromptHandle.compile({});

    const topicInstruction = input.topic ? `Focus the quiz specifically on: ${input.topic}.` : "";

    const promptText = promptHandle.compile({
      numQuestions: String(input.numQuestions),
      topicInstruction,
      strategyGuidance,
      content: input.content,
    });

    const model = new ChatGroq({
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
      temperature: 0.4,
    });

    const structuredModel = model.withStructuredOutput(generatedQuizSchema, {
      name: "generate_quiz",
    });

    const callbackHandler = this.tracer?.getCallbackHandler({
      strategyId: input.strategyId,
      numQuestions: input.numQuestions,
      promptName: QUIZ_GENERATION_PROMPT_NAME,
      promptVersion: promptHandle.version,
      promptSource: promptHandle.source,
      model: env.GROQ_MODEL,
    });

    let lastValidationError: unknown;

    for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
      let raw: unknown;
      try {
        raw = await retryWithBackoff(
          () =>
            structuredModel.invoke(promptText, {
              callbacks: callbackHandler ? [callbackHandler] : undefined,
            }),
          { retries: 2, isRetryable: isRetryableLlmError },
        );
      } catch (error) {
        throw new UpstreamError(`Quiz generation failed: ${(error as Error).message}`);
      }

      const parsed = generatedQuizSchema.safeParse(raw);
      if (parsed.success) {
        return parsed.data;
      }
      lastValidationError = parsed.error;
    }

    throw new ValidationError(
      `LLM produced an invalid quiz shape after ${MAX_VALIDATION_ATTEMPTS} attempt(s)`,
      lastValidationError,
    );
  }
}
