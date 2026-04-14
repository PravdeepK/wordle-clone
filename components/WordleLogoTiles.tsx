"use client";

import { useState, useEffect } from "react";

const TILE_COLOR_CLASSES = ["bg-green-500", "bg-yellow-500", "bg-gray-400"] as const;

function randomTileColors(length: number): string[] {
  return Array.from({ length }, () => {
    const pick = TILE_COLOR_CLASSES[Math.floor(Math.random() * TILE_COLOR_CLASSES.length)];
    return pick;
  });
}

/** Same on server + first client paint — avoids hydration mismatch; random runs in useEffect. */
const STATIC_LOGO_COLOR_ROW: string[] = [
  "bg-green-500",
  "bg-yellow-500",
  "bg-gray-400",
  "bg-green-500",
  "bg-yellow-500",
  "bg-green-500",
];

function TileRow({ text, colors }: { text: string; colors: string[] }) {
  return (
    <div className="login-tiles">
      {text.split("").map((char, i) => (
        <div key={i} className={`cell login-tile ${colors[i]}`}>
          {char === " " ? "\u00A0" : char}
        </div>
      ))}
    </div>
  );
}

/** Two-row WORDLE / BYPRAV header; colors match login (static SSR, then randomized on client). */
export default function WordleLogoTiles() {
  const [logoColors, setLogoColors] = useState(() => ({
    wordle: [...STATIC_LOGO_COLOR_ROW],
    byprav: [...STATIC_LOGO_COLOR_ROW],
  }));

  useEffect(() => {
    setLogoColors({
      wordle: randomTileColors("WORDLE".length),
      byprav: randomTileColors("BYPRAV".length),
    });
  }, []);

  return (
    <div className="login-tiles-stack" aria-hidden>
      <TileRow text="WORDLE" colors={logoColors.wordle} />
      <TileRow text="BYPRAV" colors={logoColors.byprav} />
    </div>
  );
}
