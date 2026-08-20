"use client";

import { useState, type FormEvent } from "react";
import {
  mockSecuritySettings,
  type SecuritySettings as SecuritySettingsData,
} from "../../_lib/profile";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { Panel } from "../Panel";
import { FormField } from "../FormField";

export function SecuritySettings() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<SecuritySettingsData>(() => ({
    ...mockSecuritySettings,
    securityQuestions: mockSecuritySettings.securityQuestions.map((item) => ({
      ...item,
    })),
  }));
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordChanged(false);

    if (password.next !== password.confirm) {
      setPasswordError(t.security.passwordMismatch);
      return;
    }

    setPasswordChanged(true);
    setPassword({ current: "", next: "", confirm: "" });
    window.setTimeout(() => setPasswordChanged(false), 2000);
  }

  function handleSaveQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <>
      <PageHeader title={t.security.title} subtitle={t.security.subtitle} />

      <div className="bs-detail">
        <Panel className="bs-panel-section">
          <div className="bs-panel-section-head">
            <h2>{t.security.password}</h2>
            <p>{t.security.passwordDesc}</p>
          </div>

          <form className="bs-form" onSubmit={handleChangePassword}>
            <div className="bs-form-grid bs-form-grid-3">
              <FormField label={t.security.currentPassword} required>
                <input
                  type="password"
                  value={password.current}
                  onChange={(event) =>
                    setPassword((previous) => ({
                      ...previous,
                      current: event.target.value,
                    }))
                  }
                  required
                />
              </FormField>
              <FormField label={t.security.newPassword} required>
                <input
                  type="password"
                  value={password.next}
                  onChange={(event) =>
                    setPassword((previous) => ({
                      ...previous,
                      next: event.target.value,
                    }))
                  }
                  required
                />
              </FormField>
              <FormField label={t.security.confirmPassword} required>
                <input
                  type="password"
                  value={password.confirm}
                  onChange={(event) =>
                    setPassword((previous) => ({
                      ...previous,
                      confirm: event.target.value,
                    }))
                  }
                  required
                />
              </FormField>
            </div>

            {passwordError ? (
              <div className="bs-form-error" role="alert">
                {passwordError}
              </div>
            ) : null}

            <div className="bs-modal-actions">
              <button type="submit" className="bs-btn bs-btn-primary">
                {t.security.changePassword}
              </button>
              {passwordChanged ? (
                <span className="bs-inline-status" role="status">
                  {t.security.passwordChanged}
                </span>
              ) : null}
            </div>
          </form>
        </Panel>

        <Panel className="bs-panel-section">
          <div className="bs-panel-section-head">
            <h2>{t.security.phone}</h2>
            <p>{t.security.phoneDesc}</p>
          </div>

          <div className="bs-desc-list">
            <div className="bs-desc-row">
              <span>{t.security.phone}</span>
              <b>{settings.phone}</b>
            </div>
            <div className="bs-desc-row">
              <span>{t.security.bound}</span>
              <b>{settings.phoneBound ? t.security.bound : t.security.bind}</b>
            </div>
          </div>

          <div className="bs-modal-actions">
            <button
              type="button"
              className="bs-btn bs-btn-ghost"
              onClick={() =>
                setSettings((previous) => ({
                  ...previous,
                  phoneBound: !previous.phoneBound,
                }))
              }
            >
              {settings.phoneBound ? t.security.bind : t.security.bind}
            </button>
          </div>
        </Panel>

        <Panel className="bs-panel-section">
          <div className="bs-panel-section-head">
            <h2>{t.security.securityQuestions}</h2>
            <p>{t.security.securityQuestionsDesc}</p>
          </div>

          <form className="bs-form" onSubmit={handleSaveQuestions}>
            {settings.securityQuestions.map((item, index) => (
              <div key={index} className="bs-form-grid bs-form-grid-2">
                <FormField label={t.security.question}>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(event) =>
                      setSettings((previous) => {
                        const next = previous.securityQuestions.map((q, i) =>
                          i === index ? { ...q, question: event.target.value } : q,
                        );
                        return { ...previous, securityQuestions: next };
                      })
                    }
                  />
                </FormField>
                <FormField label={t.security.answer}>
                  <input
                    type="text"
                    value={item.answer}
                    onChange={(event) =>
                      setSettings((previous) => {
                        const next = previous.securityQuestions.map((q, i) =>
                          i === index ? { ...q, answer: event.target.value } : q,
                        );
                        return { ...previous, securityQuestions: next };
                      })
                    }
                  />
                </FormField>
              </div>
            ))}

            <div className="bs-modal-actions">
              <button type="submit" className="bs-btn bs-btn-primary">
                {t.common.save}
              </button>
              {saved ? (
                <span className="bs-inline-status" role="status">
                  {t.security.saved}
                </span>
              ) : null}
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
