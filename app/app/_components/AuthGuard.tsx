"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "../_lib/auth";
import { useI18n } from "../_lib/i18n";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { status, hydrated } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (hydrated && status !== "authenticated") {
      window.location.replace("/app/login");
    }
  }, [hydrated, status]);

  if (!hydrated) {
    return <div className="bs-loading">{t.common.loading}</div>;
  }

  if (status !== "authenticated") {
    return null;
  }

  return <>{children}</>;
}
