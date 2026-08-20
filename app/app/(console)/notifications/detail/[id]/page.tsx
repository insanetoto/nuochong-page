"use client";

import { useParams } from "next/navigation";
import { NotificationDetail } from "../../../../_components/notifications/NotificationDetail";

export default function NotificationDetailPage() {
  const params = useParams<{ id: string }>();
  return <NotificationDetail id={params?.id ?? ""} />;
}
