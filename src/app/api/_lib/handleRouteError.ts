import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors";

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.flatten() } },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
  }

  console.error("Unhandled route error", error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 });
}
