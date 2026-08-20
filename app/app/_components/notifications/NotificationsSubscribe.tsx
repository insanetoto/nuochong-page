"use client";

import { useState } from "react";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { Panel } from "../Panel";

type SubscribePrefs = {
  email: boolean;
  sms: boolean;
  push: boolean;
};

export function NotificationsSubscribe() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<SubscribePrefs>({
    email: true,
    sms: false,
    push: true,
  });
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof SubscribePrefs) {
    setPrefs((previous) => ({ ...previous, [key]: !previous[key] }));
  }

  function save() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  const rows = [
    { key: "email" as const, title: t.notifications.email, desc: t.notifications.emailDesc },
    { key: "sms" as const, title: t.notifications.sms, desc: t.notifications.smsDesc },
    { key: "push" as const, title: t.notifications.push, desc: t.notifications.pushDesc },
  ];

  return (
    <>
      <PageHeader
        title={t.notifications.subscribeTitle}
        subtitle={t.notifications.subscribeSubtitle}
      />

      <Panel className="bs-check-panel">
        <div className="bs-check-list">
          {rows.map((row) => (
            <label key={row.key} className="bs-check-row" aria-label={row.title}>
              <input
                type="checkbox"
                checked={prefs[row.key]}
                onChange={() => toggle(row.key)}
              />
              <span className="bs-check-copy">
                <b>{row.title}</b>
                <small>{row.desc}</small>
              </span>
            </label>
          ))}
        </div>

        <div className="bs-modal-actions">
          <button type="button" className="bs-btn bs-btn-primary" onClick={save}>
            {t.notifications.save}
          </button>
          {saved ? (
            <span className="bs-inline-status" role="status">
              {t.notifications.saved}
            </span>
          ) : null}
        </div>
      </Panel>
    </>
  );
}
