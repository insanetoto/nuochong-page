import type { ReactNode } from "react";
import { AppShell } from "../_components/AppShell";
import { AuthGuard } from "../_components/AuthGuard";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
