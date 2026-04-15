"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlinkoBoard } from "@/components/plinko-board";
import { DEFAULT_ROWS } from "@/lib/engine/plinko";

type StartResponse = {
  roundId: string;
  pegMapHash: string;
  pegMap: Array<Array<{ leftBias: number }>>;
  binIndex: number;
  payoutMultiplier: number;
  path: Array<"L" | "R">;
  rows: number;
  nonce: string;
  commitHex: string;
  combinedSeed: string;
  betCents: number;
};

type RevealResponse = {
  roundId: string;
  status: string;
  serverSeed: string;
  revealedAt: string;
};

type RecentRound = {
  id: string;
  status: string;
  createdAt: string;
  commitHex: string;
  nonce: string;
  clientSeed: string;
  pegMapHash: string;
  dropColumn: number;
  binIndex: number;
  payoutMultiplier: number;
  betCents: number;
};

type ConfettiPiece = {
  id: number;
  left: number;
  top: number;
  delay: number;
  color: string;
};

const CONFETTI_COLORS = ["#22d3ee", "#fde047", "#f97316", "#38bdf8", "#f43f5e"];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(data.error ?? `Request failed: ${res.status}`));
  }

  return data as T;
}

function createConfetti(): ConfettiPiece[] {
  return Array.from({ length: 48 }).map((_, idx) => ({
    id: idx,
    left: Math.floor(Math.random() * 92) + 4,
    top: Math.floor(Math.random() * 28) + 26,
    delay: Number((Math.random() * 0.35).toFixed(2)),
    color: CONFETTI_COLORS[idx % CONFETTI_COLORS.length],
  }));
}

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

export default function Home() {
  const [dropColumn, setDropColumn] = useState(6);
  const [betCents, setBetCents] = useState(100);
  const [clientSeed, setClientSeed] = useState("player-seed");
  const [soundOn, setSoundOn] = useState(true);
  const [goldenBall, setGoldenBall] = useState(false);

  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastRound, setLastRound] = useState<StartResponse | null>(null);
  const [reveal, setReveal] = useState<RevealResponse | null>(null);
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [landingBinIndex, setLandingBinIndex] = useState<number | null>(null);
  const [landingPulseKey, setLandingPulseKey] = useState(0);

  const prefersReducedMotion = usePrefersReducedMotion();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastCelebratedRoundRef = useRef<string | null>(null);

  const refreshRecent = useCallback(async () => {
    try {
      const data = await requestJson<{ rounds: RecentRound[] }>("/api/rounds/recent?limit=12");
      setRecentRounds(data.rounds);
    } catch {
      setRecentRounds([]);
    }
  }, []);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    if (landingBinIndex === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      setLandingBinIndex(null);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [landingBinIndex, landingPulseKey]);

  useEffect(() => {
    if (confetti.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setConfetti([]);
    }, prefersReducedMotion ? 700 : 1200);

    return () => window.clearTimeout(timer);
  }, [confetti, prefersReducedMotion]);

  useEffect(() => {
    if (!soundOn || !animating || prefersReducedMotion) {
      return;
    }

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(goldenBall ? 640 : 520, now);
    
    // Smooth ADSR envelope to prevent clicks and guarantee correct application
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }, [animating, soundOn, goldenBall, currentStep, prefersReducedMotion]);

  useEffect(() => {
    if (!soundOn || prefersReducedMotion || animating || !lastRound) {
      return;
    }

    if (lastCelebratedRoundRef.current === lastRound.roundId) {
      return;
    }

    lastCelebratedRoundRef.current = lastRound.roundId;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    const ctx = audioCtxRef.current;
    const startAt = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];

    notes.forEach((freq, idx) => {
      const time = startAt + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.4, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.22);
    });
  }, [soundOn, prefersReducedMotion, animating, lastRound]);

  const payoutCents = useMemo(() => {
    if (!lastRound) {
      return 0;
    }
    return Math.round(lastRound.betCents * lastRound.payoutMultiplier);
  }, [lastRound]);

  const runAnimation = useCallback(async (pathLen: number) => {
    if (prefersReducedMotion) {
      setAnimating(false);
      setCurrentStep(pathLen);
      return;
    }

    setAnimating(true);
    setCurrentStep(0);

    await new Promise<void>((resolve) => {
      let step = 0;
      const timer = window.setInterval(() => {
        step += 1;
        setCurrentStep(step);
        if (step >= pathLen) {
          window.clearInterval(timer);
          resolve();
        }
      }, 210);
    });

    setAnimating(false);
  }, [prefersReducedMotion]);

  const dropBall = useCallback(async () => {
    if (soundOn && typeof window !== "undefined" && !prefersReducedMotion) {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    }

    setError(null);
    setReveal(null);
    setConfetti([]);
    setLandingBinIndex(null);
    setLoading(true);

    try {
      const commit = await requestJson<{ roundId: string; commitHex: string; nonce: string }>(
        "/api/rounds/commit",
        { method: "POST" },
      );

      const result = await requestJson<StartResponse>(`/api/rounds/${commit.roundId}/start`, {
        method: "POST",
        body: JSON.stringify({
          clientSeed,
          betCents,
          dropColumn,
        }),
      });

      setLastRound(result);
      await runAnimation(result.path.length + 1);

      setLandingBinIndex(result.binIndex);
      setLandingPulseKey((prev) => prev + 1);

      if (!prefersReducedMotion) {
        setConfetti(createConfetti());
      }

      await refreshRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drop failed");
    } finally {
      setLoading(false);
    }
  }, [clientSeed, betCents, dropColumn, runAnimation, refreshRecent, prefersReducedMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        setDropColumn((prev) => Math.max(prev - 1, 0));
      }

      if (event.key === "ArrowRight") {
        setDropColumn((prev) => Math.min(prev + 1, 12));
      }

      if ((event.key === "Enter" || event.code === "Space") && !loading && !animating) {
        event.preventDefault();
        void dropBall();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dropBall, loading, animating]);

  const revealRound = useCallback(async () => {
    if (!lastRound) {
      return;
    }

    setError(null);
    try {
      const data = await requestJson<RevealResponse>(`/api/rounds/${lastRound.roundId}/reveal`, {
        method: "POST",
      });
      setReveal(data);
      await refreshRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reveal failed");
    }
  }, [lastRound, refreshRecent]);

  const resetBoard = useCallback(() => {
    setAnimating(false);
    setCurrentStep(0);
    setLastRound(null);
    setReveal(null);
    setConfetti([]);
    setLandingBinIndex(null);
    setError(null);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-5 md:px-8">
      <header className="glass-panel stagger flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Provably Fair Arcade</p>
          <h1 className="text-2xl font-semibold text-cyan-50 md:text-3xl">Plinko Lab</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/verify" className="neon-btn rounded-lg px-4 py-2">
            Verify Round
          </Link>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 ${soundOn ? "gold-btn" : "neon-btn"}`}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              if (next && typeof window !== "undefined" && !prefersReducedMotion) {
                if (!audioCtxRef.current) {
                  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                  if (AudioCtx) audioCtxRef.current = new AudioCtx();
                }
                if (audioCtxRef.current?.state === "suspended") {
                  audioCtxRef.current.resume().catch(() => {});
                }
              }
            }}
          >
            Sound: {soundOn ? "On" : "Off"}
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="glass-panel stagger rounded-2xl p-4 md:p-6" style={{ animationDelay: "90ms" }}>
          <div className="relative">
            <PlinkoBoard
              rows={DEFAULT_ROWS}
              dropColumn={dropColumn}
              path={lastRound?.path ?? []}
              animating={animating}
              currentStep={currentStep}
              reducedMotion={prefersReducedMotion}
              goldenBall={goldenBall}
              landingBinIndex={landingBinIndex}
              landingPulseKey={landingPulseKey}
            />

            {landingBinIndex !== null ? (
              <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-cyan-200/70 bg-cyan-300/25 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.55)]">
                Landed: Bin {landingBinIndex}
              </div>
            ) : null}

            {confetti.map((piece) => (
              <span
                key={piece.id}
                className="pointer-events-none absolute z-10 block h-4 w-4 rounded-sm"
                style={{
                  left: `${piece.left}%`,
                  top: `${piece.top}%`,
                  backgroundColor: piece.color,
                  animation: prefersReducedMotion
                    ? undefined
                    : `confetti-fall 900ms ease-out ${piece.delay}s forwards`,
                }}
              />
            ))}
          </div>
        </div>

        <aside className="glass-panel stagger flex flex-col gap-4 rounded-2xl p-4 md:p-5" style={{ animationDelay: "140ms" }}>
          <label className="text-sm text-cyan-100/80">
            Client Seed
            <input
              className="mt-1 w-full rounded-lg border border-cyan-200/20 bg-slate-900/70 px-3 py-2 text-cyan-100 outline-none ring-cyan-300/40 focus:ring"
              value={clientSeed}
              onChange={(e) => setClientSeed(e.target.value)}
            />
          </label>

          <label className="text-sm text-cyan-100/80">
            Bet (cents)
            <input
              type="number"
              min={1}
              max={10000000}
              className="mt-1 w-full rounded-lg border border-cyan-200/20 bg-slate-900/70 px-3 py-2 text-cyan-100 outline-none ring-cyan-300/40 focus:ring"
              value={betCents}
              onChange={(e) => setBetCents(Math.max(Number(e.target.value) || 1, 1))}
            />
          </label>

          <div className="text-sm text-cyan-100/80">
            Column: <span className="font-medium text-cyan-50">{dropColumn}</span>
            <input
              type="range"
              min={0}
              max={12}
              className="mt-2 w-full accent-cyan-300"
              value={dropColumn}
              onChange={(e) => setDropColumn(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-cyan-200/70">Keyboard: Left/Right arrows adjust column.</p>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs">
            <button
              type="button"
              className={`rounded-md px-3 py-2 ${goldenBall ? "gold-btn" : "neon-btn"}`}
              onClick={() => setGoldenBall((prev) => !prev)}
            >
              Golden Ball
            </button>
          </div>

          <button
            type="button"
            disabled={loading || animating}
            onClick={dropBall}
            className="gold-btn rounded-lg px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Dropping..." : "Drop Ball"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={resetBoard}
            className="neon-btn rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset Board
          </button>

          <button
            type="button"
            disabled={!lastRound || loading}
            onClick={revealRound}
            className="neon-btn rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reveal Server Seed
          </button>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          {lastRound ? (
            <div className="rounded-xl border border-cyan-300/25 bg-slate-950/45 p-3 text-xs text-cyan-100/90">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Latest Round</p>
                <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
                  Bin {lastRound.binIndex}
                </span>
              </div>

              <dl className="space-y-2">
                <div className="grid grid-cols-[5.3rem_minmax(0,1fr)] gap-2">
                  <dt className="text-cyan-200/70">Round</dt>
                  <dd className="font-mono break-all text-cyan-50">{lastRound.roundId}</dd>
                </div>
                <div className="grid grid-cols-[5.3rem_minmax(0,1fr)] gap-2">
                  <dt className="text-cyan-200/70">Commit</dt>
                  <dd className="font-mono break-all text-cyan-50">{lastRound.commitHex}</dd>
                </div>
                <div className="grid grid-cols-[5.3rem_minmax(0,1fr)] gap-2">
                  <dt className="text-cyan-200/70">Nonce</dt>
                  <dd className="font-mono break-all text-cyan-50">{lastRound.nonce}</dd>
                </div>
                <div className="grid grid-cols-[5.3rem_minmax(0,1fr)] gap-2">
                  <dt className="text-cyan-200/70">Peg hash</dt>
                  <dd className="font-mono break-all text-cyan-50">{lastRound.pegMapHash}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <p className="text-cyan-200/70">Multiplier</p>
                    <p className="text-sm font-semibold text-cyan-50">{lastRound.payoutMultiplier.toFixed(2)}x</p>
                  </div>
                  <div>
                    <p className="text-cyan-200/70">Payout</p>
                    <p className="text-sm font-semibold text-cyan-50">${(payoutCents / 100).toFixed(2)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-[5.3rem_minmax(0,1fr)] gap-2 border-t border-cyan-300/15 pt-2">
                  <dt className="text-cyan-200/70">Server seed</dt>
                  <dd className="font-mono break-all text-cyan-50">
                    {reveal ? reveal.serverSeed : "hidden until reveal"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="glass-panel stagger rounded-2xl p-4 md:p-5" style={{ animationDelay: "180ms" }}>
        <h2 className="mb-3 text-lg font-medium text-cyan-50">Recent Rounds</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-xs text-cyan-100/85">
            <thead>
              <tr className="text-cyan-200/75">
                <th className="px-2">Round</th>
                <th className="px-2">Status</th>
                <th className="px-2">Drop</th>
                <th className="px-2">Bin</th>
                <th className="px-2">Multiplier</th>
                <th className="px-2">Bet</th>
                <th className="px-2">Peg Hash</th>
              </tr>
            </thead>
            <tbody>
              {recentRounds.map((round) => (
                <tr key={round.id} className="rounded-md bg-slate-900/50">
                  <td className="px-2 py-2">{round.id.slice(-8)}</td>
                  <td className="px-2 py-2">{round.status}</td>
                  <td className="px-2 py-2">{round.dropColumn}</td>
                  <td className="px-2 py-2">{round.binIndex}</td>
                  <td className="px-2 py-2">{round.payoutMultiplier.toFixed(2)}x</td>
                  <td className="px-2 py-2">${(round.betCents / 100).toFixed(2)}</td>
                  <td className="px-2 py-2">{round.pegMapHash.slice(0, 12)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
