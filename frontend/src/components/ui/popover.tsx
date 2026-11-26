"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefCallback,
} from "react";
import { cn } from "@/lib/cn";

export interface TriggerProps {
  ref: RefCallback<HTMLButtonElement>;
  onClick: () => void;
  onPointerEnter?: (e: React.PointerEvent) => void;
  onPointerLeave?: (e: React.PointerEvent) => void;
  "aria-expanded": boolean;
  "aria-haspopup": "dialog";
}

interface Props {
  label: string;
  trigger: (props: TriggerProps) => ReactNode;
  children: (close: () => void) => ReactNode;
  side?: "bottom" | "left" | "top";
  align?: "start" | "end";
  hover?: boolean;
  className?: string;
}

/** Top-layer popover anchored to a button; never clipped by scroll containers. */
export function Popover({ label, trigger, children, side = "bottom", align = "start", hover, className }: Props) {
  const [mode, setMode] = useState<"closed" | "click" | "hover">("closed");
  const anchor = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = mode !== "closed";

  const schedule = (next: "closed" | "hover", ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMode((m) => (m === "click" ? m : next)), ms);
  };
  const close = () => {
    setMode("closed");
    anchor.current?.focus();
  };

  useLayoutEffect(() => {
    const el = panel.current;
    if (!open || !el || !anchor.current) return;
    el.showPopover?.();
    const a = anchor.current.getBoundingClientRect();
    const p = el.getBoundingClientRect();
    let left = align === "start" ? a.left : a.right - p.width;
    let top = side === "top" ? a.top - p.height - 6 : a.bottom + 6;
    if (side === "left") {
      left = a.left - p.width - 8;
      top = a.top;
    }
    el.style.left = `${Math.max(8, Math.min(left, window.innerWidth - p.width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(top, window.innerHeight - p.height - 8))}px`;
  }, [open, side, align]);

  useEffect(() => {
    if (!open) return;
    if (mode === "click") panel.current?.querySelector<HTMLElement>("button, a[href], input")?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !anchor.current?.contains(target)) setMode("closed");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setMode("closed");
      anchor.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, mode]);

  const isMouse = (e: React.PointerEvent) => e.pointerType === "mouse";
  return (
    <>
      {/* Refs below are only touched in callbacks, never while rendering. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {trigger({
        ref: (el) => {
          anchor.current = el;
        },
        onClick: () => setMode((m) => (m === "click" ? "closed" : "click")),
        onPointerEnter: hover ? (e) => isMouse(e) && schedule("hover", 350) : undefined,
        onPointerLeave: hover ? (e) => isMouse(e) && schedule("closed", 200) : undefined,
        "aria-expanded": open,
        "aria-haspopup": "dialog",
      })}
      {open && (
        <div
          ref={panel}
          popover="manual"
          role="dialog"
          aria-label={label}
          onPointerEnter={hover ? () => timer.current && clearTimeout(timer.current) : undefined}
          onPointerLeave={hover ? (e) => isMouse(e) && schedule("closed", 200) : undefined}
          className={cn(
            "fixed inset-auto m-0 max-w-[calc(100vw-16px)] animate-[fade-in_150ms] overflow-visible rounded-xl border border-line bg-raised p-2 text-fg shadow-xl",
            className,
          )}
        >
          {/* eslint-disable-next-line react-hooks/refs */}
          {children(close)}
        </div>
      )}
    </>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function MenuItem({ icon, children, onClick, danger, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "ease-ui flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-app disabled:opacity-55 sm:min-h-9",
        danger && "text-danger",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
