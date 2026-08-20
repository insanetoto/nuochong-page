"use client";

import {
  ClipboardList,
  GraduationCap,
  UserCheck,
  Users,
} from "lucide-react";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../../_components/PageHeader";
import { Panel } from "../../_components/Panel";

export default function DashboardPage() {
  const { t } = useI18n();

  const stats = [
    { label: t.dashboard.totalEmployees, value: "128", icon: Users },
    { label: t.dashboard.activeAccounts, value: "112", icon: UserCheck },
    { label: t.dashboard.monthlyTraining, value: "24", icon: GraduationCap },
    { label: t.dashboard.todos, value: "9", icon: ClipboardList },
  ];

  return (
    <>
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />

      <div className="bs-stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Panel key={stat.label} className="bs-stat-card">
              <div className="bs-stat-icon">
                <Icon size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="bs-stat-meta">
                <span>{stat.label}</span>
                <b>{stat.value}</b>
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
