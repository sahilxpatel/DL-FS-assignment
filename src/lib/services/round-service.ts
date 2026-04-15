import { Round } from "@prisma/client";
import { z } from "zod";
import {
  computeCombinedSeed,
  computeCommitHex,
  generateNonce,
  generateServerSeed,
} from "@/lib/fairness/hashing";
import { runDeterministicPlinko, DEFAULT_ROWS } from "@/lib/engine/plinko";
import { prisma } from "@/lib/db/prisma";

const commitStatus = "COMMITTED";
const startedStatus = "STARTED";
const revealedStatus = "REVEALED";

function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export const startRoundInputSchema = z.object({
  clientSeed: z.string().trim().min(1).max(128),
  betCents: z.number().int().positive().max(10_000_000),
  dropColumn: z.number().int().min(0).max(12),
});

export type StartRoundInput = z.infer<typeof startRoundInputSchema>;

export async function createRoundCommit() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const serverSeed = generateServerSeed();
  const nonce = generateNonce();
  const commitHex = computeCommitHex(serverSeed, nonce);

  const round = await prisma.round.create({
    data: {
      status: commitStatus,
      nonce,
      commitHex,
      serverSeed,
      clientSeed: "",
      combinedSeed: "",
      pegMapHash: "",
      rows: DEFAULT_ROWS,
      dropColumn: 6,
      binIndex: 0,
      payoutMultiplier: 0,
      betCents: 0,
      pathJson: [],
    },
  });

  return {
    roundId: round.id,
    commitHex: round.commitHex,
    nonce: round.nonce,
  };
}

export async function startRound(id: string, input: StartRoundInput) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const round = await prisma.round.findUnique({ where: { id } });
  if (!round) {
    throw new Error("Round not found");
  }

  if (round.status !== commitStatus || !round.serverSeed) {
    throw new Error("Round is not in committable state");
  }

  const combinedSeed = computeCombinedSeed(round.serverSeed, input.clientSeed, round.nonce);
  const result = runDeterministicPlinko({
    combinedSeed,
    rows: DEFAULT_ROWS,
    dropColumn: input.dropColumn,
  });

  const updated = await prisma.round.update({
    where: { id },
    data: {
      status: startedStatus,
      clientSeed: input.clientSeed,
      betCents: input.betCents,
      dropColumn: input.dropColumn,
      combinedSeed,
      rows: result.rows,
      pegMapHash: result.pegMapHash,
      pathJson: result.path,
      binIndex: result.binIndex,
      payoutMultiplier: result.payoutMultiplier,
    },
  });

  return {
    roundId: updated.id,
    pegMapHash: updated.pegMapHash,
    pegMap: result.pegMap,
    binIndex: updated.binIndex,
    payoutMultiplier: updated.payoutMultiplier,
    path: updated.pathJson,
    rows: updated.rows,
    nonce: updated.nonce,
    commitHex: updated.commitHex,
    combinedSeed: updated.combinedSeed,
    betCents: updated.betCents,
  };
}

export async function revealRound(id: string) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const round = await prisma.round.findUnique({ where: { id } });
  if (!round) {
    throw new Error("Round not found");
  }

  if (!round.serverSeed) {
    throw new Error("Server seed unavailable");
  }

  const updated = await prisma.round.update({
    where: { id },
    data: {
      status: revealedStatus,
      revealedAt: new Date(),
    },
  });

  return {
    roundId: updated.id,
    status: updated.status,
    serverSeed: round.serverSeed,
    revealedAt: updated.revealedAt,
  };
}

export async function getRoundById(id: string): Promise<Round | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const round = await prisma.round.findUnique({ where: { id } });
  if (!round) {
    return null;
  }

  if (round.status !== revealedStatus) {
    return {
      ...round,
      serverSeed: null,
    };
  }

  return round;
}

export async function listRecentRounds(limit = 15) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  return prisma.round.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      status: true,
      commitHex: true,
      nonce: true,
      clientSeed: true,
      pegMapHash: true,
      dropColumn: true,
      binIndex: true,
      payoutMultiplier: true,
      betCents: true,
      revealedAt: true,
    },
  });
}
