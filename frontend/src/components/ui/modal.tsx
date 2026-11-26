"use client";

import { X } from "lucide-react";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  hideTitle?: boolean;
}

/** Native <dialog>: focus trap, Esc, inert background. Bottom sheet on phones. */
export function Modal(props: Props) {
  return props.open ? <Dialog {...props} /> : null;
}

function Dialog({ onClose, title, subtitle, children, footer, wide, hideTitle }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // showModal() focuses the first button; prefer the field the dialog is about.
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "max-h-[92dvh] w-full max-w-full flex-col overflow-hidden border border-line bg-main p-0 shadow-2xl open:flex",
        "animate-[sheet-in_180ms] backdrop:animate-[fade-in_160ms]",
        "max-sm:mt-auto max-sm:mb-0 max-sm:rounded-t-2xl sm:m-auto sm:rounded-2xl",
        wide ? "sm:max-w-3xl" : "sm:max-w-lg",
      )}
    >
      <div className={cn("flex items-start gap-3 px-5 pt-5", hideTitle && "sr-only")}>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-bold text-balance">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        <IconButton label="Tutup" onClick={onClose} className="-mt-1.5 -mr-2">
          <X size={18} />
        </IconButton>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", hideTitle ? "p-0" : "px-5 py-4")}>{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </dialog>
  );
}
