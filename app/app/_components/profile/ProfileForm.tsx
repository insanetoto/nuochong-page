"use client";

import { useState, type FormEvent } from "react";
import { Camera } from "lucide-react";
import { mockProfile, type UserProfile } from "../../_lib/profile";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { Panel } from "../Panel";
import { FormField } from "../FormField";
import { AvatarModal, avatarGradient } from "./AvatarModal";

export function ProfileForm() {
  const { t } = useI18n();
  const [form, setForm] = useState<UserProfile>(() => ({ ...mockProfile }));
  const [saved, setSaved] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <>
      <PageHeader
        title={t.profile.title}
        subtitle={t.profile.subtitle}
        extra={
          <button
            type="button"
            className="bs-btn bs-btn-primary"
            onClick={() => setSaved(false)}
            form="bs-profile-form"
          >
            {t.profile.save}
          </button>
        }
      />

      <Panel className="bs-profile-panel">
        <div className="bs-profile-head">
          <div
            className="bs-profile-avatar"
            style={{ background: avatarGradient(form.avatar) }}
            aria-hidden="true"
          >
            {form.name.charAt(0)}
          </div>
          <div className="bs-profile-head-meta">
            <b>{form.name}</b>
            <span>{form.role}</span>
            <button
              type="button"
              className="bs-btn bs-btn-ghost bs-btn-sm"
              onClick={() => setAvatarOpen(true)}
            >
              <Camera size={14} aria-hidden="true" />
              {t.profile.changeAvatar}
            </button>
          </div>
        </div>

        <form id="bs-profile-form" className="bs-form" onSubmit={handleSubmit}>
          <div className="bs-form-grid">
            <FormField label={t.profile.name} required>
              <input
                type="text"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                required
              />
            </FormField>

            <FormField label={t.profile.nickname}>
              <input
                type="text"
                value={form.nickname}
                onChange={(event) => update("nickname", event.target.value)}
              />
            </FormField>

            <FormField label={t.profile.email} required>
              <input
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                required
              />
            </FormField>

            <FormField label={t.profile.phone}>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </FormField>

            <FormField label={t.profile.department}>
              <input
                type="text"
                value={form.department}
                onChange={(event) => update("department", event.target.value)}
              />
            </FormField>

            <FormField label={t.profile.role}>
              <input
                type="text"
                value={form.role}
                onChange={(event) => update("role", event.target.value)}
              />
            </FormField>
          </div>

          <FormField label={t.profile.bio}>
            <textarea
              className="bs-textarea"
              rows={3}
              value={form.bio}
              onChange={(event) => update("bio", event.target.value)}
            />
          </FormField>

          <FormField label={t.profile.signature}>
            <input
              type="text"
              value={form.signature}
              onChange={(event) => update("signature", event.target.value)}
            />
          </FormField>

          <div className="bs-modal-actions">
            <button type="submit" className="bs-btn bs-btn-primary">
              {t.profile.save}
            </button>
            {saved ? (
              <span className="bs-inline-status" role="status">
                {t.profile.saved}
              </span>
            ) : null}
          </div>
        </form>
      </Panel>

      {avatarOpen ? (
        <AvatarModal
          current={form.avatar}
          onSelect={(avatar) => {
            update("avatar", avatar);
            setAvatarOpen(false);
          }}
          onClose={() => setAvatarOpen(false)}
        />
      ) : null}
    </>
  );
}
