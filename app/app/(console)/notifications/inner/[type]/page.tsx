"use client";

import { useParams } from "next/navigation";
import { NotificationsList } from "../../../../_components/notifications/NotificationsList";

export default function InnerNotificationsPage() {
  const params = useParams<{ type: string }>();
  const type =
    params?.type === "unread" || params?.type === "read" ? params.type : "all";

  return (
    <NotificationsList
      type={type}
      onTypeChange={(next) =>
        window.location.assign(`/app/notifications/inner/${next}`)
      }
    />
  );
}
