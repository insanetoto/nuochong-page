"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  mockWorkOrders,
  type WorkOrder,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "../../_lib/workorders";
import { filterByQuery, paginate } from "../../_lib/list-utils";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { SearchBar } from "../SearchBar";
import { Tabs } from "../Tabs";
import { StatusBadge, type BadgeTone } from "../StatusBadge";
import { Pagination } from "../Pagination";
import { EmptyState } from "../EmptyState";
import { ConfirmDialog } from "../ConfirmDialog";
import { WorkOrderEditModal, type WorkOrderFormValues } from "./WorkOrderEditModal";

const PAGE_SIZE = 5;

const statusTone: Record<WorkOrderStatus, BadgeTone> = {
  pending: "warning",
  processing: "info",
  resolved: "success",
  closed: "neutral",
};

const priorityTone: Record<WorkOrderPriority, BadgeTone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "error",
};

export function WorkOrderList() {
  const { t } = useI18n();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() =>
    mockWorkOrders.map((workOrder) => ({ ...workOrder })),
  );
  const [status, setStatus] = useState<WorkOrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<WorkOrder | null>(null);

  const tabs: { key: WorkOrderStatus | "all"; label: string }[] = [
    { key: "all", label: t.workorders.all },
    { key: "pending", label: t.workorders.pending },
    { key: "processing", label: t.workorders.processing },
    { key: "resolved", label: t.workorders.resolved },
    { key: "closed", label: t.workorders.closed },
  ];

  const filtered = useMemo(() => {
    const byStatus = workOrders.filter(
      (workOrder) => status === "all" || workOrder.status === status,
    );
    return filterByQuery(byStatus, query, (workOrder) => [
      workOrder.id,
      workOrder.title,
      workOrder.applicant,
    ]);
  }, [workOrders, status, query]);

  const paginated = useMemo(
    () => paginate(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  function statusLabel(value: WorkOrderStatus): string {
    return t.workorders[value];
  }

  function priorityLabel(value: WorkOrderPriority): string {
    return t.workorders[value];
  }

  function closeModal() {
    setEditing(null);
    setCreating(false);
  }

  function handleSave(values: WorkOrderFormValues) {
    if (values.id) {
      setWorkOrders((previous) =>
        previous.map((workOrder) =>
          workOrder.id === values.id
            ? { ...workOrder, ...values, id: values.id }
            : workOrder,
        ),
      );
    } else {
      const id = `WO-${1000 + workOrders.length + 1}`;
      setWorkOrders((previous) => [
        ...previous,
        {
          ...values,
          id,
          createdAt: "2026-08-20 10:00",
        } as WorkOrder,
      ]);
    }
    closeModal();
  }

  function confirmDelete() {
    if (!deleting) return;
    setWorkOrders((previous) =>
      previous.filter((workOrder) => workOrder.id !== deleting.id),
    );
    setDeleting(null);
  }

  return (
    <>
      <PageHeader
        title={t.workorders.title}
        subtitle={t.workorders.subtitle}
        extra={
          <button
            type="button"
            className="bs-btn bs-btn-primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} aria-hidden="true" />
            {t.workorders.add}
          </button>
        }
      />

      <div className="bs-toolbar">
        <Tabs tabs={tabs} active={status} onChange={(key) => setStatus(key as WorkOrderStatus | "all")} />
        <SearchBar
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder={t.workorders.searchPlaceholder}
        />
      </div>

      <div className="bs-table-wrap">
        <table className="bs-table">
          <thead>
            <tr>
              <th>{t.workorders.id}</th>
              <th>{t.common.title}</th>
              <th>{t.workorders.applicant}</th>
              <th>{t.workorders.assignee}</th>
              <th>{t.workorders.priority}</th>
              <th>{t.workorders.status}</th>
              <th>{t.workorders.createdAt}</th>
              <th>{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((workOrder) => (
              <tr key={workOrder.id}>
                <td>
                  <Link
                    href={`/app/workorders/${workOrder.id}`}
                    className="bs-table-link"
                  >
                    {workOrder.id}
                  </Link>
                </td>
                <td>{workOrder.title}</td>
                <td>{workOrder.applicant}</td>
                <td>{workOrder.assignee}</td>
                <td>
                  <StatusBadge
                    tone={priorityTone[workOrder.priority]}
                    label={priorityLabel(workOrder.priority)}
                  />
                </td>
                <td>
                  <StatusBadge
                    tone={statusTone[workOrder.status]}
                    label={statusLabel(workOrder.status)}
                  />
                </td>
                <td>{workOrder.createdAt}</td>
                <td>
                  <div className="bs-table-actions">
                    <button
                      type="button"
                      className="bs-btn bs-btn-ghost bs-btn-sm"
                      onClick={() => setEditing({ ...workOrder })}
                    >
                      <Pencil size={14} aria-hidden="true" />
                      {t.common.edit}
                    </button>
                    <button
                      type="button"
                      className="bs-btn bs-btn-ghost bs-btn-sm"
                      onClick={() => setDeleting(workOrder)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      {t.common.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 ? (
          <EmptyState title={t.workorders.empty} />
        ) : null}
      </div>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onChange={setPage}
      />

      {creating || editing ? (
        <WorkOrderEditModal
          key={editing?.id ?? "new"}
          workOrder={editing}
          onSave={handleSave}
          onCancel={closeModal}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={t.workorders.deleteTitle}
          message={t.workorders.deleteMessage}
          confirmLabel={t.common.delete}
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
