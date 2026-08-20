"use client";

import { useParams, useRouter } from "next/navigation";
import { NotificationsList } from "../../../../_components/notifications/NotificationsList";

export default function InnerNotificationsPage() {
  const params = useParams<{ type: string }>();
  const router = useRouter();
  const type =
    params?.type === "unread" || params?.type === "read" ? params.type : "all";

  return (
    <NotificationsList
      type={type}
      onTypeChange={(next) => router.push(`/app/notifications/inner/${next}`)}
    />
  );
}
