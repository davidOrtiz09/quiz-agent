import type {
  CreateQuizInput,
  QuizRepository,
  ScoredResponseInput,
} from "../../../application/ports/QuizRepository";
import type { Quiz } from "../../../domain/entities/Quiz";
import { computeWeight } from "../../../domain/services/scoring";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { ConflictError } from "../../../shared/errors";
import { prisma as defaultClient } from "./client";

const quizWithRelationsInclude = {
  questions: {
    orderBy: { position: "asc" },
    include: {
      options: { orderBy: { position: "asc" } },
    },
  },
  responses: true,
} satisfies Prisma.QuizInclude;

type QuizWithRelations = Prisma.QuizGetPayload<{ include: typeof quizWithRelationsInclude }>;

function toDomainQuiz(row: QuizWithRelations): Quiz {
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    topic: row.topic,
    strategy: row.strategy,
    numQuestions: row.numQuestions,
    status: row.status,
    finalScore: row.finalScore,
    finalPercent: row.finalPercent,
    judgeScore: row.judgeScore,
    judgeStatus: row.judgeStatus,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    questions: row.questions.map((question) => ({
      id: question.id,
      quizId: question.quizId,
      text: question.text,
      type: question.type,
      position: question.position,
      weight: question.weight,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
        position: option.position,
      })),
    })),
    responses: row.responses.map((response) => ({
      id: response.id,
      quizId: response.quizId,
      questionId: response.questionId,
      selectedOptionIds: JSON.parse(response.selectedOptionIds) as string[],
      rawScore: response.rawScore,
      createdAt: response.createdAt,
    })),
  };
}

export class PrismaQuizRepository implements QuizRepository {
  constructor(private readonly client: PrismaClient = defaultClient) {}

  async create(input: CreateQuizInput): Promise<Quiz> {
    const created = await this.client.quiz.create({
      data: {
        sourceUrl: input.sourceUrl,
        topic: input.topic,
        strategy: input.strategy,
        numQuestions: input.numQuestions,
        // Generation already completed synchronously by the time we persist —
        // GENERATING is reserved for a future async-generation flow.
        status: "READY",
        questions: {
          create: input.generated.questions.map((question, questionIndex) => ({
            text: question.text,
            type: question.type,
            position: questionIndex,
            weight: computeWeight(questionIndex),
            options: {
              create: question.options.map((option, optionIndex) => ({
                text: option.text,
                isCorrect: option.isCorrect,
                position: optionIndex,
              })),
            },
          })),
        },
      },
      include: quizWithRelationsInclude,
    });

    return toDomainQuiz(created);
  }

  async findById(id: string): Promise<Quiz | null> {
    const row = await this.client.quiz.findUnique({
      where: { id },
      include: quizWithRelationsInclude,
    });

    return row ? toDomainQuiz(row) : null;
  }

  async recordSubmission(
    quizId: string,
    responses: ScoredResponseInput[],
    result: { finalScore: number; finalPercent: number },
  ): Promise<Quiz> {
    try {
      await this.client.$transaction([
        this.client.response.createMany({
          data: responses.map((response) => ({
            quizId,
            questionId: response.questionId,
            selectedOptionIds: JSON.stringify(response.selectedOptionIds),
            rawScore: response.rawScore,
          })),
        }),
        this.client.quiz.update({
          where: { id: quizId },
          data: {
            status: "COMPLETED",
            finalScore: result.finalScore,
            finalPercent: result.finalPercent,
            completedAt: new Date(),
          },
        }),
      ]);
    } catch (error) {
      // Two concurrent submits can both pass the use case's status check; the loser hits the
      // Response.questionId unique constraint (P2002). Surface that as a 409, not a 500.
      if ((error as { code?: string })?.code === "P2002") {
        throw new ConflictError("This quiz has already been submitted");
      }
      throw error;
    }

    const updated = await this.client.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: quizWithRelationsInclude,
    });

    return toDomainQuiz(updated);
  }

  async updateJudgeResult(
    quizId: string,
    judgeScore: number | null,
    judgeStatus: "COMPLETED" | "FAILED",
  ): Promise<void> {
    await this.client.quiz.update({
      where: { id: quizId },
      data: { judgeScore, judgeStatus },
    });
  }
}
