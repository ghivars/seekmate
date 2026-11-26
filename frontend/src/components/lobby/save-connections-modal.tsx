"use client";

import { Check, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/lib/auth";
import { useConnectionActions, useMembers, type Lobby } from "@/lib/data";

export const EMAIL_NOTICE =
  "Kalau diterima, kalian bisa melihat email kampus masing-masing. Koneksi tetap ada setelah lobby dihapus.";

export function SaveConnectionsModal({ lobby, open, onClose }: { lobby: Lobby; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Simpan koneksi" subtitle={EMAIL_NOTICE}>
      <People lobby={lobby} />
    </Modal>
  );
}

function People({ lobby }: { lobby: Lobby }) {
  const me = useMe();
  const toast = useToast();
  const members = useMembers(lobby.id);
  const { request } = useConnectionActions();
  if (members.isPending) return <SkeletonList rows={4} className="h-12" />;
  if (members.isError) return <ErrorState error={members.error} onRetry={() => void members.refetch()} />;
  const others = members.data.filter((m) => m.user.id !== me.id);
  if (others.length === 0) return <EmptyState title="Belum ada anggota lain" />;
  return (
    <ul className="space-y-2">
      {others.map((m) => (
        <li key={m.user.id} className="flex items-center gap-3">
          <Avatar id={m.user.id} name={m.user.display_name} />
          <span className="min-w-0 flex-1 truncate">{m.user.display_name}</span>
          {m.connection === "accepted" ? (
            <span className="inline-flex items-center gap-1 text-sm text-mint">
              <Check size={15} aria-hidden /> Terhubung
            </span>
          ) : m.connection === "pending_out" ? (
            <span className="text-sm text-muted">Menunggu jawaban</span>
          ) : (
            <Button
              variant="soft"
              aria-label={`Ajukan koneksi ke ${m.user.display_name}`}
              onClick={() =>
                request.mutate(
                  { userId: m.user.id, courseId: lobby.course_id },
                  { onError: (e) => toast(e.message) },
                )
              }
            >
              <UserPlus size={16} aria-hidden /> {m.connection === "pending_in" ? "Terima" : "Ajukan"}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
