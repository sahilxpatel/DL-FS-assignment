import { NextRequest, NextResponse } from "next/server";
import { verifyInputSchema, verifyRound } from "@/lib/services/verify-service";

function parseVerifyQuery(request: NextRequest) {
  return {
    serverSeed: request.nextUrl.searchParams.get("serverSeed") ?? "",
    clientSeed: request.nextUrl.searchParams.get("clientSeed") ?? "",
    nonce: request.nextUrl.searchParams.get("nonce") ?? "",
    dropColumn: Number(request.nextUrl.searchParams.get("dropColumn") ?? NaN),
  };
}

export async function GET(request: NextRequest) {
  const parsed = verifyInputSchema.safeParse(parseVerifyQuery(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = verifyRound(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify round" },
      { status: 400 },
    );
  }
}
