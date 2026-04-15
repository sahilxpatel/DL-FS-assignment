import { createHash, randomBytes } from "crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generateServerSeed(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function generateNonce(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export function computeCommitHex(serverSeed: string, nonce: string): string {
  return sha256Hex(`${serverSeed}:${nonce}`);
}

export function computeCombinedSeed(
  serverSeed: string,
  clientSeed: string,
  nonce: string,
): string {
  return sha256Hex(`${serverSeed}:${clientSeed}:${nonce}`);
}

export function first4BytesBigEndianHexToUint32(hex: string): number {
  const normalized = hex.trim().toLowerCase();
  const head = normalized.slice(0, 8).padEnd(8, "0");
  return Number.parseInt(head, 16) >>> 0;
}
