"use client";

import { ChevronDown, LogOut, Plus, Search, Settings2, Share2, Compass } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MenuItem, Popover } from "@/components/ui/popover";
import { EmptyState, ErrorState, Skeleton, SkeletonList } from "@/components/ui/states";
import { MatchNote } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useCourse, useCourseLobbies, useTogglePlanned, type Lobby } from "@/lib/data";
import { STUDY_GOALS } from "@/lib/labels";
import { rovingKeyDown } from "@/lib/roving";
import { SemesterModal } from "@/components/course/semester-modal";
import { LobbyRow } from "./lobby-row";
import { useShell } from "./shell-context";

export function CourseSidebar({ courseId }: { courseId: string }) {
  const course = useCourse(courseId);
  const lobbies = useCourseLobbies(courseId);
  const toggle = useTogglePlanned();
  const { openCreateLobby } = useShell();
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [semesterOpen, setSemesterOpen] = useState(false);

  const share = async (close: () => void) => {
    close();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${courseId}`);
      toast("Tautan mata kuliah disalin.");
    } catch {
      toast("Belum bisa menyalin tautan di browser ini.");
    }
  };

  const term = query.trim().toLowerCase();
  const visible = (lobbies.data ?? []).filter((l) => l.title.toLowerCase().includes(term));

  return (
    <>
      <div className="flex h-13 shrink-0 items-center border-b border-line px-2">
        <Popover
          label="Menu mata kuliah"
          className="w-56"
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className="ease-ui flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left font-semibold transition-colors hover:bg-raised sm:h-9"
            >
              {course.data ? (
                <span className="truncate">{course.data.name}</span>
              ) : (
                <Skeleton className="h-4 w-32" />
              )}
              <ChevronDown size={16} className="ml-auto shrink-0 text-muted" aria-hidden />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<Share2 size={16} />} onClick={() => share(close)}>
                Bagikan
              </MenuItem>
              <MenuItem
                icon={<Settings2 size={16} />}
                onClick={() => {
                  close();
                  setSemesterOpen(true);
                }}
              >
                Pengaturan semester
              </MenuItem>
              {course.data?.is_planned && (
                <MenuItem
                  danger
                  icon={<LogOut size={16} />}
                  onClick={() => {
                    close();
                    toggle.mutate(
                      { courseId, planned: false },
                      { onSuccess: () => router.push("/beranda"), onError: (e) => toast(e.message) },
                    );
                  }}
                >
                  Keluar dari mata kuliah
                </MenuItem>
              )}
            </>
          )}
        </Popover>
      </div>
      <div className="space-y-2 p-3">
        <Button block onClick={() => openCreateLobby(courseId)}>
          <Plus size={18} aria-hidden /> Buat Lobby
        </Button>
        <label className="relative block">
          <span className="sr-only">Cari lobby</span>
          <Search size={15} aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari lobby"
            className="h-11 w-full rounded-lg border border-line bg-app pr-2 pl-8 text-[16px] placeholder:text-muted sm:h-9 sm:text-sm"
          />
        </label>
      </div>
      <nav aria-label="Daftar lobby" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" onKeyDown={rovingKeyDown}>
        <Link
          data-nav
          href={`/c/${courseId}`}
          className="ease-ui mb-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted transition-colors hover:bg-raised hover:text-fg sm:min-h-8"
        >
          <Compass size={16} aria-hidden /> Semua lobby
        </Link>
        {lobbies.isPending && <SkeletonList rows={6} className="h-8" />}
        {lobbies.isError && <ErrorState error={lobbies.error} onRetry={() => void lobbies.refetch()} />}
        {lobbies.data &&
          (visible.length > 0 ? (
            STUDY_GOALS.map((goal) => (
              <Category
                key={goal.value}
                label={goal.label}
                lobbies={visible.filter((l) => l.study_goal === goal.value)}
                forceOpen={term !== ""}
              />
            ))
          ) : (
            <EmptyState title={term ? "Tidak ada yang cocok" : "Belum ada lobby"}>
              {term ? "Coba kata kunci lain." : "Jadilah yang pertama membuat lobby."}
            </EmptyState>
          ))}
        {visible.some((l) => l.match) && <MatchNote className="px-2 pt-1" />}
      </nav>
      <SemesterModal open={semesterOpen} onClose={() => setSemesterOpen(false)} />
    </>
  );
}

function Category({ label, lobbies, forceOpen }: { label: string; lobbies: Lobby[]; forceOpen: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  if (lobbies.length === 0) return null;
  const open = forceOpen || !collapsed;
  return (
    <section className="mb-3">
      <h3>
        <button
          data-nav
          type="button"
          aria-expanded={open}
          onClick={() => setCollapsed(open)}
          className="ease-ui flex min-h-11 w-full items-center gap-1 rounded px-1 text-[13px] font-semibold text-muted transition-colors hover:text-fg sm:min-h-7"
        >
          <ChevronDown
            size={14}
            aria-hidden
            className={cn("transition-transform duration-150", !open && "-rotate-90")}
          />
          {label}
        </button>
      </h3>
      {open && (
        <ul className="space-y-0.5">
          {lobbies.map((lobby) => (
            <LobbyRow key={lobby.id} lobby={lobby} />
          ))}
        </ul>
      )}
    </section>
  );
}
