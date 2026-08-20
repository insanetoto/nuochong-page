"use client";

import { useState, type FormEvent } from "react";
import type {
  TrainingCourse,
  TrainingStatus,
} from "../../_lib/training";
import { useI18n } from "../../_lib/i18n";
import { Modal } from "../Modal";
import { FormField } from "../FormField";

export type TrainingFormValues = {
  id?: string;
  title: string;
  description: string;
  category: string;
  status: TrainingStatus;
  progress: number;
  lessons: number;
  instructor: string;
};

export function TrainingEditModal({
  course,
  onSave,
  onCancel,
}: {
  course: TrainingCourse | null;
  onSave: (values: TrainingFormValues) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<TrainingFormValues>(() => ({
    id: course?.id,
    title: course?.title ?? "",
    description: course?.description ?? "",
    category: course?.category ?? "",
    status: course?.status ?? "not-started",
    progress: course?.progress ?? 0,
    lessons: course?.lessons ?? 1,
    instructor: course?.instructor ?? "",
  }));

  function update<K extends keyof TrainingFormValues>(
    key: K,
    value: TrainingFormValues[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <Modal
      title={course ? t.training.edit : t.training.add}
      onClose={onCancel}
      size="md"
      footer={
        <>
          <button type="button" className="bs-btn bs-btn-ghost" onClick={onCancel}>
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="bs-training-form"
            className="bs-btn bs-btn-primary"
          >
            {t.training.save}
          </button>
        </>
      }
    >
      <form id="bs-training-form" className="bs-form" onSubmit={handleSubmit}>
        <FormField label={t.common.title} required>
          <input
            type="text"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            required
          />
        </FormField>

        <FormField label={t.training.description}>
          <textarea
            className="bs-textarea"
            rows={3}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </FormField>

        <div className="bs-form-grid bs-form-grid-2">
          <FormField label={t.training.category} required>
            <input
              type="text"
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
              required
            />
          </FormField>

          <FormField label={t.training.instructor} required>
            <input
              type="text"
              value={form.instructor}
              onChange={(event) => update("instructor", event.target.value)}
              required
            />
          </FormField>

          <FormField label={t.training.status}>
            <select
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as TrainingStatus)
              }
            >
              <option value="not-started">{t.training.notStarted}</option>
              <option value="in-progress">{t.training.inProgress}</option>
              <option value="completed">{t.training.completed}</option>
            </select>
          </FormField>

          <FormField label={t.training.lessons}>
            <input
              type="number"
              min={1}
              value={form.lessons}
              onChange={(event) => update("lessons", Number(event.target.value))}
            />
          </FormField>
        </div>

        <FormField label={t.training.progress}>
          <input
            type="range"
            min={0}
            max={100}
            value={form.progress}
            onChange={(event) => update("progress", Number(event.target.value))}
          />
        </FormField>
      </form>
    </Modal>
  );
}
