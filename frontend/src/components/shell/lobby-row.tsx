"use client";

import { Hash, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CountBadge, MatchChip } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import type { Lobby } from "@/lib/data";

export function LobbyRow({ lobby }: { lobby: Lobby }) {
  const { lobbyId } = useParams<{ lobbyId?: string }>();
  const active = lobby.id === lobbyId;
  const full = lobby.status === "full";
  const locked = full || lobby.visibility === "closed" || lobby.status === "expired";
  const unread = lobby.unread_count > 0;
  return (
    <li>
      <Link
        data-nav
        href={`/c/${lobby.course_id}/${lobby.id}`}
        aria-current={active ? "page" : undefined}
        title={lobby.title}
        className={cn(
          "ease-ui flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors sm:min-h-8",
          active ? "bg-raised text-fg" : "text-muted hover:bg-raised/70 hover:text-fg",
          unread && "font-semibold text-fg",
        )}
      >
        {locked ? <Lock size={15} aria-hidden className="shrink-0" /> : <Hash size={15} aria-hidden className="shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{lobby.title}</span>
          {full && !lobby.is_member && <span className="block text-xs text-amber">penuh</span>}
        </span>
        <CountBadge count={lobby.unread_count} label="pesan belum dibaca" />
        {lobby.match && <MatchChip score={lobby.match.score} />}
        <span className="shrink-0 text-xs tabular-nums">
          <span className="sr-only">Anggota </span>
          {lobby.member_count}/{lobby.capacity}
        </span>
      </Link>
    </li>
  );
}
