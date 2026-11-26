import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { MATCH_DISCLAIMER } from "@/lib/labels";

type Tone = "neutral" | "mint" | "amber" | "danger" | "primary";

const TONES: Record<Tone, string> = {
  neutral: "border-line bg-app/60 text-muted",
  mint: "border-mint/30 bg-mint/10 text-mint",
  amber: "border-amber/30 bg-amber/10 text-amber",
  danger: "border-danger/30 bg-danger/10 text-danger",
  primary: "border-link/30 bg-link/10 text-link",
};

export function Tag({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap",
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

/** Pulsing "live" dot. */
export function LiveDot({ tone = "mint" }: { tone?: "mint" | "amber" | "primary" }) {
  const color = { mint: "bg-mint", amber: "bg-amber", primary: "bg-primary" }[tone];
  return (
    <span aria-hidden className="relative inline-flex size-2 shrink-0">
      <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", color)} />
      <span className={cn("relative size-2 rounded-full", color)} />
    </span>
  );
}

/** Shown wherever bare score chips are listed. */
export function MatchNote({ className }: { className?: string }) {
  return <p className={cn("text-xs text-muted", className)}>% = kecocokan. {MATCH_DISCLAIMER}</p>;
}

export function CountBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-md bg-danger-fill px-1 font-mono text-[11px] font-bold text-on-danger">
      <span aria-hidden>{count > 99 ? "99+" : count}</span>
      <span className="sr-only">
        {count} {label}
      </span>
    </span>
  );
}
