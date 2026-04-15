"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { Direction } from "@/lib/engine/plinko";

type PlinkoBoardProps = {
  rows: number;
  dropColumn: number;
  path: Direction[];
  animating: boolean;
  currentStep: number;
  reducedMotion?: boolean;
  goldenBall: boolean;
  landingBinIndex?: number | null;
  landingPulseKey?: number;
};

type Point = {
  x: number;
  y: number;
};

const CELL = 30;
const MARGIN = 20;
const HEADER_HEIGHT = 46;
const BALL_OPTICAL_OFFSET_X = 4;

function computePegPoint(row: number, col: number, rows: number): Point {
  const offsetX = (rows - row) * (CELL / 2);
  return {
    x: MARGIN + offsetX + col * CELL,
    y: MARGIN + HEADER_HEIGHT + row * CELL,
  };
}

function computeBallTrack(rows: number, path: Direction[], dropColumn: number): Point[] {
  const entryColumn = Math.min(Math.max(dropColumn, 0), rows);
  let pos = 0;
  const points: Point[] = [
    {
      x: MARGIN + entryColumn * CELL,
      y: computePegPoint(0, 0, rows).y - CELL * 0.8,
    },
  ];

  for (let r = 0; r < rows; r += 1) {
    const pegIndex = Math.min(pos, r);
    const peg = computePegPoint(r, pegIndex, rows);
    points.push(peg);

    if (path[r] === "R") {
      pos += 1;
    }
  }

  const finalY = MARGIN + HEADER_HEIGHT + rows * CELL + 8;
  // Final bins form the implicit next row with left origin at MARGIN.
  const finalX = MARGIN + pos * CELL;
  points.push({ x: finalX, y: finalY });

  return points;
}

export function PlinkoBoard({
  rows,
  dropColumn,
  path,
  animating,
  currentStep,
  reducedMotion = false,
  goldenBall,
  landingBinIndex,
  landingPulseKey,
}: PlinkoBoardProps) {
  const width = MARGIN * 2 + rows * CELL;
  const height = MARGIN * 2 + HEADER_HEIGHT + rows * CELL + 98;
  const binsTop = MARGIN + HEADER_HEIGHT + rows * CELL + 24;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(width);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, [width]);

  const scale = Math.min(1, Math.max(containerWidth - 4, 240) / width);

  const pegNodes = useMemo(() => {
    const nodes: ReactNode[] = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c <= r; c += 1) {
        const p = computePegPoint(r, c, rows);
        nodes.push(
          <div
            key={`peg-${r}-${c}`}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-100 ring-2 ring-cyan-500/30"
            style={{ left: p.x, top: p.y }}
          />,
        );
      }
    }
    return nodes;
  }, [rows]);

  const track = useMemo(() => computeBallTrack(rows, path, dropColumn), [rows, path, dropColumn]);
  const safeStep = Math.min(Math.max(currentStep, 0), Math.max(track.length - 1, 0));
  const ballPoint = track[safeStep];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/60 p-4 shadow-2xl">
      <div ref={wrapperRef} className="w-full">
        <div className="relative mx-auto" style={{ width: width * scale, height: height * scale }}>
          <div
            className="absolute left-0 top-0"
            style={{
              width,
              height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
      <div
        className="relative"
        style={{ width, height }}
        aria-label="Plinko board"
        role="img"
      >
        <div
          className="absolute left-0 right-0 top-0 text-center text-xs uppercase tracking-[0.25em] text-cyan-200/75"
        >
          Drop column: {dropColumn}
        </div>

        {pegNodes}

        <div className="absolute left-0 top-0 h-full w-full">
          {Array.from({ length: 13 }).map((_, i) => (
            <div
              key={landingBinIndex === i ? `bin-${i}-${landingPulseKey ?? 0}` : `bin-${i}`}
              className={`absolute h-8 w-8 -translate-x-1/2 rounded-md border border-cyan-300/25 bg-cyan-400/10 text-center text-[12px] leading-8 text-cyan-100 ${landingBinIndex === i ? (reducedMotion ? "border-amber-200 bg-amber-300/70 text-slate-950 shadow-[0_0_20px_rgba(253,224,71,0.85)]" : "animate-[bin-hit_900ms_ease-out_1] border-cyan-100 bg-cyan-300/40 text-white shadow-[0_0_24px_rgba(34,211,238,0.9)]") : ""}`}
              style={{ left: MARGIN + i * CELL, top: binsTop }}
            >
              {i}
            </div>
          ))}
        </div>

        {ballPoint ? (
          <div
            className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 transition-all duration-200 ease-out ${goldenBall ? "bg-amber-300 ring-amber-100/60" : "bg-cyan-300 ring-cyan-100/60"} ${animating && !reducedMotion ? "animate-[pulse-glow_0.8s_ease-in-out_infinite]" : ""}`}
            style={{
              left: ballPoint.x + BALL_OPTICAL_OFFSET_X,
              top: ballPoint.y,
              transform: "translate(-50%, -50%)",
              boxShadow: goldenBall
                ? "0 0 8px rgba(253, 224, 71, 0.55), 0 0 16px rgba(253, 224, 71, 0.35)"
                : "0 0 8px rgba(34, 211, 238, 0.55), 0 0 16px rgba(34, 211, 238, 0.35)",
            }}
          />
        ) : null}
      </div>
          </div>
        </div>
      </div>
    </div>
  );
}
