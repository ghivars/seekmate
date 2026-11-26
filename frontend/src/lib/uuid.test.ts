import { afterEach, expect, it, vi } from "vitest";
import { uuid } from "./uuid";

afterEach(() => vi.unstubAllGlobals());

it("falls back to getRandomValues when randomUUID is unavailable (plain HTTP)", () => {
  vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.map((_, i) => i * 17) });
  expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
