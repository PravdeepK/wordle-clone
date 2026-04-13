import { useRef, useState, useCallback } from "react";

const FLIP_IN  = 250; // ms — tile folds away
const STAGGER  = 300; // ms — delay between each tile
const FLIP_OUT = 250; // ms — tile unfolds with colour
const BUFFER   = 20;  // ms — small safety margin

export interface RunFlipOptions {
  rowIndex: number;
  colors: string[];
  guess: string;
  wordLength: number;
  /** Called once the last tile finishes flipping. Receives the colors and guess so the caller can update keyboard state and handle win/lose. */
  onFlipDone: (colors: string[], guess: string) => void;
}

export interface UseFlipAnimationReturn {
  tileReveal: Record<number, string[]>;
  animatingRow: number | null;
  shakeRow: number | null;
  winRow: number | null;
  /** Schedule the two-phase flip for one submitted row. */
  runFlip: (opts: RunFlipOptions) => void;
  /** Trigger a shake animation on a row (e.g. invalid word). */
  triggerShake: (rowIndex: number) => void;
  /** Set the bounce-win animation on a row. */
  setWinRow: (rowIndex: number) => void;
  /** Clear every pending timeout and stop any in-progress animation. */
  cancelAll: () => void;
  /** cancelAll + reset all animation state (call before starting a new game). */
  resetAnimation: () => void;
}

/**
 * Manages the NYT-style two-phase tile flip animation.
 *
 * All setTimeout IDs are tracked in a ref so they can be cancelled atomically
 * via cancelAll() / resetAnimation() — preventing stale callbacks from a
 * previous game from corrupting the state of a freshly started game.
 */
export function useFlipAnimation(): UseFlipAnimationReturn {
  const [tileReveal, setTileReveal] = useState<Record<number, string[]>>({});
  const [animatingRow, setAnimatingRow] = useState<number | null>(null);
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [winRow, setWinRow] = useState<number | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timers.current.push(id);
  }, []);

  const cancelAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAnimatingRow(null);
  }, []);

  const resetAnimation = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAnimatingRow(null);
    setTileReveal({});
    setShakeRow(null);
    setWinRow(null);
  }, []);

  const triggerShake = useCallback(
    (rowIndex: number) => {
      setShakeRow(rowIndex);
      schedule(() => setShakeRow(null), 600);
    },
    [schedule]
  );

  const runFlip = useCallback(
    ({ rowIndex, colors, guess, wordLength, onFlipDone }: RunFlipOptions) => {
      setAnimatingRow(rowIndex);

      // Reveal each tile colour at the moment it is edge-on (invisible).
      colors.forEach((colorClass, i) => {
        schedule(() => {
          setTileReveal((prev) => {
            const rowArr = [...(prev[rowIndex] ?? Array(wordLength).fill(""))];
            rowArr[i] = colorClass;
            return { ...prev, [rowIndex]: rowArr };
          });
        }, i * STAGGER + FLIP_IN + BUFFER);
      });

      const flipDone =
        (colors.length - 1) * STAGGER + FLIP_IN + FLIP_OUT + BUFFER * 2;

      schedule(() => setAnimatingRow(null), flipDone);

      // Single callback at flipDone — caller handles keyboard + win/lose.
      schedule(() => onFlipDone(colors, guess), flipDone);
    },
    [schedule]
  );

  const setWinRowExternal = useCallback((rowIndex: number) => {
    setWinRow(rowIndex);
  }, []);

  return {
    tileReveal,
    animatingRow,
    shakeRow,
    winRow,
    runFlip,
    triggerShake,
    setWinRow: setWinRowExternal,
    cancelAll,
    resetAnimation,
  };
}
