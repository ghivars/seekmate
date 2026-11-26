"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import type { Option } from "@/lib/labels";

const CONTROL =
  "w-full rounded-lg border border-line bg-app px-3 text-[16px] text-fg placeholder:text-muted sm:text-[15px] " +
  "ease-ui transition-colors focus:border-link focus:outline-none focus-visible:ring-2 focus-visible:ring-link " +
  "aria-invalid:border-danger";

interface WrapProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  hideLabel?: boolean;
}

function useFieldIds(error?: string, hint?: ReactNode) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return { id, describedBy };
}

function Wrap({ id, label, error, hint, hideLabel, children }: WrapProps & { id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={cn("block text-sm font-medium", hideLabel && "sr-only")}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  hideLabel,
  className,
  ...rest
}: WrapProps & InputHTMLAttributes<HTMLInputElement>) {
  const { id, describedBy } = useFieldIds(error, hint);
  return (
    <Wrap id={id} label={label} error={error} hint={hint} hideLabel={hideLabel}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(CONTROL, "h-11", className)}
        {...rest}
      />
    </Wrap>
  );
}

export function TextArea({
  label,
  error,
  hint,
  hideLabel,
  className,
  ...rest
}: WrapProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { id, describedBy } = useFieldIds(error, hint);
  return (
    <Wrap id={id} label={label} error={error} hint={hint} hideLabel={hideLabel}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(CONTROL, "min-h-24 resize-y py-2.5", className)}
        {...rest}
      />
    </Wrap>
  );
}

interface OptionGroupProps<T extends string> {
  legend: string;
  options: Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  error?: string;
  columns?: 1 | 2;
}

/** Radio cards: native radios keep arrow-key behaviour and labels. */
export function OptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
  columns = 2,
}: OptionGroupProps<T>) {
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "ease-ui flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-app px-3 py-2.5 transition-colors",
              "hover:border-muted has-checked:border-link has-checked:bg-raised",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link",
            )}
          >
            <input
              type="radio"
              name={name}
              className="size-4 shrink-0 accent-[var(--primary)] outline-none"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.hint && <span className="block text-[13px] text-muted">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-[var(--primary)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}
