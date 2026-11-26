"use client";

import { Modal } from "@/components/ui/modal";
import { ErrorState, SkeletonList } from "@/components/ui/states";
import { useSemester } from "@/lib/data";
import { formatDate } from "@/lib/format";

export function SemesterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Pengaturan semester">
      <Info />
    </Modal>
  );
}

function Info() {
  const semester = useSemester();
  if (semester.isPending) return <SkeletonList rows={3} />;
  if (semester.isError) return <ErrorState error={semester.error} onRetry={() => void semester.refetch()} />;
  const s = semester.data;
  const deletion = new Date(new Date(s.ends_at).getTime() + s.grace_days * 86_400_000).toISOString();
  const rows = [
    ["Semester", s.name],
    ["Mulai", formatDate(s.starts_at)],
    ["Lobby jadi hanya-baca", formatDate(s.ends_at)],
    ["Lobby dan chat dihapus", formatDate(deletion)],
  ];
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-line">
        {rows.map(([term, value]) => (
          <div key={term} className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted">{term}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted">
        Tanggal diatur admin dan berlaku untuk semua mata kuliah. Koneksi yang sudah diterima tetap tersimpan.
      </p>
    </div>
  );
}
