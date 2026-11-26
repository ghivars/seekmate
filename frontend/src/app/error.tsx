"use client";

import { ErrorState } from "@/components/ui/states";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <ErrorState error={new Error("Ada yang tidak beres di halaman ini.")} onRetry={reset} />
    </main>
  );
}
