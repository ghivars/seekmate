import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backoff, LobbySocket, type ServerEvent, type SocketStatus } from "./lobby-socket";

class FakeSocket {
  readyState = 1;
  sent: string[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  emit(event: ServerEvent) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

let sockets: FakeSocket[];
let statuses: SocketStatus[];

function start() {
  const socket = new LobbySocket({
    lobbyId: "l1",
    onEvent: () => undefined,
    onStatus: (s) => statuses.push(s),
    getToken: async () => "t",
    open: () => {
      const fake = new FakeSocket();
      sockets.push(fake);
      return fake as unknown as WebSocket;
    },
  });
  socket.start();
  return socket;
}

describe("LobbySocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    statuses = [];
  });
  afterEach(() => vi.useRealTimers());

  it("reports online after ready and only sends while open", async () => {
    const socket = start();
    expect(socket.send({})).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]!.emit({ type: "ready" });
    expect(statuses).toEqual(["connecting", "online"]);
    expect(socket.send({ type: "typing" })).toBe(true);
    socket.stop();
  });

  it("reconnects with backoff after a drop", async () => {
    const socket = start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]!.emit({ type: "ready" });
    sockets[0]!.drop(1006);
    expect(statuses.at(-1)).toBe("offline");
    await vi.advanceTimersByTimeAsync(999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(2);
    sockets[1]!.drop(1006);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sockets).toHaveLength(3);
    socket.stop();
  });

  it("does not retry when membership was revoked or after stop", async () => {
    const denied = start();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]!.drop(4403);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
    expect(statuses.at(-1)).toBe("denied");
    denied.stop();
    const stopped = start();
    await vi.advanceTimersByTimeAsync(0);
    stopped.stop();
    sockets[1]!.drop(1006);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(2);
  });

  it("caps the backoff", () => {
    expect([0, 1, 2, 10].map(backoff)).toEqual([1000, 2000, 4000, 15_000]);
  });
});
