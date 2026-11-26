import { cn } from "@/lib/cn";

/** Two seats that overlap: the SeekMate mark. */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect x="3" y="3" width="18" height="18" rx="6" fill="var(--primary)" />
      <rect x="11" y="11" width="18" height="18" rx="6" fill="var(--mint)" />
      <path d="M11 17a6 6 0 0 1 6-6h4v4a6 6 0 0 1-6 6h-4z" fill="var(--rail)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-lg font-bold tracking-tight", className)}>
      <Mark />
      SeekMate
    </span>
  );
}
