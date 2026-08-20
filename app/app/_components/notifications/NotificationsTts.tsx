"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { Panel } from "../Panel";
import { FormField } from "../FormField";

export function NotificationsTts() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(true);
  const [speed, setSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [voice, setVoice] = useState("zh-CN-XiaoxiaoNeural");
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  const speeds = [
    { key: "slow" as const, label: t.notifications.speedSlow },
    { key: "normal" as const, label: t.notifications.speedNormal },
    { key: "fast" as const, label: t.notifications.speedFast },
  ];

  return (
    <>
      <PageHeader
        title={t.notifications.ttsTitle}
        subtitle={t.notifications.ttsSubtitle}
      />

      <Panel className="bs-panel-section">
        <label className="bs-check-row" aria-label={t.notifications.enabled}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span className="bs-check-copy">
            <b>{t.notifications.enabled}</b>
            <small>{t.notifications.enabledDesc}</small>
          </span>
        </label>

        <div className="bs-section-divider" />

        <FormField label={t.notifications.speed}>
          <div className="bs-segmented" role="group">
            {speeds.map((item) => (
              <button
                key={item.key}
                type="button"
                className={speed === item.key ? "active" : ""}
                onClick={() => setSpeed(item.key)}
                aria-pressed={speed === item.key}
              >
                {item.label}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label={t.notifications.voice}>
          <select value={voice} onChange={(event) => setVoice(event.target.value)}>
            <option value="zh-CN-XiaoxiaoNeural">晓晓（中文女声）</option>
            <option value="zh-CN-YunxiNeural">云希（中文男声）</option>
            <option value="en-US-AriaNeural">Aria (English)</option>
          </select>
        </FormField>

        <div className="bs-modal-actions">
          <button type="button" className="bs-btn bs-btn-ghost">
            <Volume2 size={16} aria-hidden="true" />
            {t.notifications.test}
          </button>
          <button type="button" className="bs-btn bs-btn-primary" onClick={save}>
            {t.common.save}
          </button>
          {saved ? (
            <span className="bs-inline-status" role="status">
              {t.notifications.ttsSaved}
            </span>
          ) : null}
        </div>
      </Panel>
    </>
  );
}
