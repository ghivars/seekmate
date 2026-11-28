"use client";

import { ArrowRight, CalendarClock, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ErrorState, Skeleton, SkeletonList } from "@/components/ui/states";
import { MatchNote } from "@/components/ui/tag";
import { useMe } from "@/lib/auth";
import { useConnections, useMyCourses, useMyLobbies, useSemester } from "@/lib/data";
import { rovingKeyDown } from "@/lib/roving";
import { LobbyRow } from "./lobby-row";

const DAY = 86_400_000;

function Heading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-6 mb-1.5 flex items-center justify-between px-2.5">
      <h3 className="label-mono text-muted">{children}</h3>
      {action}
    </div>
  );
}

/** Home panel: things about *you*, not navigation (the rail already has that). */
export function HomeSidebar() {
  const me = useMe();
  return (
    <>
      <div className="flex h-15 shrink-0 flex-col justify-center border-b border-line px-4">
        <span className="font-display text-lg leading-tight font-bold">SeekMate</span>
        <span className="label-mono text-muted">Cari teman sebelum KRS</span>
      </div>
      <nav aria-label="Ringkasan" className="min-h-0 flex-1 overflow-y-auto p-2" onKeyDown={rovingKeyDown}>
        <SemesterCard />
        <PendingRequests />
        <ActiveLobbies />
        <StudyPlan />
        <Friends />
        {me.role === "admin" && (
          <Link
            data-nav
            href="/admin"
            className="mt-6 flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-muted hover:bg-raised hover:text-fg sm:min-h-10"
          >
            <ShieldCheck size={17} aria-hidden /> Laporan (admin)
          </Link>
        )}
      </nav>
    </>
  );
}

function SemesterCard() {
  const semester = useSemester();
  // Day granularity: reading the clock once per mount is enough.
  const [now] = useState(() => Date.now());
  if (semester.isPending) return <Skeleton className="mt-1 h-20 rounded-xl" />;
  if (!semester.data) return null;
  const s = semester.data;
  const total = Date.parse(s.ends_at) - Date.parse(s.starts_at);
  const left = Math.max(0, Math.ceil((Date.parse(s.ends_at) - now) / DAY));
  const progress = Math.min(100, Math.max(0, ((now - Date.parse(s.starts_at)) / total) * 100));
  return (
    <div className="mt-1 rounded-xl border border-line bg-raised p-3">
      <p className="label-mono flex items-center gap-1.5 text-amber">
        <CalendarClock size={13} aria-hidden /> {s.name}
      </p>
      <p className="mt-1.5 text-sm">
        <span className="font-display text-xl font-bold">{left}</span> hari lagi semester selesai
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-amber" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-muted">Chat dihapus {s.grace_days} hari setelahnya. Simpan koneksimu.</p>
    </div>
  );
}

function PendingRequests() {
  const connections = useConnections();
  const pending = (connections.data ?? []).filter((c) => c.status === "pending" && c.direction === "incoming");
  if (pending.length === 0) return null;
  return (
    <Link
      data-nav
      href="/beranda"
      className="mt-3 flex min-h-11 items-center gap-2.5 rounded-xl border border-mint/40 bg-mint/10 px-3 py-2 text-sm"
    >
      <UserPlus size={17} aria-hidden className="text-mint" />
      <span className="flex-1">
        <strong>{pending.length}</strong> permintaan koneksi menunggu
      </span>
      <ArrowRight size={15} aria-hidden />
    </Link>
  );
}

function ActiveLobbies() {
  const lobbies = useMyLobbies();
  return (
    <>
      <Heading>Lobby aktif kamu</Heading>
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
      {lobbies.data?.some((l) => l.match) && <MatchNote className="px-2.5 pt-2" />}
    </>
  );
}

function StudyPlan() {
  const courses = useMyCourses();
  const total = (courses.data ?? []).reduce((sum, c) => sum + c.credits, 0);
  return (
    <>
      <Heading action={<span className="font-mono text-xs text-amber">{total} SKS</span>}>Rencana studi</Heading>
      {courses.isPending && <SkeletonList rows={2} className="h-8" />}
      <ul className="space-y-0.5">
        {courses.data?.map((c) => (
          <li key={c.id}>
            <Link
              data-nav
              href={`/c/${c.id}`}
              className="flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-sm text-muted hover:bg-raised hover:text-fg sm:min-h-8"
            >
              <span className="font-mono text-xs font-semibold text-amber">{c.code}</span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="font-mono text-[11px]">{c.credits}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        data-nav
        href="/krs"
        className="mx-1 mt-2 flex min-h-11 items-center gap-2 rounded-lg border border-amber/40 bg-amber/10 px-3 text-sm font-semibold text-amber hover:brightness-110 sm:min-h-9"
      >
        <Sparkles size={15} aria-hidden /> Cek beban SKS-ku
      </Link>
    </>
  );
}

function Friends() {
  const connections = useConnections();
  const friends = (connections.data ?? []).filter((c) => c.status === "accepted");
  return (
    <>
      <Heading>Teman terhubung</Heading>
      {friends.length === 0 ? (
        <p className="px-2.5 text-sm text-muted">Belum ada. Ajukan koneksi dari daftar anggota lobby.</p>
      ) : (
        <Link data-nav href="/beranda" className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-raised">
          <span className="flex -space-x-1.5">
            {friends.slice(0, 5).map((c) => (
              <span key={c.id} className="rounded-xl ring-2 ring-side" title={c.user.display_name}>
                <Avatar id={c.user.id} name={c.user.display_name} size="sm" />
              </span>
            ))}
          </span>
          <span className="text-sm text-muted">{friends.length} teman</span>
        </Link>
      )}
    </>
  );
}
