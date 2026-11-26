"use client";

import { Bell, Compass, House, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CountBadge } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { useUnreadNotifications } from "@/lib/data";

const TABS = [
  { href: "/beranda", label: "Beranda", icon: House },
  { href: "/jelajah", label: "Jelajah", icon: Compass },
  { href: "/notifikasi", label: "Notifikasi", icon: Bell },
  { href: "/kamu", label: "Kamu", icon: UserRound },
];

export function TabBar() {
  const pathname = usePathname();
  const unread = useUnreadNotifications();
  return (
    <nav
      aria-label="Navigasi bawah"
      className="border-t border-line bg-rail pb-[env(safe-area-inset-bottom)] group-has-[textarea:focus]/shell:hidden sm:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-link" : "text-muted",
                )}
              >
                <Icon size={21} aria-hidden />
                {label}
                {href === "/notifikasi" && unread > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-1.5">
                    <CountBadge count={unread} label="notifikasi belum dibaca" />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
