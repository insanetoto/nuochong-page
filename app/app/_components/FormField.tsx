import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  required = false,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="bs-field" htmlFor={htmlFor}>
      <span>
        {label}
        {required ? <b className="bs-required">*</b> : null}
      </span>
      {children}
    </label>
  );
}
