"use client";

import { M3eFormField } from "@m3e/react/form-field";
import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  error?: boolean;
  variant?: "filled" | "outlined";
};

export function TextField({ label, error, prefix, supportingText, variant = "outlined", className, id, ...props }:
  FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & { ref?: Ref<HTMLInputElement>; prefix?: ReactNode; supportingText?: string }) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const descriptionId = [props["aria-describedby"], supportingText ? hintId : undefined].filter(Boolean).join(" ") || undefined;
  return <M3eFormField className={className} variant={variant} error={Boolean(error)}>
    <label slot="label" htmlFor={controlId}>{label}</label>
    {prefix != null ? <span slot="prefix-text" className="field-prefix" aria-hidden="true">{prefix}</span> : null}
    <input {...props} id={controlId} aria-describedby={descriptionId} aria-invalid={error || undefined} />
    {supportingText ? <span slot="hint" id={hintId}>{supportingText}</span> : null}
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
