import { dayKey } from "@/lib/format";
import type { ChatMessage } from "@/lib/data";

export type Row =
  | { type: "day"; key: string; iso: string }
  | { type: "unread"; key: string }
  | { type: "message"; key: string; message: ChatMessage; compact: boolean };

const GROUP_WINDOW_MS = 7 * 60_000;

/** Flatten messages into virtual rows: day dividers, unread marker, grouped messages. */
export function buildRows(messages: ChatMessage[], meId: string, lastReadAt: string | null): Row[] {
  const rows: Row[] = [];
  let previous: ChatMessage | null = null;
  let marked = lastReadAt === null;
  for (const message of messages) {
    const newDay = !previous || dayKey(previous.created_at) !== dayKey(message.created_at);
    if (newDay) rows.push({ type: "day", key: `day-${dayKey(message.created_at)}`, iso: message.created_at });
    const isUnread =
      !marked && message.sender.id !== meId && Date.parse(message.created_at) > Date.parse(lastReadAt ?? "");
    if (isUnread) {
      rows.push({ type: "unread", key: "unread" });
      marked = true;
    }
    const compact =
      !newDay &&
      !isUnread &&
      previous !== null &&
      previous.sender.id === message.sender.id &&
      !previous.is_intro &&
      !message.is_intro &&
      Date.parse(message.created_at) - Date.parse(previous.created_at) < GROUP_WINDOW_MS;
    rows.push({ type: "message", key: message.client_id ?? message.id, message, compact });
    previous = message;
  }
  return rows;
}
