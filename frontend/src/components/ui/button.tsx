import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "soft" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary shadow-[0_8px_24px_-10px_var(--glow)] hover:brightness-110 hover:shadow-[0_10px_28px_-8px_var(--glow)]",
  soft: "bg-raised text-fg border border-line hover:border-muted",
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
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-semibold whitespace-nowrap",
    "ease-ui transition-[filter,background-color,border-color,box-shadow,translate] active:translate-y-px disabled:opacity-55 sm:min-h-10",
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
