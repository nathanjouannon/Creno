import { fieldErrorCatalog, type FieldErrorCode } from '@creno/validation';
import type { ZodError, ZodIssue } from 'zod';

export interface FieldError {
  field: string;
  code: FieldErrorCode;
}

const isFieldCode = (value: string): value is FieldErrorCode => value in fieldErrorCatalog;

// Schemas return a field code as the Zod message (ADR-0009); built-in issues are mapped here.
function codeOf(issue: ZodIssue): FieldErrorCode {
  if (isFieldCode(issue.message)) return issue.message;
  switch (issue.code) {
    case 'unrecognized_keys':
      return 'FIELD_UNKNOWN';
    case 'invalid_string':
      return issue.validation === 'email'
        ? 'FIELD_EMAIL_INVALID'
        : issue.validation === 'datetime'
          ? 'FIELD_DATE_INVALID'
          : 'FIELD_REQUIRED';
    case 'invalid_date':
      return 'FIELD_DATE_INVALID';
    default:
      // Missing, empty or mistyped value
      return 'FIELD_REQUIRED';
  }
}

/** One entry per field (the first issue), with dotted names for nesting: `slots.0.endsAt`. */
export function toFieldErrors(error: ZodError, prefix = ''): FieldError[] {
  const byField = new Map<string, FieldError>();
  const add = (field: string, code: FieldErrorCode) => {
    if (!byField.has(field)) byField.set(field, { field, code });
  };
  for (const issue of error.issues) {
    const field = [...(prefix ? [prefix] : []), ...issue.path].join('.') || 'body';
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys)
        add([field === 'body' ? '' : field, key].filter(Boolean).join('.'), 'FIELD_UNKNOWN');
    } else {
      add(field, codeOf(issue));
    }
  }
  return [...byField.values()];
}
