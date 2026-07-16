import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/composition/container";
import { toPublicQuiz } from "@/domain/entities/Quiz";
import { handleRouteError } from "../../_lib/handleRouteError";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { getQuiz } = getContainer();
    const quiz = await getQuiz.execute(id);
    return NextResponse.json(toPublicQuiz(quiz));
  } catch (error) {
    return handleRouteError(error);
  }
}
