import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import type { Lobby } from "@/lib/data";
import { atmosphereLabel, goalLabel, timeLabel } from "@/lib/labels";

/** Start of the conversation: lobby info, plus the welcome state for solo lobbies. */
export function LobbyIntro({ lobby, onShare }: { lobby: Lobby; onShare: () => void }) {
  const alone = lobby.is_member && lobby.member_count === 1 && lobby.status === "open";
  return (
    <div className="px-4 pt-8 pb-3">
      <h2 className="text-2xl font-bold tracking-tight text-balance [overflow-wrap:anywhere]">{lobby.title}</h2>
      <p className="mt-1 max-w-prose text-muted [overflow-wrap:anywhere]">
        {lobby.description || "Belum ada deskripsi."}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Tag tone="primary">{goalLabel[lobby.study_goal]}</Tag>
        <Tag>{atmosphereLabel[lobby.atmosphere]}</Tag>
        <Tag>{timeLabel[lobby.preferred_time]}</Tag>
        <Tag>
          {lobby.member_count}/{lobby.capacity} anggota
        </Tag>
      </div>
      {alone && (
        <div className="mt-5 max-w-md rounded-2xl border border-line bg-raised p-4">
          <p className="font-semibold">Menunggu anggota</p>
          <p className="mt-1 text-sm text-muted">Bagikan lobby ini ke teman satu mata kuliah.</p>
          <Button className="mt-3" onClick={onShare}>
            <Share2 size={16} aria-hidden /> Salin tautan lobby
          </Button>
        </div>
      )}
    </div>
  );
}
