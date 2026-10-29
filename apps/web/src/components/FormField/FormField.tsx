'use client';

import { cloneElement, useId, type ReactElement } from 'react';
import { get, useFormContext } from 'react-hook-form';
import { fieldErrorCatalog, type FieldErrorCode } from '@creno/validation';
import { FieldError } from '@/components/FieldError';
import { useFormSending } from '@/components/Form';

interface Props {
  /** Field name in the form values; dots for nesting (`admin.email`). */
  name: string;
  label: string;
  help?: string;
  required?: boolean;
  /** Error look without a message here (the message is shown by another field of the same group). */
  invalid?: boolean;
  /** Wording of a code for this field only, as the catalog asks (`FIELD_REQUIRED` of `title`: « Le titre est obligatoire. »). */
  messages?: Partial<Record<string, string>>;
  /**
   * The error message of this field is shown by its group, under this id (a day and a time on one row,
   * `DateTimeRange`): the field only takes the error look and points to it.
   */
  messageId?: string;
  /** An `Input` of components/Input; it receives its wiring from here. */
  children: ReactElement<Record<string, unknown>>;
}

/** The message of a field code from the catalog (errors.md, section 3). */
export function fieldMessage(code: string): string {
  return code in fieldErrorCatalog ? fieldErrorCatalog[code as FieldErrorCode].message : code;
}

/** Label, control, help and error of one field, linked for assistive technology. */
export function FormField({
  name,
  label,
  help,
  required,
  invalid,
  messages,
  messageId,
  children,
}: Props) {
  const { register, formState } = useFormContext();
  const sending = useFormSending();
  const id = useId();
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const code = (get(formState.errors, name) as { message?: string } | undefined)?.message;
  const errorRef = messageId ? (code || invalid ? messageId : null) : code ? errorId : null;
  const describedBy = [help ? helpId : null, errorRef].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={id} className="text-small text-text-muted">
        {label}
      </label>
      {cloneElement(children, {
        id,
        error: Boolean(code) || Boolean(invalid),
        'aria-invalid': code || invalid ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
        disabled: sending || children.props.disabled,
        ...register(name),
      })}
      {help ? (
        <p id={helpId} className="text-small text-text-muted">
          {help}
        </p>
      ) : null}
      {code && !messageId ? (
        <FieldError id={errorId}>{messages?.[code] ?? fieldMessage(code)}</FieldError>
      ) : null}
    </div>
  );
}
