"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, Flag, Pencil, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/lib/data";
import { formatDay, formatTime } from "@/lib/format";
import { buildRows, type Row } from "./message-rows";

interface Props {
  messages: ChatMessage[];
  meId: string;
  lastReadAt: string | null;
  header: ReactNode;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  canAct: boolean;
  canEdit: boolean;
  onReport: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onRetry: (message: ChatMessage) => void;
  onReachBottom: () => void;
}

const NEAR_BOTTOM = 80;

export function MessageList(props: Props) {
  const { messages, meId, lastReadAt, header, hasMore, loadingMore, onLoadMore, onReachBottom } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => buildRows(messages, meId, lastReadAt), [messages, meId, lastReadAt]);
  const [atBottom, setAtBottom] = useState(true);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());
  const started = useRef(false);
  const previous = useRef<{ first: string; size: number; count: number }>({ first: "", size: 0, count: 0 });

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: (i) => (rows[i]?.type === "message" ? 56 : 40),
    getItemKey: (i) => rows[i]?.key ?? i,
    overscan: 12,
  });
  const total = virtualizer.getTotalSize();
  const first = messages[0]?.id ?? "";
  const last = messages.at(-1);

  // Keep the viewport stable: stick to the bottom, or preserve position when history is prepended.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || rows.length === 0) return;
    if (!started.current) {
      started.current = true;
      const unread = rows.findIndex((r) => r.type === "unread");
      if (unread >= 0) virtualizer.scrollToIndex(unread, { align: "center" });
      else virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
    } else if (previous.current.first !== first && rows.length > previous.current.count) {
      el.scrollTop += total - previous.current.size;
    } else if (atBottom || (rows.length > previous.current.count && last?.sender.id === meId)) {
      virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
    }
    previous.current = { first, size: total, count: rows.length };
  }, [rows, total, first, atBottom, virtualizer, last, meId]);

  useEffect(() => {
    if (!atBottom || !last) return;
    onReachBottom();
    // Messages that arrived in a background tab count as read once the tab is visible again.
    document.addEventListener("visibilitychange", onReachBottom);
    return () => document.removeEventListener("visibilitychange", onReachBottom);
  }, [atBottom, last, onReachBottom]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM);
    if (el.scrollTop < 120 && hasMore && !loadingMore) onLoadMore();
  };

  const focusRow = (key: string) => {
    const index = rows.findIndex((r) => r.key === key);
    if (index < 0) return;
    setFocusKey(key);
    virtualizer.scrollToIndex(index, { align: "auto" });
    requestAnimationFrame(() => scroller.current?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus());
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    const keys = rows.filter((r) => r.type === "message").map((r) => r.key);
    const current = focusKey ? keys.indexOf(focusKey) : keys.length;
    const next = { ArrowUp: current - 1, ArrowDown: current + 1, Home: 0, End: keys.length - 1 }[e.key] ?? 0;
    const target = keys[Math.max(0, Math.min(next, keys.length - 1))];
    if (!target) return;
    e.preventDefault();
    focusRow(target);
  };

  const announce =
    last && last.sender.id !== meId && Date.parse(last.created_at) > openedAt && !last.deleted
      ? `${last.sender.display_name}: ${last.body}`
      : "";

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Pesan. Gunakan panah atas dan bawah untuk berpindah."
        className="h-full overflow-x-hidden overflow-y-auto outline-offset-[-2px]"
      >
        <div className="flex min-h-full flex-col justify-end pb-3">
          {!hasMore && header}
          {loadingMore && <p className="py-2 text-center text-xs text-muted">Memuat pesan lama...</p>}
          <div data-messages className="relative w-full shrink-0" style={{ height: total }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              if (!row) return null;
              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <RowView row={row} {...props} focused={row.key === focusKey} onFocus={() => setFocusKey(row.key)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {!atBottom && rows.length > 0 && (
        <button
          type="button"
          onClick={() => virtualizer.scrollToIndex(rows.length - 1, { align: "end", behavior: "auto" })}
          className="absolute bottom-3 left-1/2 flex min-h-11 -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-raised px-4 text-sm font-semibold shadow-lg sm:min-h-9"
        >
          <ArrowDown size={15} aria-hidden /> Ke pesan terbaru
        </button>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

type RowProps = Props & { row: Row; focused: boolean; onFocus: () => void };

function RowView({ row, ...props }: RowProps) {
  if (row.type === "day") {
    return (
      <div role="separator" className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-muted">
        <span className="h-px flex-1 bg-line" />
        {formatDay(row.iso)}
        <span className="h-px flex-1 bg-line" />
      </div>
    );
  }
  if (row.type === "unread") {
    return (
      <div role="separator" className="flex items-center gap-3 px-4 py-1.5 text-xs font-semibold text-danger">
        <span className="h-px flex-1 bg-danger/60" />
        Pesan baru
      </div>
    );
  }
  return <MessageRow {...props} message={row.message} compact={row.compact} rowKey={row.key} />;
}

interface MessageRowProps extends Omit<RowProps, "row"> {
  message: ChatMessage;
  compact: boolean;
  rowKey: string;
}

function MessageRow(props: MessageRowProps) {
  const { message, compact, rowKey, meId, canAct, canEdit, focused, onFocus } = props;
  const mine = message.sender.id === meId;
  const actionable = !message.deleted && !message.state && (mine ? canEdit : canAct);
  return (
    <div
      role="article"
      aria-label={`Pesan dari ${message.sender.display_name}`}
      data-key={rowKey}
      tabIndex={focused ? 0 : -1}
      onFocus={onFocus}
      className={cn(
        "group/msg relative flex gap-3 px-4 hover:bg-app/45 focus-visible:bg-app/60",
        compact ? "py-0.5" : "mt-2 py-1",
        message.is_intro && "mx-2 rounded-xl border-l-3 border-amber bg-amber/8 px-3 py-2",
      )}
    >
      <div className="w-10 shrink-0">
        {compact ? (
          <span className="invisible block pt-1 text-right text-[11px] text-muted tabular-nums group-hover/msg:visible">
            {formatTime(message.created_at)}
          </span>
        ) : (
          <Avatar id={message.sender.id} name={message.sender.display_name} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {compact ? (
          <span className="sr-only">
            {message.sender.display_name}, {formatTime(message.created_at)}:{" "}
          </span>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{message.sender.display_name}</span>
            {message.is_intro && <Tag tone="amber">Perkenalan</Tag>}
            <time dateTime={message.created_at} className="text-xs text-muted">
              {formatTime(message.created_at)}
            </time>
          </p>
        )}
        {message.deleted ? (
          <p className="text-muted italic">Pesan dihapus</p>
        ) : (
          <p className={cn("[overflow-wrap:anywhere] whitespace-pre-wrap", message.state === "sending" && "opacity-60")}>
            {message.body}
            {message.edited_at && <span className="ml-1.5 text-xs text-muted">(diedit)</span>}
          </p>
        )}
        {message.state === "failed" && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-danger">
            {message.error ?? "Belum terkirim."}
            <button
              type="button"
              onClick={() => props.onRetry(message)}
              className="inline-flex min-h-11 items-center gap-1 font-semibold underline sm:min-h-7"
            >
              <RotateCw size={13} aria-hidden /> Coba kirim lagi
            </button>
          </p>
        )}
      </div>
      {actionable && (
        <div className="absolute -top-3 right-3 flex rounded-lg border border-line bg-raised opacity-0 shadow-md group-focus-within/msg:opacity-100 group-hover/msg:opacity-100">
          {mine ? (
            <>
              <IconButton label="Edit pesan" className="sm:size-8" onClick={() => props.onEdit(message)}>
                <Pencil size={15} />
              </IconButton>
              <IconButton label="Hapus pesan" className="sm:size-8" onClick={() => props.onDelete(message)}>
                <Trash2 size={15} />
              </IconButton>
            </>
          ) : (
            <IconButton label="Laporkan pesan" className="sm:size-8" onClick={() => props.onReport(message)}>
              <Flag size={15} />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}
