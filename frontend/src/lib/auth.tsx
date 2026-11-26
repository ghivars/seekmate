"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, call, onSessionLost, refreshSession, setAccessToken, type Schemas } from "./api/client";

export type Me = Schemas["MeOut"];
type Status = "loading" | "authenticated" | "anonymous" | "error";

interface AuthValue {
  status: Status;
  me: Me | null;
  setMe: (me: Me) => void;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMeState] = useState<Me | null>(null);

  const clear = useCallback(() => {
    setAccessToken(null);
    setMeState(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  const setMe = useCallback((next: Me) => {
    setMeState(next);
    setStatus("authenticated");
  }, []);

  const restore = useCallback(async () => {
    try {
      if (!(await refreshSession())) return setStatus("anonymous");
      setMe(await call(api.GET("/api/v1/auth/me")));
    } catch {
      setStatus("error");
    }
  }, [setMe]);

  useEffect(() => {
    // Restoring the session is an external sync; state settles after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restore();
    return onSessionLost(clear);
  }, [restore, clear]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      me,
      setMe,
      login: async (email, password) => {
        const token = await call(api.POST("/api/v1/auth/login", { body: { email, password } }));
        setAccessToken(token.access_token);
        queryClient.clear();
        const next = await call(api.GET("/api/v1/auth/me"));
        setMe(next);
        return next;
      },
      logout: async () => {
        await call(api.POST("/api/v1/auth/logout")).catch(() => undefined);
        clear();
      },
      retry: () => {
        setStatus("loading");
        void restore();
      },
    }),
    [status, me, setMe, queryClient, clear, restore],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

/** For screens behind the auth guard. */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error("useMe used outside the authenticated area");
  return me;
}
