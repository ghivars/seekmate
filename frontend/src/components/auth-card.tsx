"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Wordmark } from "./brand";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Wordmark className="mb-6" />
        <div className="rounded-2xl border border-line bg-main p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-balance">{title}</h1>
          {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
          <div className="mt-6 space-y-4">{children}</div>
        </div>
      </div>
    </main>
  );
}

/** Only same-app paths are accepted, so ?next= cannot become an open redirect. */
export function safeNext(next: string | null): string {
  return next && /^\/(?![/\\])/.test(next) ? next : "/beranda";
}

export function useRedirectIfAuthenticated() {
  const { status, me } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status !== "authenticated" || !me) return;
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(me.onboarded_at ? safeNext(next) : "/onboarding");
  }, [status, me, router]);
}
