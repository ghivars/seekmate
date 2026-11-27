"use client";

import { ArrowRight, Check, Plus, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { JoinSheet } from "@/components/lobby/join-sheet";
import { LobbyCard } from "@/components/lobby/lobby-card";
import { HeroGlow, Page, Section } from "@/components/shell/page";
import { useShell } from "@/components/shell/shell-context";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { LiveDot, Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/cn";
import {
  useCourseSearch,
  useDiscoverLobbies,
  useSemester,
  useTogglePlanned,
  type Course,
  type DiscoverSort,
  type Lobby,
} from "@/lib/data";

const SORTS: { value: DiscoverSort; label: string }[] = [
  { value: "match", label: "Paling cocok" },
  { value: "popular", label: "Paling ramai 🔥" },
  { value: "newest", label: "Terbaru" },
];

export default function DiscoverPage() {
  const me = useMe();
  const { openCreateLobby } = useShell();
  const semester = useSemester();
  const [query, setQuery] = useState("");
  const [faculty, setFaculty] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<DiscoverSort>(me.preferences ? "match" : "popular");
  const [joining, setJoining] = useState<Lobby | null>(null);
  const q = useDeferredValue(query.trim());
  const courses = useCourseSearch(q);
  const allCourses = useCourseSearch("");
  const lobbies = useDiscoverLobbies({ q, faculty, has_slot: openOnly, sort, limit: 9 });
  const faculties = useMemo(
    () => [...new Set((allCourses.data ?? []).map((c) => c.faculty_or_dept).filter(Boolean))].sort(),
    [allCourses.data],
  );
  const catalog = (courses.data ?? []).filter((c) => !faculty || c.faculty_or_dept === faculty);
  const activeCount = (allCourses.data ?? []).reduce((sum, c) => sum + c.lobby_count, 0);

  return (
    <Page title="Jelajah Lobby Belajar" badge={`${activeCount} lobby aktif`} wide>
      <div className="doodle-hero relative isolate mb-8 -mx-4 -mt-6 rounded-b-3xl px-6 py-8 sm:-mx-8 sm:px-10 sm:py-10">
        <HeroGlow />
        <div className="flex flex-wrap items-end gap-6">
          <div className="min-w-0 flex-1">
            <p className="label-mono flex items-center gap-2 text-amber">
              <LiveDot tone="amber" /> {semester.data?.name ?? "Semester aktif"}
            </p>
            <h2 className="mt-2 text-4xl font-bold sm:text-5xl">
              Jelajah Study Lobby <span aria-hidden className="inline-block animate-[float_3s_ease-in-out_infinite]">🚀</span>
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              Temukan ruang kolaborasi, bedah soal bareng, atau cuma cari teman ngopi sebelum KRS. Belajar jadi lebih seru
              kalau ada temannya.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/krs" className={buttonClass("soft")}>
              <Sparkles size={17} className="text-amber" aria-hidden /> Analisis KRS
            </Link>
            <Button onClick={() => openCreateLobby("")}>
              <Plus size={18} aria-hidden /> Buat Lobby Baru
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-10 space-y-4 rounded-2xl border border-line bg-raised/70 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-60 flex-1">
            <span className="sr-only">Cari mata kuliah, kode, atau nama lobby</span>
            <Search size={17} aria-hidden className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari mata kuliah, kode, atau nama lobby..."
              className="h-12 w-full rounded-xl border border-line bg-app pr-3 pl-10 text-[16px] placeholder:text-muted focus:border-link focus:outline-none sm:text-[15px]"
            />
          </label>
          <label className="flex h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-app px-3 text-sm">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
              className="size-4 accent-[var(--amber)]"
            />
            Masih ada slot
          </label>
          <select
            aria-label="Urutkan lobby"
            value={sort}
            onChange={(e) => setSort(SORTS.find((s) => s.value === e.target.value)?.value ?? "match")}
            className="h-12 rounded-xl border border-line bg-app px-3 text-sm"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} disabled={s.value === "match" && !me.preferences}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter fakultas">
          {["", ...faculties].map((f) => (
            <button
              key={f || "all"}
              type="button"
              aria-pressed={faculty === f}
              onClick={() => setFaculty(f)}
              className={cn(
                "ease-ui min-h-10 shrink-0 rounded-lg px-3.5 font-mono text-xs font-semibold transition-colors",
                faculty === f ? "bg-primary text-on-primary" : "bg-app text-muted hover:text-fg",
              )}
            >
              {f || "Semua fakultas"}
            </button>
          ))}
        </div>
      </div>

      <Section
        title="Lobby yang sedang buka"
        badge={lobbies.data ? `${lobbies.data.length} rekomendasi` : undefined}
        action={
          <span className="flex items-center gap-2 text-sm text-muted">
            <LiveDot /> Update tiap 20 detik
          </span>
        }
      >
        {lobbies.isPending && <CardSkeletons />}
        {lobbies.isError && <ErrorState error={lobbies.error} onRetry={() => void lobbies.refetch()} />}
        {lobbies.data?.length === 0 && (
          <EmptyState
            icon={<span className="text-4xl">🛋️</span>}
            title="Masih sepi di sini"
            action={
              <Button onClick={() => openCreateLobby("")}>
                <Plus size={17} aria-hidden /> Jadi yang pertama buat lobby
              </Button>
            }
          >
            Belum ada lobby yang cocok dengan pencarianmu. Buka satu, nanti teman menyusul.
          </EmptyState>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lobbies.data?.map((lobby) => (
            <LobbyCard key={lobby.id} lobby={lobby} onJoin={setJoining} />
          ))}
        </div>
      </Section>

      <Section
        title="Katalog mata kuliah"
        tone="amber"
        action={<span className="label-mono text-muted">{catalog.length} mata kuliah</span>}
      >
        {courses.isPending && <Skeleton className="h-64 rounded-2xl" />}
        {courses.isError && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
        {courses.data && catalog.length === 0 && (
          <EmptyState icon={<Search size={28} />} title="Mata kuliah tidak ketemu">
            Coba nama, kode, atau fakultas lain.
          </EmptyState>
        )}
        {catalog.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-line bg-raised">
            <div className="label-mono hidden grid-cols-[1fr_160px_150px_190px] gap-4 border-b border-line px-5 py-3 text-muted md:grid">
              <span>Mata kuliah &amp; kode</span>
              <span>Lobby aktif</span>
              <span>Teman sekelas</span>
              <span className="text-right">Aksi</span>
            </div>
            <ul className="divide-y divide-line">
              {catalog.map((course) => (
                <CatalogRow key={course.id} course={course} />
              ))}
            </ul>
          </div>
        )}
      </Section>
      <JoinSheet lobby={joining} onClose={() => setJoining(null)} />
    </Page>
  );
}

function CardSkeletons() {
  return (
    <div role="status" aria-label="Memuat lobby" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-72 rounded-2xl" />
      ))}
    </div>
  );
}

function CatalogRow({ course }: { course: Course }) {
  const toggle = useTogglePlanned();
  const toast = useToast();
  const { openCreateLobby } = useShell();
  return (
    <li className="grid items-center gap-3 px-4 py-4 sm:px-5 md:grid-cols-[1fr_160px_150px_190px] md:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 rounded-md border border-line bg-app px-2 py-1 font-mono text-sm font-semibold text-amber">
          {course.code}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{course.name}</p>
          <p className="truncate font-mono text-[11px] text-muted">
            {course.credits} SKS · {course.faculty_or_dept}
            {course.is_sample && " · contoh"}
          </p>
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm">
        {course.lobby_count > 0 ? (
          <>
            <LiveDot /> <span className="text-mint">{course.lobby_count} lobby aktif</span>
          </>
        ) : (
          <>
            <span aria-hidden className="size-2 rounded-full bg-muted/50" />
            <span className="text-muted">Belum ada lobby</span>
          </>
        )}
      </p>
      <p className="font-mono text-sm text-muted">
        {course.planner_count > 0 ? `${course.planner_count} mahasiswa` : "Belum ada"}
      </p>
      <div className="flex items-center gap-2 md:justify-end">
        {course.lobby_count > 0 ? (
          <Link href={`/c/${course.id}`} className={buttonClass("soft") + " max-md:flex-1"}>
            Lihat lobby <ArrowRight size={15} aria-hidden />
            <span className="sr-only"> {course.name}</span>
          </Link>
        ) : (
          <Button variant="soft" className="max-md:flex-1" onClick={() => openCreateLobby(course.id)}>
            <Plus size={15} aria-hidden /> Buat lobby<span className="sr-only"> {course.name}</span>
          </Button>
        )}
        <button
          type="button"
          aria-pressed={course.is_planned}
          aria-label={`${course.is_planned ? "Hapus dari" : "Tambah ke"} rencana: ${course.name}`}
          title={course.is_planned ? "Ada di rencanamu" : "Tambah ke rencana"}
          onClick={() =>
            toggle.mutate({ courseId: course.id, planned: !course.is_planned }, { onError: (e) => toast(e.message) })
          }
          className={cn(
            "ease-ui inline-flex size-11 shrink-0 items-center justify-center rounded-lg border transition-colors sm:size-10",
            course.is_planned ? "border-mint/40 bg-mint/10 text-mint" : "border-line text-muted hover:border-muted hover:text-fg",
          )}
        >
          {course.is_planned ? <Check size={17} /> : <Plus size={17} />}
        </button>
        {course.is_planned && <Tag tone="mint" className="md:hidden">Di rencana</Tag>}
      </div>
    </li>
  );
}
