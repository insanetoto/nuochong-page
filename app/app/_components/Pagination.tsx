"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../_lib/i18n";

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const { t } = useI18n();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const info = t.common.pageInfo
    .replace("{start}", String(start))
    .replace("{end}", String(end))
    .replace("{total}", String(total));

  return (
    <div className="bs-pagination">
      <span className="bs-pagination-info">{info}</span>
      <div className="bs-pagination-controls">
        <button
          type="button"
          className="bs-btn bs-btn-ghost bs-btn-sm bs-pagination-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label={t.common.previous}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={`bs-pagination-page${pageNumber === page ? " active" : ""}`}
              onClick={() => onChange(pageNumber)}
              aria-current={pageNumber === page ? "page" : undefined}
            >
              {pageNumber}
            </button>
          ),
        )}

        <button
          type="button"
          className="bs-btn bs-btn-ghost bs-btn-sm bs-pagination-btn"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label={t.common.next}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
