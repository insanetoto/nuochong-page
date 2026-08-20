import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="bs-empty-state">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="bs-empty-state-action">{action}</div> : null}
    </div>
  );
}
