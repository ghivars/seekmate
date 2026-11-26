import type { Me } from "./auth";
import type { StudyGoal } from "./labels";

export const GOAL_PHRASES: Record<StudyGoal, string> = {
  assignment_group: "untuk tugas kelompok",
  exam_prep: "untuk persiapan ujian",
  concept_discussion: "sambil diskusi materi",
  just_connect: "sambil kenalan",
};

export const EXTRA_PHRASES = ["Aku baru di sini.", "Biasanya aku online malam.", "Salam kenal, ya!"];

type Profile = Pick<Me, "display_name" | "major" | "cohort_year">;

/** "Halo, aku Dewi, Informatika angkatan 2026. Aku mau belajar ... di mata kuliah ini." */
export function buildIntro(me: Profile, goal: StudyGoal): string {
  const background = [me.major, me.cohort_year && `angkatan ${me.cohort_year}`].filter(Boolean).join(" ");
  const who = background ? `${me.display_name}, ${background}` : me.display_name;
  return `Halo, aku ${who}. Aku mau belajar ${GOAL_PHRASES[goal]} di mata kuliah ini.`;
}

/** Swap the goal inside an already edited text; leaves it alone when the phrase was rewritten. */
export function swapGoal(text: string, next: StudyGoal): string {
  const current = Object.values(GOAL_PHRASES).find((phrase) => text.includes(phrase));
  return current ? text.replace(current, GOAL_PHRASES[next]) : text;
}

export function toggleExtra(text: string, phrase: string): string {
  if (text.includes(phrase)) return text.replace(phrase, "").replace(/ {2,}/g, " ").trim();
  return `${text.trim()} ${phrase}`.trim();
}
