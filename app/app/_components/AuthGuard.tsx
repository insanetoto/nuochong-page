"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../_lib/auth";
import { useI18n } from "../_lib/i18n";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { status, hydrated } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && status !== "authenticated") {
      router.replace("/app/login");
    }
  }, [hydrated, status, router]);

  if (!hydrated) {
    return <div className="bs-loading">{t.common.loading}</div>;
  }

  if (status !== "authenticated") {
    return null;
  }

  return <>{children}</>;
}
