import { api } from "./api/client";

type EventName = "time_to_first_join" | "join" | "first_message";

const enabled = process.env.NEXT_PUBLIC_USABILITY_TEST === "true";
const KEY = "seekmate-usability";

interface Session {
  key: string;
  startedAt: number;
  sent: EventName[];
}

function session(): Session {
  const stored = sessionStorage.getItem(KEY);
  if (stored) return JSON.parse(stored) as Session;
  return { key: crypto.randomUUID(), startedAt: Date.now(), sent: [] };
}

/** Starts the per-tab clock used by "time to first join". */
export function startUsabilityClock() {
  if (!enabled) return;
  try {
    if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, JSON.stringify(session()));
  } catch {
    // Storage blocked: skip metrics rather than break the app.
  }
}

/** Anonymous, opt-in metrics for usability tests; each "first" event is sent once per tab. */
export function logUsability(event: EventName) {
  if (!enabled) return;
  try {
    const s = session();
    if (event !== "join" && s.sent.includes(event)) return;
    s.sent.push(event);
    sessionStorage.setItem(KEY, JSON.stringify(s));
    void api
      .POST("/api/v1/usability-events", {
        body: { session_key: s.key, event, elapsed_ms: Math.min(Date.now() - s.startedAt, 86_400_000) },
      })
      .catch(() => undefined);
  } catch {
    // Never let metrics affect the product.
  }
}
