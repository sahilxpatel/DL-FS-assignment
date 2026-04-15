import { first4BytesBigEndianHexToUint32, sha256Hex } from "@/lib/fairness/hashing";
import { XorShift32 } from "@/lib/prng/xorshift32";

export const DEFAULT_ROWS = 12;
export const DEFAULT_PAYOUTS = [8, 5, 3, 2, 1.5, 1.2, 1, 1.2, 1.5, 2, 3, 5, 8] as const;

export type Direction = "L" | "R";

export type Peg = {
  leftBias: number;
};

export type SimulatedRound = {
  rows: number;
  pegMap: Peg[][];
  pegMapHash: string;
  path: Direction[];
  binIndex: number;
  payoutMultiplier: number;
};

function clampUnit(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

export function generatePegMap(prng: XorShift32, rows = DEFAULT_ROWS): Peg[][] {
  const pegMap: Peg[][] = [];

  for (let r = 0; r < rows; r += 1) {
    const row: Peg[] = [];

    for (let c = 0; c <= r; c += 1) {
      const leftBias = 0.5 + (prng.rand() - 0.5) * 0.2;
      row.push({ leftBias: round6(leftBias) });
    }

    pegMap.push(row);
  }

  return pegMap;
}

export function simulateBallPath(
  prng: XorShift32,
  pegMap: Peg[][],
  dropColumn: number,
): { path: Direction[]; binIndex: number } {
  let pos = 0;
  const path: Direction[] = [];

  for (let r = 0; r < pegMap.length; r += 1) {
    const pegIndex = Math.min(pos, r);
    const adj = (dropColumn - 6) * 0.01;
    const leftBias = pegMap[r][pegIndex]?.leftBias ?? 0.5;
    const bias = clampUnit(leftBias + adj);

    if (prng.rand() < bias) {
      path.push("L");
    } else {
      path.push("R");
      pos += 1;
    }
  }

  return { path, binIndex: pos };
}

export function getPayoutMultiplier(binIndex: number): number {
  return DEFAULT_PAYOUTS[binIndex] ?? 1;
}

export function runDeterministicPlinko(input: {
  combinedSeed: string;
  rows?: number;
  dropColumn: number;
}): SimulatedRound {
  const rows = input.rows ?? DEFAULT_ROWS;
  const seed = first4BytesBigEndianHexToUint32(input.combinedSeed);
  const prng = new XorShift32(seed);

  // Important fairness ordering: peg map first, then path decisions.
  const pegMap = generatePegMap(prng, rows);
  const pegMapHash = sha256Hex(JSON.stringify(pegMap));
  const { path, binIndex } = simulateBallPath(prng, pegMap, input.dropColumn);

  return {
    rows,
    pegMap,
    pegMapHash,
    path,
    binIndex,
    payoutMultiplier: getPayoutMultiplier(binIndex),
  };
}
