"use client";

import React from "react";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

interface VirtualKeyboardProps {
  onKey: (key: string) => void;
  keyStatuses: Record<string, string>;
  disabled?: boolean;
}

export default function VirtualKeyboard({ onKey, keyStatuses, disabled = false }: VirtualKeyboardProps) {
  return (
    <div className="keyboard">
      {ROWS.map((row, i) => (
        <div key={i} className="keyboard-row">
          {i === 2 && (
            <button className="key large-key" onClick={() => onKey("ENTER")} disabled={disabled}>
              Enter
            </button>
          )}
          {row.split("").map((k) => (
            <button
              key={k}
              className={`key ${keyStatuses[k] || ""}`}
              onClick={() => onKey(k)}
              disabled={disabled}
            >
              {k}
            </button>
          ))}
          {i === 2 && (
            <button className="key large-key" onClick={() => onKey("⌫")} disabled={disabled}>
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
