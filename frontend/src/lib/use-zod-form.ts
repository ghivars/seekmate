"use client";

import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { errorMessage } from "./api/client";

type Errors<T> = Partial<Record<keyof T & string, string>>;

/** Minimal typed form state validated by a zod object schema. */
export function useZodForm<S extends z.ZodObject>(schema: S, initial: z.input<S>) {
  type Values = z.input<S>;
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Errors<Values>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Values & string>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): z.output<S> | null => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    const next: Errors<Values> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0]) as keyof Values & string;
      next[key] ??= issue.message;
    }
    setErrors(next);
    return null;
  };

  const submit = (onValid: (data: z.output<S>) => Promise<void>) => async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    setFormError(null);
    const data = validate();
    if (!data) return;
    setBusy(true);
    try {
      await onValid(data);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return { values, errors, formError, setFormError, busy, set, validate, submit };
}
