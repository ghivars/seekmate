import type { KeyboardEvent } from "react";

/** Arrow-key navigation between `[data-nav]` descendants of the element with this handler. */
export function rovingKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-nav]")];
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key] ?? 0;
  items[Math.max(0, Math.min(next, items.length - 1))]?.focus();
}
