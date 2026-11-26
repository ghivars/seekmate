import { describe, expect, it } from "vitest";
import { safeNext } from "./auth-card";

describe("safeNext", () => {
  it("allows in-app paths", () => expect(safeNext("/c/1/2")).toBe("/c/1/2"));
  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "falls back for %s",
    (value) => expect(safeNext(value)).toBe("/beranda"),
  );
});
