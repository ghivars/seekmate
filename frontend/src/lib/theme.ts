"use client";

import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => void listeners.delete(notify);
}

const read = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  // Swap instantly: half-faded text is unreadable.
  root.dataset.switching = "";
  root.dataset.theme = theme;
  void root.offsetHeight;
  requestAnimationFrame(() => delete root.dataset.switching);
  try {
    localStorage.setItem("seekmate-theme", theme);
  } catch {
    // Private mode: the choice just lasts for this page load.
  }
  listeners.forEach((l) => l());
}

export const useTheme = (): Theme => useSyncExternalStore(subscribe, read, () => "dark");
