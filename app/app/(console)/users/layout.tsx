"use client";

import type { ReactNode } from "react";
import { SubNav } from "../../_components/SubNav";
import { useI18n } from "../../_lib/i18n";

export default function UsersLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  const items = [
    { href: "/app/users", label: t.employees.title },
    { href: "/app/users/profile", label: t.profile.title },
    { href: "/app/users/security", label: t.security.title },
  ];

  return (
    <div className="bs-service">
      <SubNav items={items} />
      <div className="bs-service-body">{children}</div>
    </div>
  );
}
