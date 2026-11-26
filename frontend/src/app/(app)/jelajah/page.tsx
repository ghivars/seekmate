"use client";

import { Check, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Page } from "@/components/shell/page";
import { Button, buttonClass } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useCourseSearch, useTogglePlanned, type Course } from "@/lib/data";

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const courses = useCourseSearch(useDeferredValue(query.trim()));
  return (
    <Page title="Jelajah">
      <TextField
        label="Cari mata kuliah"
        type="search"
        placeholder="Nama, kode, atau jurusan"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-5"
      />
      {courses.isPending && (
        <div role="status" aria-label="Memuat mata kuliah" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      )}
      {courses.isError && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
      {courses.data?.length === 0 && (
        <EmptyState icon={<Search size={28} />} title="Mata kuliah tidak ketemu">
          Coba nama, kode, atau jurusan lain.
        </EmptyState>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.data?.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </ul>
    </Page>
  );
}

function CourseCard({ course }: { course: Course }) {
  const toggle = useTogglePlanned();
  const toast = useToast();
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-raised p-4">
      <p className="flex items-center gap-2 text-[13px] text-muted">
        {course.code} · {course.credits} SKS {course.is_sample && <Tag>Data contoh</Tag>}
      </p>
      <h2 className="font-semibold text-balance">{course.name}</h2>
      <p className="text-sm text-muted">
        {course.lobby_count > 0 ? `${course.lobby_count} lobby aktif` : "Belum ada lobby"}
      </p>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Button
          variant={course.is_planned ? "ghost" : "primary"}
          className="flex-1"
          aria-label={`${course.is_planned ? "Hapus dari" : "Tambah ke"} rencana: ${course.name}`}
          onClick={() =>
            toggle.mutate({ courseId: course.id, planned: !course.is_planned }, { onError: (e) => toast(e.message) })
          }
        >
          {course.is_planned ? (
            <>
              <Check size={16} className="text-mint" aria-hidden /> Di rencana
            </>
          ) : (
            <>
              <Plus size={16} aria-hidden /> Tambah ke rencana
            </>
          )}
        </Button>
        <Link href={`/c/${course.id}`} className={buttonClass("soft")}>
          Lihat<span className="sr-only"> lobby {course.name}</span>
        </Link>
      </div>
    </li>
  );
}
