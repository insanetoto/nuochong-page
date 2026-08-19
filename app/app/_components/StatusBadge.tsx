export function StatusBadge({ status }: { status: "active" | "inactive" }) {
  const label = status === "active" ? "在职" : "离职";
  return <span className={`bs-badge bs-badge-${status}`}>{label}</span>;
}
