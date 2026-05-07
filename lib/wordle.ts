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
