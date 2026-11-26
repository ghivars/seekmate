"use client";

import { Compass, House, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/states";
import { abbr } from "@/lib/abbr";
import { cn } from "@/lib/cn";
import { useMyCourses } from "@/lib/data";
import { rovingKeyDown } from "@/lib/roving";
import { useShell } from "./shell-context";

const TILE =
  "ease-ui flex size-12 items-center justify-center rounded-xl border transition-[border-radius,background-color,color,border-color,box-shadow] duration-200";

function RailItem({ active, unread, children }: { active: boolean; unread?: boolean; children: ReactNode }) {
  return (
    <li className="group/item relative flex justify-center">
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-[height] duration-200",
          active ? "h-9" : unread ? "h-2 bg-fg" : "h-0 group-hover/item:h-5",
        )}
      />
      {unread && !active && (
        <span aria-hidden className="absolute top-0.5 right-3 size-2.5 rounded-full border-2 border-rail bg-danger-fill" />
      )}
      {children}
    </li>
  );
}

const tile = (active: boolean) =>
  cn(
    TILE,
    active
      ? "rounded-2xl border-primary bg-primary text-on-primary shadow-[0_8px_22px_-8px_var(--glow)]"
      : "border-line bg-raised text-fg hover:rounded-2xl hover:border-primary/60",
  );

export function Rail() {
  const pathname = usePathname();
  const { courseId } = useParams<{ courseId?: string }>();
  const { openAddCourse, setLeftOpen } = useShell();
  const courses = useMyCourses();
  const home = !courseId && !pathname.startsWith("/jelajah") && !pathname.startsWith("/krs");

  return (
    <nav aria-label="Mata kuliah" className="flex w-18 shrink-0 flex-col border-r border-line bg-rail" onKeyDown={rovingKeyDown}>
      <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto py-3 [scrollbar-width:none]">
        <RailItem active={home}>
          <Link data-nav href="/beranda" aria-label="Beranda" title="Beranda" aria-current={home ? "page" : undefined} className={tile(home)}>
            <House size={21} />
          </Link>
        </RailItem>
        <RailItem active={pathname.startsWith("/jelajah")}>
          <Link
            data-nav
            href="/jelajah"
            aria-label="Jelajah"
            title="Jelajah"
            aria-current={pathname.startsWith("/jelajah") ? "page" : undefined}
            onClick={() => setLeftOpen(false)}
            className={tile(pathname.startsWith("/jelajah"))}
          >
            <Compass size={21} />
          </Link>
        </RailItem>
        <RailItem active={pathname.startsWith("/krs")}>
          <Link
            data-nav
            href="/krs"
            aria-label="Analisis KRS"
            title="Analisis KRS"
            aria-current={pathname.startsWith("/krs") ? "page" : undefined}
            onClick={() => setLeftOpen(false)}
            className={cn(tile(pathname.startsWith("/krs")), !pathname.startsWith("/krs") && "text-amber")}
          >
            <Sparkles size={20} />
          </Link>
        </RailItem>
        <li aria-hidden className="mx-auto my-1 h-px w-8 bg-line" />
        {courses.isPending &&
          [0, 1, 2].map((i) => (
            <li key={i} className="flex justify-center">
              <Skeleton className="size-12 rounded-xl" />
            </li>
          ))}
        {courses.data?.map((course) => {
          const active = course.id === courseId;
          return (
            <RailItem key={course.id} active={active} unread={course.unread_count > 0}>
              <Link
                data-nav
                href={`/c/${course.id}`}
                title={`${course.code} ${course.name}`}
                aria-label={`${course.code} ${course.name}${course.unread_count > 0 ? ", ada pesan baru" : ""}`}
                aria-current={active ? "page" : undefined}
                className={cn(tile(active), "font-mono text-[13px] font-bold tracking-wider")}
              >
                {abbr(course.name)}
              </Link>
            </RailItem>
          );
        })}
        <RailItem active={false}>
          <button
            data-nav
            type="button"
            aria-label="Tambah mata kuliah"
            title="Tambah mata kuliah"
            onClick={openAddCourse}
            className={cn(TILE, "border-dashed border-line text-muted hover:border-mint hover:text-mint")}
          >
            <Plus size={21} />
          </button>
        </RailItem>
      </ul>
    </nav>
  );
}
