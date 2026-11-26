import { describe, expect, it } from "vitest";
import { flatten, removeMessage, upsertMessage, type History } from "./chat-cache";
import { mockMessage } from "./mock";

const at = (n: number) => `2026-08-01T10:0${n}:00Z`;
const m = (id: string, n: number, body = id) => mockMessage({ id, body, created_at: at(n) });
const history: History = {
  pages: [
    { items: [m("c", 3), m("d", 4)], next_cursor: "x" },
    { items: [m("a", 1), m("b", 2)], next_cursor: null },
  ],
  pageParams: [null, "x"],
};

describe("chat cache", () => {
  it("flattens newest-first pages into reading order", () => {
    expect(flatten(history).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("appends once, even when the same event arrives twice", () => {
    const twice = upsertMessage(upsertMessage(history, m("e", 5)), m("e", 5));
    expect(flatten(twice).map((x) => x.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("replaces an edited message in any page", () => {
    const next = upsertMessage(history, m("a", 1, "diedit"));
    expect(flatten(next)[0]?.body).toBe("diedit");
  });
  it("blanks deleted messages", () => {
    const next = flatten(removeMessage(history, "b"));
    expect(next[1]).toMatchObject({ deleted: true, body: "" });
  });
});
