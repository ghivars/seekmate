import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

// Fixed pairs so initials stay readable in both themes.
const TINTS = [
  "bg-[#2d4a86] text-[#e4edff]",
  "bg-[#1c624b] text-[#ddf8ec]",
  "bg-[#74500f] text-[#fff0d1]",
  "bg-[#8a3340] text-[#ffe3e6]",
  "bg-[#5b3e8c] text-[#eee4ff]",
  "bg-[#285d6e] text-[#ddf5fc]",
];

export function tintFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

interface Props {
  id: string;
  name: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  className?: string;
}

const SIZES = { sm: "size-7 text-[11px]", md: "size-10 text-sm", lg: "size-14 text-lg" };

export function Avatar({ id, name, size = "md", online, className }: Props) {
  return (
    <span className={cn("relative inline-block shrink-0", className)} aria-hidden>
      <span
        className={cn("flex items-center justify-center rounded-xl font-semibold", SIZES[size], tintFor(id))}
      >
        {initials(name) || "?"}
      </span>
      {online !== undefined && (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-side",
            online ? "bg-mint" : "bg-muted",
          )}
        />
      )}
    </span>
  );
}
