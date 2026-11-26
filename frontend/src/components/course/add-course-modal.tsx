"use client";

import { Check, Plus } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/states";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useCourseSearch, useTogglePlanned } from "@/lib/data";

export function AddCourseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Tambah mata kuliah" subtitle="Pilih yang rencananya mau kamu ambil.">
      <Picker />
    </Modal>
  );
}

function Picker() {
  const [query, setQuery] = useState("");
  const courses = useCourseSearch(useDeferredValue(query));
  const toggle = useTogglePlanned();
  const toast = useToast();
  return (
    <div className="space-y-3">
      <TextField
        label="Cari mata kuliah"
        data-autofocus
        type="search"
        placeholder="Nama, kode, atau jurusan"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {courses.isPending && <SkeletonList rows={5} className="h-14" />}
      {courses.isError && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
      {courses.data?.length === 0 && <EmptyState title="Tidak ketemu">Coba nama atau kode lain.</EmptyState>}
      <ul className="space-y-1.5">
        {courses.data?.map((course) => (
          <li key={course.id} className="flex items-center gap-3 rounded-xl border border-line bg-raised px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{course.name}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                {course.code} · {course.credits} SKS {course.is_sample && <Tag>Data contoh</Tag>}
              </p>
            </div>
            <Button
              variant={course.is_planned ? "ghost" : "soft"}
              aria-label={`${course.is_planned ? "Hapus dari" : "Tambah ke"} rencana: ${course.name}`}
              onClick={() =>
                toggle.mutate(
                  { courseId: course.id, planned: !course.is_planned },
                  { onError: (e) => toast(e.message) },
                )
              }
            >
              {course.is_planned ? <Check size={17} className="text-mint" /> : <Plus size={17} />}
              <span className="max-sm:sr-only">{course.is_planned ? "Ditambahkan" : "Tambah"}</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
