import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { MATCH_DISCLAIMER } from "@/lib/labels";

type Tone = "neutral" | "mint" | "amber" | "danger" | "primary";

const TONES: Record<Tone, string> = {
  neutral: "border-line text-muted",
  mint: "border-mint/45 text-mint",
  amber: "border-amber/45 text-amber",
  danger: "border-danger/45 text-danger",
  primary: "border-link/45 text-link",
};

export function Tag({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-px text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const matchTone = (score: number): Tone => (score >= 70 ? "mint" : score >= 40 ? "primary" : "neutral");

export function MatchChip({ score }: { score: number }) {
  return (
    <Tag tone={matchTone(score)}>
      <span className="sr-only">Kecocokan preferensi </span>
      {score}%
    </Tag>
  );
}

/** Shown wherever bare score chips are listed. */
export function MatchNote({ className }: { className?: string }) {
  return <p className={cn("text-xs text-muted", className)}>% = kecocokan. {MATCH_DISCLAIMER}</p>;
}

export function CountBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-danger-fill px-1 text-[11px] font-bold text-on-danger">
      <span aria-hidden>{count > 99 ? "99+" : count}</span>
      <span className="sr-only">
        {count} {label}
      </span>
    </span>
  );
}
