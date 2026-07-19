import { GenerateQuizUseCase } from "../application/use-cases/GenerateQuizUseCase";
import { GetQuizUseCase } from "../application/use-cases/GetQuizUseCase";
import { SubmitQuizUseCase } from "../application/use-cases/SubmitQuizUseCase";
import { LangChainQuizEvaluator } from "../infrastructure/evaluation/LangChainQuizEvaluator";
import { LangChainGroqGenerator } from "../infrastructure/llm/LangChainGroqGenerator";
import { LangfusePromptProvider } from "../infrastructure/llm/prompts/LangfusePromptProvider";
import { HttpMarkdownFetcher } from "../infrastructure/markdown/HttpMarkdownFetcher";
import { LangfuseTracer } from "../infrastructure/observability/LangfuseTracer";
import { PrismaQuizRepository } from "../infrastructure/persistence/prisma/PrismaQuizRepository";
import { NextAfterScheduler } from "../infrastructure/runtime/NextAfterScheduler";

export interface Container {
  generateQuiz: GenerateQuizUseCase;
  submitQuiz: SubmitQuizUseCase;
  getQuiz: GetQuizUseCase;
}

let container: Container | undefined;

/**
 * Wires concrete adapters to the ports the use cases depend on. This is the only place in
 * the app where infrastructure classes and use cases are allowed to meet — route handlers
 * should only ever import from here, never construct adapters themselves.
 */
export function getContainer(): Container {
  if (!container) {
    const quizRepository = new PrismaQuizRepository();
    const markdownFetcher = new HttpMarkdownFetcher();
    const promptProvider = new LangfusePromptProvider();
    const tracer = new LangfuseTracer();
    const quizGenerator = new LangChainGroqGenerator(promptProvider, tracer);
    const quizEvaluator = new LangChainQuizEvaluator(promptProvider, quizRepository);
    const backgroundScheduler = new NextAfterScheduler();

    container = {
      generateQuiz: new GenerateQuizUseCase(
        markdownFetcher,
        quizGenerator,
        quizRepository,
        quizEvaluator,
        backgroundScheduler,
      ),
      submitQuiz: new SubmitQuizUseCase(quizRepository),
      getQuiz: new GetQuizUseCase(quizRepository),
    };
  }
  return container;
}
