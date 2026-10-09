"use client";

import React, { useEffect, useRef } from "react";
import {
  PALETTES,
  TILE_MARKS,
  resetSettings,
  updateSettings,
  useSettings,
  type Palette,
  type Settings,
} from "../lib/settings";
import { ChatColorPicker, MobileLayoutPicker } from "./MultiplayerSettings";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  /** Name shown in the chat colour preview. */
  playerName?: string;
};

/* ── Colour-vision simulation ──
   Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB.
   Used for the preview filters (SVG feColorMatrix filters run in linearRGB by
   default) and for the "hard to tell apart" warning on custom colours. */
type Matrix = [number, number, number, number, number, number, number, number, number];

const SIMULATIONS: Array<{ id: string; label: string; matrix: Matrix | null }> = [
  { id: "normal", label: "Typical vision", matrix: null },
  { id: "protan", label: "Protanopia (red-blind)", matrix: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998] },
  { id: "deutan", label: "Deuteranopia (green-blind)", matrix: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881] },
  { id: "tritan", label: "Tritanopia (blue-blind)", matrix: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.148296, 0.004733, 0.691367, 0.3039] },
  { id: "achroma", label: "Achromatopsia (no colour)", matrix: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722] },
];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function simulate(hex: string, m: Matrix | null): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
  const out = m
    ? [0, 1, 2].map((r) => m[r * 3] * rgb[0] + m[r * 3 + 1] * rgb[1] + m[r * 3 + 2] * rgb[2])
    : rgb;
  return out.map((v) => Math.round(toSrgb(Math.min(1, Math.max(0, v))) * 255)) as [number, number, number];
}

const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Vision types under which two of the three tile colours become hard to tell apart. */
function confusableUnder(correct: string, present: string, absent: string): string[] {
  const MIN_DISTANCE = 70; // of a possible ~441
  return SIMULATIONS.filter(({ matrix }) => {
    const [c, p, a] = [correct, present, absent].map((h) => simulate(h, matrix));
    return distance(c, p) < MIN_DISTANCE || distance(c, a) < MIN_DISTANCE || distance(p, a) < MIN_DISTANCE;
  }).map((s) => s.label);
}

function SimulationFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        {SIMULATIONS.filter((s) => s.matrix).map(({ id, matrix: m }) => (
          <filter key={id} id={`cvd-${id}`} colorInterpolationFilters="linearRGB">
            <feColorMatrix
              type="matrix"
              values={`${m![0]} ${m![1]} ${m![2]} 0 0  ${m![3]} ${m![4]} ${m![5]} 0 0  ${m![6]} ${m![7]} ${m![8]} 0 0  0 0 0 1 0`}
            />
          </filter>
        ))}
      </defs>
    </svg>
  );
}

const SAMPLE: Array<[letter: string, cls: string]> = [
  ["C", "bg-green-500"],
  ["R", "bg-gray-400"],
  ["A", "bg-yellow-500"],
  ["N", "bg-gray-400"],
  ["E", "bg-green-500"],
];

function SampleRow() {
  return (
    <div className="grid-row">
      {SAMPLE.map(([letter, cls], i) => (
        <div key={i} className={`cell ${cls}`}>{letter}</div>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, labelledBy }: { checked: boolean; onChange: (v: boolean) => void; labelledBy: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      className="settings-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

function ToggleRow({ id, label, sub, checked, onChange }: { id: string; label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <span className="settings-row-label" id={id}>{label}</span>
        <span className="settings-row-sub">{sub}</span>
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} />
    </div>
  );
}

/** Arrow-key navigation inside a role="radiogroup". */
function radioKeys<T>(options: readonly T[], value: T, onChange: (v: T) => void) {
  return (e: React.KeyboardEvent) => {
    const i = options.indexOf(value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % options.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + options.length) % options.length;
    if (next === -1) return;
    e.preventDefault();
    onChange(options[next]);
    const group = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };
}

function PaletteSwatches({ id, settings }: { id: Palette; settings: Settings }) {
  const p = PALETTES.find((x) => x.id === id)!;
  const swatch = id === "custom" ? [settings.customCorrect, settings.customPresent, p.swatch[2]] : p.swatch;
  return (
    <span className="settings-option-swatches" aria-hidden="true">
      {swatch.map((c, i) => <span key={i} style={{ background: c }} />)}
    </span>
  );
}

export default function SettingsModal({ open, onClose, playerName = "You" }: SettingsModalProps) {
  const settings = useSettings();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const paletteIds = PALETTES.map((p) => p.id);
  const markIds = TILE_MARKS.map((m) => m.id);
  const absentForCustom = settings.darkMode ? "#3a3a3c" : "#787c7e";
  const customClashes =
    settings.palette === "custom"
      ? confusableUnder(settings.customCorrect, settings.customPresent, absentForCustom)
      : [];

  return (
    <div className="feedback-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button type="button" className="feedback-backdrop" aria-label="Close settings" tabIndex={-1} onClick={onClose} />
      <div className="feedback-dialog settings-dialog">
        <button ref={closeRef} type="button" className="feedback-close" aria-label="Close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>

        <h2 className="feedback-title" id="settings-title">Settings</h2>
        <p className="feedback-subtitle">Changes apply instantly and are saved on this device.</p>

        <SimulationFilters />

        {/* ── Appearance ── */}
        <section className="settings-section" aria-labelledby="settings-appearance">
          <h3 className="settings-section-title" id="settings-appearance">Appearance</h3>
          <ToggleRow
            id="settings-dark"
            label="Dark mode"
            sub="Dark background, easier on the eyes at night"
            checked={settings.darkMode}
            onChange={(v) => updateSettings({ darkMode: v })}
          />
          <ToggleRow
            id="settings-motion"
            label="Reduce motion"
            sub="No flips, bounces or shakes — invalid words get a red outline"
            checked={settings.reduceMotion}
            onChange={(v) => updateSettings({ reduceMotion: v })}
          />
        </section>

        {/* ── Colour vision ── */}
        <section className="settings-section" aria-labelledby="settings-colour">
          <h3 className="settings-section-title" id="settings-colour">Colour vision</h3>
          <p className="settings-hint">Tile colours for right spot, wrong spot and not in the word.</p>

          <div
            className="settings-options"
            role="radiogroup"
            aria-labelledby="settings-colour"
            onKeyDown={radioKeys(paletteIds, settings.palette, (palette) => updateSettings({ palette }))}
          >
            {PALETTES.map((p) => {
              const selected = settings.palette === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`settings-option ${selected ? "settings-option--sel" : ""}`}
                  onClick={() => updateSettings({ palette: p.id })}
                >
                  <PaletteSwatches id={p.id} settings={settings} />
                  <span className="settings-option-text">
                    <span className="settings-option-label">{p.label}</span>
                    <span className="settings-option-sub">{p.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {settings.palette === "custom" && (
            <>
              <div className="settings-custom-colors">
                <label className="settings-color-field">
                  <input
                    type="color"
                    value={settings.customCorrect}
                    onChange={(e) => updateSettings({ customCorrect: e.target.value })}
                  />
                  Right spot
                </label>
                <label className="settings-color-field">
                  <input
                    type="color"
                    value={settings.customPresent}
                    onChange={(e) => updateSettings({ customPresent: e.target.value })}
                  />
                  Wrong spot
                </label>
              </div>
              {customClashes.length > 0 && (
                <p className="settings-warning" role="status">
                  These colours are hard to tell apart with {customClashes.join(", ").toLowerCase()}.
                  Try other colours, or turn on symbols or patterns below.
                </p>
              )}
            </>
          )}

          <div className="settings-row-text">
            <span className="settings-row-label" id="settings-marks">Tile markers</span>
            <span className="settings-row-sub">
              {TILE_MARKS.find((m) => m.id === settings.tileMarks)?.description}
            </span>
          </div>
          <div
            className="settings-seg"
            role="radiogroup"
            aria-labelledby="settings-marks"
            onKeyDown={radioKeys(markIds, settings.tileMarks, (tileMarks) => updateSettings({ tileMarks }))}
          >
            {TILE_MARKS.map((m) => {
              const selected = settings.tileMarks === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`settings-seg-btn ${selected ? "settings-seg-btn--sel" : ""}`}
                  onClick={() => updateSettings({ tileMarks: m.id })}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="settings-preview" aria-label="Preview of the current tile colours" role="group">
            <SampleRow />
            <div className="settings-preview-legend" aria-hidden="true">
              <span><i className="settings-legend-dot" style={{ background: "var(--color-correct)" }} />Right spot</span>
              <span><i className="settings-legend-dot" style={{ background: "var(--color-present)" }} />Wrong spot</span>
              <span><i className="settings-legend-dot" style={{ background: "var(--color-absent)" }} />Not in word</span>
            </div>
            <div className="settings-sim-grid" aria-hidden="true">
              {SIMULATIONS.filter((s) => s.matrix).map((s) => (
                <div key={s.id} className="settings-sim">
                  <div style={{ filter: `url(#cvd-${s.id})` }}>
                    <SampleRow />
                  </div>
                  <span className="settings-sim-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="settings-hint">
            The small rows simulate how your palette looks to people with each type of colour blindness.
            Screen readers announce every revealed tile and key (e.g. “A, wrong spot”) whatever you pick here.
          </p>
        </section>

        {/* ── Multiplayer ── */}
        <section className="settings-section" aria-labelledby="settings-mp">
          <h3 className="settings-section-title" id="settings-mp">Multiplayer</h3>
          <MobileLayoutPicker
            value={settings.mpMobileLayout}
            onChange={(mpMobileLayout) => updateSettings({ mpMobileLayout })}
          />
          <ChatColorPicker
            value={settings.mpChatColor}
            onChange={(mpChatColor) => updateSettings({ mpChatColor })}
            previewName={playerName}
          />
        </section>

        <div className="settings-footer">
          <span>Saved on this device — works in guest mode too.</span>
          <button type="button" className="settings-reset" onClick={resetSettings}>
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
