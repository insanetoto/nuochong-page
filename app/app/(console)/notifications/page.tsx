import { redirect } from "next/navigation";

export default function NotificationsIndexPage() {
  redirect("/app/notifications/inner/all");
}
