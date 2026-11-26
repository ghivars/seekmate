"use client";

import { Menu, Search } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/button";
import { useShell } from "./shell-context";

export function MenuButton() {
  const { setLeftOpen } = useShell();
  return (
    <IconButton label="Buka menu" className="sm:hidden" onClick={() => setLeftOpen(true)}>
      <Menu size={20} />
    </IconButton>
  );
}

/** Standard page: fixed header plus scrolling body. */
export function Page({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const { openSwitcher } = useShell();
  return (
    <>
      <header className="flex h-13 shrink-0 items-center gap-2 border-b border-line px-2 sm:px-4">
        <MenuButton />
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
        {actions}
        <IconButton label="Cari cepat (Ctrl+K)" onClick={openSwitcher}>
          <Search size={18} />
        </IconButton>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">{children}</div>
      </main>
    </>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex min-h-9 items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
