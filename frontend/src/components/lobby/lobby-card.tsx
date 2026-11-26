import { Clock3, Lock, UsersRound } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { MatchChip, Tag } from "@/components/ui/tag";
import type { Lobby } from "@/lib/data";
import { atmosphereLabel, goalLabel, MATCH_DISCLAIMER, timeLabel } from "@/lib/labels";

export interface CardInfo {
  title: string;
  description: string;
  study_goal: Lobby["study_goal"];
  atmosphere: Lobby["atmosphere"];
  preferred_time: Lobby["preferred_time"];
  capacity: number;
  member_count: number;
  members_preview: Lobby["members_preview"];
  course_code?: string;
  status: Lobby["status"];
  match: Lobby["match"];
}

export function LobbyCardBody({ lobby, showCourse }: { lobby: CardInfo; showCourse?: boolean }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 font-semibold text-balance [overflow-wrap:anywhere]">{lobby.title}</h3>
        {lobby.match && <MatchChip score={lobby.match.score} />}
      </div>
      {showCourse && <p className="text-[13px] text-muted">{lobby.course_code}</p>}
      {lobby.description && (
        <p className="line-clamp-2 text-sm text-muted [overflow-wrap:anywhere]">{lobby.description}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Tag tone="primary">{goalLabel[lobby.study_goal]}</Tag>
        <Tag>{atmosphereLabel[lobby.atmosphere]}</Tag>
        <Tag>
          <Clock3 size={11} aria-hidden /> {timeLabel[lobby.preferred_time]}
        </Tag>
        {lobby.status === "full" && (
          <Tag tone="amber">
            <Lock size={11} aria-hidden /> Penuh
          </Tag>
        )}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-1">
        <span className="flex -space-x-1.5">
          {lobby.members_preview.map((m) => (
            <Avatar key={m.id} id={m.id} name={m.display_name} size="sm" className="rounded-xl ring-2 ring-raised" />
          ))}
        </span>
        <span className="inline-flex items-center gap-1 text-[13px] text-muted tabular-nums">
          <UsersRound size={13} aria-hidden />
          <span className="sr-only">Anggota</span> {lobby.member_count}/{lobby.capacity}
        </span>
      </div>
      {lobby.match && <p className="text-xs text-muted">{MATCH_DISCLAIMER}</p>}
    </>
  );
}

interface CardProps {
  lobby: Lobby;
  showCourse?: boolean;
  onJoin?: (lobby: Lobby) => void;
}

export function LobbyCard({ lobby, showCourse, onJoin }: CardProps) {
  const joinable = lobby.status === "open" && !lobby.is_member && lobby.visibility === "public";
  return (
    <article className="flex flex-col gap-2.5 rounded-2xl border border-line bg-raised p-4">
      <LobbyCardBody lobby={lobby} showCourse={showCourse} />
      <div className="flex gap-2 pt-1">
        <Link href={`/c/${lobby.course_id}/${lobby.id}`} className={buttonClass("soft") + " flex-1"}>
          {lobby.is_member ? "Buka" : "Lihat"}
          <span className="sr-only"> {lobby.title}</span>
        </Link>
        {joinable && onJoin && (
          <button type="button" className={buttonClass("primary") + " flex-1"} onClick={() => onJoin(lobby)}>
            Gabung
            <span className="sr-only"> {lobby.title}</span>
          </button>
        )}
      </div>
    </article>
  );
}
