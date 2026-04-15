import { NextRequest, NextResponse } from "next/server";
import { listRecentRounds } from "@/lib/services/round-service";

export async function GET(request: NextRequest) {
  try {
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 15;
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 15;

    const rounds = await listRecentRounds(safeLimit);
    return NextResponse.json({ rounds }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list rounds" },
      { status: 500 },
    );
  }
}
