"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { hydrateAuth } from "../_lib/auth";
import { hydrateLanguage, useI18n } from "../_lib/i18n";
import { LoginForm } from "./LoginForm";

export function AppEntry() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    hydrateAuth();
    hydrateLanguage();
  }, []);

  if (pathname.startsWith("/app")) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="bs-entry-fab"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t.nav.enterBusinessSystem}
      >
        <LayoutGrid size={18} strokeWidth={2.2} aria-hidden="true" />
        <span>{t.nav.businessSystem}</span>
      </button>

      {open ? (
        <div className="bs-modal-overlay">
          <div
            className="bs-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bs-login-title"
          >
            <button
              type="button"
              className="bs-modal-close"
              onClick={() => setOpen(false)}
              aria-label={t.common.close}
            >
              ×
            </button>
            <LoginForm />
          </div>
        </div>
      ) : null}
    </>
  );
}
