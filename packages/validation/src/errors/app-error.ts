import { errorCatalog, type ErrorCode } from './catalog';

export type ErrorDetails = Record<string, unknown>;

/** Application error carrying a catalog code; the route envelope turns it into the `Error` schema. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details?: ErrorDetails,
  ) {
    super(code);
    this.name = 'AppError';
  }

  get status(): number {
    return errorCatalog[this.code].status;
  }
}

/** Fills the `{name}` placeholders of a catalog message from `details` (errors.md, section 4). */
export function formatErrorMessage(code: ErrorCode, details?: ErrorDetails): string {
  return errorCatalog[code].message.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = details?.[key];
    return value === undefined ? placeholder : String(value);
  });
}
