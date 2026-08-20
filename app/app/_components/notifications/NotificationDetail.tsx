"use client";

import { ArrowLeft } from "lucide-react";
import {
  getNotificationById,
  type NotificationType,
} from "../../_lib/notifications";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { Panel } from "../Panel";
import { StatusBadge, type BadgeTone } from "../StatusBadge";
import { EmptyState } from "../EmptyState";

const typeTone: Record<NotificationType, BadgeTone> = {
  system: "info",
  training: "success",
  workorder: "warning",
  announcement: "neutral",
};

export function NotificationDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const notification = getNotificationById(id);

  if (!notification) {
    return (
      <>
        <PageHeader title={t.notifications.detailTitle} />
        <EmptyState title={t.notifications.noDetail} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t.notifications.detailTitle}
        extra={
          /* eslint-disable-next-line @next/next/no-html-link-for-pages -- full page nav; next/link client nav is broken in production */
          <a href="/app/notifications/inner/all" className="bs-btn bs-btn-ghost">
            <ArrowLeft size={16} aria-hidden="true" />
            {t.notifications.backToList}
          </a>
        }
      />

      <Panel className="bs-detail">
        <div className="bs-detail-head">
          <h2>{notification.title}</h2>
          <div className="bs-detail-meta">
            <StatusBadge
              tone={typeTone[notification.type]}
              label={t.notifications.types[notification.type]}
            />
            <span>{notification.createdAt}</span>
            <StatusBadge
              tone={notification.read ? "neutral" : "warning"}
              label={
                notification.read ? t.notifications.read : t.notifications.unread
              }
            />
          </div>
        </div>
        <p className="bs-detail-body">{notification.content}</p>
      </Panel>
    </>
  );
}
