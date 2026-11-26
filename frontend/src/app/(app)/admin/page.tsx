"use client";

import { useState } from "react";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/states";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/lib/auth";
import { useAdminActions, useReports, type Report } from "@/lib/data";
import { formatRelative } from "@/lib/format";

const STATUS: Record<Report["status"], string> = {
  open: "Baru",
  reviewed: "Ditinjau",
  actioned: "Ditindak",
  dismissed: "Ditolak",
};
const REASON: Record<Report["reason"], string> = {
  harassment: "Pelecehan",
  spam: "Spam",
  inappropriate: "Tidak pantas",
  other: "Lainnya",
};
const TARGET: Record<Report["target_type"], string> = { message: "Pesan", lobby: "Lobby", user: "Pengguna" };
const STATUSES = Object.keys(STATUS) as Report["status"][];

export default function AdminPage() {
  const me = useMe();
  if (me.role !== "admin") {
    return (
      <Page title="Admin">
        <EmptyState title="Halaman ini khusus admin" />
      </Page>
    );
  }
  return <Reports />;
}

type Pending = { kind: "lobby"; id: string } | { kind: "user"; id: string; suspended: boolean };

function Reports() {
  const [filter, setFilter] = useState<Report["status"] | undefined>("open");
  const [pending, setPending] = useState<Pending | null>(null);
  const reports = useReports(filter);
  const actions = useAdminActions();
  const toast = useToast();
  return (
    <Page title="Laporan">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter status">
        {[undefined, ...STATUSES].map((s) => (
          <Button
            key={s ?? "all"}
            variant={filter === s ? "primary" : "soft"}
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
          >
            {s ? STATUS[s] : "Semua"}
          </Button>
        ))}
      </div>
      {reports.isPending && <SkeletonList rows={5} className="h-16" />}
      {reports.isError && <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />}
      {reports.data?.length === 0 && <EmptyState title="Tidak ada laporan di sini" />}
      {reports.data && reports.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-side text-muted">
              <tr>
                {["Target", "Alasan", "Detail", "Pelapor", "Status", "Tindakan"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reports.data.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-3">
                    <Tag>{TARGET[r.target_type]}</Tag>
                    <p className="mt-1 max-w-40 [overflow-wrap:anywhere]">{r.target_label ?? "Sudah dihapus"}</p>
                    <p className="text-xs text-muted">{formatRelative(r.created_at)}</p>
                  </td>
                  <td className="px-3 py-3">{REASON[r.reason]}</td>
                  <td className="max-w-64 px-3 py-3 [overflow-wrap:anywhere] whitespace-pre-wrap">{r.detail}</td>
                  <td className="px-3 py-3">{r.reporter.display_name}</td>
                  <td className="px-3 py-3">
                    <select
                      aria-label="Status laporan"
                      value={r.status}
                      onChange={(e) => {
                        const status = STATUSES.find((s) => s === e.target.value);
                        if (status) actions.setStatus.mutate({ id: r.id, status }, { onError: (x) => toast(x.message) });
                      }}
                      className="h-11 rounded-lg border border-line bg-raised px-2 sm:h-9"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="space-y-1.5 px-3 py-2">
                    {r.lobby_id && (
                      <Button variant="soft" onClick={() => setPending({ kind: "lobby", id: r.lobby_id ?? "" })}>
                        Tutup lobby
                      </Button>
                    )}
                    {r.user_id && r.user_status !== "deleted" && (
                      <Button
                        variant="soft"
                        onClick={() =>
                          setPending({ kind: "user", id: r.user_id ?? "", suspended: r.user_status === "active" })
                        }
                      >
                        {r.user_status === "active" ? "Nonaktifkan akun" : "Aktifkan akun"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pending && (
        <ConfirmModal
          open
          danger
          title={
            pending.kind === "lobby"
              ? "Tutup lobby ini?"
              : pending.suspended
                ? "Nonaktifkan akun ini?"
                : "Aktifkan lagi akun ini?"
          }
          confirmLabel="Ya, lanjutkan"
          onClose={() => setPending(null)}
          onConfirm={() =>
            pending.kind === "lobby"
              ? actions.deactivateLobby.mutateAsync(pending.id)
              : actions.suspendUser.mutateAsync({ userId: pending.id, suspended: pending.suspended })
          }
        >
          <p>
            {pending.kind === "lobby"
              ? "Lobby menjadi hanya-baca dan hilang dari daftar."
              : pending.suspended
                ? "Pengguna langsung keluar dari semua perangkat dan tidak bisa masuk."
                : "Pengguna bisa masuk lagi seperti biasa."}
          </p>
        </ConfirmModal>
      )}
    </Page>
  );
}
