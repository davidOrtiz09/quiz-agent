import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/client";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
