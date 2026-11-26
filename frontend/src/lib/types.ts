import type { Schemas } from "./api/client";

export type UserBrief = Schemas["UserBrief"];
export type PublicUser = Schemas["PublicUser"];
export type Course = Schemas["CourseOut"];
export type Match = Schemas["MatchOut"];
export type Lobby = Schemas["LobbyOut"];
export type LobbyInput = Schemas["LobbyCreate"];
export type Member = Schemas["MemberOut"];
export type Message = Schemas["MessageOut"];
export type MessagePage = Schemas["MessagePage"];
export type Connection = Schemas["ConnectionOut"];
export type Report = Schemas["ReportOut"];
export type ReportInput = Schemas["ReportIn"];
export type AppNotification = Schemas["NotificationOut"];
export type Semester = Schemas["SemesterOut"];
export type KrsAnalysis = Schemas["KrsAnalysis"];
export type DiscoverSort = "match" | "newest" | "popular";

/** A message plus client-only delivery state for optimistic sends. */
export interface ChatMessage extends Message {
  state?: "sending" | "failed";
  error?: string;
}

export interface LobbyFilters {
  study_goal?: Lobby["study_goal"];
  atmosphere?: Lobby["atmosphere"];
  has_slot?: boolean;
  sort?: "match" | "newest";
}
