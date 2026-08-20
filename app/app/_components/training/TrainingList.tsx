"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  getTrainingCategories,
  mockTrainingCourses,
  type TrainingCourse,
  type TrainingStatus,
} from "../../_lib/training";
import { filterByQuery, paginate } from "../../_lib/list-utils";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { SearchBar } from "../SearchBar";
import { Tabs } from "../Tabs";
import { StatusBadge, type BadgeTone } from "../StatusBadge";
import { Pagination } from "../Pagination";
import { EmptyState } from "../EmptyState";
import { TrainingEditModal, type TrainingFormValues } from "./TrainingEditModal";

const PAGE_SIZE = 5;

const statusTone: Record<TrainingStatus, BadgeTone> = {
  "not-started": "neutral",
  "in-progress": "info",
  completed: "success",
};

export function TrainingList() {
  const { t } = useI18n();
  const [courses, setCourses] = useState<TrainingCourse[]>(() =>
    mockTrainingCourses.map((course) => ({ ...course })),
  );
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TrainingCourse | null>(null);
  const [creating, setCreating] = useState(false);

  const categories = getTrainingCategories();
  const tabs = [
    { key: "all", label: t.training.all },
    ...categories.map((item) => ({ key: item, label: item })),
  ];

  const filtered = useMemo(() => {
    const byCategory = courses.filter(
      (course) => category === "all" || course.category === category,
    );
    return filterByQuery(byCategory, query, (course) => [
      course.title,
      course.category,
      course.instructor,
    ]);
  }, [courses, category, query]);

  const paginated = useMemo(
    () => paginate(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  function closeModal() {
    setEditing(null);
    setCreating(false);
  }

  function handleSave(values: TrainingFormValues) {
    if (values.id) {
      setCourses((previous) =>
        previous.map((course) =>
          course.id === values.id
            ? { ...course, ...values, id: values.id }
            : course,
        ),
      );
    } else {
      setCourses((previous) => [
        ...previous,
        { ...values, id: `t${Date.now()}`, updatedAt: "2026-08-20" } as TrainingCourse,
      ]);
    }
    closeModal();
  }

  return (
    <>
      <PageHeader
        title={t.training.title}
        subtitle={t.training.subtitle}
        extra={
          <button
            type="button"
            className="bs-btn bs-btn-primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} aria-hidden="true" />
            {t.training.add}
          </button>
        }
      />

      <div className="bs-toolbar">
        <Tabs tabs={tabs} active={category} onChange={setCategory} />
        <SearchBar
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder={t.training.searchPlaceholder}
        />
      </div>

      <div className="bs-table-wrap">
        <table className="bs-table">
          <thead>
            <tr>
              <th>{t.common.title}</th>
              <th>{t.training.category}</th>
              <th>{t.training.status}</th>
              <th>{t.training.progress}</th>
              <th>{t.training.updatedAt}</th>
              <th>{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((course) => (
              <tr key={course.id}>
                <td>
                  <a
                    href={`/app/training/${course.id}`}
                    className="bs-table-link"
                  >
                    {course.title}
                  </a>
                </td>
                <td>{course.category}</td>
                <td>
                  <StatusBadge
                    tone={statusTone[course.status]}
                    label={
                      course.status === "not-started"
                        ? t.training.notStarted
                        : course.status === "in-progress"
                          ? t.training.inProgress
                          : t.training.completed
                    }
                  />
                </td>
                <td>
                  <div className="bs-progress">
                    <span
                      className="bs-progress-bar"
                      style={{ width: `${course.progress}%` }}
                    />
                    <small>{course.progress}%</small>
                  </div>
                </td>
                <td>{course.updatedAt}</td>
                <td>
                  <button
                    type="button"
                    className="bs-btn bs-btn-ghost bs-btn-sm"
                    onClick={() => setEditing({ ...course })}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    {t.common.edit}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 ? (
          <EmptyState title={t.training.empty} />
        ) : null}
      </div>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onChange={setPage}
      />

      {creating || editing ? (
        <TrainingEditModal
          key={editing?.id ?? "new"}
          course={editing}
          onSave={handleSave}
          onCancel={closeModal}
        />
      ) : null}
    </>
  );
}
