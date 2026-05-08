import { ImageResponse } from "next/og";

export const alt = "Wordle By Prav";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#6aaa64";
const YELLOW = "#c9b458";
const GRAY = "#787c7e";
const TEXT = "#1a1a1b";
const MUTED = "#787c7e";
const BG = "#ffffff";
const FONT_FAMILY = "'Helvetica Neue', Helvetica, Arial, sans-serif";

function Tile({
  letter,
  size: tileSize,
  bg,
}: {
  letter: string;
  size: number;
  bg: string;
}) {
  return (
    <div
      style={{
        width: tileSize,
        height: tileSize,
        background: bg,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: tileSize * 0.55,
        letterSpacing: "0.01em",
        lineHeight: 1,
        borderRadius: Math.max(2, tileSize * 0.02),
        fontFamily: FONT_FAMILY,
        textTransform: "uppercase",
      }}
    >
      {letter}
    </div>
  );
}

export default function OpengraphImage() {
  const tile = 200;
  const gap = 18;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          color: TEXT,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_FAMILY,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap,
          }}
        >
          <div style={{ display: "flex", gap }}>
            <Tile letter="W" size={tile} bg={GREEN} />
            <Tile letter="P" size={tile} bg={YELLOW} />
          </div>
          <div style={{ display: "flex", gap }}>
            <Tile letter="B" size={tile} bg={GRAY} />
            <Tile letter="Y" size={tile} bg={GREEN} />
          </div>
        </div>

        <div
          style={{
            marginTop: 56,
            fontSize: 56,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: "0.01em",
          }}
        >
          Wordle By Prav
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 26,
            color: MUTED,
            maxWidth: 880,
            textAlign: "center",
            lineHeight: 1.4,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          Pick a word length, guess in six tries, share challenges with friends.
        </div>
      </div>
    ),
    { ...size }
  );
}
