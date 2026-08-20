"use client";

import { useParams } from "next/navigation";
import { HelpDetail } from "../../../_components/help/HelpDetail";

export default function HelpDetailPage() {
  const params = useParams<{ id: string }>();
  return <HelpDetail id={params?.id ?? ""} />;
}
