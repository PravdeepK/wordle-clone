import { ImageResponse } from "next/og";

export const alt = "Wordle By Prav — a personal Wordle-style word game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#6aaa64";
const YELLOW = "#c9b458";
const GRAY = "#787c7e";

const WORDLE_COLORS = [GREEN, YELLOW, GRAY, GREEN, YELLOW, GREEN];
const BYPRAV_COLORS = [YELLOW, GREEN, GRAY, GREEN, YELLOW, GRAY];

function Row({ letters, colors, tileSize }: { letters: string; colors: string[]; tileSize: number }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {letters.split("").map((char, i) => (
        <div
          key={i}
          style={{
            width: tileSize,
            height: tileSize,
            background: colors[i],
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: tileSize * 0.55,
            letterSpacing: "0.02em",
            borderRadius: 2,
          }}
        >
          {char}
        </div>
      ))}
    </div>
  );
}

export default function OpengraphImage() {
  const tileSize = 128;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          color: "#1a1a1b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Helvetica, Arial, sans-serif",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Row letters="WORDLE" colors={WORDLE_COLORS} tileSize={tileSize} />
          <Row letters="BYPRAV" colors={BYPRAV_COLORS} tileSize={tileSize} />
        </div>
        <div
          style={{
            marginTop: 56,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#787c7e",
          }}
        >
          Guess the word · Every day
        </div>
      </div>
    ),
    { ...size }
  );
}
