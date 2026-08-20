"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../_lib/i18n";

export type SubNavItem =
  | { type?: "link"; href: string; label: string; badge?: number }
  | { type: "heading"; label: string };

export function SubNav({
  items,
  title,
  children,
}: {
  items: SubNavItem[];
  title?: string;
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`bs-service${collapsed ? " bs-service-collapsed" : ""}`}>
      <div className="bs-service-nav">
        <button
          type="button"
          className="bs-subnav-collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t.nav.expand : t.nav.collapse}
        >
          {collapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <ChevronLeft size={16} aria-hidden="true" />
          )}
        </button>

        {title ? <div className="bs-subnav-title">{title}</div> : null}

        <nav className="bs-subnav" aria-label="模块导航">
          {items.map((item) => {
            if (item.type === "heading") {
              return (
                <div key={item.label} className="bs-subnav-heading">
                  {item.label}
                </div>
              );
            }

            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <a
                key={item.href}
                href={item.href}
                className={`bs-subnav-link${active ? " active" : ""}`}
              >
                <span>{item.label}</span>
                {item.badge != null && item.badge > 0 ? (
                  <span className="bs-subnav-badge">{item.badge}</span>
                ) : null}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="bs-service-body">{children}</div>
    </div>
  );
}
