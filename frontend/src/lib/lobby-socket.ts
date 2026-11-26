import { api, call } from "./api/client";
import type { Message, UserBrief } from "./types";

export type ServerEvent =
  | { type: "ready" }
  | { type: "pong" }
  | { type: "message" | "message_updated"; message: Message }
  | { type: "message_deleted"; message_id: string }
  | { type: "member_joined"; user: UserBrief }
  | { type: "member_left"; user_id: string }
  | { type: "presence"; user_id: string; online: boolean }
  | { type: "typing"; user: UserBrief }
  | { type: "lobby_updated" }
  | { type: "error"; client_id: string | null; code: string; message: string };

export type SocketStatus = "idle" | "connecting" | "online" | "offline" | "denied";

interface Options {
  lobbyId: string;
  onEvent: (event: ServerEvent) => void;
  onStatus: (status: SocketStatus) => void;
  /** Injected in tests. */
  getToken?: () => Promise<string>;
  open?: (url: string) => WebSocket;
}

const PING_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;

export const backoff = (attempt: number) => Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);

function wsBase(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;
  return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8000`;
}

const fetchToken = async () => (await call(api.POST("/api/v1/auth/ws-token"))).token;

/** One lobby connection that reconnects with exponential backoff until stopped. */
export class LobbySocket {
  private socket: WebSocket | null = null;
  private attempt = 0;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: Options) {}

  start() {
    this.options.onStatus("connecting");
    void this.connect();
    window.addEventListener("online", this.reconnectNow);
  }

  stop() {
    this.stopped = true;
    window.removeEventListener("online", this.reconnectNow);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.socket?.close(1000);
    this.socket = null;
  }

  /** Returns false when the socket is not ready; the caller keeps the message queued. */
  send(data: object): boolean {
    if (this.socket?.readyState !== 1) return false;
    this.socket.send(JSON.stringify(data));
    return true;
  }

  private readonly reconnectNow = () => {
    if (this.stopped || this.socket) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    void this.connect();
  };

  private async connect() {
    let token: string;
    try {
      token = await (this.options.getToken ?? fetchToken)();
    } catch {
      this.scheduleRetry();
      return;
    }
    if (this.stopped) return;
    const url = `${wsBase()}/ws/lobbies/${this.options.lobbyId}?token=${encodeURIComponent(token)}`;
    const socket = this.options.open ? this.options.open(url) : new WebSocket(url);
    this.socket = socket;
    socket.onmessage = (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as ServerEvent;
      if (event.type === "ready") {
        this.attempt = 0;
        this.options.onStatus("online");
        this.pingTimer = setInterval(() => this.send({ type: "ping" }), PING_MS);
      }
      this.options.onEvent(event);
    };
    socket.onclose = (e: CloseEvent) => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.socket = null;
      if (this.stopped) return;
      // 4403: no longer a member, so retrying would never work.
      if (e.code === 4403) this.options.onStatus("denied");
      else this.scheduleRetry();
    };
  }

  private scheduleRetry() {
    if (this.stopped) return;
    this.options.onStatus("offline");
    this.retryTimer = setTimeout(() => void this.connect(), backoff(this.attempt));
    this.attempt += 1;
  }
}
