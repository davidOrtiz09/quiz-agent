import { ChatGroq } from "@langchain/groq";
import type { PromptProvider } from "../../application/ports/PromptProvider";
import type { QuizGenerator, QuizGeneratorInput } from "../../application/ports/QuizGenerator";
import type { Tracer } from "../../application/ports/Tracer";
import { getStrategyById } from "../../application/strategies/registry";
import { generatedQuizSchema, type GeneratedQuiz } from "../../domain/schemas/generatedQuiz.schema";
import { getEnv } from "../../shared/env";
import { UpstreamError, ValidationError } from "../../shared/errors";
import { QUIZ_GENERATION_PROMPT_NAME } from "./prompts/fallbacks";

const MAX_VALIDATION_ATTEMPTS = 3;

/**
 * Groq occasionally emits *almost*-valid tool-call syntax (a stray token or unbalanced
 * brace), which its parser rejects with a 400 `tool_use_failed`. That's a bad generation,
 * not a transport problem — the right response is to regenerate, exactly like a schema
 * miss. (The SDK layer correctly does NOT retry 400s on its own.)
 */
function isToolUseFailure(error: unknown): boolean {
  const message = (error as Error | undefined)?.message ?? "";
  return message.includes("tool_use_failed");
}

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

    // Retries live in ONE place: the LangChain/groq-sdk layer, which honors Groq's
    // retry-after on 429s. (Its default of 6 attempts stacks badly with rate limits —
    // a single throttled generation could hide behind minutes of silent sleeping.)
    const model = new ChatGroq({
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
      temperature: 0.4,
      maxRetries: 2,
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

    try {
      for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
        let raw: unknown;
        try {
          raw = await structuredModel.invoke(promptText, {
            callbacks: callbackHandler ? [callbackHandler] : undefined,
          });
        } catch (error) {
          if (isToolUseFailure(error)) {
            lastValidationError = error;
            continue;
          }
          // Log the full provider error server-side, but never leak its raw body to the client.
          console.error("Quiz generation upstream failure", error);
          throw new UpstreamError("Quiz generation failed — the language model provider returned an error");
        }

        const parsed = generatedQuizSchema.safeParse(raw);
        if (parsed.success) {
          // The schema only enforces the generic 5-8 range; the user asked for an exact count.
          if (parsed.data.questions.length === input.numQuestions) {
            return parsed.data;
          }
          lastValidationError = new Error(
            `LLM returned ${parsed.data.questions.length} questions, expected ${input.numQuestions}`,
          );
          continue;
        }
        lastValidationError = parsed.error;
      }

      console.error(`Quiz generation produced no valid quiz after ${MAX_VALIDATION_ATTEMPTS} attempts`, lastValidationError);
      throw new ValidationError(
        `The model could not produce a valid quiz after ${MAX_VALIDATION_ATTEMPTS} attempts — please try again`,
      );
    } finally {
      // Flush now rather than relying on Langfuse's background timer, so traces are visible
      // immediately (useful both for the live demo and for the async judge that follows).
      await this.tracer?.flush();
    }
  }
}
