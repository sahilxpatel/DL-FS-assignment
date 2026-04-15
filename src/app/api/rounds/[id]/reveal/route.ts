import { NextResponse } from "next/server";
import { revealRound } from "@/lib/services/round-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const data = await revealRound(id);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reveal round" },
      { status: 400 },
    );
  }
}
