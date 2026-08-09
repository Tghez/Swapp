"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "h-11 w-full min-w-0 max-w-full rounded-card border bg-surface px-4 text-base text-text " +
  "placeholder:text-muted/70 transition-colors focus:border-secondary " +
  "disabled:opacity-60";

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (controlId: string, describedBy: string | undefined) => ReactNode;
}

/**
 * Wraps a control with its label, hint and error, and wires up the aria
 * relationships so screen readers announce the error with the field rather
 * than as loose text somewhere on the page.
 */
export function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-urgent">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function TextField({
  label,
  error,
  hint,
  className,
  ...props
}: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL,
            error ? "border-urgent" : "border-border",
            className,
          )}
          {...props}
        />
      )}
    </FieldShell>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  disabled?: boolean;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
  hint,
  disabled,
}: SelectFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            CONTROL,
            "appearance-none",
            error ? "border-urgent" : "border-border",
          )}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  rows?: number;
  placeholder?: string;
}

export function TextAreaField({
  label,
  value,
  onChange,
  error,
  hint,
  rows = 3,
  placeholder,
}: TextAreaFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <textarea
          id={id}
          value={value}
          rows={rows}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "w-full resize-none rounded-card border bg-surface px-4 py-3",
            "text-base text-text placeholder:text-muted/70 focus:border-secondary",
            error ? "border-urgent" : "border-border",
          )}
        />
      )}
    </FieldShell>
  );
}

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: ReactNode;
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: CheckboxFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn(
          "flex items-center gap-3 rounded-card border px-4 py-3 transition-colors",
          disabled
            ? "cursor-not-allowed border-border bg-surface/60 opacity-70"
            : "cursor-pointer border-border bg-surface hover:border-urgent",
          checked && !disabled && "border-urgent bg-urgent-soft",
        )}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="size-5 accent-[var(--color-urgent)]"
        />
        <span className="text-sm font-semibold text-text">{label}</span>
      </label>
      {hint && <p className="px-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
