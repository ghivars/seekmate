const SKIP = new Set(["dan", "di", "ke", "untuk", "the", "of", "and", "i", "ii", "iii", "iv"]);

/**
 * Three-letter rail label from a course name.
 * "Algoritma dan Pemrograman" -> "ALP", "Kalkulus I" -> "KLK", "Basis Data" -> "BSD".
 */
export function abbr(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ""))
    .filter((w) => w && !SKIP.has(w.toLowerCase()));
  const [first, ...rest] = words;
  if (!first) return name.slice(0, 3).toUpperCase();
  const tail = rest.slice(0, 2).map((w) => w[0]!);
  const fill = [...first.slice(1)].filter((c) => !"aeiouAEIOU".includes(c));
  const letters = [first[0]!, ...fill.slice(0, 2 - tail.length), ...tail];
  const padded = letters.length < 3 ? [...letters, ...first.slice(1, 4 - letters.length)] : letters;
  return padded.join("").slice(0, 3).toUpperCase();
}
