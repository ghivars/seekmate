"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { AddCourseModal } from "@/components/course/add-course-modal";
import { CreateLobbyModal } from "@/components/lobby/create-lobby-modal";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { startUsabilityClock } from "@/lib/usability";
import { useIsDesktop, useIsMobile } from "@/lib/use-media";
import { QuickSwitcher } from "./quick-switcher";
import { Rail } from "./rail";
import { ShellContext, type ShellValue } from "./shell-context";
import { Sidebar } from "./sidebar";
import { TabBar } from "./tab-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const { status, me, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/masuk?next=${encodeURIComponent(pathname)}`);
    else if (me && !me.onboarded_at) router.replace("/onboarding");
  }, [status, me, router, pathname]);

  if (status === "error") {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <ErrorState error={new Error("Server belum bisa dihubungi.")} onRetry={retry} />
      </main>
    );
  }
  if (!me || !me.onboarded_at) return <ShellSkeleton />;
  return <Shell>{children}</Shell>;
}

function ShellSkeleton() {
  return (
    <div className="flex h-dvh" role="status" aria-label="Memuat SeekMate">
      <div className="hidden w-18 space-y-3 bg-rail p-3 sm:block">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="size-12 rounded-2xl" />
        ))}
      </div>
      <div className="hidden w-60 space-y-3 bg-side p-4 sm:block">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
      <div className="flex-1 space-y-4 bg-main p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();
  const pathname = usePathname();
  // Drawers remember the path they were opened on, so navigating closes them.
  const [leftFor, setLeftFor] = useState<string | null>(null);
  const [membersFor, setMembersFor] = useState<string | null>(null);
  const [membersPinned, setMembersPinned] = useState(true);
  const [switcher, setSwitcher] = useState(false);
  const [addCourse, setAddCourse] = useState(false);
  const [createFor, setCreateFor] = useState<string | null>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const leftOpen = isMobile && leftFor === pathname;
  const membersOpen = isDesktop ? membersPinned : membersFor === pathname;

  const shell = useMemo<ShellValue>(
    () => ({
      leftOpen,
      setLeftOpen: (open) => setLeftFor(open ? pathname : null),
      membersOpen,
      setMembersOpen: (open) => (isDesktop ? setMembersPinned(open) : setMembersFor(open ? pathname : null)),
      openSwitcher: () => setSwitcher(true),
      openAddCourse: () => setAddCourse(true),
      openCreateLobby: setCreateFor,
    }),
    [leftOpen, membersOpen, pathname, isDesktop],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSwitcher((open) => !open);
      }
      if (e.key === "Escape") {
        setLeftFor(null);
        setMembersFor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(startUsabilityClock, []);

  useEffect(() => {
    if (leftOpen) drawer.current?.querySelector<HTMLElement>("a[href], button")?.focus();
  }, [leftOpen]);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    const end = e.changedTouches[0];
    touch.current = null;
    if (!isMobile || !start || !end) return;
    const dx = end.clientX - start.x;
    if (Math.abs(dx) < 64 || Math.abs(end.clientY - start.y) > 48) return;
    if (dx > 0) {
      if (membersOpen) setMembersFor(null);
      else setLeftFor(pathname);
    } else if (leftOpen) setLeftFor(null);
    else if (/^\/c\/[^/]+\/[^/]+/.test(pathname)) setMembersFor(pathname);
  };

  return (
    <ShellContext value={shell}>
      <a
        href="#konten"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Langsung ke konten
      </a>
      <div className="group/shell flex h-dvh overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {leftOpen && (
          <div
            aria-hidden
            className="fixed inset-0 z-30 animate-[fade-in_160ms] bg-[var(--shade)] sm:hidden"
            onClick={() => setLeftFor(null)}
          />
        )}
        <div
          ref={drawer}
          inert={isMobile && !leftOpen}
          className={cn(
            "flex h-full shrink-0 max-sm:fixed max-sm:inset-y-0 max-sm:left-0 max-sm:z-40 max-sm:w-[min(88vw,340px)] max-sm:shadow-2xl",
            "ease-ui max-sm:transition-transform",
            leftOpen ? "max-sm:translate-x-0" : "max-sm:-translate-x-full",
          )}
        >
          <Rail />
          <Sidebar />
        </div>
        <div inert={leftOpen} className="flex min-w-0 flex-1 flex-col bg-main">
          <div id="konten" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
            {children}
          </div>
          <TabBar />
        </div>
      </div>
      <QuickSwitcher open={switcher} onClose={() => setSwitcher(false)} />
      <AddCourseModal open={addCourse} onClose={() => setAddCourse(false)} />
      <CreateLobbyModal courseId={createFor} onClose={() => setCreateFor(null)} />
    </ShellContext>
  );
}
