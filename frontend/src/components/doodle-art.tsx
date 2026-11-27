import { useId } from "react";

const INK = "#3a2c05";

/**
 * Sparse hand-drawn doodles (stars, clouds, flowers, books, symbols) on a yellow ground.
 * Purely decorative; sits behind hero content inside a `.doodle-hero` container.
 */
export function DoodleArt() {
  const id = useId().replace(/:/g, "");
  const line = { stroke: INK, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#ffe788_0%,#ffd84d_55%,#ffc83a_100%)]" />
      <svg className="absolute inset-0 size-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={`doodle-${id}`}
            width="300"
            height="300"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-6)"
          >
            {/* star */}
            <g transform="translate(36 44)">
              <polygon points="0,-14 4,-4 14,-4 6,3 9,13 0,7 -9,13 -6,3 -14,-4 -4,-4" fill="#fffaf0" {...line} />
            </g>
            {/* cloud */}
            <g transform="translate(170 40)">
              <path d="M-20 8 a8 8 0 0 1 3-15 a11 11 0 0 1 21-4 a9 9 0 0 1 15 8 a7 7 0 0 1-2 11 z" fill="#ffffff" {...line} />
            </g>
            {/* flower */}
            <g transform="translate(262 128)">
              {[0, 72, 144, 216, 288].map((deg) => (
                <circle key={deg} cx={Math.cos((deg * Math.PI) / 180) * 8} cy={Math.sin((deg * Math.PI) / 180) * 8} r="6" fill="#ff8fab" stroke={INK} strokeWidth="1.6" />
              ))}
              <circle r="4.5" fill="#ffb627" stroke={INK} strokeWidth="1.6" />
            </g>
            {/* book */}
            <g transform="translate(70 160) rotate(-10)">
              <path d="M-16 -10 h14 a2 2 0 0 1 2 2 v20 a2 2 0 0 0-2-2 h-14 z M16 -10 h-14 a2 2 0 0 0-2 2 v20 a2 2 0 0 1 2-2 h14 z" fill="#5b8def" fillOpacity="0.85" {...line} />
            </g>
            {/* pencil */}
            <g transform="translate(196 222) rotate(-35)">
              <rect x="-18" y="-4.5" width="28" height="9" rx="1.5" fill="#ff9f43" stroke={INK} strokeWidth="2" />
              <path d="M10 -4.5 L19 0 L10 4.5 Z" fill="#fffaf0" {...line} />
            </g>
            {/* heart */}
            <g transform="translate(126 112) scale(1.3)">
              <path d="M0 6 C-12 -2 -8 -12 0 -6 C8 -12 12 -2 0 6 Z" fill="#ff6b8b" stroke={INK} strokeWidth="1.5" />
            </g>
            {/* sparkles */}
            <g transform="translate(250 262)">
              <path d="M0 -10 Q2 -2 10 0 Q2 2 0 10 Q-2 2 -10 0 Q-2 -2 0 -10Z" fill="#ffffff" {...line} />
            </g>
            <g transform="translate(24 252) scale(0.7)">
              <path d="M0 -10 Q2 -2 10 0 Q2 2 0 10 Q-2 2 -10 0 Q-2 -2 0 -10Z" fill="#3dd6a0" {...line} />
            </g>
            {/* lightning */}
            <g transform="translate(232 70)">
              <path d="M2 -12 L-6 2 L0 2 L-3 12 L7 -3 L1 -3 Z" fill="#fffaf0" {...line} />
            </g>
            {/* music note */}
            <g transform="translate(118 252)">
              <path d="M4 6 V-12 L13 -9" fill="none" {...line} />
              <circle cx="0" cy="6" r="4" fill={INK} />
            </g>
            {/* little symbols: ring, plus, squiggle, dots */}
            <circle cx="104" cy="28" r="4" fill="none" {...line} />
            <path d="M170 152 h10 M175 147 v10" fill="none" {...line} />
            <path d="M12 102 q6 -8 12 0 t12 0" fill="none" {...line} />
            <circle cx="214" cy="178" r="2" fill={INK} />
            <circle cx="56" cy="214" r="2" fill={INK} />
            <circle cx="282" cy="18" r="2" fill={INK} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#doodle-${id})`} opacity="0.55" />
      </svg>
      {/* Calm patch behind the headline so doodles gather around the edges, not under text. */}
      <div className="absolute inset-0 bg-[radial-gradient(55%_75%_at_24%_50%,rgb(255_224_110/0.96)_0%,rgb(255_224_110/0.75)_45%,transparent_80%)]" />
    </div>
  );
}
