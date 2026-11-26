"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { AuthCard, useRedirectIfAuthenticated } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/ui/field";
import { api, ApiError, call } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { useZodForm } from "@/lib/use-zod-form";

const schema = z.object({
  email: z.email("Tulis alamat email yang valid."),
  password: z.string().min(1, "Kata sandi belum diisi."),
});

export default function LoginPage() {
  useRedirectIfAuthenticated();
  const { login } = useAuth();
  const form = useZodForm(schema, { email: "", password: "" });
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);

  const onSubmit = form.submit(async ({ email, password }) => {
    setUnverified(false);
    try {
      await login(email, password);
    } catch (error) {
      setUnverified(error instanceof ApiError && error.code === "email_not_verified");
      throw error;
    }
  });

  const resend = async () => {
    await call(api.POST("/api/v1/auth/resend-verification", { body: { email: form.values.email } }));
    setResent(true);
  };

  return (
    <AuthCard title="Masuk ke SeekMate" subtitle="Cari teman belajar sebelum KRS dimulai.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
          autoComplete="current-password"
          value={form.values.password}
          onChange={(e) => form.set("password", e.target.value)}
          error={form.errors.password}
        />
        <FormError message={form.formError} />
        {unverified &&
          (resent ? (
            <p role="status" className="text-sm text-mint">
              Tautan baru sudah dikirim. Cek email kampusmu.
            </p>
          ) : (
            <Button variant="soft" block onClick={resend}>
              Kirim ulang tautan verifikasi
            </Button>
          ))}
        <Button type="submit" block busy={form.busy}>
          Masuk
        </Button>
      </form>
      <p className="text-sm text-muted">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-semibold text-link hover:underline">
          Daftar
        </Link>
      </p>
    </AuthCard>
  );
}
