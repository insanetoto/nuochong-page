"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../_lib/auth";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { status, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && status !== "authenticated") {
      router.replace("/app/login");
    }
  }, [hydrated, status, router]);

  if (!hydrated) {
    return <div className="bs-loading">正在加载…</div>;
  }

  if (status !== "authenticated") {
    return null;
  }

  return <>{children}</>;
}
