import { z } from "zod";
import { computeCombinedSeed, computeCommitHex } from "@/lib/fairness/hashing";
import { runDeterministicPlinko } from "@/lib/engine/plinko";

export const verifyInputSchema = z.object({
  serverSeed: z.string().trim().min(1),
  clientSeed: z.string().trim().min(1),
  nonce: z.string().trim().min(1),
  dropColumn: z.number().int().min(0).max(12),
});

export type VerifyInput = z.infer<typeof verifyInputSchema>;

export function verifyRound(input: VerifyInput) {
  const commitHex = computeCommitHex(input.serverSeed, input.nonce);
  const combinedSeed = computeCombinedSeed(input.serverSeed, input.clientSeed, input.nonce);
  const result = runDeterministicPlinko({
    combinedSeed,
    dropColumn: input.dropColumn,
  });

  return {
    commitHex,
    combinedSeed,
    pegMapHash: result.pegMapHash,
    binIndex: result.binIndex,
    payoutMultiplier: result.payoutMultiplier,
    path: result.path,
  };
}
