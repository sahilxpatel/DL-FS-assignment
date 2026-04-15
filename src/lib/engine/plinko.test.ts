import { describe, expect, it } from "vitest";
import { runDeterministicPlinko } from "./plinko";

describe("plinko engine", () => {
  it("replays deterministically with same inputs", () => {
    const input = {
      combinedSeed: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      dropColumn: 6,
      rows: 12,
    };

    const one = runDeterministicPlinko(input);
    const two = runDeterministicPlinko(input);

    expect(one.pegMapHash).toBe(two.pegMapHash);
    expect(one.path).toEqual(two.path);
    expect(one.binIndex).toBe(two.binIndex);
    expect(one.payoutMultiplier).toBe(two.payoutMultiplier);
  });

  it("changes outputs when drop column changes", () => {
    const baseSeed = "0000000000000000000000000000000000000000000000000000000000000001";

    const left = runDeterministicPlinko({ combinedSeed: baseSeed, dropColumn: 1, rows: 12 });
    const right = runDeterministicPlinko({ combinedSeed: baseSeed, dropColumn: 11, rows: 12 });

    expect(left.path).not.toEqual(right.path);
    expect(left.binIndex).not.toBe(right.binIndex);
  });
});
