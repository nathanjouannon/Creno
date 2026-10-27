'use client';

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

// design/components.md, "Input": the control alone, with no label or message. States: default, hover, focus (global),
// filled, error (red border), disabled.
const control =
  'h-control w-full rounded-button border bg-background px-sm text-base text-text disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted';

const border = (error?: boolean) => (error ? 'border-danger' : 'border-border-strong');

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { error, className = '', ...rest },
  ref,
) {
  return (
    <input ref={ref} type="text" {...rest} className={`${control} ${border(error)} ${className}`} />
  );
});

export const EmailInput = forwardRef<HTMLInputElement, InputProps>(function EmailInput(
  { error, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="email"
      autoComplete="email"
      {...rest}
      className={`${control} ${border(error)} ${className}`}
    />
  );
});

/** Masked, with a button to show it (the option of components.md). */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(
  { error, className = '', ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex gap-sm">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        {...rest}
        className={`${control} ${border(error)} ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        disabled={rest.disabled}
        className="h-control shrink-0 rounded-button border border-border-strong bg-background px-sm text-small text-text hover:bg-surface disabled:cursor-not-allowed disabled:text-text-muted"
      >
        {visible ? 'Masquer' : 'Afficher'}
      </button>
    </div>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options: readonly string[];
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectProps>(function SelectInput(
  { error, options, className = '', ...rest },
  ref,
) {
  return (
    <select ref={ref} {...rest} className={`${control} ${border(error)} ${className}`}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
});

export const DateInput = forwardRef<HTMLInputElement, InputProps>(function DateInput(
  { error, className = '', ...rest },
  ref,
) {
  return (
    <input ref={ref} type="date" {...rest} className={`${control} ${border(error)} ${className}`} />
  );
});

export const TimeInput = forwardRef<HTMLInputElement, InputProps>(function TimeInput(
  { error, className = '', ...rest },
  ref,
) {
  return (
    <input ref={ref} type="time" {...rest} className={`${control} ${border(error)} ${className}`} />
  );
});

/** Whole numbers; an empty field means "no limit" where the form says so (places of a slot). */
export const NumberInput = forwardRef<HTMLInputElement, InputProps>(function NumberInput(
  { error, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode="numeric"
      min={1}
      step={1}
      {...rest}
      className={`${control} ${border(error)} ${className}`}
    />
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error, className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={4}
      {...rest}
      className={`${control} h-auto py-sm ${border(error)} ${className}`}
    />
  );
});
