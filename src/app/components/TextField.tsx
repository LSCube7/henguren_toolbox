"use client";

import { M3eFormField } from "@m3e/react/form-field";
import { useId, type InputHTMLAttributes, type Ref, type TextareaHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  error?: boolean;
  variant?: "filled" | "outlined";
};

export function TextField({ label, error, variant = "outlined", className, id, ...props }:
  FieldProps & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return <M3eFormField className={className} variant={variant} error={Boolean(error)}>
    <label slot="label" htmlFor={controlId}>{label}</label>
    <input {...props} id={controlId} aria-invalid={error || undefined} />
  </M3eFormField>;
}

export function TextAreaField({ label, error, variant = "outlined", className, id, ...props }:
  FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return <M3eFormField className={className} variant={variant} error={Boolean(error)}>
    <label slot="label" htmlFor={controlId}>{label}</label>
    <textarea {...props} id={controlId} aria-invalid={error || undefined} />
  </M3eFormField>;
}
