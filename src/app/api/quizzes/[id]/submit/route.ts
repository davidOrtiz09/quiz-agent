import { NextRequest, NextResponse } from "next/server";
import { submitQuizRequestSchema } from "@/application/dto/submitQuiz.dto";
import { getContainer } from "@/composition/container";
import { handleRouteError } from "../../../_lib/handleRouteError";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = submitQuizRequestSchema.parse(body);

    const { submitQuiz } = getContainer();
    const quiz = await submitQuiz.execute({ quizId: id, answers: input.answers });

    // Post-submission, revealing the answer key is expected — this response IS the result view.
    return NextResponse.json(quiz);
  } catch (error) {
    return handleRouteError(error);
  }
}
