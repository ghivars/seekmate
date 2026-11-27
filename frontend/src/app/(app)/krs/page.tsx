"use client";

import { AlertTriangle, BookOpen, Lightbulb, Plus, Sparkles, Users, Wand2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { HeroGlow, Page, Section } from "@/components/shell/page";
import { useShell } from "@/components/shell/shell-context";
import { Button, buttonClass } from "@/components/ui/button";
import { FormError, TextArea } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { LiveDot, Tag } from "@/components/ui/tag";
import { errorMessage } from "@/lib/api/client";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/cn";
import { useAnalyzeKrs, useKrsStatus, useMyCourses, type KrsAnalysis } from "@/lib/data";

const LOAD: Record<KrsAnalysis["load"], { label: string; tone: string; width: string; emoji: string }> = {
  ringan: { label: "Ringan", tone: "bg-mint", width: "w-1/4", emoji: "🌱" },
  seimbang: { label: "Seimbang", tone: "bg-primary", width: "w-1/2", emoji: "⚖️" },
  berat: { label: "Berat", tone: "bg-amber", width: "w-3/4", emoji: "🔥" },
  sangat_berat: { label: "Sangat berat", tone: "bg-danger-fill", width: "w-full", emoji: "🌋" },
};

export default function KrsPage() {
  const courses = useMyCourses();
  const status = useKrsStatus();
  const analyze = useAnalyzeKrs();
  const { openAddCourse } = useShell();
  const [target, setTarget] = useState(20);
  const [notes, setNotes] = useState("");
  const total = (courses.data ?? []).reduce((sum, c) => sum + c.credits, 0);
  const aiOn = status.data?.ai_enabled ?? false;

  const run = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    analyze.mutate(
      { target_credits: target, notes: notes.trim() },
      { onSuccess: () => celebrate(button) },
    );
  };

  return (
    <Page title="Analisis KRS" badge={aiOn ? "AI aktif" : "mode dasar"} wide>
      <div className="doodle-hero relative isolate mb-8 -mx-4 -mt-6 rounded-b-3xl px-6 py-8 sm:-mx-8 sm:px-10 sm:py-10">
        <HeroGlow />
        <p className="label-mono flex items-center gap-2 text-amber">
          <Sparkles size={13} aria-hidden /> Asisten rencana studi
        </p>
        <h2 className="mt-2 text-4xl font-bold sm:text-5xl">
          Cek KRS-mu sebelum klik submit <span aria-hidden>🧠</span>
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          Kami hitung beban SKS, cek mata kuliah mana yang sudah ramai lobby-nya, lalu kasih saran biar semestermu
          nggak keteteran.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-2xl border border-line bg-raised p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold">Rencana kamu</h3>
              <span className="font-mono text-sm text-amber">{total} SKS</span>
            </div>
            {courses.isPending && <Skeleton className="h-28" />}
            {courses.isError && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
            {courses.data?.length === 0 && (
              <EmptyState
                icon={<BookOpen size={26} />}
                title="Rencanamu masih kosong"
                action={
                  <Button onClick={openAddCourse}>
                    <Plus size={16} aria-hidden /> Tambah mata kuliah
                  </Button>
                }
              />
            )}
            <ul className="space-y-1.5">
              {courses.data?.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5 rounded-lg bg-app/70 px-3 py-2">
                  <span className="font-mono text-xs font-semibold text-amber">{c.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                  <span className="font-mono text-xs text-muted">{c.credits} SKS</span>
                </li>
              ))}
            </ul>
            {courses.data && courses.data.length > 0 && (
              <button type="button" onClick={openAddCourse} className="mt-2 text-sm font-semibold text-link hover:underline">
                + Tambah mata kuliah
              </button>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-line bg-raised p-5">
            <div className="space-y-2">
              <label htmlFor="target-sks" className="block text-sm font-medium">
                Target SKS: <output className="font-mono text-amber">{target}</output>
              </label>
              <input
                id="target-sks"
                type="range"
                min={2}
                max={24}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="h-11 w-full accent-[var(--primary)]"
              />
            </div>
            <TextArea
              label="Ceritakan sedikit (opsional)"
              rows={3}
              maxLength={300}
              placeholder="Contoh: aku kerja paruh waktu sore, dan agak lemah di matematika."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              hint={aiOn ? "Dikirim ke AI bersama daftar mata kuliah. Jangan tulis data pribadi." : undefined}
            />
            <Button block busy={analyze.isPending} disabled={!courses.data?.length} onClick={run}>
              <Wand2 size={17} aria-hidden /> Analisis sekarang
            </Button>
            <p className="flex items-center gap-2 text-xs text-muted">
              {aiOn ? (
                <>
                  <LiveDot /> Didukung AI ({status.data?.model})
                </>
              ) : (
                "AI belum diaktifkan admin. Kamu tetap dapat analisis dasar berbasis aturan."
              )}
            </p>
          </div>
        </div>

        <div aria-live="polite">
          {analyze.isPending && <ThinkingCard />}
          {analyze.isError && (
            <FormError message={errorMessage(analyze.error)} />
          )}
          {!analyze.data && !analyze.isPending && !analyze.isError && <Placeholder />}
          {analyze.data && !analyze.isPending && <Result data={analyze.data} />}
        </div>
      </div>
    </Page>
  );
}

function Placeholder() {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line p-8 text-center">
      <span aria-hidden className="animate-[float_3s_ease-in-out_infinite] text-5xl">
        🔮
      </span>
      <p className="font-display text-xl font-bold">Hasil analisis muncul di sini</p>
      <p className="max-w-sm text-sm text-muted">
        Atur target SKS, lalu tekan Analisis sekarang. Butuh beberapa detik saja.
      </p>
    </div>
  );
}

function ThinkingCard() {
  return (
    <div role="status" className="space-y-4 rounded-2xl border border-line bg-raised p-6">
      <p className="flex items-center gap-2 font-semibold">
        <Sparkles size={17} className="animate-pulse text-amber" aria-hidden /> Lagi mikir keras...
      </p>
      {["w-3/4", "w-full", "w-5/6", "w-2/3"].map((w) => (
        <div
          key={w}
          className={cn(
            "h-4 rounded bg-[linear-gradient(90deg,var(--line),var(--raised),var(--line))] bg-[length:200%_100%]",
            "animate-[shimmer_1.4s_linear_infinite]",
            w,
          )}
        />
      ))}
    </div>
  );
}

function Result({ data }: { data: KrsAnalysis }) {
  const load = LOAD[data.load];
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-raised p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Tag tone={data.source === "ai" ? "amber" : "neutral"}>
            {data.source === "ai" ? (
              <>
                <Sparkles size={11} aria-hidden /> Analisis AI
              </>
            ) : (
              "Analisis dasar"
            )}
          </Tag>
          <span className="flex-1" />
          <span className="font-mono text-sm text-muted">
            {data.total_credits} SKS{data.target_credits ? ` / target ${data.target_credits}` : ""}
          </span>
        </div>
        <p className="label-mono text-muted">Beban semester</p>
        <p className="mt-1 font-display text-3xl font-bold">
          {load.label} <span aria-hidden>{load.emoji}</span>
        </p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className={cn("h-full rounded-full transition-[width] duration-700", load.tone, load.width)} />
        </div>
        <p className="mt-4 text-[15px] leading-relaxed">{data.summary}</p>
      </div>

      {data.warnings.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber/40 bg-amber/10 p-5">
          {data.warnings.map((w) => (
            <p key={w} className="flex gap-2.5 text-sm">
              <AlertTriangle size={17} aria-hidden className="mt-0.5 shrink-0 text-amber" /> {w}
            </p>
          ))}
        </div>
      )}

      <Section title="Saran buat kamu" tone="amber">
        <ul className="space-y-2.5">
          {data.suggestions.map((s) => (
            <li key={s} className="flex gap-3 rounded-xl border border-line bg-raised p-4 text-[15px]">
              <Lightbulb size={18} aria-hidden className="mt-0.5 shrink-0 text-amber" /> {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Per mata kuliah" tone="mint">
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.courses.map((c) => (
            <li key={c.course_id} className="flex flex-col gap-2 rounded-xl border border-line bg-raised p-4">
              <p className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-amber">{c.code}</span>
                <span className="font-mono text-xs text-muted">{c.credits} SKS</span>
              </p>
              <p className="font-semibold">{c.name}</p>
              <p className="text-sm text-muted">{c.tip}</p>
              <p className="mt-auto flex items-center gap-3 pt-1 font-mono text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <Users size={12} aria-hidden /> {c.planner_count} merencanakan
                </span>
                <Link href={`/c/${c.course_id}`} className="ml-auto font-sans font-semibold text-link hover:underline">
                  {c.lobby_count > 0 ? `${c.lobby_count} lobby` : "Buat lobby"} →
                </Link>
              </p>
            </li>
          ))}
        </ul>
      </Section>
      <p className="text-xs text-muted">{data.disclaimer}</p>
      <Link href="/jelajah" className={buttonClass("soft")}>
        Cari teman belajar di Jelajah
      </Link>
    </div>
  );
}
