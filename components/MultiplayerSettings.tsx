"use client";

import React from "react";

/**
 * Multiplayer preference pickers. Rendered on the multiplayer page's Settings
 * tab and in the global Settings modal; both read/write lib/settings.ts.
 */

export const NAME_COLORS: Array<{ id: string; hex: string; label: string }> = [
  { id: "blue",   hex: "#4a90e2", label: "Blue" },
  { id: "red",    hex: "#e25555", label: "Red" },
  { id: "orange", hex: "#e2884a", label: "Orange" },
  { id: "yellow", hex: "#d6b218", label: "Yellow" },
  { id: "green",  hex: "#3fa84a", label: "Green" },
  { id: "teal",   hex: "#2bb6a4", label: "Teal" },
  { id: "purple", hex: "#8a4ae2", label: "Purple" },
  { id: "pink",   hex: "#e24aa3", label: "Pink" },
];

export function MobileLayoutPicker({
  value,
  onChange,
}: {
  value: "split" | "tabs";
  onChange: (next: "split" | "tabs") => void;
}) {
  const options: Array<{ id: "split" | "tabs"; label: string; sub: string }> = [
    { id: "split", label: "A · Split", sub: "Both boards" },
    { id: "tabs", label: "B · Tabs", sub: "Big board" },
  ];

  const onKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(options[(idx + 1) % options.length].id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(options[(idx - 1 + options.length) % options.length].id);
    }
  };

  return (
    <div className="mp-settings-panel">
      <div className="mp-settings-title">Mobile layout</div>
      <div className="mp-layout-row" role="radiogroup" aria-label="Mobile layout">
        {options.map((opt, idx) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={`mp-layout-card ${selected ? "mp-layout-card--sel" : ""}`}
              onClick={() => onChange(opt.id)}
              onKeyDown={(e) => onKey(e, idx)}
            >
              {selected && <span className="mp-layout-check" aria-hidden="true">✓</span>}
              <span className="mp-layout-preview" aria-hidden="true">
                {opt.id === "split" ? <SplitPreview /> : <TabsPreview />}
              </span>
              <span className="mp-layout-label">{opt.label}</span>
              <span className="mp-layout-sub">{opt.sub}</span>
            </button>
          );
        })}
      </div>
      <div className="mp-settings-foot">Saves immediately</div>
    </div>
  );
}

export function ChatColorPicker({
  value,
  onChange,
  previewName,
}: {
  value: string;
  onChange: (next: string) => void;
  previewName: string;
}) {
  return (
    <div className="mp-settings-panel">
      <div className="mp-settings-title">Chat name color</div>
      <div className="mp-color-preview">
        <span className="chat-from" style={{ color: value }}>{previewName}:</span>{" "}
        <span className="chat-text">looks like this</span>
      </div>
      <div className="mp-color-row" role="radiogroup" aria-label="Chat name color presets">
        {NAME_COLORS.map((c) => {
          const selected = value.toLowerCase() === c.hex.toLowerCase();
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.label}
              title={c.label}
              className={`mp-color-swatch ${selected ? "mp-color-swatch--sel" : ""}`}
              style={{ background: c.hex }}
              onClick={() => onChange(c.hex)}
            />
          );
        })}
      </div>
      <label className="mp-color-custom">
        <span className="mp-color-custom-label">Custom</span>
        <input
          type="color"
          className="mp-color-custom-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pick a custom chat name color"
        />
        <span className="mp-color-custom-hex">{value.toUpperCase()}</span>
      </label>
      <div className="mp-settings-foot">Saves immediately</div>
    </div>
  );
}

function MiniBoard({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cols = 5;
  const rows = 3;
  const pad = 2;
  const gap = 2;
  const cellW = (w - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (h - pad * 2 - gap * (rows - 1)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={x + pad + c * (cellW + gap)}
          y={y + pad + r * (cellH + gap)}
          width={cellW}
          height={cellH}
          fill="currentColor"
          opacity="0.5"
          rx="1"
        />
      );
    }
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="currentColor" strokeWidth="1.5" rx="3" />
      {cells}
    </g>
  );
}

function MiniKeyboard({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const keys = 7;
  const pad = 1.5;
  const gap = 1.5;
  const keyW = (w - pad * 2 - gap * (keys - 1)) / keys;
  const keyH = h - pad * 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="currentColor" strokeWidth="1.5" rx="2" />
      {Array.from({ length: keys }).map((_, i) => (
        <rect
          key={i}
          x={x + pad + i * (keyW + gap)}
          y={y + pad}
          width={keyW}
          height={keyH}
          fill="currentColor"
          opacity="0.5"
          rx="0.5"
        />
      ))}
    </g>
  );
}

function SplitPreview() {
  return (
    <svg className="pv-svg" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <MiniBoard x={2} y={2} w={96} h={70} />
      <MiniBoard x={102} y={2} w={96} h={70} />
      <MiniKeyboard x={2} y={78} w={196} h={20} />
      <rect x={2} y={102} width={196} height={14} fill="none" stroke="currentColor" strokeWidth="1.5" rx="2" />
    </svg>
  );
}

function TabsPreview() {
  return (
    <svg className="pv-svg" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x={2} y={2} width={96} height={12} fill="currentColor" rx="2" />
      <rect x={102} y={2} width={96} height={12} fill="none" stroke="currentColor" strokeWidth="1.5" rx="2" />
      <MiniBoard x={2} y={20} w={196} h={52} />
      <MiniKeyboard x={2} y={78} w={196} h={20} />
      <rect x={2} y={102} width={196} height={14} fill="none" stroke="currentColor" strokeWidth="1.5" rx="2" />
    </svg>
  );
}
