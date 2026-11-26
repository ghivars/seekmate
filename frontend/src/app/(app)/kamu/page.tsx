"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { isComplete, PreferencesFields, type PartialPreferences } from "@/components/preferences-fields";
import { Page, Section } from "@/components/shell/page";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm";
import { Checkbox, FormError, OptionGroup, TextArea, TextField } from "@/components/ui/field";
import { ErrorState, SkeletonList } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, call, errorMessage } from "@/lib/api/client";
import { useAuth, useMe } from "@/lib/auth";
import { useBlockActions, useBlocks } from "@/lib/data";
import { setTheme, useTheme } from "@/lib/theme";
import { useZodForm } from "@/lib/use-zod-form";
import { useQueryClient } from "@tanstack/react-query";

const schema = z.object({
  display_name: z.string().trim().min(2, "Minimal 2 huruf.").max(40, "Maksimal 40 huruf."),
  major: z.string().trim().max(80, "Maksimal 80 huruf."),
  cohort_year: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1990 && Number(v) <= 2100), {
      message: "Tulis tahun 4 angka, misalnya 2026.",
    }),
  bio: z.string().trim().max(200, "Maksimal 200 huruf."),
  is_newcomer: z.boolean(),
});

export default function YouPage() {
  const me = useMe();
  const { logout } = useAuth();
  return (
    <Page title="Kamu">
      <div className="max-w-2xl">
        {me.role === "admin" && (
          <Link href="/admin" className={buttonClass("soft") + " mb-6"}>
            <ShieldCheck size={17} aria-hidden /> Laporan (admin)
          </Link>
        )}
        <ProfileForm />
        <PreferencesForm />
        <Appearance />
        <Blocks />
        <Section title="Akun">
          <p className="mb-3 text-sm text-muted">Masuk sebagai {me.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" onClick={() => void logout()}>
              <LogOut size={16} aria-hidden /> Keluar
            </Button>
            <DeleteAccount />
          </div>
        </Section>
      </div>
    </Page>
  );
}

function ProfileForm() {
  const me = useMe();
  const { setMe } = useAuth();
  const toast = useToast();
  const form = useZodForm(schema, {
    display_name: me.display_name,
    major: me.major,
    cohort_year: me.cohort_year ? String(me.cohort_year) : "",
    bio: me.bio,
    is_newcomer: me.is_newcomer,
  });
  const { values: v, errors, set } = form;
  const onSubmit = form.submit(async ({ cohort_year, ...rest }) => {
    const body = { ...rest, cohort_year: cohort_year ? Number(cohort_year) : null };
    setMe(await call(api.PATCH("/api/v1/users/me", { body })));
    toast("Profil disimpan.");
  });
  return (
    <Section title="Profil">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          label="Nama panggilan"
          maxLength={40}
          value={v.display_name}
          onChange={(e) => set("display_name", e.target.value)}
          error={errors.display_name}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Jurusan"
            maxLength={80}
            value={v.major}
            onChange={(e) => set("major", e.target.value)}
            error={errors.major}
          />
          <TextField
            label="Angkatan"
            inputMode="numeric"
            maxLength={4}
            value={v.cohort_year}
            onChange={(e) => set("cohort_year", e.target.value)}
            error={errors.cohort_year}
          />
        </div>
        <TextArea
          label="Bio"
          maxLength={200}
          value={v.bio}
          onChange={(e) => set("bio", e.target.value)}
          error={errors.bio}
          hint={`${v.bio.length}/200. Terlihat oleh sesama anggota lobby.`}
        />
        <Checkbox
          label="Aku baru di kampus atau kota ini"
          checked={v.is_newcomer}
          onChange={(x) => set("is_newcomer", x)}
        />
        <FormError message={form.formError} />
        <Button type="submit" busy={form.busy}>
          Simpan profil
        </Button>
      </form>
    </Section>
  );
}

function PreferencesForm() {
  const me = useMe();
  const { setMe } = useAuth();
  const toast = useToast();
  const client = useQueryClient();
  const [prefs, setPrefs] = useState<PartialPreferences>(me.preferences ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!isComplete(prefs)) {
      setError("Pilih satu jawaban di setiap bagian, ya.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setMe(await call(api.PUT("/api/v1/users/me/preferences", { body: prefs })));
      // Scores depend on preferences.
      for (const key of ["lobbies", "lobby"]) void client.invalidateQueries({ queryKey: [key] });
      toast("Preferensi disimpan.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Preferensi belajar">
      <div className="space-y-6">
        <PreferencesFields
          fields={["study_goal", "atmosphere", "preferred_time", "communication_style", "language"]}
          value={prefs}
          onChange={setPrefs}
        />
        <FormError message={error} />
        <Button busy={busy} onClick={save}>
          Simpan preferensi
        </Button>
      </div>
    </Section>
  );
}

function Appearance() {
  const theme = useTheme();
  return (
    <Section title="Tampilan">
      <OptionGroup
        legend="Tema"
        options={[
          { value: "dark", label: "Gelap" },
          { value: "light", label: "Terang" },
        ]}
        value={theme}
        onChange={setTheme}
      />
    </Section>
  );
}

function Blocks() {
  const blocks = useBlocks();
  const { unblock } = useBlockActions();
  const toast = useToast();
  return (
    <Section title="Pengguna diblokir">
      {blocks.isPending && <SkeletonList rows={2} className="h-12" />}
      {blocks.isError && <ErrorState error={blocks.error} onRetry={() => void blocks.refetch()} />}
      {blocks.data?.length === 0 && <p className="text-sm text-muted">Tidak ada.</p>}
      <ul className="space-y-2">
        {blocks.data?.map((user) => (
          <li
            key={user.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised px-4 py-2"
          >
            <span className="truncate">{user.display_name}</span>
            <Button
              variant="ghost"
              aria-label={`Batalkan blokir ${user.display_name}`}
              onClick={() => unblock.mutate(user.id, { onError: (e) => toast(e.message) })}
            >
              Batalkan blokir
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DeleteAccount() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
        Hapus akun
      </Button>
      <ConfirmModal
        open={open}
        danger
        title="Hapus akunmu?"
        confirmLabel="Hapus permanen"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await call(api.DELETE("/api/v1/users/me"));
          await logout();
        }}
      >
        <p>
          Profil, preferensi, dan koneksimu dihapus. Pesan yang sudah terkirim tampil sebagai &quot;Pengguna
          dihapus&quot;. Ini tidak bisa dibatalkan.
        </p>
      </ConfirmModal>
    </>
  );
}
