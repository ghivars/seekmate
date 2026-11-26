"use client";

import { Bell, Compass, House, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CountBadge, MatchNote } from "@/components/ui/tag";
import { ErrorState, SkeletonList } from "@/components/ui/states";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useMyLobbies, useUnreadNotifications } from "@/lib/data";
import { rovingKeyDown } from "@/lib/roving";
import { LobbyRow } from "./lobby-row";

export function HomeSidebar() {
  const pathname = usePathname();
  const me = useMe();
  const lobbies = useMyLobbies();
  const unread = useUnreadNotifications();
  const links = [
    { href: "/beranda", label: "Beranda", icon: House },
    { href: "/jelajah", label: "Jelajah", icon: Compass },
    { href: "/notifikasi", label: "Notifikasi", icon: Bell },
    { href: "/kamu", label: "Kamu", icon: UserRound },
    ...(me.role === "admin" ? [{ href: "/admin", label: "Laporan (admin)", icon: ShieldCheck }] : []),
  ];
  return (
    <>
      <div className="flex h-13 shrink-0 items-center border-b border-line px-4 font-semibold">SeekMate</div>
      <nav aria-label="Menu utama" className="min-h-0 flex-1 overflow-y-auto p-2" onKeyDown={rovingKeyDown}>
        <ul className="space-y-0.5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  data-nav
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "ease-ui flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 transition-colors sm:min-h-10",
                    active ? "bg-raised text-fg" : "text-muted hover:bg-raised/70 hover:text-fg",
                  )}
                >
                  <Icon size={18} aria-hidden />
                  <span className="flex-1">{label}</span>
                  {href === "/notifikasi" && <CountBadge count={unread} label="notifikasi belum dibaca" />}
                </Link>
              </li>
            );
          })}
        </ul>
        <h3 className="mt-5 mb-1 px-2.5 text-[13px] font-semibold text-muted">Lobby saya</h3>
        {lobbies.isPending && <SkeletonList rows={3} className="h-8" />}
        {lobbies.isError && <ErrorState error={lobbies.error} onRetry={() => void lobbies.refetch()} />}
        {lobbies.data?.length === 0 && (
          <p className="px-2.5 text-sm text-muted">Belum ada. Cari lobby di Jelajah, yuk.</p>
        )}
        <ul className="space-y-0.5">
          {lobbies.data?.map((lobby) => (
            <LobbyRow key={lobby.id} lobby={lobby} />
          ))}
        </ul>
        {lobbies.data?.some((l) => l.match) && <MatchNote className="px-2.5 pt-3" />}
      </nav>
    </>
  );
}
