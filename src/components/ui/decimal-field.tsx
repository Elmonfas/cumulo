"use client";

import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface DecimalFieldProps extends Omit<ComponentProps<"input">, "onChange" | "value" | "type"> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Unidad mostrada dentro del campo: "€", "%", "años"… */
  suffix?: string;
  hint?: string;
  error?: string | null;
  /** Solo enteros: abre el teclado numérico sin separador decimal. */
  integer?: boolean;
}

/**
 * Campo de texto para cifras es-ES. Trabaja con strings: el padre los
 * interpreta con `parseDecimal`, nunca con `Number`.
 */
export function DecimalField({
  label,
  value,
  onValueChange,
  suffix,
  hint,
  error,
  integer = false,
  className,
  id,
  ...props
}: DecimalFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div
        className={cn(
          "flex h-12 items-center rounded-2xl border bg-surface-2 px-4 transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20",
          error ? "border-accent" : "border-border",
        )}
      >
        <input
          id={inputId}
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          size={1}
          className="w-full min-w-0 flex-1 bg-transparent text-base tabular-nums outline-none placeholder:text-text-muted"
          {...props}
        />
        {suffix && <span className="ml-2 shrink-0 text-sm text-text-muted">{suffix}</span>}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-accent">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${inputId}-hint`} className="text-xs text-text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
