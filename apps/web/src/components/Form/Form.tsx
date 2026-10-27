'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { FormProvider, useForm, type FieldValues, type Resolver } from 'react-hook-form';
import type { ZodTypeAny } from 'zod';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import type { ApiError, ApiResult } from '@/lib/api-client';

/** Where an API error code goes: under a field, or in the general message (`message` replaces the API text). */
export type ErrorTarget = { field: string } | { message: string };

const SendingContext = createContext(false);

/**
 * True while the values are being sent. Fields are disabled then, but not while they are validated: a disabled
 * field cannot take the focus that goes to the first error.
 */
export function useFormSending() {
  return useContext(SendingContext);
}

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
  const [sending, setSending] = useState(false);
  const sendingNow = useRef(false);
  const { handleSubmit, setError, resetField } = methods;

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
    if (sendingNow.current) return; // never a double submission
    sendingNow.current = true;
    setSending(true);
    setGlobalError(null);
    try {
      const result = await onSubmit(values);
      if (!result.ok) {
        show(result.error);
        resetOnError.forEach((name) => resetField(name, { defaultValue: '' }));
      }
    } finally {
      sendingNow.current = false;
      setSending(false);
    }
  });

  return (
    <FormProvider {...methods}>
      <SendingContext.Provider value={sending}>
        {/* method=post: before the page is interactive a submission must never put the fields (a password) in the URL */}
        <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-md">
          {globalError ? <Alert>{globalError}</Alert> : null}
          {children}
          <Button type="submit" variant="primary" size="block" loading={sending}>
            {submitLabel}
          </Button>
        </form>
      </SendingContext.Provider>
    </FormProvider>
  );
}
