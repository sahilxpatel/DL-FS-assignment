import { NextResponse } from "next/server";
import { createRoundCommit } from "@/lib/services/round-service";

export async function POST() {
  try {
    const commit = await createRoundCommit();
    return NextResponse.json(commit, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create commit" },
      { status: 500 },
    );
  }
}
