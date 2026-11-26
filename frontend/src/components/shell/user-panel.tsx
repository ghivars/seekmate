"use client";

import { Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { setTheme, useTheme } from "@/lib/theme";

export function UserPanel() {
  const me = useMe();
  const theme = useTheme();
  return (
    <div className="flex items-center gap-2 border-t border-line bg-rail/60 px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
      <Avatar id={me.id} name={me.display_name} online size="md" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold">{me.display_name}</p>
        <p className="text-xs text-muted">Online</p>
      </div>
      <IconButton
        label={theme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </IconButton>
      <Link
        href="/kamu"
        aria-label="Pengaturan"
        title="Pengaturan"
        className="ease-ui inline-flex size-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-fg sm:size-9"
      >
        <Settings size={17} />
      </Link>
    </div>
  );
}
