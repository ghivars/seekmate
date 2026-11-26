"use client";

import Link from "next/link";
import { Popover } from "@/components/ui/popover";
import { matchTone, Tag } from "@/components/ui/tag";
import type { Match } from "@/lib/data";
import { atmosphereLabel, goalLabel, languageLabel, MATCH_DISCLAIMER, styleLabel, timeLabel } from "@/lib/labels";

const VALUE_LABELS: Record<string, string> = {
  ...goalLabel,
  ...atmosphereLabel,
  ...timeLabel,
  ...styleLabel,
};
const DIMENSIONS: Record<Match["dimensions"][number]["key"], string> = {
  study_goal: "Tujuan",
  atmosphere: "Suasana",
  preferred_time: "Waktu",
  communication_style: "Gaya komunikasi",
  language: "Bahasa",
};

function valueLabel(key: string, value: string | null) {
  if (value === null) return "belum diisi";
  if (key === "language") return languageLabel[value as keyof typeof languageLabel];
  return VALUE_LABELS[value] ?? value;
}

export function MatchBreakdown({ match }: { match: Match }) {
  return (
    <div className="space-y-3">
      <p className="text-2xl font-bold tabular-nums">
        {match.score}% <span className="text-sm font-medium text-muted">cocok dengan preferensimu</span>
      </p>
      <ul className="space-y-2.5">
        {match.dimensions.map((d) => (
          <li key={d.key} className="text-sm">
            <div className="flex justify-between gap-3">
              <span className="font-medium">{DIMENSIONS[d.key]}</span>
              <span className="text-muted tabular-nums">
                {d.points} dari {Math.round(d.weight * 100)} poin
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${d.similarity * 100}%` }} />
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {d.key === "communication_style" || d.key === "language" ? "Pembuat" : "Lobby"}:{" "}
              {valueLabel(d.key, d.lobby_value)}, kamu: {valueLabel(d.key, d.your_value)}
            </p>
          </li>
        ))}
      </ul>
      <p className="border-t border-line pt-2 text-xs text-muted">{MATCH_DISCLAIMER}</p>
    </div>
  );
}

export function MatchBadge({ match, isCreator }: { match: Match | null; isCreator?: boolean }) {
  if (!match) {
    if (isCreator) return null;
    return (
      <Link href="/kamu" className="rounded-md px-1 text-xs font-medium whitespace-nowrap text-link hover:underline">
        Isi preferensi
      </Link>
    );
  }
  return (
    <Popover
      label="Rincian kecocokan"
      align="end"
      className="w-80 p-4"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`Kecocokan ${match.score} persen. ${MATCH_DISCLAIMER} Lihat rincian`}
          title={MATCH_DISCLAIMER}
          className="inline-flex min-h-11 items-center rounded-lg px-1.5 hover:bg-raised sm:min-h-9"
        >
          <Tag tone={matchTone(match.score)}>{match.score}% cocok</Tag>
        </button>
      )}
    >
      {() => <MatchBreakdown match={match} />}
    </Popover>
  );
}
