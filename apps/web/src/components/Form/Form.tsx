'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { FormProvider, useForm, type FieldValues, type Resolver } from 'react-hook-form';
import type { ZodTypeAny } from 'zod';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import type { ApiError, ApiResult } from '@/lib/api-client';

/** Where an API error code goes: under a field, or in the general message (`message` replaces the API text). */
export type ErrorTarget = { field: string } | { message: string };

interface Props {
  /** Same Zod schema as the server's; its messages are field codes translated from the catalog. */
  schema: ZodTypeAny;
  defaultValues: FieldValues;
  /** Sends the values. On success it navigates by itself (the effect belongs to the business form). */
  onSubmit: (values: FieldValues) => Promise<ApiResult>;
  submitLabel: string;
  errorMap?: Record<string, ErrorTarget>;
  /** Fields to empty after a failure (the password of a login). */
  resetOnError?: string[];
  children: ReactNode;
}

/**
 * Validates with the schema, sends, and shows what the API answers (design/components.md, "Form"):
 * `VALIDATION_ERROR` under its fields, other codes in an alert. Values are kept after an error.
 */
export function Form({
  schema,
  defaultValues,
  onSubmit,
  submitLabel,
  errorMap,
  resetOnError = [],
  children,
}: Props) {
  const methods = useForm({
    resolver: zodResolver(schema) as Resolver<FieldValues>,
    defaultValues,
    // Errors appear at the first submission, then follow the typing
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const [globalError, setGlobalError] = useState<string | null>(null);
  const { handleSubmit, setError, resetField, formState } = methods;

  function show(error: ApiError) {
    const fields = error.details?.fields;
    if (error.code === 'VALIDATION_ERROR' && fields?.length) {
      fields.forEach(({ field, code }, index) =>
        setError(field, { type: 'server', message: code }, { shouldFocus: index === 0 }),
      );
      return;
    }
    const target = errorMap?.[error.code];
    if (target && 'field' in target)
      setError(target.field, { type: 'server', message: error.code }, { shouldFocus: true });
    else setGlobalError(target?.message ?? error.message);
  }

  const submit = handleSubmit(async (values) => {
    setGlobalError(null);
    const result = await onSubmit(values);
    if (!result.ok) {
      show(result.error);
      resetOnError.forEach((name) => resetField(name, { defaultValue: '' }));
    }
  });

  return (
    <FormProvider {...methods}>
      {/* method=post: before the page is interactive a submission must never put the fields (a password) in the URL */}
      <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-md">
        {globalError ? <Alert>{globalError}</Alert> : null}
        {children}
        <Button type="submit" variant="primary" size="block" loading={formState.isSubmitting}>
          {submitLabel}
        </Button>
      </form>
    </FormProvider>
  );
}
