const COLORS = ["#2563eb", "#34d399", "#f5b544", "#f87171", "#a78bfa", "#7aa2ff"];

/** A short confetti burst from an element (or the screen centre). Skipped for reduced motion. */
export function celebrate(origin?: Element | null) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = origin?.getBoundingClientRect();
  const x = box ? box.left + box.width / 2 : window.innerWidth / 2;
  const y = box ? box.top + box.height / 2 : window.innerHeight / 3;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  for (let i = 0; i < 42; i++) {
    const piece = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 160;
    piece.style.cssText = [
      `position:absolute;left:${x}px;top:${y}px`,
      `width:${6 + Math.random() * 6}px;height:${4 + Math.random() * 6}px`,
      `background:${COLORS[i % COLORS.length]};border-radius:${i % 3 === 0 ? "50%" : "2px"}`,
      `--dx:${Math.cos(angle) * distance}px;--dy:${Math.sin(angle) * distance + 120}px`,
      `--spin:${Math.random() * 720 - 360}deg`,
      `animation:confetti ${700 + Math.random() * 500}ms cubic-bezier(.2,.7,.3,1) forwards`,
    ].join(";");
    layer.append(piece);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1400);
}
