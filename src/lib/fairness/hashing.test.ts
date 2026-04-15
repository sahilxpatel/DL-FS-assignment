import { describe, expect, it } from "vitest";
import { computeCombinedSeed, computeCommitHex, sha256Hex } from "./hashing";

describe("hashing", () => {
  it("computes SHA256 hex correctly", () => {
    expect(sha256Hex("hello")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("computes commit and combined seeds", () => {
    const serverSeed = "server";
    const clientSeed = "client";
    const nonce = "nonce";

    expect(computeCommitHex(serverSeed, nonce)).toBe(
      "5599a84431a1d5fe41bd74fab6855c27a2ad89123072bb4c2541dcccd598df7a",
    );

    expect(computeCombinedSeed(serverSeed, clientSeed, nonce)).toBe(
      "c1e3d8db33b5b01e414106c2646e6dde8b176cb1767314caff86c6253fd36c60",
    );
  });
});
