import { describe, expect, it } from "vitest";
import { computeCombinedSeed, computeCommitHex, first4BytesBigEndianHexToUint32 } from "@/lib/fairness/hashing";
import { generatePegMap, runDeterministicPlinko } from "./plinko";
import { XorShift32 } from "@/lib/prng/xorshift32";

const serverSeed = "b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc";
const nonce = "42";
const clientSeed = "candidate-hello";

describe("assignment reference vector", () => {
  it("matches commit and combined seed", () => {
    expect(computeCommitHex(serverSeed, nonce)).toBe(
      "bb9acdc67f3f18f3345236a01f0e5072596657a9005c7d8a22cff061451a6b34",
    );

    expect(computeCombinedSeed(serverSeed, clientSeed, nonce)).toBe(
      "e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0",
    );
  });

  it("matches xorshift32 first five rand values", () => {
    const combinedSeed = computeCombinedSeed(serverSeed, clientSeed, nonce);
    const seed = first4BytesBigEndianHexToUint32(combinedSeed);
    const prng = new XorShift32(seed);

    const first5 = Array.from({ length: 5 }, () => prng.rand());
    const expected = [0.1106166649, 0.7625129214, 0.0439292176, 0.4578678815, 0.3438999297];

    first5.forEach((value, idx) => {
      expect(value).toBeCloseTo(expected[idx], 8);
    });
  });

  it("matches peg map starter rows and center outcome", () => {
    const combinedSeed = computeCombinedSeed(serverSeed, clientSeed, nonce);
    const seed = first4BytesBigEndianHexToUint32(combinedSeed);
    const prng = new XorShift32(seed);

    const pegMap = generatePegMap(prng, 12);

    expect(pegMap[0].map((p) => p.leftBias)).toEqual([0.422123]);
    expect(pegMap[1].map((p) => p.leftBias)).toEqual([0.552503, 0.408786]);
    expect(pegMap[2].map((p) => p.leftBias)).toEqual([0.491574, 0.46878, 0.43654]);

    const round = runDeterministicPlinko({ combinedSeed, rows: 12, dropColumn: 6 });
    expect(round.binIndex).toBe(6);
  });
});
