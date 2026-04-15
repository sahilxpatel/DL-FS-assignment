import { NextRequest, NextResponse } from "next/server";
import { startRound, startRoundInputSchema } from "@/lib/services/round-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const json = await request.json();
    const parsed = startRoundInputSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = await startRound(id, parsed.data);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start round" },
      { status: 400 },
    );
  }
}
