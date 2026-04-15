export class XorShift32 {
  private state: number;

  constructor(seed: number) {
    // xorshift32 gets stuck at 0 forever, so move to deterministic non-zero fallback.
    this.state = (seed >>> 0) || 0x6d2b79f5;
  }

  nextUint32(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  rand(): number {
    return this.nextUint32() / 0x100000000;
  }
}
