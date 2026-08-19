import {
  ClipboardList,
  GraduationCap,
  UserCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "../../_components/PageHeader";
import { Panel } from "../../_components/Panel";

const stats = [
  { label: "员工总数", value: "128", icon: Users },
  { label: "活跃账号", value: "112", icon: UserCheck },
  { label: "本月培训", value: "24", icon: GraduationCap },
  { label: "待办事项", value: "9", icon: ClipboardList },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="控制台" subtitle="业务系统概览" />

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
