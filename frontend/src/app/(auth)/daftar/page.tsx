"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { AuthCard, useRedirectIfAuthenticated } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/ui/field";
import { api, call } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { useZodForm } from "@/lib/use-zod-form";

const schema = z.object({
  display_name: z.string().trim().min(2, "Minimal 2 huruf.").max(40, "Maksimal 40 huruf."),
  email: z.email("Tulis alamat email yang valid."),
  password: z.string().min(10, "Minimal 10 karakter.").max(128, "Maksimal 128 karakter."),
});

export default function RegisterPage() {
  useRedirectIfAuthenticated();
  const form = useZodForm(schema, { display_name: "", email: "", password: "" });
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { acceptToken } = useAuth();
  const onSubmit = form.submit(async (body) => {
    const result = await call(api.POST("/api/v1/auth/register", { body }));
    if (result.signed_in && result.access_token) {
      // Verification is off on this server: straight to onboarding.
      await acceptToken(result.access_token);
      return;
    }
    setSentTo(body.email);
  });

  if (sentTo) {
    return (
      <AuthCard title="Cek emailmu" subtitle={<>Kami mengirim tautan verifikasi ke {sentTo}.</>}>
        <MailCheck size={32} className="text-mint" aria-hidden />
        <p className="text-sm text-muted">
          Buka tautannya untuk mengaktifkan akun. Belum masuk? Lihat folder spam, atau minta tautan baru dari halaman
          masuk.
        </p>
        <Link href="/masuk" className="font-semibold text-link hover:underline">
          Ke halaman masuk
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Buat akun" subtitle="Pakai email kampus supaya semua anggota benar-benar mahasiswa.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          label="Nama panggilan"
          autoComplete="nickname"
          maxLength={40}
          value={form.values.display_name}
          onChange={(e) => form.set("display_name", e.target.value)}
          error={form.errors.display_name}
        />
        <TextField
          label="Email kampus"
          type="email"
          autoComplete="email"
          value={form.values.email}
          onChange={(e) => form.set("email", e.target.value)}
          error={form.errors.email}
        />
        <TextField
          label="Kata sandi"
          type="password"
          autoComplete="new-password"
          hint="Minimal 10 karakter."
          value={form.values.password}
          onChange={(e) => form.set("password", e.target.value)}
          error={form.errors.password}
        />
        <FormError message={form.formError} />
        <Button type="submit" block busy={form.busy}>
          Daftar
        </Button>
      </form>
      <p className="text-sm text-muted">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-semibold text-link hover:underline">
          Masuk
        </Link>
      </p>
    </AuthCard>
  );
}
