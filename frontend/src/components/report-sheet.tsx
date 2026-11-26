"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, OptionGroup, TextArea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useSendReport, type ReportInput } from "@/lib/data";
import type { Option } from "@/lib/labels";

export interface ReportTarget {
  type: ReportInput["target_type"];
  id: string;
  label: string;
}

const REASONS: Option<ReportInput["reason"]>[] = [
  { value: "harassment", label: "Pelecehan atau perundungan" },
  { value: "spam", label: "Spam atau promosi" },
  { value: "inappropriate", label: "Konten tidak pantas" },
  { value: "other", label: "Lainnya" },
];

export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  return target ? <Sheet target={target} onClose={onClose} /> : null;
}

function Sheet({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const toast = useToast();
  const report = useSendReport();
  const [reason, setReason] = useState<ReportInput["reason"]>();
  const [detail, setDetail] = useState("");
  const submit = () => {
    if (!reason) return;
    report.mutate(
      { target_type: target.type, target_id: target.id, reason, detail: detail.trim() },
      {
        onSuccess: () => {
          toast("Laporan terkirim. Terima kasih sudah menjaga SeekMate.");
          onClose();
        },
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Laporkan ${target.label}`}
      subtitle="Admin akan melihat salinan singkat isinya. Pelapor tidak ditampilkan ke yang dilaporkan."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="danger" disabled={!reason} busy={report.isPending} onClick={submit}>
            Kirim laporan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <OptionGroup legend="Alasan" options={REASONS} value={reason} onChange={setReason} columns={1} />
        <TextArea
          label="Catatan (opsional)"
          maxLength={250}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
        <FormError message={report.isError ? errorMessage(report.error) : null} />
      </div>
    </Modal>
  );
}
