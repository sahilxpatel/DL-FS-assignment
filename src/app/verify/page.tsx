"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PlinkoBoard } from "@/components/plinko-board";
import { DEFAULT_ROWS } from "@/lib/engine/plinko";

type VerifyApiResponse = {
  commitHex: string;
  combinedSeed: string;
  pegMapHash: string;
  binIndex: number;
  payoutMultiplier: number;
  path: Array<"L" | "R">;
};

type RoundResponse = {
  id: string;
  commitHex: string;
  combinedSeed: string;
  pegMapHash: string;
  binIndex: number;
};

const REPLAY_ROWS = 12;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

async function requestJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(data.error ?? `Request failed: ${res.status}`));
  }
  return data as T;
}

export default function VerifyPage() {
  const [serverSeed, setServerSeed] = useState("");
  const [clientSeed, setClientSeed] = useState("player-seed");
  const [nonce, setNonce] = useState("");
  const [dropColumn, setDropColumn] = useState(6);
  const [roundId, setRoundId] = useState("");
  const [forceMotion, setForceMotion] = useState(false);

  const [result, setResult] = useState<VerifyApiResponse | null>(null);
  const [storedRound, setStoredRound] = useState<RoundResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [replayStep, setReplayStep] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const motionEnabled = !prefersReducedMotion || forceMotion;
  const replayLimit = result ? result.path.length + 1 : 0;

  const playReplay = useCallback(() => {
    if (!result) {
      return;
    }

    if (!motionEnabled) {
      setReplayStep(replayLimit);
      setReplaying(false);
      return;
    }

    setReplayStep(0);
    setReplaying(true);
  }, [result, replayLimit, motionEnabled]);

  useEffect(() => {
    if (!result) {
      setReplayStep(0);
      setReplaying(false);
      return;
    }

    playReplay();
  }, [result, playReplay]);

  useEffect(() => {
    if (!replaying || replayLimit === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setReplayStep((prev) => {
        const next = prev + 1;
        if (next >= replayLimit) {
          window.clearInterval(timer);
          setReplaying(false);
        }
        return Math.min(next, replayLimit);
      });
    }, 170);

    return () => window.clearInterval(timer);
  }, [replaying, replayLimit]);

  const commitMatch = result && storedRound ? result.commitHex === storedRound.commitHex : null;
  const combinedMatch = result && storedRound ? result.combinedSeed === storedRound.combinedSeed : null;
  const pegHashMatch = result && storedRound ? result.pegMapHash === storedRound.pegMapHash : null;
  const binMatch = result && storedRound ? result.binIndex === storedRound.binIndex : null;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStoredRound(null);
    setLoading(true);

    try {
      const verify = await requestJson<VerifyApiResponse>(
        `/api/verify?serverSeed=${encodeURIComponent(serverSeed)}&clientSeed=${encodeURIComponent(clientSeed)}&nonce=${encodeURIComponent(nonce)}&dropColumn=${dropColumn}`,
      );
      setResult(verify);

      if (roundId.trim()) {
        const round = await requestJson<RoundResponse>(`/api/rounds/${encodeURIComponent(roundId.trim())}`);
        setStoredRound(round);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-8">
      <header className="glass-panel rounded-2xl px-5 py-4">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Provably Fair Verifier</p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-cyan-50">Round Verifier</h1>
          <Link href="/" className="neon-btn rounded-lg px-3 py-2 text-sm">
            Back To Game
          </Link>
        </div>
      </header>

      <form onSubmit={onSubmit} className="glass-panel grid gap-4 rounded-2xl p-5 md:grid-cols-2">
        <label className="text-sm text-cyan-100/85">
          Server Seed
          <input
            className="mt-1 w-full rounded-lg border border-cyan-200/20 bg-slate-900/70 px-3 py-2 text-cyan-100 outline-none ring-cyan-300/40 focus:ring"
            value={serverSeed}
            onChange={(e) => setServerSeed(e.target.value)}
            required
          />
        </label>

        <label className="text-sm text-cyan-100/85">
          Client Seed
          <input
            className="mt-1 w-full rounded-lg border border-cyan-200/20 bg-slate-900/70 px-3 py-2 text-cyan-100 outline-none ring-cyan-300/40 focus:ring"
            value={clientSeed}
            onChange={(e) => setClientSeed(e.target.value)}
            required
          />
        </label>

        <label className="text-sm text-cyan-100/85">
          Nonce
          <input
            className="mt-1 w-full rounded-lg border border-cyan-200/20 bg-slate-900/70 px-3 py-2 text-cyan-100 outline-none ring-cyan-300/40 focus:ring"
            value={nonce}
            onChange={(e) => setNonce(e.target.value)}
            required
          />
        </label>

        <label className="text-sm text-cyan-100/85">
          Drop Column (0-12)
          <input
            type="number"
            min={0}
            max={12}
            className="mt-1 w-full rounded-lg border border-cyan-200/20 bg-slate-900/70 px-3 py-2 text-cyan-100 outline-none ring-cyan-300/40 focus:ring"
            value={dropColumn}
            onChange={(e) => setDropColumn(Number(e.target.value))}
            required
          />
        </label>

        <label className="text-sm text-cyan-100/85 md:col-span-2">
          Optional Stored Round ID (for ✅/❌ comparison)
          <input
            className="mt-1 w-full rounded-lg border border-cyan-200/20 bg-slate-900/70 px-3 py-2 text-cyan-100 outline-none ring-cyan-300/40 focus:ring"
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            placeholder="cuid from game round"
          />
        </label>

        <button
          type="submit"
          className="gold-btn rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50 md:col-span-2"
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify"}
        </button>

        {error ? <p className="text-sm text-rose-300 md:col-span-2">{error}</p> : null}
      </form>

      {result ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="glass-panel rounded-2xl p-5 text-sm text-cyan-100/90">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-cyan-50">Computed Output</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-200/70">
                  Deterministic replay result
                </p>
              </div>
              <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-100">
                Bin {result.binIndex}
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm">
              <div className="grid gap-1 rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3 md:grid-cols-[9rem_minmax(0,1fr)] md:items-start md:gap-4">
                <span className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">commitHex</span>
                <span className="break-all text-cyan-50">{result.commitHex}</span>
              </div>
              <div className="grid gap-1 rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3 md:grid-cols-[9rem_minmax(0,1fr)] md:items-start md:gap-4">
                <span className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">combinedSeed</span>
                <span className="break-all text-cyan-50">{result.combinedSeed}</span>
              </div>
              <div className="grid gap-1 rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3 md:grid-cols-[9rem_minmax(0,1fr)] md:items-start md:gap-4">
                <span className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">pegMapHash</span>
                <span className="break-all text-cyan-50">{result.pegMapHash}</span>
              </div>
              <div className="grid gap-1 rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3 md:grid-cols-[9rem_minmax(0,1fr)] md:items-start md:gap-4">
                <span className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">path</span>
                <span className="font-mono tracking-[0.28em] text-cyan-50">{result.path.join("")}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              <div className="rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">binIndex</p>
                <p className="mt-1 text-lg font-semibold text-cyan-50">{result.binIndex}</p>
              </div>
              <div className="rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">payout</p>
                <p className="mt-1 text-lg font-semibold text-cyan-50">{result.payoutMultiplier.toFixed(2)}x</p>
              </div>
              <div className="rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">steps</p>
                <p className="mt-1 text-lg font-semibold text-cyan-50">{result.path.length}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 text-sm text-cyan-100/90">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium text-cyan-50">Replay</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-200/70">
                  Path visualization
                </p>
              </div>
              <div className="flex items-center gap-2">
                {prefersReducedMotion ? (
                  <button
                    type="button"
                    onClick={() => setForceMotion((prev) => !prev)}
                    className={`rounded-md px-3 py-1.5 text-xs ${forceMotion ? "gold-btn" : "neon-btn"}`}
                  >
                    Motion: {forceMotion ? "On" : "Reduced"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={playReplay}
                  className="neon-btn rounded-md px-3 py-1.5 text-xs"
                >
                  Replay Path
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-cyan-300/25 bg-slate-950/45 p-3">
              <PlinkoBoard
                rows={DEFAULT_ROWS}
                dropColumn={dropColumn}
                path={result.path}
                animating={replaying}
                currentStep={replayStep}
                reducedMotion={!motionEnabled}
                goldenBall={false}
              />
            </div>
          </div>
        </section>
      ) : null}

      {storedRound && result ? (
        <section className="glass-panel rounded-2xl p-5 text-sm text-cyan-100/90">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-cyan-50">Stored Round Comparison</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-200/70">
                Live round vs stored record
              </p>
            </div>
            <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-100">
              {commitMatch && combinedMatch && pegHashMatch && binMatch ? "All matched" : "Mismatch detected"}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">commitHex</p>
              <p className="mt-2 text-lg font-semibold text-cyan-50">{commitMatch ? "✅" : "❌"}</p>
            </div>
            <div className="rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">combinedSeed</p>
              <p className="mt-2 text-lg font-semibold text-cyan-50">{combinedMatch ? "✅" : "❌"}</p>
            </div>
            <div className="rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">pegMapHash</p>
              <p className="mt-2 text-lg font-semibold text-cyan-50">{pegHashMatch ? "✅" : "❌"}</p>
            </div>
            <div className="rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">binIndex</p>
              <p className="mt-2 text-lg font-semibold text-cyan-50">{binMatch ? "✅" : "❌"}</p>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
