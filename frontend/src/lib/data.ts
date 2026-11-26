"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api, call } from "./api/client";
import type { Connection, Course, Lobby, LobbyFilters, LobbyInput, Report, ReportInput } from "./types";

export type * from "./types";

const POLL = 20_000;

/** Everything derived from membership, unread state or lobby status. */
export function invalidateLobby(client: QueryClient, lobbyId?: string) {
  for (const key of ["lobbies", "courses", "course", "notifications"]) {
    void client.invalidateQueries({ queryKey: [key] });
  }
  if (lobbyId) {
    for (const key of ["lobby", "members"]) void client.invalidateQueries({ queryKey: [key, lobbyId] });
  }
}

// --- Courses ---------------------------------------------------------------

export const useMyCourses = () =>
  useQuery({
    queryKey: ["courses", "mine"],
    queryFn: () => call(api.GET("/api/v1/courses", { params: { query: { planned: true } } })),
    refetchInterval: POLL,
  });

export const useCourseSearch = (q: string) =>
  useQuery({
    queryKey: ["courses", "search", q],
    queryFn: () => call(api.GET("/api/v1/courses", { params: { query: { q } } })),
    placeholderData: (previous) => previous,
  });

export const useCourse = (courseId: string) =>
  useQuery({
    queryKey: ["course", courseId],
    queryFn: () => call(api.GET("/api/v1/courses/{course_id}", { params: { path: { course_id: courseId } } })),
  });

export const useSemester = () =>
  useQuery({ queryKey: ["semester"], queryFn: () => call(api.GET("/api/v1/semesters/active")) });

export function useTogglePlanned() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, planned }: { courseId: string; planned: boolean }) => {
      const params = { params: { path: { course_id: courseId } } };
      return planned
        ? call(api.POST("/api/v1/courses/{course_id}/plan", params))
        : call(api.DELETE("/api/v1/courses/{course_id}/plan", params));
    },
    // Optimistic: the button flips right away everywhere the course is listed.
    onMutate: ({ courseId, planned }) => {
      client.setQueriesData<Course[]>({ queryKey: ["courses", "search"] }, (list) =>
        list?.map((c) => (c.id === courseId ? { ...c, is_planned: planned } : c)),
      );
    },
    onSettled: () => {
      for (const key of ["courses", "course"]) void client.invalidateQueries({ queryKey: [key] });
      void client.invalidateQueries({ queryKey: ["lobbies", "recommended"] });
    },
  });
}

// --- Lobbies ---------------------------------------------------------------

export const useCourseLobbies = (courseId: string, filters: LobbyFilters = {}) =>
  useQuery({
    queryKey: ["lobbies", "course", courseId, filters],
    queryFn: () =>
      call(
        api.GET("/api/v1/courses/{course_id}/lobbies", {
          params: { path: { course_id: courseId }, query: filters },
        }),
      ),
    placeholderData: (previous) => previous,
    refetchInterval: POLL,
  });

export const useMyLobbies = () =>
  useQuery({
    queryKey: ["lobbies", "mine"],
    queryFn: () => call(api.GET("/api/v1/lobbies/mine")),
    refetchInterval: POLL,
  });

export const useRecommendedLobbies = () =>
  useQuery({ queryKey: ["lobbies", "recommended"], queryFn: () => call(api.GET("/api/v1/lobbies/recommended")) });

/** Lobbies reachable from the quick switcher: mine plus the open course's. */
export function useSwitcherLobbies(): Lobby[] {
  const { courseId } = useParams<{ courseId?: string }>();
  const mine = useMyLobbies();
  const course = useQuery({
    queryKey: ["lobbies", "course", courseId ?? "", {}],
    queryFn: () =>
      call(
        api.GET("/api/v1/courses/{course_id}/lobbies", { params: { path: { course_id: courseId ?? "" } } }),
      ),
    enabled: Boolean(courseId),
  });
  const all = [...(mine.data ?? []), ...(courseId ? (course.data ?? []) : [])];
  return [...new Map(all.map((l) => [l.id, l])).values()];
}

export const useLobby = (lobbyId: string) =>
  useQuery({
    queryKey: ["lobby", lobbyId],
    queryFn: () => call(api.GET("/api/v1/lobbies/{lobby_id}", { params: { path: { lobby_id: lobbyId } } })),
    refetchInterval: POLL,
  });

export const useMembers = (lobbyId: string) =>
  useQuery({
    queryKey: ["members", lobbyId],
    queryFn: () => call(api.GET("/api/v1/lobbies/{lobby_id}/members", { params: { path: { lobby_id: lobbyId } } })),
    refetchInterval: 30_000,
  });

export function useCreateLobby() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, body }: { courseId: string; body: LobbyInput }) =>
      call(api.POST("/api/v1/courses/{course_id}/lobbies", { params: { path: { course_id: courseId } }, body })),
    onSuccess: (lobby) => {
      client.setQueryData(["lobby", lobby.id], lobby);
      invalidateLobby(client);
    },
  });
}

export function useJoinLobby() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lobbyId, intro }: { lobbyId: string; intro: string }) =>
      call(api.POST("/api/v1/lobbies/{lobby_id}/join", { params: { path: { lobby_id: lobbyId } }, body: { intro } })),
    onSuccess: (lobby) => client.setQueryData(["lobby", lobby.id], lobby),
    onSettled: (_data, _error, { lobbyId }) => invalidateLobby(client, lobbyId),
  });
}

/** Simple actions on one lobby that all refresh the same data. */
export function useLobbyAction(lobbyId: string) {
  const client = useQueryClient();
  const params = { params: { path: { lobby_id: lobbyId } } };
  const onSettled = () => invalidateLobby(client, lobbyId);
  return {
    leave: useMutation({ mutationFn: () => call(api.POST("/api/v1/lobbies/{lobby_id}/leave", params)), onSettled }),
    close: useMutation({ mutationFn: () => call(api.POST("/api/v1/lobbies/{lobby_id}/close", params)), onSettled }),
    remove: useMutation({
      mutationFn: (memberId: string) =>
        call(
          api.DELETE("/api/v1/lobbies/{lobby_id}/members/{member_id}", {
            params: { path: { lobby_id: lobbyId, member_id: memberId } },
          }),
        ),
      onSettled,
    }),
  };
}

export function useSlotAlert() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lobbyId, enabled }: { lobbyId: string; enabled: boolean }) => {
      const params = { params: { path: { lobby_id: lobbyId } } };
      return enabled
        ? call(api.POST("/api/v1/lobbies/{lobby_id}/slot-alert", params))
        : call(api.DELETE("/api/v1/lobbies/{lobby_id}/slot-alert", params));
    },
    onSettled: (_data, _error, { lobbyId }) => invalidateLobby(client, lobbyId),
  });
}

// --- Connections, blocks, reports ------------------------------------------

export const useConnections = () =>
  useQuery({
    queryKey: ["connections"],
    queryFn: () => call(api.GET("/api/v1/connections")),
    refetchInterval: POLL,
  });

export function useConnectionActions() {
  const client = useQueryClient();
  const onSettled = () => {
    for (const key of ["connections", "members", "notifications"]) {
      void client.invalidateQueries({ queryKey: [key] });
    }
  };
  const path = (c: Connection) => ({ params: { path: { connection_id: c.id } } });
  return {
    request: useMutation({
      mutationFn: ({ userId, courseId }: { userId: string; courseId: string }) =>
        call(api.POST("/api/v1/connections", { body: { user_id: userId, origin_course_id: courseId } })),
      onSettled,
    }),
    accept: useMutation({
      mutationFn: (c: Connection) => call(api.POST("/api/v1/connections/{connection_id}/accept", path(c))),
      onSettled,
    }),
    decline: useMutation({
      mutationFn: (c: Connection) => call(api.POST("/api/v1/connections/{connection_id}/decline", path(c))),
      onSettled,
    }),
    remove: useMutation({
      mutationFn: (c: Connection) => call(api.DELETE("/api/v1/connections/{connection_id}", path(c))),
      onSettled,
    }),
  };
}

export const useBlocks = () => useQuery({ queryKey: ["blocks"], queryFn: () => call(api.GET("/api/v1/blocks")) });

export function useBlockActions() {
  const client = useQueryClient();
  // A block changes what almost every list shows.
  const onSuccess = () => void client.invalidateQueries();
  return {
    block: useMutation({
      mutationFn: (userId: string) => call(api.POST("/api/v1/blocks", { body: { user_id: userId } })),
      onSuccess,
    }),
    unblock: useMutation({
      mutationFn: (userId: string) =>
        call(api.DELETE("/api/v1/blocks/{user_id}", { params: { path: { user_id: userId } } })),
      onSuccess,
    }),
  };
}

export const useSendReport = () =>
  useMutation({ mutationFn: (body: ReportInput) => call(api.POST("/api/v1/reports", { body })) });

// --- Notifications ---------------------------------------------------------

export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: () => call(api.GET("/api/v1/notifications")),
    refetchInterval: POLL,
  });

export const useUnreadNotifications = (): number => useNotifications().data?.unread_count ?? 0;

export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[] | null) => call(api.POST("/api/v1/notifications/read", { body: { ids } })),
    onSettled: () => void client.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// --- Admin -----------------------------------------------------------------

export const useReports = (status: Report["status"] | undefined) =>
  useQuery({
    queryKey: ["reports", status ?? "all"],
    queryFn: () => call(api.GET("/api/v1/admin/reports", { params: { query: { status } } })),
  });

export function useAdminActions() {
  const client = useQueryClient();
  const onSettled = () => void client.invalidateQueries({ queryKey: ["reports"] });
  return {
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: Report["status"] }) =>
        call(
          api.PATCH("/api/v1/admin/reports/{report_id}", { params: { path: { report_id: id } }, body: { status } }),
        ),
      onSettled,
    }),
    deactivateLobby: useMutation({
      mutationFn: (lobbyId: string) =>
        call(api.POST("/api/v1/admin/lobbies/{lobby_id}/deactivate", { params: { path: { lobby_id: lobbyId } } })),
      onSettled,
    }),
    suspendUser: useMutation({
      mutationFn: ({ userId, suspended }: { userId: string; suspended: boolean }) =>
        call(
          api.POST("/api/v1/admin/users/{user_id}/suspend", {
            params: { path: { user_id: userId } },
            body: { suspended },
          }),
        ),
      onSettled,
    }),
  };
}
