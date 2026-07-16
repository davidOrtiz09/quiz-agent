import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/composition/container";
import { ConflictError } from "@/shared/errors";
import { handleRouteError } from "../../../_lib/handleRouteError";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { getQuiz } = getContainer();
    const quiz = await getQuiz.execute(id);

    if (quiz.status !== "COMPLETED") {
      throw new ConflictError("This quiz has not been submitted yet");
    }

    return NextResponse.json(quiz);
  } catch (error) {
    return handleRouteError(error);
  }
}
