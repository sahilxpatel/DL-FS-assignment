import { describe, expect, it } from "vitest";
import { XorShift32 } from "./xorshift32";

describe("xorshift32", () => {
  it("matches deterministic vector for seed=1", () => {
    const prng = new XorShift32(1);
    const values = Array.from({ length: 5 }, () => prng.nextUint32());

    expect(values).toEqual([270369, 67634689, 2647435461, 307599695, 2398689233]);
  });

  it("rand returns values in [0, 1)", () => {
    const prng = new XorShift32(123);
    for (let i = 0; i < 1000; i += 1) {
      const value = prng.rand();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
