"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  CircleHelp,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { logout, useAuth } from "../_lib/auth";
import { useI18n } from "../_lib/i18n";
import { getNotificationCounts } from "../_lib/notifications";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const counts = getNotificationCounts();

  const navItems = [
    { href: "/app/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/app/users", label: t.nav.users, icon: Users },
    { href: "/app/notifications", label: t.nav.notifications, icon: Bell },
    { href: "/app/help", label: t.nav.help, icon: CircleHelp },
    { href: "/app/training", label: t.nav.training, icon: GraduationCap },
    { href: "/app/workorders", label: t.nav.workorders, icon: ClipboardList },
  ];

  function handleLogout() {
    logout();
    window.location.replace("/app/login");
  }

  return (
    <div className="bs-shell">
      <header className="bs-topbar">
        <div className="bs-topbar-brand">
          <span className="bs-brand-mark">诺</span>
          <span className="bs-brand-text">{t.nav.brand}</span>
        </div>

        <div className="bs-topbar-right">
          <a
            className="bs-topbar-bell"
            href="/app/notifications"
            aria-label={t.nav.notifications}
          >
            <Bell size={18} aria-hidden="true" />
            {counts.unread > 0 ? (
              <span className="bs-notice-chip" aria-hidden="true">
                {counts.unread}
              </span>
            ) : null}
          </a>

          <LanguageSwitcher />

          <button
            type="button"
            className="bs-user-menu-btn"
            onClick={() => setMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="bs-avatar">{user?.name?.charAt(0) ?? "管"}</span>
            <span className="bs-user-meta">
              <b>{user?.name}</b>
              <small>{user?.email}</small>
            </span>
          </button>

          {menuOpen ? (
            <div className="bs-user-menu" role="menu">
              <button type="button" role="menuitem" onClick={handleLogout}>
                <LogOut size={16} aria-hidden="true" />
                {t.nav.logout}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="bs-shell-body">
        <aside className="bs-sidebar">
          <nav className="bs-sidebar-nav" aria-label={t.nav.navLabel}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`bs-sidebar-link${active ? " active" : ""}`}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <main className="bs-console">{children}</main>
      </div>
    </div>
  );
}
