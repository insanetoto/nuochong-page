"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { logout, useAuth } from "../_lib/auth";

const navItems = [
  { href: "/app/dashboard", label: "控制台", icon: LayoutDashboard },
  { href: "/app/users", label: "员工账号", icon: Users },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    router.replace("/app/login");
  }

  return (
    <div className={`bs-shell${collapsed ? " bs-shell-collapsed" : ""}`}>
      <header className="bs-topbar">
        <div className="bs-topbar-brand">
          <span className="bs-brand-mark">诺</span>
          <span className="bs-brand-text">诺崇业务系统</span>
        </div>

        <div className="bs-topbar-right">
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
                退出登录
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <aside className="bs-sidebar">
        <nav className="bs-sidebar-nav" aria-label="业务系统导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`bs-sidebar-link${active ? " active" : ""}`}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="bs-sidebar-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
        >
          {collapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <ChevronLeft size={16} aria-hidden="true" />
          )}
        </button>
      </aside>

      <main className="bs-console">{children}</main>
    </div>
  );
}
