"use client";

import { Bell, Menu, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DoodleArt } from "@/components/doodle-art";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { CountBadge } from "@/components/ui/tag";
import { useMe } from "@/lib/auth";
import { useUnreadNotifications } from "@/lib/data";
import { cn } from "@/lib/cn";
import { useShell } from "./shell-context";

export function MenuButton() {
  const { setLeftOpen } = useShell();
  return (
    <IconButton label="Buka menu" className="sm:hidden" onClick={() => setLeftOpen(true)}>
      <Menu size={20} />
    </IconButton>
  );
}

function SearchPill() {
  const { openSwitcher } = useShell();
  return (
    <>
      <button
        type="button"
        onClick={openSwitcher}
        className="ease-ui hidden h-10 w-72 items-center gap-2.5 rounded-lg border border-line bg-raised px-3 text-sm text-muted transition-colors hover:border-muted md:flex"
      >
        <Search size={16} aria-hidden />
        <span className="flex-1 text-left">Cari matkul atau lobby...</span>
        <kbd className="rounded border border-line px-1.5 font-mono text-[11px]">Ctrl K</kbd>
      </button>
      <IconButton label="Cari cepat (Ctrl+K)" onClick={openSwitcher} className="md:hidden">
        <Search size={18} />
      </IconButton>
    </>
  );
}

function BellLink() {
  const unread = useUnreadNotifications();
  return (
    <Link
      href="/notifikasi"
      aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
      title="Notifikasi"
      className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-fg max-sm:hidden"
    >
      <Bell size={18} aria-hidden />
      <span className="absolute -top-0.5 -right-0.5" aria-hidden>
        <CountBadge count={unread} label="belum dibaca" />
      </span>
    </Link>
  );
}

interface PageProps {
  title: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

/** Standard page: fixed header plus scrolling body. */
export function Page({ title, badge, actions, children, wide }: PageProps) {
  const me = useMe();
  return (
    <>
      <header className="flex h-15 shrink-0 items-center gap-2 border-b border-line bg-main/80 px-2 backdrop-blur sm:gap-3 sm:px-5">
        <MenuButton />
        <h1 className="min-w-0 truncate text-lg font-bold">{title}</h1>
        {badge && (
          <span className="hidden rounded-md border border-line bg-raised px-2 py-0.5 font-mono text-xs text-amber sm:inline">
            {badge}
          </span>
        )}
        <span className="flex-1" />
        <SearchPill />
        {actions}
        <BellLink />
        <span className="max-sm:hidden" title={me.display_name}>
          <Avatar id={me.id} name={me.display_name} size="sm" online />
        </span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto w-full px-4 py-6 sm:px-8", wide ? "max-w-7xl" : "max-w-5xl")}>{children}</div>
      </main>
    </>
  );
}

const DOTS = { primary: "bg-primary", amber: "bg-amber", mint: "bg-mint" };

export function Section({
  title,
  action,
  badge,
  tone = "primary",
  children,
}: {
  title: string;
  action?: ReactNode;
  badge?: ReactNode;
  tone?: keyof typeof DOTS;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden className={cn("size-2 rounded-full", DOTS[tone])} />
        <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
        {badge && (
          <span className="rounded-md border border-line bg-raised px-2 py-0.5 font-mono text-xs text-muted">
            {badge}
          </span>
        )}
        <span className="flex-1" />
        {action}
      </div>
      {children}
    </section>
  );
}

/** Yellow doodle ground for hero areas (use inside a `.doodle-hero` container). */
export function HeroGlow() {
  return <DoodleArt />;
}
