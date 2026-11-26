import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`[data-theme="${selector}"] {`);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1]!, m[2]!]));
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe.each(["dark", "light"])("%s theme contrast", (theme) => {
  const t = tokens(theme);
  const surfaces = ["app", "rail", "side", "main", "raised"];
  const texts = ["fg", "muted", "link", "mint", "amber", "danger"];
  it.each(surfaces.flatMap((s) => texts.map((c) => [c, s] as const)))("%s on %s is at least 4.5:1", (c, s) => {
    expect(ratio(t[c]!, t[s]!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each([
    ["on-primary", "primary"],
    ["on-danger", "danger-fill"],
  ])("%s on %s is at least 4.5:1", (c, s) => {
    expect(ratio(t[c]!, t[s]!)).toBeGreaterThanOrEqual(4.5);
  });
});
