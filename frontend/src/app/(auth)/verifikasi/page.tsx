"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { api, call, errorMessage } from "@/lib/api/client";

export default function VerifyPage() {
  const [state, setState] = useState<"busy" | "done" | "failed">("busy");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    call(api.POST("/api/v1/auth/verify-email", { body: { token } }))
      .then(() => setState("done"))
      .catch((error: unknown) => {
        setMessage(errorMessage(error));
        setState("failed");
      });
  }, []);

  if (state === "busy") {
    return (
      <AuthCard title="Memverifikasi email">
        <Skeleton className="h-11" />
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title={state === "done" ? "Email terverifikasi" : "Verifikasi belum berhasil"}
      subtitle={state === "done" ? "Akunmu sudah aktif. Yuk, masuk." : message}
    >
      <Link href="/masuk" className={buttonClass("primary", true)}>
        {state === "done" ? "Masuk" : "Minta tautan baru"}
      </Link>
    </AuthCard>
  );
}
