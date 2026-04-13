"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef } from "react";

/** True when the event target is a real form field (not our invisible guess capture). */
function blocksGlobalGuessKeys(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  if (t.closest("[data-global-guess-keys]")) return false;

  if (t.closest("textarea, select")) return true;

  const input = t.closest("input");
  if (!input) return false;

  const type = (input as HTMLInputElement).type;
  if (
    type === "checkbox" ||
    type === "radio" ||
    type === "range" ||
    type === "button" ||
    type === "submit" ||
    type === "hidden" ||
    type === "file"
  ) {
    return false;
  }

  return true;
}

/**
 * Listens at window capture so physical keys work even when focus is on the
 * on-screen keyboard (or elsewhere). Pair with `data-global-guess-keys` on the
 * hidden guess `<input type="text">` so typing there is not double-handled.
 */
export function useGlobalGuessKeyboard(options: {
  enabled: boolean;
  maxLength: number;
  setCurrentGuess: Dispatch<SetStateAction<string>>;
  onEnter: () => void | Promise<void>;
}) {
  const { enabled, maxLength, setCurrentGuess, onEnter } = options;
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (blocksGlobalGuessKeys(e.target)) return;

      const ae = document.activeElement as HTMLInputElement | null;
      if (ae?.tagName === "INPUT" && (ae.type === "checkbox" || ae.type === "radio" || ae.type === "range")) {
        return;
      }

      const k = e.key;
      if (k === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        setCurrentGuess((p) => p.slice(0, -1));
        return;
      }
      if (k === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        void onEnterRef.current();
        return;
      }
      if (k.length === 1 && /[a-zA-Z]/.test(k)) {
        e.preventDefault();
        e.stopPropagation();
        setCurrentGuess((p) => (p.length < maxLength ? p + k.toUpperCase() : p));
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [enabled, maxLength, setCurrentGuess]);
}
