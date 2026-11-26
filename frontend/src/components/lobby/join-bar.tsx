"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCourseLobbies, useSlotAlert, type Lobby } from "@/lib/data";

export function JoinBar({ lobby, onJoin }: { lobby: Lobby; onJoin: () => void }) {
  const full = lobby.status === "full";
  const locked = lobby.status === "expired" || lobby.status === "closed" || lobby.visibility === "closed";
  return (
    <div className="shrink-0 border-t border-line bg-side px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          {locked
            ? "Lobby ini tidak menerima anggota baru."
            : full
              ? "Lobby ini sudah penuh. Kamu masih bisa melihat pratinjaunya."
              : "Kamu sedang melihat pratinjau. Gabung untuk ikut ngobrol."}
          {lobby.match && (
            <p className="mt-0.5 text-xs text-muted">
              {lobby.match.score}% cocok. {lobby.match.disclaimer}
            </p>
          )}
        </div>
        {full && !locked && <SlotAlertButton lobby={lobby} />}
        {!locked && (
          <Button onClick={onJoin} disabled={full} className="sm:min-w-32">
            Gabung
          </Button>
        )}
      </div>
      {full && <SimilarLobbies lobby={lobby} />}
    </div>
  );
}

function SlotAlertButton({ lobby }: { lobby: Lobby }) {
  const alert = useSlotAlert();
  const toast = useToast();
  return (
    <Button
      variant="soft"
      busy={alert.isPending}
      aria-pressed={lobby.has_slot_alert}
      onClick={() =>
        alert.mutate(
          { lobbyId: lobby.id, enabled: !lobby.has_slot_alert },
          {
            onSuccess: () => toast(lobby.has_slot_alert ? "Pengingat dimatikan." : "Siap, nanti kami beri tahu."),
            onError: (e) => toast(e.message),
          },
        )
      }
    >
      <BellRing size={16} aria-hidden />
      {lobby.has_slot_alert ? "Batalkan pengingat" : "Beri tahu jika ada slot"}
    </Button>
  );
}

function SimilarLobbies({ lobby }: { lobby: Lobby }) {
  const lobbies = useCourseLobbies(lobby.course_id);
  const similar = (lobbies.data ?? [])
    .filter((l) => l.id !== lobby.id && l.status === "open" && l.visibility === "public" && !l.is_member)
    .sort((a, b) => Number(b.study_goal === lobby.study_goal) - Number(a.study_goal === lobby.study_goal))
    .slice(0, 3);
  if (similar.length === 0) return null;
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="mb-1.5 text-sm font-semibold">Lobby serupa</p>
      <ul className="flex flex-wrap gap-2">
        {similar.map((l) => (
          <li key={l.id}>
            <Link
              href={`/c/${l.course_id}/${l.id}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-line bg-raised px-3 text-sm hover:border-muted sm:min-h-9"
            >
              {l.title} ({l.member_count}/{l.capacity})
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
