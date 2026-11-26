"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { isComplete, PreferencesFields, type PartialPreferences } from "@/components/preferences-fields";
import { Button } from "@/components/ui/button";
import { Checkbox, FormError, TextField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/states";
import { api, call, errorMessage } from "@/lib/api/client";
import { useAuth, type Me } from "@/lib/auth";
import type { Preferences } from "@/lib/labels";

const STEPS: { title: string; subtitle: string; fields: (keyof Preferences)[] }[] = [
  {
    title: "Tujuan dan suasana",
    subtitle: "Supaya kami bisa menunjukkan lobby yang cocok.",
    fields: ["study_goal", "atmosphere"],
  },
  {
    title: "Waktu dan gaya ngobrol",
    subtitle: "Bisa kamu ubah kapan saja.",
    fields: ["preferred_time", "communication_style"],
  },
  { title: "Bahasa dan profil", subtitle: "Dipakai untuk kalimat perkenalanmu.", fields: ["language"] },
];
const LAST = STEPS.length;

const RULES = [
  "Saling menghargai. Tidak ada perundungan, pelecehan, atau spam.",
  "Jangan bagikan data pribadi orang lain.",
  "Belajar bareng, bukan joki atau bocoran ujian.",
];

export default function OnboardingPage() {
  const { status, me } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/masuk");
    if (me?.onboarded_at) router.replace("/beranda");
  }, [status, me, router]);

  if (!me) {
    return (
      <AuthCard title="Menyiapkan akunmu">
        <Skeleton className="h-40" />
      </AuthCard>
    );
  }
  return <Wizard me={me} />;
}

function Wizard({ me }: { me: Me }) {
  const { setMe } = useAuth();
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<PartialPreferences>(me.preferences ?? {});
  const [major, setMajor] = useState(me.major);
  const [cohort, setCohort] = useState(me.cohort_year ? String(me.cohort_year) : "");
  const [newcomer, setNewcomer] = useState(me.is_newcomer);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const cohortValid = cohort === "" || (/^\d{4}$/.test(cohort) && Number(cohort) >= 1990 && Number(cohort) <= 2100);

  const go = (next: number) => {
    setStep(next);
    topRef.current?.focus();
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isComplete(prefs)) await call(api.PUT("/api/v1/users/me/preferences", { body: prefs }));
      const next = await call(
        api.PATCH("/api/v1/users/me", {
          body: {
            major,
            cohort_year: cohort ? Number(cohort) : null,
            is_newcomer: newcomer,
            accept_code_of_conduct: true,
            complete_onboarding: true,
          },
        }),
      );
      setMe(next);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const current = STEPS[step];
  return (
    <AuthCard
      title={current?.title ?? "Kode etik singkat"}
      subtitle={current ? `Langkah ${step + 1} dari ${LAST}. ${current.subtitle}` : "Satu hal lagi sebelum mulai."}
    >
      <div ref={topRef} tabIndex={-1} className="flex gap-1.5 outline-none" aria-hidden>
        {[...STEPS, null].map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-line"}`} />
        ))}
      </div>
      {current ? (
        <>
          <PreferencesFields fields={current.fields} value={prefs} onChange={setPrefs} />
          {step === 2 && (
            <div className="space-y-4 pt-2">
              <TextField label="Jurusan" maxLength={80} value={major} onChange={(e) => setMajor(e.target.value)} />
              <TextField
                label="Angkatan"
                inputMode="numeric"
                maxLength={4}
                placeholder="2026"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                error={cohortValid ? undefined : "Tulis tahun 4 angka, misalnya 2026."}
              />
              <Checkbox label="Aku baru di kampus atau kota ini" checked={newcomer} onChange={setNewcomer} />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => go(step === 0 ? LAST : step - 1)}>
              {step === 0 ? "Lewati" : "Kembali"}
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="ghost" onClick={() => go(LAST)}>
                  Lewati
                </Button>
              )}
              <Button onClick={() => go(step + 1)} disabled={step === 2 && !cohortValid}>
                Lanjut
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <ul className="list-disc space-y-2 pl-5 text-[15px]">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <Checkbox label="Aku setuju dengan kode etik ini" checked={agreed} onChange={setAgreed} />
          {!isComplete(prefs) && (
            <p className="text-sm text-muted">
              Preferensimu belum lengkap, jadi skor kecocokan belum tampil. Kamu bisa melengkapinya nanti di menu Kamu.
            </p>
          )}
          <FormError message={error} />
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => go(0)}>
              Kembali
            </Button>
            <Button onClick={finish} disabled={!agreed || !cohortValid} busy={busy}>
              Mulai
            </Button>
          </div>
        </>
      )}
    </AuthCard>
  );
}
