"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getWorkOrderById,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "../../_lib/workorders";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { Panel } from "../Panel";
import { StatusBadge, type BadgeTone } from "../StatusBadge";
import { EmptyState } from "../EmptyState";

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

export function WorkOrderDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const workOrder = getWorkOrderById(id);

  if (!workOrder) {
    return (
      <>
        <PageHeader title={t.workorders.detail} />
        <EmptyState title={t.workorders.empty} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t.workorders.detail}
        extra={
          <Link href="/app/workorders" className="bs-btn bs-btn-ghost">
            <ArrowLeft size={16} aria-hidden="true" />
            {t.workorders.backToList}
          </Link>
        }
      />

      <Panel className="bs-detail">
        <div className="bs-detail-head">
          <h2>
            {workOrder.id} · {workOrder.title}
          </h2>
          <div className="bs-detail-meta">
            <StatusBadge
              tone={statusTone[workOrder.status]}
              label={t.workorders[workOrder.status]}
            />
            <StatusBadge
              tone={priorityTone[workOrder.priority]}
              label={t.workorders[workOrder.priority]}
            />
            <span>{workOrder.createdAt}</span>
          </div>
        </div>

        <div className="bs-desc-list">
          <div className="bs-desc-row">
            <span>{t.workorders.applicant}</span>
            <b>{workOrder.applicant}</b>
          </div>
          <div className="bs-desc-row">
            <span>{t.workorders.assignee}</span>
            <b>{workOrder.assignee}</b>
          </div>
        </div>

        <h3 className="bs-detail-subtitle">{t.workorders.description}</h3>
        <p className="bs-detail-body">{workOrder.description}</p>
      </Panel>
    </>
  );
}
