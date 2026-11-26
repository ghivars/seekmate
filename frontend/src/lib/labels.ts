import type { Schemas } from "./api/client";

export type Preferences = Schemas["PreferencesIn"];
export type StudyGoal = Preferences["study_goal"];
export type Atmosphere = Preferences["atmosphere"];
export type PreferredTime = Preferences["preferred_time"];
export type CommunicationStyle = Preferences["communication_style"];
export type Language = Preferences["language"];

export interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export const STUDY_GOALS: Option<StudyGoal>[] = [
  { value: "assignment_group", label: "Tugas kelompok", hint: "Cari anggota untuk tugas atau proyek" },
  { value: "exam_prep", label: "Persiapan ujian", hint: "Latihan soal dan rangkuman bareng" },
  { value: "concept_discussion", label: "Diskusi materi", hint: "Bahas konsep yang masih bikin bingung" },
  { value: "just_connect", label: "Kenalan", hint: "Cari teman dulu, belajarnya menyusul" },
];
export const ATMOSPHERES: Option<Atmosphere>[] = [
  { value: "chill", label: "Santai", hint: "Ngobrol ringan, tanpa tekanan" },
  { value: "focused", label: "Fokus", hint: "Ada target dan jadwal jelas" },
  { value: "mixed", label: "Campuran", hint: "Bisa santai, bisa serius" },
];
export const TIMES: Option<PreferredTime>[] = [
  { value: "morning", label: "Pagi" },
  { value: "afternoon", label: "Siang" },
  { value: "evening", label: "Malam" },
  { value: "flexible", label: "Fleksibel" },
];
export const STYLES: Option<CommunicationStyle>[] = [
  { value: "chat_active", label: "Aktif di chat", hint: "Sering balas dan mulai obrolan" },
  { value: "chat_light", label: "Chat seperlunya", hint: "Balas kalau penting" },
  { value: "meetup_ready", label: "Siap ketemuan", hint: "Lebih suka belajar tatap muka" },
];
export const LANGUAGES: Option<Language>[] = [
  { value: "id", label: "Indonesia" },
  { value: "en", label: "English" },
  { value: "mixed", label: "Campur" },
];

const toMap = <T extends string>(options: Option<T>[]) =>
  Object.fromEntries(options.map((o) => [o.value, o.label])) as Record<T, string>;

export const goalLabel = toMap(STUDY_GOALS);
export const atmosphereLabel = toMap(ATMOSPHERES);
export const timeLabel = toMap(TIMES);
export const styleLabel = toMap(STYLES);
export const languageLabel = toMap(LANGUAGES);

export const MATCH_DISCLAIMER = "Berdasarkan preferensi belajar, bukan jaminan jadwal kelas yang sama.";
