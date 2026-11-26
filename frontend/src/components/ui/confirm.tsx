"use client";

import { useState, type ReactNode } from "react";
import { errorMessage } from "@/lib/api/client";
import { Button } from "./button";
import { FormError } from "./field";
import { Modal } from "./modal";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown>;
}

export function ConfirmModal(props: Props) {
  return props.open ? <Confirm {...props} /> : null;
}

function Confirm({ onClose, title, children, confirmLabel, danger, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant={danger ? "danger" : "primary"} busy={busy} onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[15px]">
        {children}
        <FormError message={error} />
      </div>
    </Modal>
  );
}
