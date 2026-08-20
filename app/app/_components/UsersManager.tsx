"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  mockEmployees,
  type Employee,
  type EmployeeFormValues,
} from "../_lib/employees";
import { useI18n } from "../_lib/i18n";
import { PageHeader } from "./PageHeader";
import { SearchBar } from "./SearchBar";
import { StatusBadge } from "./StatusBadge";
import { UserEditModal } from "./UserEditModal";

export function UsersManager() {
  const { t } = useI18n();
  const [users, setUsers] = useState<Employee[]>(() =>
    mockEmployees.map((employee) => ({ ...employee })),
  );
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((employee) =>
      [employee.name, employee.email, employee.department, employee.role].some(
        (field) => field.toLowerCase().includes(keyword),
      ),
    );
  }, [users, query]);

  function handleSave(values: EmployeeFormValues) {
    if (values.id) {
      setUsers((previous) =>
        previous.map((employee) =>
          employee.id === values.id
            ? ({ ...values, id: values.id } as Employee)
            : employee,
        ),
      );
    } else {
      const id = `e${Date.now()}`;
      setUsers((previous) => [...previous, { ...values, id } as Employee]);
    }

    setEditing(null);
    setCreating(false);
  }

  function closeModal() {
    setEditing(null);
    setCreating(false);
  }

  return (
    <>
      <PageHeader
        title={t.employees.title}
        subtitle={t.employees.subtitle}
        extra={
          <button
            type="button"
            className="bs-btn bs-btn-primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} aria-hidden="true" />
            {t.employees.add}
          </button>
        }
      />

      <div className="bs-toolbar">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t.employees.searchPlaceholder}
        />
      </div>

      <div className="bs-table-wrap">
        <table className="bs-table">
          <thead>
            <tr>
              <th>{t.employees.name}</th>
              <th>{t.employees.email}</th>
              <th>{t.employees.department}</th>
              <th>{t.employees.role}</th>
              <th>{t.employees.status}</th>
              <th>{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.name}</td>
                <td>{employee.email}</td>
                <td>{employee.department}</td>
                <td>{employee.role}</td>
                <td>
                  <StatusBadge
                    tone={employee.status === "active" ? "success" : "error"}
                    label={
                      employee.status === "active"
                        ? t.employees.active
                        : t.employees.inactive
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="bs-btn bs-btn-ghost bs-btn-sm"
                    onClick={() => setEditing({ ...employee })}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    {t.common.edit}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <div className="bs-empty">{t.employees.empty}</div>
        ) : null}
      </div>

      {creating || editing ? (
        <UserEditModal
          key={editing?.id ?? "new"}
          employee={editing}
          onSave={handleSave}
          onCancel={closeModal}
        />
      ) : null}
    </>
  );
}
