"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import {
  mockNotifications,
  type Notification,
  type NotificationType,
} from "../../_lib/notifications";
import { filterByQuery, paginate } from "../../_lib/list-utils";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { SearchBar } from "../SearchBar";
import { Tabs } from "../Tabs";
import { StatusBadge, type BadgeTone } from "../StatusBadge";
import { Pagination } from "../Pagination";
import { EmptyState } from "../EmptyState";
import { ConfirmDialog } from "../ConfirmDialog";

const PAGE_SIZE = 5;

const typeTone: Record<NotificationType, BadgeTone> = {
  system: "info",
  training: "success",
  workorder: "warning",
  announcement: "neutral",
};

export function NotificationsList({
  type,
  onTypeChange,
}: {
  type: "all" | "unread" | "read";
  onTypeChange: (type: "all" | "unread" | "read") => void;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<Notification[]>(() =>
    mockNotifications.map((notification) => ({ ...notification })),
  );
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const filtered = useMemo(() => {
    const byType = items.filter((item) => {
      if (type === "unread") return !item.read;
      if (type === "read") return item.read;
      return true;
    });

    return filterByQuery(byType, query, (item) => [item.title, item.content]);
  }, [items, type, query]);

  const paginated = useMemo(
    () => paginate(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  const tabs = [
    { key: "all", label: t.notifications.all },
    { key: "unread", label: t.notifications.unread, badge: unreadCount },
    { key: "read", label: t.notifications.read },
  ];

  function toggleSelect(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((previous) => {
      if (previous.size === paginated.length) return new Set();
      return new Set(paginated.map((item) => item.id));
    });
  }

  function markRead(id: string) {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }

  function markAllRead() {
    setItems((previous) =>
      previous.map((item) => (item.read ? item : { ...item, read: true })),
    );
  }

  function deleteSelected() {
    setItems((previous) =>
      previous.filter((item) => !selected.has(item.id)),
    );
    setSelected(new Set());
    setConfirmingDelete(false);
  }

  return (
    <>
      <PageHeader title={t.notifications.title} subtitle={t.notifications.subtitle} />

      <div className="bs-toolbar">
        <Tabs tabs={tabs} active={type} onChange={onTypeChange} />
        <SearchBar
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder={t.notifications.searchPlaceholder}
        />
      </div>

      <div className="bs-toolbar bs-toolbar-actions">
        <div>
          <button
            type="button"
            className="bs-btn bs-btn-ghost bs-btn-sm"
            onClick={markAllRead}
          >
            <CheckCheck size={14} aria-hidden="true" />
            {t.notifications.markAllRead}
          </button>
          <button
            type="button"
            className="bs-btn bs-btn-ghost bs-btn-sm"
            disabled={selected.size === 0}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
            {t.notifications.deleteSelected}
          </button>
        </div>
      </div>

      <div className="bs-table-wrap">
        <table className="bs-table">
          <thead>
            <tr>
              <th className="bs-table-check">
                <input
                  type="checkbox"
                  checked={paginated.length > 0 && selected.size === paginated.length}
                  onChange={toggleSelectAll}
                  aria-label="select all"
                />
              </th>
              <th>{t.common.title}</th>
              <th>{t.notifications.type}</th>
              <th>{t.notifications.time}</th>
              <th>{t.notifications.status}</th>
              <th>{t.notifications.actions}</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((notification) => (
              <tr key={notification.id}>
                <td className="bs-table-check">
                  <input
                    type="checkbox"
                    checked={selected.has(notification.id)}
                    onChange={() => toggleSelect(notification.id)}
                    aria-label={`select ${notification.title}`}
                  />
                </td>
                <td>
                  <a
                    href={`/app/notifications/detail/${notification.id}`}
                    className="bs-table-link"
                  >
                    {notification.title}
                  </a>
                </td>
                <td>
                  <StatusBadge
                    tone={typeTone[notification.type]}
                    label={t.notifications.types[notification.type]}
                  />
                </td>
                <td>{notification.createdAt}</td>
                <td>
                  <StatusBadge
                    tone={notification.read ? "neutral" : "warning"}
                    label={
                      notification.read
                        ? t.notifications.read
                        : t.notifications.unread
                    }
                  />
                </td>
                <td>
                  <div className="bs-table-actions">
                    {!notification.read ? (
                      <button
                        type="button"
                        className="bs-btn bs-btn-ghost bs-btn-sm"
                        onClick={() => markRead(notification.id)}
                      >
                        {t.notifications.markRead}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="bs-btn bs-btn-ghost bs-btn-sm"
                      onClick={() => {
                        setItems((previous) =>
                          previous.filter((item) => item.id !== notification.id),
                        );
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      {t.notifications.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 ? (
          <EmptyState title={t.notifications.empty} />
        ) : null}
      </div>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onChange={setPage}
      />

      {confirmingDelete ? (
        <ConfirmDialog
          title={t.common.confirmDeleteTitle}
          message={t.common.confirmDeleteMessage}
          confirmLabel={t.notifications.delete}
          danger
          onConfirm={deleteSelected}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}
    </>
  );
}
