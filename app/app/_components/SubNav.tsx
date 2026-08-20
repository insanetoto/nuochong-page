"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SubNavItem =
  | { type?: "link"; href: string; label: string; badge?: number }
  | { type: "heading"; label: string };

export function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  return (
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
          <Link
            key={item.href}
            href={item.href}
            className={`bs-subnav-link${active ? " active" : ""}`}
          >
            <span>{item.label}</span>
            {item.badge != null && item.badge > 0 ? (
              <span className="bs-subnav-badge">{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
