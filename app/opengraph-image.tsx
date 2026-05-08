import { ImageResponse } from "next/og";

export const alt = "Wordle By Prav — a personal Wordle clone";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#6aaa64";
const YELLOW = "#c9b458";
const GRAY = "#787c7e";
const TEXT = "#1a1a1b";
const MUTED = "#787c7e";
const BG = "#ffffff";

const WORDLE_KINDS = [GREEN, YELLOW, GRAY, GREEN, YELLOW, GREEN];
const BYPRAV_KINDS = [YELLOW, GREEN, GRAY, GREEN, YELLOW, GREEN];

const FONT_FAMILY = "'Helvetica Neue', Helvetica, Arial, sans-serif";

function siteHost(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (raw) {
    try {
      return new URL(raw).host.toUpperCase();
    } catch {
      /* fall through */
    }
  }
  return "WORDLEBYPRAV.COM";
}

function Tile({
  letter,
  size: tileSize,
  bg,
  fontFamily,
}: {
  letter: string;
  size: number;
  bg: string;
  fontFamily: string;
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
        borderRadius: Math.max(2, tileSize * 0.02),
        fontFamily,
        textTransform: "uppercase",
      }}
    >
      {letter}
    </div>
  );
}

function TileRow({
  letters,
  colors,
  tileSize,
  gap,
}: {
  letters: string;
  colors: string[];
  tileSize: number;
  gap: number;
}) {
  return (
    <div style={{ display: "flex", gap }}>
      {letters.split("").map((char, i) => (
        <Tile key={i} letter={char} size={tileSize} bg={colors[i]} fontFamily={FONT_FAMILY} />
      ))}
    </div>
  );
}

export default function OpengraphImage() {
  const wordmarkTile = 88;
  const wordmarkGap = 5;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          color: TEXT,
          display: "flex",
          fontFamily: FONT_FAMILY,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "72px 88px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Top-left: small P tile + URL */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Tile letter="P" size={56} bg={GREEN} fontFamily={FONT_FAMILY} />
            <span
              style={{
                fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
                fontSize: 16,
                letterSpacing: "0.18em",
                color: MUTED,
                textTransform: "uppercase",
              }}
            >
              {siteHost()}
            </span>
          </div>

          {/* Bottom-left: wordmark + tagline */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: wordmarkGap }}>
              <TileRow letters="WORDLE" colors={WORDLE_KINDS} tileSize={wordmarkTile} gap={wordmarkGap} />
              <TileRow letters="BYPRAV" colors={BYPRAV_KINDS} tileSize={wordmarkTile} gap={wordmarkGap} />
            </div>
            <p
              style={{
                margin: "36px 0 0",
                fontSize: 28,
                color: MUTED,
                maxWidth: 760,
                lineHeight: 1.4,
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              A Wordle clone I built. Pick a word length, guess in six tries, share challenges with friends.
            </p>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
