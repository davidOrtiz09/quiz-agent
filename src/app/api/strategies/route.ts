import { NextResponse } from "next/server";
import { STRATEGIES } from "@/application/strategies/registry";

export async function GET() {
  return NextResponse.json({ strategies: STRATEGIES });
}
