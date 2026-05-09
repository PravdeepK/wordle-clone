export const RECENT_WORDS_KEY = "wordle:recentWords";
export const RECENT_WORDS_LIMIT = 20;

export function loadRecentWords(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_WORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((w) => typeof w === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecentWord(word: string): void {
  if (typeof window === "undefined" || !word) return;
  try {
    const list = loadRecentWords();
    const lower = word.toLowerCase();
    const next = [lower, ...list.filter((w) => w.toLowerCase() !== lower)].slice(0, RECENT_WORDS_LIMIT);
    window.localStorage.setItem(RECENT_WORDS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
