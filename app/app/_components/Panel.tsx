import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
  title,
  subtitle,
  extra,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  extra?: ReactNode;
}) {
  const classes = ["bs-panel", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {title ? (
        <div className="bs-panel-head">
          <div className="bs-panel-head-copy">
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {extra ? <div className="bs-panel-head-extra">{extra}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
