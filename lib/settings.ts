/**
 * Device-local player settings: appearance, colour-vision support, multiplayer
 * preferences.
 *
 * Storage is `localStorage`, deliberately — guests have no uid, so anything in
 * Firestore would be unavailable to them. Settings follow the device, not the
 * account, for everyone.
 *
 * The keys `darkMode`, `mp.mobileLayout` and `mp.chatColor` predate this module
 * and are kept as-is so existing players don't lose their choices. Everything
 * new lives under `wordle:settings` as one JSON blob.
 *
 * Applying settings to the page = setting attributes on <html> (see
 * `applyToDocument`). The inline script in app/layout.tsx does the same thing
 * before first paint, so there's no flash of the wrong palette. **If you change
 * the attribute names or storage keys here, change that script too.**
 */

import { useSyncExternalStore } from "react";

export type Palette =
  | "classic"
  | "high-contrast"
  | "red-green"
  | "blue-yellow"
  | "monochrome"
  | "custom";

export type TileMarks = "off" | "symbols" | "patterns" | "both";
export type MobileLayout = "split" | "tabs";

export type Settings = {
  darkMode: boolean;
  reduceMotion: boolean;
  palette: Palette;
  customCorrect: string;
  customPresent: string;
  tileMarks: TileMarks;
  mpMobileLayout: MobileLayout;
  mpChatColor: string;
};

export const DEFAULT_NAME_COLOR = "#4a90e2";

export const DEFAULT_SETTINGS: Settings = {
  darkMode: false,
  reduceMotion: false,
  palette: "classic",
  customCorrect: "#0072b2",
  customPresent: "#e69f00",
  tileMarks: "off",
  mpMobileLayout: "split",
  mpChatColor: DEFAULT_NAME_COLOR,
};

export const PALETTES: Array<{
  id: Palette;
  label: string;
  description: string;
  /** Swatches for the picker card (light-mode values). Custom reads from settings. */
  swatch: [correct: string, present: string, absent: string];
}> = [
  { id: "classic",       label: "Classic",        description: "Green and yellow",                         swatch: ["#6aaa64", "#c9b458", "#787c7e"] },
  { id: "high-contrast", label: "High contrast",  description: "Orange and blue",                          swatch: ["#f5793a", "#85c0f9", "#787c7e"] },
  { id: "red-green",     label: "Red–green safe", description: "Protanopia · deuteranopia — blue and amber", swatch: ["#0072b2", "#e69f00", "#787c7e"] },
  { id: "blue-yellow",   label: "Blue–yellow safe", description: "Tritanopia — magenta and teal",           swatch: ["#c2185b", "#00897b", "#787c7e"] },
  { id: "monochrome",    label: "Monochrome",     description: "Achromatopsia — light and dark only",      swatch: ["#1f1f1f", "#8f8f8f", "#d6d6d6"] },
  { id: "custom",        label: "Custom",         description: "Pick your own colours",                    swatch: ["#0072b2", "#e69f00", "#787c7e"] },
];

export const TILE_MARKS: Array<{ id: TileMarks; label: string; description: string }> = [
  { id: "off",      label: "Off",      description: "Colour only" },
  { id: "symbols",  label: "Symbols",  description: "✓ right spot · ↔ wrong spot · ✕ not in word" },
  { id: "patterns", label: "Patterns", description: "Stripes for right spot, dots for wrong spot" },
  { id: "both",     label: "Both",     description: "Symbols and patterns" },
];

const SETTINGS_KEY = "wordle:settings";
const DARK_KEY = "darkMode";
const MP_LAYOUT_KEY = "mp.mobileLayout";
const MP_COLOR_KEY = "mp.chatColor";

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHexColor = (c: unknown): c is string => typeof c === "string" && HEX.test(c);

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / storage disabled — setting applies to this page only */
  }
}

function load(): Settings {
  let blob: Record<string, unknown> = {};
  try {
    const raw = readStorage(SETTINGS_KEY);
    if (raw) blob = JSON.parse(raw) ?? {};
  } catch {
    blob = {};
  }
  const d = DEFAULT_SETTINGS;
  const color = readStorage(MP_COLOR_KEY);
  return {
    darkMode: readStorage(DARK_KEY) === "true",
    reduceMotion: blob.reduceMotion === true,
    palette: pick(blob.palette, PALETTES.map((p) => p.id), d.palette),
    customCorrect: isHexColor(blob.customCorrect) ? blob.customCorrect : d.customCorrect,
    customPresent: isHexColor(blob.customPresent) ? blob.customPresent : d.customPresent,
    tileMarks: pick(blob.tileMarks, TILE_MARKS.map((m) => m.id), d.tileMarks),
    mpMobileLayout: pick(readStorage(MP_LAYOUT_KEY), ["split", "tabs"] as const, d.mpMobileLayout),
    mpChatColor: isHexColor(color) ? color : d.mpChatColor,
  };
}

function persist(s: Settings): void {
  writeStorage(DARK_KEY, String(s.darkMode));
  writeStorage(MP_LAYOUT_KEY, s.mpMobileLayout);
  writeStorage(MP_COLOR_KEY, s.mpChatColor);
  writeStorage(
    SETTINGS_KEY,
    JSON.stringify({
      reduceMotion: s.reduceMotion,
      palette: s.palette,
      customCorrect: s.customCorrect,
      customPresent: s.customPresent,
      tileMarks: s.tileMarks,
    }),
  );
}

/** White or near-black, whichever reads better on `hex`. */
export function readableTextOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast vs white = 1.05 / (L + .05); vs #1a1a1b ≈ (L + .05) / .06.
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.06 ? "#ffffff" : "#1a1a1b";
}

function applyToDocument(s: Settings): void {
  const root = document.documentElement;
  root.classList.toggle("dark", s.darkMode);
  root.dataset.palette = s.palette;
  root.dataset.tileMarks = s.tileMarks;
  root.classList.toggle("reduce-motion", s.reduceMotion);
  if (s.palette === "custom") {
    root.style.setProperty("--color-correct", s.customCorrect);
    root.style.setProperty("--color-present", s.customPresent);
    root.style.setProperty("--color-correct-text", readableTextOn(s.customCorrect));
    root.style.setProperty("--color-present-text", readableTextOn(s.customPresent));
  } else {
    for (const v of ["--color-correct", "--color-present", "--color-correct-text", "--color-present-text"]) {
      root.style.removeProperty(v);
    }
  }
}

/* ── Store (one per tab; other tabs sync via the `storage` event) ── */

let current: Settings | null = null;
const listeners = new Set<() => void>();

function snapshot(): Settings {
  if (!current) current = load();
  return current;
}

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function onStorage(e: StorageEvent): void {
  if (e.key && ![SETTINGS_KEY, DARK_KEY, MP_LAYOUT_KEY, MP_COLOR_KEY].includes(e.key)) return;
  current = load();
  applyToDocument(current);
  emit();
}

export function getSettings(): Settings {
  return typeof window === "undefined" ? DEFAULT_SETTINGS : snapshot();
}

export function updateSettings(patch: Partial<Settings>): void {
  const next = { ...snapshot(), ...patch };
  if (!isHexColor(next.customCorrect)) next.customCorrect = DEFAULT_SETTINGS.customCorrect;
  if (!isHexColor(next.customPresent)) next.customPresent = DEFAULT_SETTINGS.customPresent;
  if (!isHexColor(next.mpChatColor)) next.mpChatColor = DEFAULT_SETTINGS.mpChatColor;
  current = next;
  persist(next);
  applyToDocument(next);
  emit();
}

/** Reset everything except dark mode, which has its own one-tap toggle in the menu. */
export function resetSettings(): void {
  updateSettings({ ...DEFAULT_SETTINGS, darkMode: snapshot().darkMode });
}

/**
 * Live settings. Server render and hydration see `DEFAULT_SETTINGS`; the real
 * values arrive on the next render, so markup never mismatches.
 */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_SETTINGS);
}
