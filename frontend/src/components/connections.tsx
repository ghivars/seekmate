"use client";

import { Mail, Trash2 } from "lucide-react";
import { useState } from "react";
import { EMAIL_NOTICE } from "@/components/lobby/save-connections-modal";
import { Section } from "@/components/shell/page";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm";
import { ErrorState, SkeletonList } from "@/components/ui/states";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useConnectionActions, useConnections, type Connection } from "@/lib/data";

function Person({ connection }: { connection: Connection }) {
  const { user, origin_course } = connection;
  const background = [user.major, user.cohort_year && `angkatan ${user.cohort_year}`].filter(Boolean).join(", ");
  return (
    <>
      <Avatar id={user.id} name={user.display_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{user.display_name}</p>
        <p className="truncate text-[13px] text-muted">
          {[background, origin_course && `dari ${origin_course.name}`].filter(Boolean).join(" · ")}
        </p>
      </div>
    </>
  );
}

const ROW = "flex flex-wrap items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3";

export function PendingConnections() {
  const connections = useConnections();
  const { accept, decline } = useConnectionActions();
  const toast = useToast();
  const incoming = (connections.data ?? []).filter((c) => c.status === "pending" && c.direction === "incoming");
  if (incoming.length === 0) return null;
  const onError = (e: Error) => toast(e.message);
  return (
    <Section title="Permintaan koneksi">
      <p className="mb-3 text-sm text-muted">{EMAIL_NOTICE}</p>
      <ul className="space-y-2">
        {incoming.map((c) => (
          <li key={c.id} className={ROW}>
            <Person connection={c} />
            <div className="flex gap-2 max-sm:w-full">
              <Button
                variant="soft"
                className="max-sm:flex-1"
                aria-label={`Tolak ${c.user.display_name}`}
                onClick={() => decline.mutate(c, { onError })}
              >
                Tolak
              </Button>
              <Button
                className="max-sm:flex-1"
                aria-label={`Terima ${c.user.display_name}`}
                onClick={() => accept.mutate(c, { onError })}
              >
                Terima
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ConnectionList() {
  const connections = useConnections();
  const { remove } = useConnectionActions();
  const [removing, setRemoving] = useState<Connection | null>(null);
  const saved = (connections.data ?? []).filter((c) => c.status === "accepted");
  const waiting = (connections.data ?? []).filter((c) => c.status === "pending" && c.direction === "outgoing");
  return (
    <Section title="Koneksi">
      {connections.isPending && <SkeletonList rows={2} className="h-16" />}
      {connections.isError && <ErrorState error={connections.error} onRetry={() => void connections.refetch()} />}
      {connections.data && saved.length + waiting.length === 0 && (
        <p className="text-sm text-muted">
          Belum ada koneksi. Ajukan dari daftar anggota lobby supaya kalian tetap terhubung setelah semester berakhir.
        </p>
      )}
      <ul className="space-y-2">
        {saved.map((c) => (
          <li key={c.id} className={ROW}>
            <Person connection={c} />
            {c.email && (
              <a
                href={`mailto:${c.email}`}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-link hover:underline sm:min-h-9"
              >
                <Mail size={15} aria-hidden /> {c.email}
              </a>
            )}
            <IconButton label={`Hapus koneksi ${c.user.display_name}`} onClick={() => setRemoving(c)}>
              <Trash2 size={16} />
            </IconButton>
          </li>
        ))}
        {waiting.map((c) => (
          <li key={c.id} className={ROW}>
            <Person connection={c} />
            <Tag>Menunggu jawaban</Tag>
          </li>
        ))}
      </ul>
      {removing && (
        <ConfirmModal
          open
          danger
          title={`Hapus koneksi ${removing.user.display_name}?`}
          confirmLabel="Hapus koneksi"
          onClose={() => setRemoving(null)}
          onConfirm={() => remove.mutateAsync(removing)}
        >
          <p>Kalian tidak akan melihat email masing-masing lagi. Ini berlaku untuk kalian berdua.</p>
        </ConfirmModal>
      )}
    </Section>
  );
}
