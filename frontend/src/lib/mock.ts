import { MATCH_DISCLAIMER } from "./labels";
import type { ChatMessage, Lobby, Member } from "./types";

// Fixtures for component tests only.
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const rani = { id: "u1", display_name: "Rani (demo)" };
const bima = { id: "u2", display_name: "Bima (demo)" };

export const mockLobby = (over: Partial<Lobby>): Lobby => ({
  id: "l1",
  course_id: "c1",
  course_code: "CTH101",
  course_name: "Algoritma dan Pemrograman",
  title: "Demo: Kelompok tugas besar",
  description: "Lobby contoh untuk tugas besar, santai tapi rutin.",
  study_goal: "assignment_group",
  atmosphere: "chill",
  preferred_time: "evening",
  capacity: 5,
  member_count: 2,
  visibility: "public",
  status: "open",
  created_at: at(300),
  expires_at: at(-100_000),
  creator: rani,
  members_preview: [rani, bima],
  is_member: false,
  my_role: null,
  unread_count: 0,
  last_read_at: null,
  has_slot_alert: false,
  match: {
    score: 82,
    disclaimer: MATCH_DISCLAIMER,
    dimensions: [
      { key: "study_goal", weight: 0.35, similarity: 1, points: 35, lobby_value: "assignment_group", your_value: "assignment_group" },
      { key: "atmosphere", weight: 0.25, similarity: 1, points: 25, lobby_value: "chill", your_value: "chill" },
      { key: "preferred_time", weight: 0.2, similarity: 0.5, points: 10, lobby_value: "flexible", your_value: "evening" },
      { key: "communication_style", weight: 0.1, similarity: 0.5, points: 5, lobby_value: "chat_light", your_value: "chat_active" },
      { key: "language", weight: 0.1, similarity: 0.5, points: 5, lobby_value: "mixed", your_value: "id" },
    ],
  },
  ...over,
});

const profile = { major: "Informatika", cohort_year: 2026, bio: "Akun demo.", is_newcomer: true };
export const mockMember = (over: Partial<Member>): Member => ({
  user: { ...rani, ...profile },
  role: "member",
  online: true,
  connection: "none",
  joined_at: at(300),
  ...over,
});

export const mockMessage = (over: Partial<ChatMessage>): ChatMessage => ({
  id: "m1",
  lobby_id: "l1",
  sender: rani,
  body: "Pesan contoh",
  is_intro: false,
  client_id: null,
  created_at: at(10),
  edited_at: null,
  deleted: false,
  ...over,
});
