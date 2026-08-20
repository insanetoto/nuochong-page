"use client";

import { useState, type FormEvent } from "react";
import type { Employee, EmployeeFormValues } from "../_lib/employees";
import { useI18n } from "../_lib/i18n";
import { Modal } from "./Modal";
import { FormField } from "./FormField";

export function UserEditModal({
  employee,
  onSave,
  onCancel,
}: {
  employee: Employee | null;
  onSave: (values: EmployeeFormValues) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<EmployeeFormValues>(() => ({
    name: employee?.name ?? "",
    email: employee?.email ?? "",
    department: employee?.department ?? "",
    role: employee?.role ?? "",
    status: employee?.status ?? "active",
    phone: employee?.phone ?? "",
  }));

  function update<K extends keyof EmployeeFormValues>(
    key: K,
    value: EmployeeFormValues[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ ...form, id: employee?.id });
  }

  return (
    <Modal
      title={employee ? t.employees.edit : t.employees.add}
      onClose={onCancel}
      size="md"
      footer={
        <>
          <button type="button" className="bs-btn bs-btn-ghost" onClick={onCancel}>
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="bs-user-edit-form"
            className="bs-btn bs-btn-primary"
          >
            {t.common.save}
          </button>
        </>
      }
    >
      <form id="bs-user-edit-form" className="bs-form" onSubmit={handleSubmit}>
        <FormField label={t.employees.name}>
          <input
            type="text"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            required
          />
        </FormField>

        <FormField label={t.employees.email}>
          <input
            type="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            required
          />
        </FormField>

        <FormField label={t.employees.department}>
          <input
            type="text"
            value={form.department}
            onChange={(event) => update("department", event.target.value)}
            required
          />
        </FormField>

        <FormField label={t.employees.role}>
          <input
            type="text"
            value={form.role}
            onChange={(event) => update("role", event.target.value)}
            required
          />
        </FormField>

        <FormField label={t.employees.phone}>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            required
          />
        </FormField>

        <FormField label={t.employees.status}>
          <select
            value={form.status}
            onChange={(event) =>
              update("status", event.target.value as Employee["status"])
            }
          >
            <option value="active">{t.employees.active}</option>
            <option value="inactive">{t.employees.inactive}</option>
          </select>
        </FormField>
      </form>
    </Modal>
  );
}
