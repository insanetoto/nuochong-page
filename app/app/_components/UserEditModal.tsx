"use client";

import { useState, type FormEvent } from "react";
import type { Employee, EmployeeFormValues } from "../_lib/employees";

export function UserEditModal({
  employee,
  onSave,
  onCancel,
}: {
  employee: Employee | null;
  onSave: (values: EmployeeFormValues) => void;
  onCancel: () => void;
}) {
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
          <h2 id="bs-user-edit-title">{employee ? "编辑员工" : "新增员工"}</h2>
          <button
            type="button"
            className="bs-modal-close"
            onClick={onCancel}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <form className="bs-form" onSubmit={handleSubmit}>
          <label className="bs-field">
            <span>姓名</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
            />
          </label>

          <label className="bs-field">
            <span>邮箱</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              required
            />
          </label>

          <label className="bs-field">
            <span>部门</span>
            <input
              type="text"
              value={form.department}
              onChange={(event) => update("department", event.target.value)}
              required
            />
          </label>

          <label className="bs-field">
            <span>角色</span>
            <input
              type="text"
              value={form.role}
              onChange={(event) => update("role", event.target.value)}
              required
            />
          </label>

          <label className="bs-field">
            <span>电话</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              required
            />
          </label>

          <label className="bs-field">
            <span>状态</span>
            <select
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as Employee["status"])
              }
            >
              <option value="active">在职</option>
              <option value="inactive">离职</option>
            </select>
          </label>

          <div className="bs-modal-actions">
            <button type="button" className="bs-btn bs-btn-ghost" onClick={onCancel}>
              取消
            </button>
            <button type="submit" className="bs-btn bs-btn-primary">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
