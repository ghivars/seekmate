"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { JoinSheet } from "@/components/lobby/join-sheet";
import { LobbyCard } from "@/components/lobby/lobby-card";
import { Page } from "@/components/shell/page";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useCourse, useCourseLobbies, useTogglePlanned, type Lobby, type LobbyFilters } from "@/lib/data";
import { ATMOSPHERES, STUDY_GOALS, type Option } from "@/lib/labels";

const SELECT =
  "h-11 rounded-lg border border-line bg-raised px-3 pr-8 text-[16px] sm:h-10 sm:text-sm max-sm:flex-1 max-sm:min-w-32";

function FilterSelect<T extends string>({
  label,
  any,
  value,
  options,
  onChange,
}: {
  label: string;
  any: string;
  value: T | undefined;
  options: Option<T>[];
  onChange: (value: T | undefined) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(options.find((o) => o.value === e.target.value)?.value)}
      className={SELECT}
    >
      <option value="">{any}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const me = useMe();
  const toast = useToast();
  const { openCreateLobby } = useShell();
  const hasPreferences = me.preferences !== null;
  const [filters, setFilters] = useState<LobbyFilters>({ sort: hasPreferences ? "match" : "newest" });
  const [joining, setJoining] = useState<Lobby | null>(null);
  const course = useCourse(courseId);
  const lobbies = useCourseLobbies(courseId, filters);
  const toggle = useTogglePlanned();
  const filtered = Boolean(filters.study_goal || filters.atmosphere || filters.has_slot);

  if (course.isError) {
    return (
      <Page title="Mata kuliah">
        <ErrorState error={course.error} onRetry={() => void course.refetch()} />
      </Page>
    );
  }

  return (
    <Page title={course.data?.name ?? "Memuat..."}>
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {course.data ? (
          <p className="text-muted">
            {course.data.code} · {course.data.faculty_or_dept} · {course.data.credits} SKS{" "}
            {course.data.is_sample && <Tag>Data contoh</Tag>}
          </p>
        ) : (
          <Skeleton className="h-5 w-56" />
        )}
        <div className="ml-auto flex gap-2 max-sm:w-full">
          {course.data && !course.data.is_planned && (
            <Button
              variant="soft"
              className="max-sm:flex-1"
              onClick={() => toggle.mutate({ courseId, planned: true }, { onError: (e) => toast(e.message) })}
            >
              Tambah ke rencana
            </Button>
          )}
          <Button className="max-sm:flex-1" onClick={() => openCreateLobby(courseId)}>
            <Plus size={17} aria-hidden /> Buat Lobby
          </Button>
        </div>
      </div>

      <h2 className="sr-only">Daftar lobby</h2>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter lobby">
        <FilterSelect
          label="Tujuan"
          any="Semua tujuan"
          value={filters.study_goal}
          options={STUDY_GOALS}
          onChange={(study_goal) => setFilters({ ...filters, study_goal })}
        />
        <FilterSelect
          label="Suasana"
          any="Semua suasana"
          value={filters.atmosphere}
          options={ATMOSPHERES}
          onChange={(atmosphere) => setFilters({ ...filters, atmosphere })}
        />
        <button
          type="button"
          aria-pressed={Boolean(filters.has_slot)}
          onClick={() => setFilters({ ...filters, has_slot: filters.has_slot ? undefined : true })}
          className={cn(SELECT, "pr-3", filters.has_slot && "border-link text-link")}
        >
          Masih ada slot
        </button>
        <select
          aria-label="Urutkan"
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value === "match" ? "match" : "newest" })}
          className={cn(SELECT, "sm:ml-auto")}
        >
          <option value="match" disabled={!hasPreferences}>
            Paling cocok
          </option>
          <option value="newest">Terbaru</option>
        </select>
      </div>

      {!hasPreferences && (
        <p className="mb-4 rounded-xl border border-line bg-raised px-4 py-3 text-sm">
          Isi preferensi belajarmu untuk melihat skor kecocokan.{" "}
          <Link href="/kamu" className="font-semibold text-link hover:underline">
            Isi sekarang
          </Link>
        </p>
      )}

      {lobbies.isPending && (
        <div role="status" aria-label="Memuat lobby" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      )}
      {lobbies.isError && <ErrorState error={lobbies.error} onRetry={() => void lobbies.refetch()} />}
      {lobbies.data?.length === 0 &&
        (filtered ? (
          <EmptyState
            icon={<Search size={28} />}
            title="Tidak ada lobby yang cocok dengan filter"
            action={
              <Button variant="soft" onClick={() => setFilters({ sort: filters.sort })}>
                Hapus filter
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Jadilah yang pertama membuat lobby"
            action={
              <Button onClick={() => openCreateLobby(courseId)}>
                <Plus size={17} aria-hidden /> Buat Lobby
              </Button>
            }
          >
            Buka lobby dulu, nanti teman satu mata kuliah bisa menyusul.
          </EmptyState>
        ))}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lobbies.data?.map((lobby) => (
          <LobbyCard key={lobby.id} lobby={lobby} onJoin={setJoining} />
        ))}
      </div>
      <JoinSheet lobby={joining} onClose={() => setJoining(null)} />
    </Page>
  );
}
