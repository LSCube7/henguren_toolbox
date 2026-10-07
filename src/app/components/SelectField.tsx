"use client";

import { M3eFormField } from "@m3e/react/form-field";
import { M3eSelect } from "@m3e/react/select";
import { useId, type ComponentProps } from "react";

type SelectFieldProps = ComponentProps<typeof M3eSelect> & {
  label: string;
  variant?: "filled" | "outlined";
};

export function SelectField({ label, variant = "filled", className, id, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return <M3eFormField variant={variant} className={className}>
    <label slot="label" htmlFor={controlId}>{label}</label>
    <M3eSelect {...props} id={controlId} />
  </M3eFormField>;
}
