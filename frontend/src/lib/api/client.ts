import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// The access token only ever lives in memory; the refresh token is an HttpOnly cookie.
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const sessionListeners = new Set<() => void>();

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

/** Called when the session cannot be refreshed any more. */
export function onSessionLost(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => void sessionListeners.delete(listener);
}

/** Exchange the refresh cookie for a new access token (single flight). */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" });
      if (!res.ok) {
        accessToken = null;
        if (res.status >= 500) throw new ApiError(res.status, "server_error", "Server sedang bermasalah.");
        return false;
      }
      const body: Schemas["TokenOut"] = await res.json();
      accessToken = body.access_token;
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function authFetch(request: Request): Promise<Response> {
  const retry = request.clone();
  if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(request);
  const isAuthCall = /\/auth\/(login|register|refresh|logout|verify-email)/.test(request.url);
  if (res.status !== 401 || isAuthCall) return res;
  if (!(await refreshSession())) {
    sessionListeners.forEach((l) => l());
    return res;
  }
  retry.headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(retry);
}

export const api = createClient<paths>({
  baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
  fetch: authFetch,
  credentials: "same-origin",
});

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Unwrap an openapi-fetch result, turning failures into a typed ApiError. */
export async function call<T>(promise: Promise<Result<T>>): Promise<T> {
  let result: Result<T>;
  try {
    result = await promise;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "network", "Koneksi terputus. Cek internetmu, lalu coba lagi.");
  }
  if (result.response.ok) return result.data as T;
  const body = result.error;
  const pick = (key: "code" | "message") =>
    typeof body === "object" && body !== null && key in body
      ? String((body as Record<string, unknown>)[key])
      : null;
  throw new ApiError(
    result.response.status,
    pick("code") ?? "unknown",
    pick("message") ?? "Ada yang tidak beres. Coba lagi sebentar lagi, ya.",
  );
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Ada yang tidak beres. Coba lagi, ya.";
