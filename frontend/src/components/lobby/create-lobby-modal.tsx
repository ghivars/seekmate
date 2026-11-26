"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormError, OptionGroup, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useMe } from "@/lib/auth";
import { celebrate } from "@/lib/celebrate";
import { useCourse, useCourseSearch, useCreateLobby } from "@/lib/data";
import { ATMOSPHERES, STUDY_GOALS, TIMES } from "@/lib/labels";
import { useZodForm } from "@/lib/use-zod-form";
import { LobbyCardBody } from "./lobby-card";

export const lobbySchema = z.object({
  title: z.string().trim().min(3, "Minimal 3 huruf.").max(80, "Maksimal 80 huruf."),
  description: z.string().trim().max(500, "Maksimal 500 huruf."),
  study_goal: z.enum(["assignment_group", "exam_prep", "concept_discussion", "just_connect"]),
  atmosphere: z.enum(["chill", "focused", "mixed"]),
  preferred_time: z.enum(["morning", "afternoon", "evening", "flexible"]),
  capacity: z.number().int().min(2, "Minimal 2 orang.").max(15, "Maksimal 15 orang."),
});

const STEP_TITLES = ["Judul dan deskripsi", "Tujuan, suasana, waktu", "Kapasitas"];

export function CreateLobbyModal({ courseId, onClose }: { courseId: string | null; onClose: () => void }) {
  return (
    <Modal open={courseId !== null} onClose={onClose} title="Buat Lobby" subtitle="Boleh sendiri dulu, teman menyusul." wide>
      {courseId !== null && <Wizard initialCourse={courseId} onClose={onClose} />}
    </Modal>
  );
}

function Wizard({ initialCourse, onClose }: { initialCourse: string; onClose: () => void }) {
  const me = useMe();
  const router = useRouter();
  const all = useCourseSearch("");
  const [picked, setPicked] = useState(initialCourse);
  const courseId = picked || all.data?.find((c) => c.is_planned)?.id || all.data?.[0]?.id || "";
  const course = useCourse(courseId);
  const create = useCreateLobby();
  const [step, setStep] = useState(0);
  const form = useZodForm(lobbySchema, {
    title: "",
    description: "",
    study_goal: me.preferences?.study_goal ?? "assignment_group",
    atmosphere: me.preferences?.atmosphere ?? "mixed",
    preferred_time: me.preferences?.preferred_time ?? "flexible",
    capacity: 5,
  });
  const { values: v, errors, set } = form;

  const next = () => {
    const result = lobbySchema.pick({ title: true, description: true }).safeParse(v);
    if (step === 0 && !result.success) {
      form.validate();
      return;
    }
    setStep(step + 1);
  };

  const submit = form.submit(async (data) => {
    const lobby = await create.mutateAsync({ courseId, body: data });
    celebrate();
    onClose();
    router.push(`/c/${courseId}/${lobby.id}`);
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step < 2) next();
        else void submit();
      }}
      className="grid gap-6 sm:grid-cols-[1fr_240px]"
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted">
            Langkah {step + 1} dari 3: {STEP_TITLES[step]}
          </p>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {STEP_TITLES.map((title, i) => (
              <span key={title} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-line"}`} />
            ))}
          </div>
        </div>
        {step === 0 && (
          <>
            {!initialCourse && (
              <div className="space-y-1.5">
                <label htmlFor="lobby-course" className="block text-sm font-medium">
                  Mata kuliah
                </label>
                <select
                  id="lobby-course"
                  value={courseId}
                  onChange={(e) => setPicked(e.target.value)}
                  className="h-11 w-full rounded-lg border border-line bg-app px-3 text-[16px] sm:text-[15px]"
                >
                  {all.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <TextField
              label="Judul lobby"
              data-autofocus
              maxLength={80}
              placeholder="Contoh: Cari kelompok tugas besar"
              value={v.title}
              onChange={(e) => set("title", e.target.value)}
              error={errors.title}
            />
            <TextArea
              label="Deskripsi (opsional)"
              maxLength={500}
              placeholder="Ceritakan mau belajar apa dan kapan."
              value={v.description}
              onChange={(e) => set("description", e.target.value)}
              error={errors.description}
              hint={`${v.description.length}/500`}
            />
          </>
        )}
        {step === 1 && (
          <>
            <OptionGroup legend="Tujuan" options={STUDY_GOALS} value={v.study_goal} onChange={(x) => set("study_goal", x)} />
            <OptionGroup legend="Suasana" options={ATMOSPHERES} value={v.atmosphere} onChange={(x) => set("atmosphere", x)} />
            <OptionGroup legend="Waktu" options={TIMES} value={v.preferred_time} onChange={(x) => set("preferred_time", x)} />
          </>
        )}
        {step === 2 && (
          <div className="space-y-2">
            <label htmlFor="kapasitas" className="block text-sm font-medium">
              Kapasitas: <output className="tabular-nums">{v.capacity} orang</output> (termasuk kamu)
            </label>
            <input
              id="kapasitas"
              type="range"
              min={2}
              max={15}
              value={v.capacity}
              onChange={(e) => set("capacity", Number(e.target.value))}
              className="h-11 w-full accent-[var(--primary)]"
            />
            <p className="text-sm text-muted">Kelompok kecil (3 sampai 6) biasanya lebih gampang akrab.</p>
          </div>
        )}
        <FormError message={form.formError} />
        <div className="flex justify-between gap-2 pt-2">
          <Button variant="ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
            {step === 0 ? "Batal" : "Kembali"}
          </Button>
          <Button type="submit" busy={form.busy}>
            {step < 2 ? "Lanjut" : "Buat Lobby"}
          </Button>
        </div>
      </div>
      <div className="max-sm:order-first">
        <p className="mb-2 text-[13px] font-medium text-muted">Pratinjau</p>
        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-raised p-4">
          <LobbyCardBody
            lobby={{
              ...v,
              title: v.title.trim() || "Judul lobby kamu",
              course_code: course.data?.code,
              member_count: 1,
              members_preview: [{ id: me.id, display_name: me.display_name }],
              status: "open",
              match: null,
            }}
            showCourse
          />
        </div>
      </div>
    </form>
  );
}
