/**
 * Compare a guess against the secret word.
 * Both strings must be uppercase and equal length.
 * Returns an array of Tailwind class strings, one per letter.
 */
export function checkGuess(guess: string, secret: string): string[] {
  const result = Array(secret.length).fill("bg-gray-400 text-white");
  const matched = Array(secret.length).fill(false);
  const secretLetters = secret.split("");

  // green pass
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secretLetters[i]) {
      result[i] = "bg-green-500 text-white";
      matched[i] = true;
    }
  }

  // yellow pass
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === "bg-green-500 text-white") continue;
    const idx = secretLetters.findIndex((l, j) => l === guess[i] && !matched[j]);
    if (idx !== -1) {
      result[i] = "bg-yellow-500 text-black";
      matched[idx] = true;
    }
  }

  return result;
}

export type TileStatus = "correct" | "present" | "absent";

/** Map a `checkGuess` class string back to its meaning. */
export function tileStatus(colorClass: string | undefined): TileStatus | null {
  if (!colorClass) return null;
  if (colorClass.includes("green")) return "correct";
  if (colorClass.includes("yellow")) return "present";
  if (colorClass.includes("gray")) return "absent";
  return null;
}

const STATUS_TEXT: Record<TileStatus, string> = {
  correct: "correct spot",
  present: "in the word, wrong spot",
  absent: "not in the word",
};

/**
 * Accessible label for a revealed tile or key ("A, correct spot"), so the
 * result never depends on colour alone. `undefined` for unrevealed tiles.
 */
export function tileLabel(letter: string, colorClass: string | undefined): string | undefined {
  const status = tileStatus(colorClass);
  if (!status) return undefined;
  // Opponent boards hide letters but still show colours.
  const name = letter.trim() ? letter.toUpperCase() : "Hidden letter";
  return `${name}, ${STATUS_TEXT[status]}`;
}

/** Tile props for screen readers: an image with a spoken label once revealed. */
export function tileA11yProps(letter: string, colorClass: string | undefined) {
  const label = tileLabel(letter, colorClass);
  return label ? ({ role: "img", "aria-label": label } as const) : {};
}
