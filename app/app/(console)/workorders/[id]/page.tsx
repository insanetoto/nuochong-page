"use client";

import { useParams } from "next/navigation";
import { WorkOrderDetail } from "../../../_components/workorders/WorkOrderDetail";

export default function WorkOrderDetailPage() {
  const params = useParams<{ id: string }>();
  return <WorkOrderDetail id={params?.id ?? ""} />;
}
