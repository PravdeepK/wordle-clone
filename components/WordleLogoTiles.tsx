"use client";

import { useState, useEffect, CSSProperties } from "react";

const COLOR_VARS = ["--color-correct", "--color-present", "--color-absent"] as const;
type ColorVar = (typeof COLOR_VARS)[number];

function randomColors(length: number): ColorVar[] {
  return Array.from({ length }, () => COLOR_VARS[Math.floor(Math.random() * COLOR_VARS.length)]);
}

const FLIP_STAGGER_MS = 250;
const FLIP_DURATION_MS = 500;
const ROW_GAP_MS = 200;

function TileRow({
  text,
  colors,
  revealed,
  startDelayMs,
  reverse = false,
}: {
  text: string;
  colors: ColorVar[];
  revealed: boolean;
  startDelayMs: number;
  reverse?: boolean;
}) {
  const chars = text.split("");
  return (
    <div className="login-tiles">
      {chars.map((char, i) => {
        const order = reverse ? chars.length - 1 - i : i;
        const style: CSSProperties = {
          ["--reveal-bg" as never]: `var(${colors[i]})`,
        };
        if (revealed) {
          style.animationDelay = `${startDelayMs + order * FLIP_STAGGER_MS}ms`;
        }
        return (
          <div
            key={i}
            className={`cell login-tile${revealed ? " login-tile--reveal" : ""}`}
            style={style}
          >
            {char === " " ? " " : char}
          </div>
        );
      })}
    </div>
  );
}

/** Two-row WORDLE / BYPRAV header that flips in like a played Wordle row. */
export default function WordleLogoTiles() {
  const [revealed, setRevealed] = useState(false);
  const [colors, setColors] = useState<{ wordle: ColorVar[]; byprav: ColorVar[] }>(() => ({
    wordle: Array(6).fill("--color-absent") as ColorVar[],
    byprav: Array(6).fill("--color-absent") as ColorVar[],
  }));

  useEffect(() => {
    setColors({
      wordle: randomColors("WORDLE".length),
      byprav: randomColors("BYPRAV".length),
    });
    const t = window.setTimeout(() => setRevealed(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="login-tiles-stack" aria-hidden>
      <TileRow text="WORDLE" colors={colors.wordle} revealed={revealed} startDelayMs={0} />
      <TileRow text="BYPRAV" colors={colors.byprav} revealed={revealed} startDelayMs={0} reverse />
    </div>
  );
}
