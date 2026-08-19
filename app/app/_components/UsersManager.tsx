"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import {
  mockEmployees,
  type Employee,
  type EmployeeFormValues,
} from "../_lib/employees";
import { PageHeader } from "./PageHeader";
import { StatusBadge } from "./StatusBadge";
import { UserEditModal } from "./UserEditModal";

export function UsersManager() {
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
        title="员工账号"
        subtitle="管理内部员工与账号状态"
        extra={
          <button
            type="button"
            className="bs-btn bs-btn-primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} aria-hidden="true" />
            新增员工
          </button>
        }
      />

      <div className="bs-toolbar">
        <label className="bs-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="按姓名、邮箱或部门搜索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="bs-table-wrap">
        <table className="bs-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>邮箱</th>
              <th>部门</th>
              <th>角色</th>
              <th>状态</th>
              <th>操作</th>
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
                  <StatusBadge status={employee.status} />
                </td>
                <td>
                  <button
                    type="button"
                    className="bs-btn bs-btn-ghost bs-btn-sm"
                    onClick={() => setEditing({ ...employee })}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <div className="bs-empty">未找到匹配的员工</div>
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
