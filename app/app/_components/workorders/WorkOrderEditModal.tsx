"use client";

import { useState, type FormEvent } from "react";
import type {
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
} from "../../_lib/workorders";
import { useI18n } from "../../_lib/i18n";
import { Modal } from "../Modal";
import { FormField } from "../FormField";

export type WorkOrderFormValues = {
  id?: string;
  title: string;
  description: string;
  applicant: string;
  assignee: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
};

export function WorkOrderEditModal({
  workOrder,
  onSave,
  onCancel,
}: {
  workOrder: WorkOrder | null;
  onSave: (values: WorkOrderFormValues) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<WorkOrderFormValues>(() => ({
    id: workOrder?.id,
    title: workOrder?.title ?? "",
    description: workOrder?.description ?? "",
    applicant: workOrder?.applicant ?? "",
    assignee: workOrder?.assignee ?? "",
    priority: workOrder?.priority ?? "medium",
    status: workOrder?.status ?? "pending",
  }));

  function update<K extends keyof WorkOrderFormValues>(
    key: K,
    value: WorkOrderFormValues[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <Modal
      title={workOrder ? t.workorders.edit : t.workorders.add}
      onClose={onCancel}
      size="md"
      footer={
        <>
          <button type="button" className="bs-btn bs-btn-ghost" onClick={onCancel}>
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="bs-workorder-form"
            className="bs-btn bs-btn-primary"
          >
            {t.workorders.save}
          </button>
        </>
      }
    >
      <form id="bs-workorder-form" className="bs-form" onSubmit={handleSubmit}>
        <FormField label={t.common.title} required>
          <input
            type="text"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            required
          />
        </FormField>

        <FormField label={t.workorders.description}>
          <textarea
            className="bs-textarea"
            rows={3}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </FormField>

        <div className="bs-form-grid bs-form-grid-2">
          <FormField label={t.workorders.applicant} required>
            <input
              type="text"
              value={form.applicant}
              onChange={(event) => update("applicant", event.target.value)}
              required
            />
          </FormField>

          <FormField label={t.workorders.assignee} required>
            <input
              type="text"
              value={form.assignee}
              onChange={(event) => update("assignee", event.target.value)}
              required
            />
          </FormField>

          <FormField label={t.workorders.priority}>
            <select
              value={form.priority}
              onChange={(event) =>
                update("priority", event.target.value as WorkOrderPriority)
              }
            >
              <option value="low">{t.workorders.low}</option>
              <option value="medium">{t.workorders.medium}</option>
              <option value="high">{t.workorders.high}</option>
              <option value="urgent">{t.workorders.urgent}</option>
            </select>
          </FormField>

          <FormField label={t.workorders.status}>
            <select
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as WorkOrderStatus)
              }
            >
              <option value="pending">{t.workorders.pending}</option>
              <option value="processing">{t.workorders.processing}</option>
              <option value="resolved">{t.workorders.resolved}</option>
              <option value="closed">{t.workorders.closed}</option>
            </select>
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
