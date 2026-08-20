"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { Modal } from "../Modal";
import { useI18n } from "../../_lib/i18n";

const presets = [
  { id: "preset-1", gradient: "linear-gradient(135deg, #0b57d0, #06b6d4)" },
  { id: "preset-2", gradient: "linear-gradient(135deg, #7c3aed, #ec4899)" },
  { id: "preset-3", gradient: "linear-gradient(135deg, #16a34a, #84cc16)" },
  { id: "preset-4", gradient: "linear-gradient(135deg, #ea580c, #f59e0b)" },
  { id: "preset-5", gradient: "linear-gradient(135deg, #0f766e, #22d3ee)" },
  { id: "preset-6", gradient: "linear-gradient(135deg, #be123c, #fb7185)" },
];

export function avatarGradient(id: string): string {
  return presets.find((preset) => preset.id === id)?.gradient ?? presets[0].gradient;
}

export function AvatarModal({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (avatar: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    onSelect("uploaded");
  }

  return (
    <Modal title={t.profile.changeAvatar} onClose={onClose} size="sm">
      <div className="bs-avatar-picker">
        <p className="bs-avatar-picker-label">{t.profile.presets}</p>

        <div className="bs-avatar-grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`bs-avatar-option${current === preset.id ? " active" : ""}`}
              style={{ background: preset.gradient }}
              onClick={() => onSelect(preset.id)}
              aria-label={preset.id}
            />
          ))}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="bs-visually-hidden"
          onChange={handleFile}
        />
        <button
          type="button"
          className="bs-btn bs-btn-ghost"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} aria-hidden="true" />
          {t.profile.upload}
        </button>
        <p className="bs-avatar-upload-hint">{t.profile.uploadHint}</p>
      </div>
    </Modal>
  );
}
