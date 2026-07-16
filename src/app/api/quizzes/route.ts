import { NextRequest, NextResponse } from "next/server";
import { generateQuizRequestSchema } from "@/application/dto/generateQuiz.dto";
import { getContainer } from "@/composition/container";
import { toPublicQuiz } from "@/domain/entities/Quiz";
import { handleRouteError } from "../_lib/handleRouteError";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = generateQuizRequestSchema.parse(body);

    const { generateQuiz } = getContainer();
    const quiz = await generateQuiz.execute({
      sourceUrl: input.sourceUrl,
      topic: input.topic,
      strategyId: input.strategy,
      numQuestions: input.numQuestions,
    });

    return NextResponse.json(toPublicQuiz(quiz), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
