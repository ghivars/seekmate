"use client";

import { Bell, Compass, House, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CountBadge, MatchNote, Tag } from "@/components/ui/tag";
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
    { href: "/jelajah", label: "Jelajah Semua", icon: Compass },
    { href: "/krs", label: "Analisis KRS", icon: Sparkles, chip: "AI" },
    { href: "/notifikasi", label: "Notifikasi", icon: Bell },
    { href: "/kamu", label: "Kamu", icon: UserRound },
    ...(me.role === "admin" ? [{ href: "/admin", label: "Laporan (admin)", icon: ShieldCheck }] : []),
  ];
  return (
    <>
      <div className="flex h-15 shrink-0 flex-col justify-center border-b border-line px-4">
        <span className="font-display text-lg leading-tight font-bold">SeekMate</span>
        <span className="label-mono text-muted">Cari teman sebelum KRS</span>
      </div>
      <nav aria-label="Menu utama" className="min-h-0 flex-1 overflow-y-auto p-2" onKeyDown={rovingKeyDown}>
        <h3 className="label-mono mt-2 mb-1.5 px-2.5 text-muted">Ruang temu</h3>
        <ul className="space-y-0.5">
          {links.map(({ href, label, icon: Icon, chip }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  data-nav
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "ease-ui relative flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 transition-colors sm:min-h-10",
                    active ? "bg-raised font-semibold text-fg" : "text-muted hover:bg-raised/70 hover:text-fg",
                  )}
                >
                  {active && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary" />}
                  <Icon size={18} aria-hidden className={active ? "text-link" : undefined} />
                  <span className="flex-1">{label}</span>
                  {chip && <Tag tone="amber">{chip}</Tag>}
                  {href === "/notifikasi" && <CountBadge count={unread} label="notifikasi belum dibaca" />}
                </Link>
              </li>
            );
          })}
        </ul>
        <h3 className="label-mono mt-6 mb-1.5 px-2.5 text-muted">Lobby aktif kamu</h3>
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
