"use client";

import { useState, type FormEvent } from "react";
import type { Employee, EmployeeFormValues } from "../_lib/employees";
import { useI18n } from "../_lib/i18n";

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
    <div className="bs-modal-overlay">
      <div
        className="bs-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bs-user-edit-title"
      >
        <div className="bs-modal-header">
          <h2 id="bs-user-edit-title">
            {employee ? t.employees.edit : t.employees.add}
          </h2>
          <button
            type="button"
            className="bs-modal-close"
            onClick={onCancel}
            aria-label={t.common.close}
          >
            ×
          </button>
        </div>

        <form className="bs-form" onSubmit={handleSubmit}>
          <label className="bs-field">
            <span>{t.employees.name}</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
            />
          </label>

          <label className="bs-field">
            <span>{t.employees.email}</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              required
            />
          </label>

          <label className="bs-field">
            <span>{t.employees.department}</span>
            <input
              type="text"
              value={form.department}
              onChange={(event) => update("department", event.target.value)}
              required
            />
          </label>

          <label className="bs-field">
            <span>{t.employees.role}</span>
            <input
              type="text"
              value={form.role}
              onChange={(event) => update("role", event.target.value)}
              required
            />
          </label>

          <label className="bs-field">
            <span>{t.employees.phone}</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              required
            />
          </label>

          <label className="bs-field">
            <span>{t.employees.status}</span>
            <select
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as Employee["status"])
              }
            >
              <option value="active">{t.employees.active}</option>
              <option value="inactive">{t.employees.inactive}</option>
            </select>
          </label>

          <div className="bs-modal-actions">
            <button type="button" className="bs-btn bs-btn-ghost" onClick={onCancel}>
              {t.common.cancel}
            </button>
            <button type="submit" className="bs-btn bs-btn-primary">
              {t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
