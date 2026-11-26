const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" });
const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });

export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatDate = (iso: string) => date.format(new Date(iso));
export const dayKey = (iso: string) => new Date(iso).toDateString();

export function formatDay(iso: string, now = new Date()): string {
  const key = dayKey(iso);
  if (key === now.toDateString()) return "Hari ini";
  if (key === new Date(now.getTime() - 86_400_000).toDateString()) return "Kemarin";
  return day.format(new Date(iso));
}

export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} jam lalu`;
  if (minutes < 10_080) return `${Math.floor(minutes / 1440)} hari lalu`;
  return formatDate(iso);
}

export const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

/** "CTH101" -> ["CTH", "101"], so similar codes stay distinguishable in the rail. */
export function splitCode(code: string): [string, string] {
  const match = /^([A-Za-z]+)[\s-]*(\d.*)$/.exec(code);
  return match ? [match[1]!.slice(0, 4), match[2]!.slice(0, 4)] : [code.slice(0, 4), ""];
}
