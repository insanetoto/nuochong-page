"use client";

import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";
import {
  getTrainingCourseById,
  type TrainingStatus,
} from "../../_lib/training";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { Panel } from "../Panel";
import { StatusBadge, type BadgeTone } from "../StatusBadge";
import { EmptyState } from "../EmptyState";

const statusTone: Record<TrainingStatus, BadgeTone> = {
  "not-started": "neutral",
  "in-progress": "info",
  completed: "success",
};

export function TrainingDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const course = getTrainingCourseById(id);

  if (!course) {
    return (
      <>
        <PageHeader title={t.training.detail} />
        <EmptyState title={t.training.empty} />
      </>
    );
  }

  const statusLabel =
    course.status === "not-started"
      ? t.training.notStarted
      : course.status === "in-progress"
        ? t.training.inProgress
        : t.training.completed;

  return (
    <>
      <PageHeader
        title={t.training.detail}
        extra={
          <Link href="/app/training" className="bs-btn bs-btn-ghost">
            <ArrowLeft size={16} aria-hidden="true" />
            {t.training.backToList}
          </Link>
        }
      />

      <Panel className="bs-detail">
        <div className="bs-detail-head">
          <h2>{course.title}</h2>
          <div className="bs-detail-meta">
            <StatusBadge tone={statusTone[course.status]} label={statusLabel} />
            <span>{course.category}</span>
            <span>
              {t.training.instructor}: {course.instructor}
            </span>
            <span>
              {t.training.lessons}: {course.lessons}
            </span>
          </div>
        </div>

        <div className="bs-progress bs-progress-lg">
          <span
            className="bs-progress-bar"
            style={{ width: `${course.progress}%` }}
          />
          <small>{course.progress}%</small>
        </div>

        <p className="bs-detail-body">{course.description}</p>

        <div className="bs-detail-actions">
          <button type="button" className="bs-btn bs-btn-primary">
            <Play size={16} aria-hidden="true" />
            {course.status === "completed"
              ? t.training.continue
              : course.status === "in-progress"
                ? t.training.continue
                : t.training.start}
          </button>
        </div>
      </Panel>
    </>
  );
}
