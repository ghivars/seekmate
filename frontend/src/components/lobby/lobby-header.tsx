"use client";

import { Bell, Flag, Hash, LogOut, MoreVertical, Search, Share2, UsersRound, DoorClosed } from "lucide-react";
import Link from "next/link";
import { IconButton } from "@/components/ui/button";
import { MenuItem, Popover } from "@/components/ui/popover";
import { CountBadge, Tag } from "@/components/ui/tag";
import { MenuButton } from "@/components/shell/page";
import { useShell } from "@/components/shell/shell-context";
import { useMe } from "@/lib/auth";
import { useUnreadNotifications, type Lobby } from "@/lib/data";
import { MatchBadge } from "./match-popover";

interface Props {
  lobby: Lobby;
  onReport: () => void;
  onLeave: () => void;
  onClose: () => void;
  onShare: () => void;
}

export function LobbyHeader({ lobby, onReport, onLeave, onClose, onShare }: Props) {
  const { membersOpen, setMembersOpen, openSwitcher } = useShell();
  const me = useMe();
  const unread = useUnreadNotifications();
  const active = lobby.status === "open" || lobby.status === "full";
  return (
    <header className="flex h-15 shrink-0 items-center gap-1 border-b border-line px-1 sm:gap-2 sm:px-3">
      <MenuButton />
      <Hash size={18} aria-hidden className="shrink-0 text-muted max-sm:hidden" />
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <h1 className="truncate font-semibold">{lobby.title}</h1>
        <p className="min-w-0 flex-1 truncate text-sm text-muted max-lg:hidden">{lobby.description}</p>
      </div>
      <Tag tone={lobby.status === "full" ? "amber" : "neutral"} className="max-sm:hidden">
        <UsersRound size={12} aria-hidden /> {lobby.member_count}/{lobby.capacity}
      </Tag>
      <MatchBadge match={lobby.match} isCreator={lobby.creator.id === me.id} />
      <IconButton label="Cari cepat (Ctrl+K)" onClick={openSwitcher} className="max-sm:hidden">
        <Search size={18} />
      </IconButton>
      <Link
        href="/notifikasi"
        aria-label="Notifikasi"
        title="Notifikasi"
        className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-fg max-sm:hidden"
      >
        <Bell size={18} aria-hidden />
        <span className="absolute -top-0.5 -right-0.5">
          <CountBadge count={unread} label="belum dibaca" />
        </span>
      </Link>
      <IconButton
        label={membersOpen ? "Tutup daftar anggota" : "Buka daftar anggota"}
        aria-expanded={membersOpen}
        onClick={() => setMembersOpen(!membersOpen)}
      >
        <UsersRound size={18} />
      </IconButton>
      <Popover
        label="Menu lobby"
        align="end"
        className="w-52"
        trigger={(props) => (
          <IconButton label="Menu lobby" {...props}>
            <MoreVertical size={18} />
          </IconButton>
        )}
      >
        {(close) => {
          const run = (fn: () => void) => () => {
            close();
            fn();
          };
          return (
            <>
              <MenuItem icon={<Share2 size={16} />} onClick={run(onShare)}>
                Bagikan lobby
              </MenuItem>
              {lobby.my_role === "owner" && active && (
                <MenuItem danger icon={<DoorClosed size={16} />} onClick={run(onClose)}>
                  Tutup lobby
                </MenuItem>
              )}
              {lobby.is_member && active && (
                <MenuItem danger icon={<LogOut size={16} />} onClick={run(onLeave)}>
                  Keluar dari lobby
                </MenuItem>
              )}
              {lobby.creator.id !== me.id && (
                <MenuItem danger icon={<Flag size={16} />} onClick={run(onReport)}>
                  Laporkan lobby
                </MenuItem>
              )}
            </>
          );
        }}
      </Popover>
    </header>
  );
}
