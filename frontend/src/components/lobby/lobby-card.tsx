"use client";

import { ArrowRight, Clock3, Lock, Users } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { LiveDot, MatchChip, Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
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
  course_name?: string;
  course_credits?: number;
  creator?: Lobby["creator"];
  status: Lobby["status"];
  match: Lobby["match"];
}

export function StatusChip({ lobby }: { lobby: Pick<CardInfo, "status" | "capacity" | "member_count"> }) {
  const slots = lobby.capacity - lobby.member_count;
  if (lobby.status === "full" || slots <= 0) {
    return (
      <Tag tone="danger">
        <Lock size={11} aria-hidden /> Penuh
      </Tag>
    );
  }
  if (slots <= 2) {
    return (
      <Tag tone="amber">
        <span aria-hidden>🔥</span> {slots} slot tersisa
      </Tag>
    );
  }
  return (
    <Tag tone="mint">
      <LiveDot /> Buka · {slots} slot
    </Tag>
  );
}

export function LobbyCardBody({ lobby, showCourse = true }: { lobby: CardInfo; showCourse?: boolean }) {
  const cohort = lobby.creator?.cohort_year ? ` '${String(lobby.creator.cohort_year).slice(2)}` : "";
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip lobby={lobby} />
        <Tag>
          <Clock3 size={11} aria-hidden /> {timeLabel[lobby.preferred_time]} · {atmosphereLabel[lobby.atmosphere]}
        </Tag>
        <span className="flex-1" />
        {lobby.match && <MatchChip score={lobby.match.score} />}
      </div>
      {showCourse && lobby.course_code && (
        <p className="truncate text-[13px] text-muted">
          <span className="font-mono font-semibold text-amber">{lobby.course_code}</span>
          {lobby.course_credits ? <span className="font-mono"> · {lobby.course_credits} SKS</span> : null}
          {lobby.course_name && <> · {lobby.course_name}</>}
        </p>
      )}
      <h3 className="text-lg leading-snug font-bold text-balance [overflow-wrap:anywhere]">{lobby.title}</h3>
      {lobby.description && (
        <p className="line-clamp-2 text-sm text-muted [overflow-wrap:anywhere]">{lobby.description}</p>
      )}
      <div>
        <Tag tone="primary">{goalLabel[lobby.study_goal]}</Tag>
      </div>
      <div className="mt-auto flex items-center gap-2.5 pt-1">
        {lobby.creator && (
          <>
            <Avatar id={lobby.creator.id} name={lobby.creator.display_name} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{lobby.creator.display_name}</p>
              <p className="truncate font-mono text-[11px] text-muted">
                {lobby.creator.major ? `${lobby.creator.major}${cohort}` : "Pembuat lobby"}
              </p>
            </div>
          </>
        )}
        <span className={cn("flex -space-x-1.5", !lobby.creator && "flex-1")}>
          {lobby.members_preview.slice(0, 3).map((m) => (
            <span key={m.id} className="rounded-xl ring-2 ring-raised">
              <Avatar id={m.id} name={m.display_name} size="sm" />
            </span>
          ))}
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-xs text-mint">
          <Users size={12} aria-hidden />
          <span className="sr-only">Anggota</span>
          {lobby.member_count}/{lobby.capacity}
        </span>
      </div>
      {lobby.match && <p className="text-[11px] text-muted">{MATCH_DISCLAIMER}</p>}
    </>
  );
}

interface CardProps {
  lobby: Lobby;
  showCourse?: boolean;
  onJoin?: (lobby: Lobby) => void;
}

export function LobbyCard({ lobby, showCourse = true, onJoin }: CardProps) {
  const joinable = lobby.status === "open" && !lobby.is_member && lobby.visibility === "public";
  const href = `/c/${lobby.course_id}/${lobby.id}`;
  return (
    <article className="group/card ease-ui relative flex flex-col gap-3 rounded-2xl border border-line bg-raised p-5 transition-[translate,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_18px_40px_-20px_var(--glow)]">
      <LobbyCardBody lobby={lobby} showCourse={showCourse} />
      <div className="flex gap-2 pt-1">
        {joinable && onJoin ? (
          <>
            <button type="button" className={buttonClass("primary") + " flex-1"} onClick={() => onJoin(lobby)}>
              Gabung Lobby <ArrowRight size={16} aria-hidden className="transition-transform group-hover/card:translate-x-0.5" />
              <span className="sr-only"> {lobby.title}</span>
            </button>
            <Link href={href} className={buttonClass("soft")}>
              Intip<span className="sr-only"> {lobby.title}</span>
            </Link>
          </>
        ) : (
          <Link href={href} className={buttonClass(lobby.is_member ? "primary" : "soft") + " flex-1"}>
            {lobby.is_member ? "Masuk Lobby" : "Lihat Pratinjau"} <ArrowRight size={16} aria-hidden />
            <span className="sr-only"> {lobby.title}</span>
          </Link>
        )}
      </div>
    </article>
  );
}
