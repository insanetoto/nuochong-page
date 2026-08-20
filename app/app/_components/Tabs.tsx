"use client";

export type TabItem = {
  key: string;
  label: string;
  badge?: number;
};

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="bs-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={`bs-tab${active === tab.key ? " active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          <span>{tab.label}</span>
          {tab.badge != null && tab.badge > 0 ? (
            <span className="bs-tab-badge">{tab.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
