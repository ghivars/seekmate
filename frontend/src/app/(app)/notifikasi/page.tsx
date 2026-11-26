"use client";

import { Bell, DoorOpen, Hourglass, MessageSquare, UserCheck, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { useMarkNotificationsRead, useNotifications, type AppNotification } from "@/lib/data";
import { formatDate, formatRelative } from "@/lib/format";

interface View {
  icon: LucideIcon;
  text: string;
  href: string;
}

const str = (value: unknown) => (typeof value === "string" ? value : "");

function describe(n: AppNotification): View {
  const p = n.payload;
  const lobby = str(p.lobby_title);
  const href = p.lobby_id ? `/c/${str(p.course_id)}/${str(p.lobby_id)}` : "/beranda";
  switch (n.type) {
    case "new_message":
      return { icon: MessageSquare, text: `${Number(p.count ?? 1)} pesan baru di ${lobby}`, href };
    case "member_joined":
      return { icon: UserPlus, text: `${str(p.user_name)} bergabung ke ${lobby}`, href };
    case "slot_available":
      return { icon: DoorOpen, text: `Ada slot kosong di ${lobby}`, href };
    case "lobby_expiring":
      return { icon: Hourglass, text: `${lobby} akan berakhir ${formatDate(str(p.ends_at))}. Simpan koneksimu.`, href };
    case "connection_request":
      return p.state === "accepted"
        ? { icon: UserCheck, text: `${str(p.user_name)} menerima koneksimu`, href: "/beranda" }
        : { icon: UserPlus, text: `${str(p.user_name)} mengajukan koneksi`, href: "/beranda" };
  }
}

export default function NotificationsPage() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = notifications.data?.unread_count ?? 0;
  return (
    <Page
      title="Notifikasi"
      actions={
        unread > 0 && (
          <Button variant="ghost" onClick={() => markRead.mutate(null)}>
            Tandai dibaca
          </Button>
        )
      }
    >
      {notifications.isPending && <SkeletonList rows={6} className="h-14" />}
      {notifications.isError && (
        <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />
      )}
      {notifications.data?.items.length === 0 && (
        <EmptyState icon={<Bell size={28} />} title="Belum ada notifikasi">
          Pesan baru, anggota baru, dan permintaan koneksi muncul di sini.
        </EmptyState>
      )}
      <ul className="space-y-1.5">
        {notifications.data?.items.map((n) => {
          const { icon: Icon, text, href } = describe(n);
          return (
            <li key={n.id}>
              <Link
                href={href}
                onClick={() => !n.read_at && markRead.mutate([n.id])}
                className={cn(
                  "ease-ui flex min-h-14 items-center gap-3 rounded-xl px-4 py-2.5 transition-colors hover:bg-raised",
                  !n.read_at && "bg-raised",
                )}
              >
                <Icon size={18} aria-hidden className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  {!n.read_at && <span className="sr-only">Belum dibaca: </span>}
                  {text}
                </span>
                <time dateTime={n.created_at} className="shrink-0 text-xs text-muted">
                  {formatRelative(n.created_at)}
                </time>
                {!n.read_at && <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
