import { useState } from 'react';
import type { ZodSchema } from 'zod';

type Errors<T> = Partial<Record<keyof T, string>>;

export function useForm<T extends Record<string, unknown>>(schema: ZodSchema<T>, initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});

  function set<K extends keyof T>(field: K, value: T[K]) {
    setValues(v => ({ ...v, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }
    const mapped: Errors<T> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof T;
      if (key && !mapped[key]) mapped[key] = issue.message;
    }
    setErrors(mapped);
    return false;
  }

  function reset(next?: T) {
    setValues(next ?? initial);
    setErrors({});
  }

  return { values, set, errors, validate, reset, setValues };
}
