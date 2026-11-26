"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, call, errorMessage } from "./api/client";
import { flatten, removeMessage, upsertMessage, type History } from "./chat-cache";
import { invalidateLobby } from "./data";
import { LobbySocket, type ServerEvent, type SocketStatus } from "./lobby-socket";
import { logUsability } from "./usability";
import { uuid } from "./uuid";
import type { ChatMessage, Lobby, Member, UserBrief } from "./types";

const SEND_TIMEOUT_MS = 10_000;
const TYPING_MS = 4_000;

/** History + live updates + optimistic outbox for one lobby. */
export function useLobbyChat(lobby: Lobby, me: UserBrief) {
  const client = useQueryClient();
  const lobbyId = lobby.id;
  const isMember = lobby.is_member;
  const live = isMember && (lobby.status === "open" || lobby.status === "full");
  const key = useMemo(() => ["messages", lobbyId], [lobbyId]);

  const history = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      call(
        api.GET("/api/v1/lobbies/{lobby_id}/messages", {
          params: { path: { lobby_id: lobbyId }, query: pageParam ? { cursor: pageParam } : {} },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    enabled: isMember,
    staleTime: 0,
  });
  const preview = useQuery({
    queryKey: ["preview", lobbyId],
    queryFn: () => call(api.GET("/api/v1/lobbies/{lobby_id}/preview", { params: { path: { lobby_id: lobbyId } } })),
    enabled: !isMember,
    refetchInterval: 10_000,
  });

  const [connection, setConnection] = useState<SocketStatus>("idle");
  const [outbox, setOutbox] = useState<ChatMessage[]>([]);
  const [typers, setTypers] = useState<Record<string, string>>({});
  // Frozen when the lobby is opened so the "new messages" marker does not jump around.
  const [lastReadAt] = useState(lobby.last_read_at);
  const socket = useRef<LobbySocket | null>(null);
  const pending = useRef<ChatMessage[]>([]);
  const lastMarked = useRef<string | null>(null);
  const lastTyping = useRef(0);

  useEffect(() => {
    pending.current = outbox;
  }, [outbox]);

  const fail = useCallback((clientId: string, error: string) => {
    setOutbox((list) => list.map((m) => (m.client_id === clientId ? { ...m, state: "failed", error } : m)));
  }, []);

  const transmit = useCallback(
    (message: ChatMessage) => {
      socket.current?.send({ type: "message", client_id: message.client_id, body: message.body });
      setTimeout(() => {
        const still = pending.current.find((m) => m.client_id === message.client_id);
        if (still?.state === "sending") fail(message.client_id ?? "", "Belum terkirim.");
      }, SEND_TIMEOUT_MS);
    },
    [fail],
  );

  useEffect(() => {
    if (!live) return;
    let wasReady = false;
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const stopTyping = (id: string) =>
      setTypers((current) => Object.fromEntries(Object.entries(current).filter(([k]) => k !== id)));

    const onEvent = (event: ServerEvent) => {
      switch (event.type) {
        case "ready":
          // Catch up on anything missed while disconnected, then flush the queue (idempotent).
          if (wasReady) {
            void client.invalidateQueries({ queryKey: ["messages", lobbyId] });
            invalidateLobby(client, lobbyId);
          }
          wasReady = true;
          pending.current.filter((m) => m.state === "sending").forEach(transmit);
          break;
        case "message":
        case "message_updated":
          client.setQueryData<History>(["messages", lobbyId], (h) => upsertMessage(h, event.message));
          setOutbox((list) => list.filter((m) => m.client_id !== event.message.client_id));
          stopTyping(event.message.sender.id);
          break;
        case "message_deleted":
          client.setQueryData<History>(["messages", lobbyId], (h) => removeMessage(h, event.message_id));
          break;
        case "presence":
          client.setQueryData<Member[]>(["members", lobbyId], (list) =>
            list?.map((m) => (m.user.id === event.user_id ? { ...m, online: event.online } : m)),
          );
          break;
        case "member_joined":
        case "member_left":
        case "lobby_updated":
          invalidateLobby(client, lobbyId);
          break;
        case "typing": {
          const { id, display_name } = event.user;
          setTypers((current) => ({ ...current, [id]: display_name }));
          clearTimeout(typingTimers.get(id));
          typingTimers.set(
            id,
            setTimeout(() => stopTyping(id), TYPING_MS),
          );
          break;
        }
        case "error":
          if (event.client_id) fail(event.client_id, event.message);
          break;
      }
    };

    const instance = new LobbySocket({
      lobbyId,
      onEvent,
      onStatus: (status) => {
        setConnection(status);
        if (status === "denied") invalidateLobby(client, lobbyId);
      },
    });
    socket.current = instance;
    instance.start();
    return () => {
      instance.stop();
      socket.current = null;
      typingTimers.forEach((t) => clearTimeout(t));
    };
  }, [live, lobbyId, client, transmit, fail]);

  const source = isMember ? flatten(history.data) : preview.data?.items;
  const messages = useMemo<ChatMessage[]>(() => [...(source ?? []), ...outbox], [source, outbox]);
  const newest = source?.at(-1)?.id ?? null;

  const send = (body: string) => {
    const message: ChatMessage = {
      id: uuid(),
      client_id: uuid(),
      lobby_id: lobbyId,
      sender: { id: me.id, display_name: me.display_name },
      body,
      is_intro: false,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted: false,
      state: "sending",
    };
    setOutbox((list) => [...list, message]);
    transmit(message);
    logUsability("first_message");
  };

  const retry = (message: ChatMessage) => {
    const next: ChatMessage = { ...message, state: "sending", error: undefined };
    setOutbox((list) => list.map((m) => (m.client_id === message.client_id ? next : m)));
    transmit(next);
  };

  const edit = async (message: ChatMessage, body: string) => {
    const updated = await call(
      api.PATCH("/api/v1/messages/{message_id}", { params: { path: { message_id: message.id } }, body: { body } }),
    );
    client.setQueryData<History>(key, (h) => upsertMessage(h, updated));
  };

  const remove = async (message: ChatMessage) => {
    await call(api.DELETE("/api/v1/messages/{message_id}", { params: { path: { message_id: message.id } } }));
    client.setQueryData<History>(key, (h) => removeMessage(h, message.id));
  };

  const markRead = useCallback(() => {
    if (!isMember || !newest || lastMarked.current === newest || document.visibilityState !== "visible") return;
    lastMarked.current = newest;
    call(api.POST("/api/v1/lobbies/{lobby_id}/read", { params: { path: { lobby_id: lobbyId } } }))
      .then(() => {
        client.setQueryData<Lobby>(["lobby", lobbyId], (l) =>
          l ? { ...l, last_read_at: new Date().toISOString(), unread_count: 0 } : l,
        );
        for (const k of ["lobbies", "courses", "notifications"]) void client.invalidateQueries({ queryKey: [k] });
      })
      .catch(() => {
        lastMarked.current = null;
      });
  }, [isMember, newest, lobbyId, client]);

  const notifyTyping = () => {
    const now = Date.now();
    if (now - lastTyping.current < 2_500) return;
    lastTyping.current = now;
    socket.current?.send({ type: "typing" });
  };

  const active = isMember ? history : preview;
  return {
    messages,
    lastReadAt,
    isPending: active.isPending,
    error: active.isError && !active.data ? active.error : null,
    refetch: () => void active.refetch(),
    hasMore: isMember && history.hasNextPage,
    loadingMore: history.isFetchingNextPage,
    loadMore: () => void history.fetchNextPage(),
    connection,
    typing: Object.values(typers),
    send,
    retry,
    edit,
    remove,
    notifyTyping,
    markRead,
    errorMessage,
  };
}
