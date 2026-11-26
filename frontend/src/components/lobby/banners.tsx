"use client";

import { CalendarX2, Hourglass, WifiOff, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";

function Banner({ tone, icon, children, action }: { tone: "amber" | "danger" | "neutral"; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2.5 border-b px-4 py-1.5 text-sm",
        tone === "amber" && "border-amber/40 bg-amber/10",
        tone === "danger" && "border-danger/40 bg-danger/10",
        tone === "neutral" && "border-line bg-side",
      )}
    >
      <span className="shrink-0" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

const DISMISS_KEY = "seekmate-retention-banner";

/** Dismissal lasts for the browser session only. */
export function RetentionBanner() {
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  return (
    <Banner
      tone="neutral"
      icon={<Hourglass size={15} className="text-amber" />}
      action={
        <IconButton
          label="Tutup pengingat"
          onClick={() => {
            setHidden(true);
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // Storage unavailable: hidden until the next load.
            }
          }}
        >
          <X size={15} />
        </IconButton>
      }
    >
      Chat ini dihapus setelah semester berakhir. Simpan koneksi yang ingin dipertahankan.
    </Banner>
  );
}

export function ExpiredBanner({ onSave }: { onSave: () => void }) {
  return (
    <Banner
      tone="amber"
      icon={<CalendarX2 size={16} className="text-amber" />}
      action={
        <button
          type="button"
          onClick={onSave}
          className="min-h-11 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary sm:min-h-9"
        >
          Simpan koneksi
        </button>
      }
    >
      Semester sudah berakhir. Lobby ini hanya bisa dibaca dan akan segera dihapus.
    </Banner>
  );
}

export function ClosedBanner() {
  return (
    <Banner tone="neutral" icon={<CalendarX2 size={16} />}>
      Lobby ini sudah ditutup. Pesannya hanya bisa dibaca.
    </Banner>
  );
}

export function ReconnectBanner() {
  return (
    <div role="status">
      <Banner tone="danger" icon={<WifiOff size={15} className="text-danger" />}>
        Koneksi terputus. Menyambung lagi, pesanmu tidak hilang.
      </Banner>
    </div>
  );
}
