"use client";

import { useParams } from "next/navigation";
import { TrainingDetail } from "../../../_components/training/TrainingDetail";

export default function TrainingDetailPage() {
  const params = useParams<{ id: string }>();
  return <TrainingDetail id={params?.id ?? ""} />;
}
