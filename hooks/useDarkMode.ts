"use client";

import { updateSettings, useSettings } from "../lib/settings";

/** Thin wrapper over the settings store, kept so existing call sites don't change. */
export function useDarkMode() {
  const { darkMode } = useSettings();
  const toggleDarkMode = () => updateSettings({ darkMode: !darkMode });
  return { darkMode, toggleDarkMode };
}
