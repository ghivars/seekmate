import type { InfiniteData } from "@tanstack/react-query";
import type { Message, MessagePage } from "./types";

export type History = InfiniteData<MessagePage>;

/** Pages arrive newest first; render order is oldest first. */
export const flatten = (history: History | undefined): Message[] =>
  history ? [...history.pages].reverse().flatMap((page) => page.items) : [];

/** Insert or replace a message in the newest page, keeping chronological order. */
export function upsertMessage(history: History | undefined, message: Message): History | undefined {
  if (!history) return history;
  const exists = history.pages.some((p) => p.items.some((m) => m.id === message.id));
  const pages = history.pages.map((page, index) => {
    if (exists) return { ...page, items: page.items.map((m) => (m.id === message.id ? message : m)) };
    if (index !== 0) return page;
    const items = [...page.items, message].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    return { ...page, items };
  });
  return { ...history, pages };
}

export function removeMessage(history: History | undefined, id: string): History | undefined {
  if (!history) return history;
  const pages = history.pages.map((page) => ({
    ...page,
    items: page.items.map((m) => (m.id === id ? { ...m, deleted: true, body: "" } : m)),
  }));
  return { ...history, pages };
}
