import { describe, expect, it } from "vitest";
import { mockMessage } from "@/lib/mock";
import { buildRows } from "./message-rows";

const a = { id: "a", display_name: "A" };
const b = { id: "b", display_name: "B" };
const msg = (id: string, sender: typeof a, created_at: string, is_intro = false) =>
  mockMessage({ id, sender, created_at, is_intro });

describe("buildRows", () => {
  it("groups consecutive messages and splits on sender, gap and intro", () => {
    const rows = buildRows(
      [
        msg("1", a, "2026-08-01T10:00:00"),
        msg("2", a, "2026-08-01T10:01:00"),
        msg("3", b, "2026-08-01T10:02:00"),
        msg("4", b, "2026-08-01T10:20:00"),
        msg("5", b, "2026-08-01T10:21:00", true),
      ],
      "me",
      null,
    );
    expect(rows.flatMap((r) => (r.type === "message" ? [r.compact] : []))).toEqual([false, true, false, false, false]);
  });

  it("adds a divider per day", () => {
    const rows = buildRows([msg("1", a, "2026-08-01T10:00:00"), msg("2", a, "2026-08-02T10:00:00")], "me", null);
    expect(rows.map((r) => r.type)).toEqual(["day", "message", "day", "message"]);
  });

  it("places one unread marker before the first unread message from someone else", () => {
    const rows = buildRows(
      [msg("1", a, "2026-08-01T10:00:00Z"), msg("2", { id: "me", display_name: "Me" }, "2026-08-01T10:05:00Z"), msg("3", a, "2026-08-01T10:06:00Z"), msg("4", a, "2026-08-01T10:07:00Z")],
      "me",
      "2026-08-01T10:01:00Z",
    );
    expect(rows.map((r) => r.type)).toEqual(["day", "message", "message", "unread", "message", "message"]);
  });
});
