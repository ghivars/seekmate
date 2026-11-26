"use client";

import { Compass, House, Plus } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useMyCourses } from "@/lib/data";
import { splitCode } from "@/lib/format";
import { rovingKeyDown } from "@/lib/roving";
import { Skeleton } from "@/components/ui/states";
import { tintFor } from "@/components/ui/avatar";
import { useShell } from "./shell-context";

const TILE =
  "ease-ui flex size-12 items-center justify-center transition-[border-radius,background-color,color] duration-200";

interface ItemProps {
  active: boolean;
  unread?: boolean;
  children: ReactNode;
}

/** Left indicator bar: tall when active, dot when there is unread activity. */
function RailItem({ active, unread, children }: ItemProps) {
  return (
    <li className="group/item relative flex justify-center">
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-[height] duration-200",
          active ? "h-9" : unread ? "h-2 bg-fg" : "h-0 group-hover/item:h-5",
        )}
      />
      {children}
    </li>
  );
}

export function Rail() {
  const pathname = usePathname();
  const { courseId } = useParams<{ courseId?: string }>();
  const { openAddCourse, setLeftOpen } = useShell();
  const courses = useMyCourses();
  const home = !courseId && !pathname.startsWith("/jelajah");
  const tile = (active: boolean) =>
    cn(TILE, active ? "rounded-2xl bg-primary text-on-primary" : "rounded-xl bg-raised hover:rounded-2xl hover:bg-primary hover:text-on-primary");

  return (
    <nav aria-label="Mata kuliah" className="flex w-18 shrink-0 flex-col bg-rail" onKeyDown={rovingKeyDown}>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-3 [scrollbar-width:none]">
        <RailItem active={home}>
          <Link data-nav href="/beranda" aria-label="Beranda" title="Beranda" aria-current={home ? "page" : undefined} className={tile(home)}>
            <House size={22} />
          </Link>
        </RailItem>
        <li aria-hidden className="mx-auto h-px w-8 bg-line" />
        {courses.isPending &&
          [0, 1, 2].map((i) => (
            <li key={i} className="flex justify-center">
              <Skeleton className="size-12 rounded-xl" />
            </li>
          ))}
        {courses.data?.map((course) => {
          const active = course.id === courseId;
          const [letters, digits] = splitCode(course.code);
          return (
            <RailItem key={course.id} active={active} unread={course.unread_count > 0}>
              <Link
                data-nav
                href={`/c/${course.id}`}
                title={`${course.code} ${course.name}`}
                aria-label={`${course.code} ${course.name}${course.unread_count > 0 ? ", ada pesan baru" : ""}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  TILE,
                  "flex-col leading-none font-bold",
                  tintFor(course.id),
                  active ? "rounded-[20px] ring-2 ring-primary" : "rounded-xl hover:rounded-[20px]",
                )}
              >
                <span className="text-[11px] tracking-wide">{letters}</span>
                {digits && <span className="mt-0.5 text-sm">{digits}</span>}
              </Link>
            </RailItem>
          );
        })}
        <RailItem active={false}>
          <button data-nav type="button" aria-label="Tambah mata kuliah" title="Tambah mata kuliah" onClick={openAddCourse} className={cn(tile(false), "text-mint")}>
            <Plus size={22} />
          </button>
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
            <Compass size={22} />
          </Link>
        </RailItem>
      </ul>
    </nav>
  );
}
