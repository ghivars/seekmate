"use client";

import { Compass, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConnectionList, PendingConnections } from "@/components/connections";
import { JoinSheet } from "@/components/lobby/join-sheet";
import { LobbyCard } from "@/components/lobby/lobby-card";
import { HeroGlow, Page, Section } from "@/components/shell/page";
import { useShell } from "@/components/shell/shell-context";
import { buttonClass, Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { CountBadge } from "@/components/ui/tag";
import { useMe } from "@/lib/auth";
import { useMyCourses, useMyLobbies, useRecommendedLobbies, type Lobby } from "@/lib/data";

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

function CardSkeletons() {
  return (
    <div role="status" aria-label="Memuat" className={GRID}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-44 rounded-2xl" />
      ))}
    </div>
  );
}

export default function HomePage() {
  const me = useMe();
  const [joining, setJoining] = useState<Lobby | null>(null);
  return (
    <Page title="Beranda" wide>
      <div className="doodle-hero relative isolate mb-10 grid gap-6 -mx-4 -mt-6 px-6 py-8 sm:-mx-8 sm:px-10 sm:py-10 lg:grid-cols-[1fr_380px] lg:items-center">
        <HeroGlow />
        <div>
          <p className="label-mono text-amber">Selamat datang kembali</p>
          <h2 className="mt-2 text-4xl font-bold sm:text-5xl">
            Halo, {me.display_name.split(" ")[0]}{" "}
            <span aria-hidden className="inline-block origin-[70%_70%] animate-[wave_2.4s_ease-in-out_infinite]">
              👋
            </span>
          </h2>
          <p className="mt-3 max-w-xl text-muted">Siap cari teman belajar hari ini? Ini rangkuman ruang belajarmu.</p>
        </div>
        <Link
          href="/krs"
          className="group ease-ui flex items-center gap-4 rounded-2xl border border-amber/40 bg-raised p-5 transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_var(--glow)]"
        >
          <span aria-hidden className="text-4xl">🧠</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold">Analisis KRS</span>
            <span className="block text-sm text-muted">Cek beban SKS dan dapat saran sebelum submit.</span>
          </span>
          <Sparkles size={20} className="text-amber transition-transform group-hover:rotate-12" aria-hidden />
        </Link>
      </div>
      <PendingConnections />
      <Courses />
      <MyLobbies />
      <Section title="Rekomendasi lobby" tone="amber">
        {me.preferences === null && (
          <p className="mb-4 rounded-xl border border-line bg-raised px-4 py-3 text-sm">
            Lengkapi preferensi supaya rekomendasi diurutkan berdasarkan kecocokan.{" "}
            <Link href="/kamu" className="font-semibold text-link hover:underline">
              Isi preferensi
            </Link>
          </p>
        )}
        <Recommended onJoin={setJoining} />
      </Section>
      <ConnectionList />
      <JoinSheet lobby={joining} onClose={() => setJoining(null)} />
    </Page>
  );
}

function Courses() {
  const courses = useMyCourses();
  const { openAddCourse } = useShell();
  return (
    <Section
      title="Mata kuliah saya"
      action={
        <Button variant="ghost" onClick={openAddCourse}>
          <Plus size={16} aria-hidden /> Tambah
        </Button>
      }
    >
      {courses.isPending && <Skeleton className="h-16 rounded-2xl" />}
      {courses.isError && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
      {courses.data?.length === 0 && (
        <EmptyState
          title="Belum ada mata kuliah"
          action={
            <Link href="/jelajah" className={buttonClass("primary")}>
              <Compass size={17} aria-hidden /> Jelajah mata kuliah
            </Link>
          }
        >
          Tambahkan mata kuliah yang rencananya mau kamu ambil.
        </EmptyState>
      )}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {courses.data?.map((course) => (
          <li key={course.id}>
            <Link
              href={`/c/${course.id}`}
              className="ease-ui flex min-h-16 items-center gap-3 rounded-xl border border-line bg-raised px-4 py-2.5 transition-colors hover:border-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{course.name}</span>
                <span className="block text-[13px] text-muted">
                  {course.code} · {course.lobby_count} lobby
                </span>
              </span>
              <CountBadge count={course.unread_count} label="pesan belum dibaca" />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function MyLobbies() {
  const lobbies = useMyLobbies();
  if (lobbies.data?.length === 0) return null;
  return (
    <Section title="Lobby saya">
      {lobbies.isPending && <CardSkeletons />}
      {lobbies.isError && <ErrorState error={lobbies.error} onRetry={() => void lobbies.refetch()} />}
      <div className={GRID}>
        {lobbies.data?.map((lobby) => (
          <LobbyCard key={lobby.id} lobby={lobby} showCourse />
        ))}
      </div>
    </Section>
  );
}

function Recommended({ onJoin }: { onJoin: (lobby: Lobby) => void }) {
  const lobbies = useRecommendedLobbies();
  if (lobbies.isPending) return <CardSkeletons />;
  if (lobbies.isError) return <ErrorState error={lobbies.error} onRetry={() => void lobbies.refetch()} />;
  if (lobbies.data.length === 0) {
    return (
      <EmptyState title="Belum ada rekomendasi">
        Rekomendasi diambil dari mata kuliah di rencanamu. Kamu juga bisa membuat lobby sendiri.
      </EmptyState>
    );
  }
  return (
    <div className={GRID}>
      {lobbies.data.map((lobby) => (
        <LobbyCard key={lobby.id} lobby={lobby} showCourse onJoin={onJoin} />
      ))}
    </div>
  );
}
