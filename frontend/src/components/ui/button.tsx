import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "soft" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:brightness-110",
  soft: "bg-raised text-fg border border-line hover:brightness-110 dark:hover:brightness-125",
  ghost: "text-fg hover:bg-raised",
  danger: "bg-danger-fill text-on-danger hover:brightness-110",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  busy?: boolean;
  block?: boolean;
}

export function buttonClass(variant: Variant = "primary", block = false) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3.5 text-[15px] font-semibold whitespace-nowrap",
    "ease-ui transition-[filter,background-color,opacity] disabled:opacity-55 sm:min-h-10",
    VARIANTS[variant],
    block && "w-full",
  );
}

export function Button({ variant, busy, block, className, children, disabled, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(buttonClass(variant, block), className)}
      {...rest}
    >
      {busy ? "Sebentar..." : children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({ label, className, children, type, ...rest }: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      title={label}
      className={cn(
        "ease-ui inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors",
        "hover:bg-raised hover:text-fg aria-expanded:bg-raised aria-expanded:text-fg sm:size-9",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
