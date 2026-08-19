"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { hydrateAuth } from "../_lib/auth";
import { LoginForm } from "./LoginForm";

export function AppEntry() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    hydrateAuth();
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
        aria-label="进入业务系统"
      >
        <LayoutGrid size={18} strokeWidth={2.2} aria-hidden="true" />
        <span>业务系统</span>
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
              aria-label="关闭登录框"
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
