export type BadgeTone = "success" | "warning" | "error" | "info" | "neutral";

export function StatusBadge({
  tone,
  label,
}: {
  tone: BadgeTone;
  label: string;
}) {
  return <span className={`bs-badge bs-badge-${tone}`}>{label}</span>;
}
