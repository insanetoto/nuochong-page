"use client";

import type { ReactNode } from "react";
import { SubNav } from "../../_components/SubNav";
import { useI18n } from "../../_lib/i18n";
import { getNotificationCounts } from "../../_lib/notifications";

export default function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useI18n();
  const counts = getNotificationCounts();

  const items = [
    { type: "heading" as const, label: t.notifications.inner },
    { href: "/app/notifications/inner/all", label: t.notifications.all },
    {
      href: "/app/notifications/inner/unread",
      label: t.notifications.unread,
      badge: counts.unread,
    },
    { href: "/app/notifications/inner/read", label: t.notifications.read },
    { type: "heading" as const, label: t.notifications.settings },
    { href: "/app/notifications/subscribe", label: t.notifications.subscribe },
    { href: "/app/notifications/tts", label: t.notifications.tts },
  ];

  return (
    <SubNav items={items} title={t.notifications.title}>
      {children}
    </SubNav>
  );
}
