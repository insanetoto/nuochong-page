import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const classes = ["bs-panel", className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}
