"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, TextArea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useJoinLobby, type Lobby } from "@/lib/data";
import { buildIntro, EXTRA_PHRASES, GOAL_PHRASES, swapGoal, toggleExtra } from "@/lib/intro";
import { STUDY_GOALS } from "@/lib/labels";
import { celebrate } from "@/lib/celebrate";
import { logUsability } from "@/lib/usability";

const MAX = 1000;

export function JoinSheet({ lobby, onClose }: { lobby: Lobby | null; onClose: () => void }) {
  return lobby ? <Sheet lobby={lobby} onClose={onClose} /> : null;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "ease-ui min-h-11 rounded-full border px-3.5 text-sm transition-colors sm:min-h-9",
        active ? "border-link bg-raised text-fg" : "border-line text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Sheet({ lobby, onClose }: { lobby: Lobby; onClose: () => void }) {
  const me = useMe();
  const router = useRouter();
  const join = useJoinLobby();
  const [text, setText] = useState(() => buildIntro(me, lobby.study_goal));
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await join.mutateAsync({ lobbyId: lobby.id, intro: text.trim() });
      logUsability("time_to_first_join");
      logUsability("join");
      celebrate();
    } catch (e) {
      // Joined from another tab in the meantime: just open the lobby.
      if (!(e instanceof ApiError && e.code === "already_member")) {
        setError(errorMessage(e));
        return;
      }
    }
    onClose();
    router.push(`/c/${lobby.course_id}/${lobby.id}`);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Gabung ke ${lobby.title}`}
      subtitle="Perkenalan ini jadi pesan pertamamu. Ubah sesukamu."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button busy={join.isPending} disabled={text.length > MAX} onClick={submit}>
            {text.trim() ? "Gabung dan kirim" : "Gabung tanpa perkenalan"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextArea
          label="Perkenalan"
          rows={4}
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Ganti tujuan</legend>
          <div className="flex flex-wrap gap-2">
            {STUDY_GOALS.map((goal) => (
              <Chip
                key={goal.value}
                active={text.includes(GOAL_PHRASES[goal.value])}
                onClick={() => setText(swapGoal(text, goal.value))}
              >
                {goal.label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Tambah kalimat</legend>
          <div className="flex flex-wrap gap-2">
            {EXTRA_PHRASES.map((phrase) => (
              <Chip key={phrase} active={text.includes(phrase)} onClick={() => setText(toggleExtra(text, phrase))}>
                {phrase}
              </Chip>
            ))}
          </div>
        </fieldset>
        <FormError message={error} />
      </div>
    </Modal>
  );
}
