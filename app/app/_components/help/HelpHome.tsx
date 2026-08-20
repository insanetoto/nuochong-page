"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  Rocket,
  User,
} from "lucide-react";
import { getHelpCategories, searchHelp } from "../../_lib/help";
import { useI18n } from "../../_lib/i18n";
import { PageHeader } from "../PageHeader";
import { SearchBar } from "../SearchBar";
import { EmptyState } from "../EmptyState";

const categoryIcons: Record<string, typeof BookOpen> = {
  rocket: Rocket,
  user: User,
  book: BookOpen,
  graduation: GraduationCap,
  clipboard: ClipboardList,
};

export function HelpHome() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const categories = getHelpCategories();
  const results = useMemo(() => searchHelp(query), [query]);

  function toggleExpand(categoryId: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  return (
    <>
      <PageHeader title={t.help.title} subtitle={t.help.subtitle} />

      <div className="bs-help-search">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t.help.searchPlaceholder}
        />
      </div>

      {query.trim() ? (
        <div className="bs-help-results">
          <h2>{t.help.searchResults}</h2>
          {results.length === 0 ? (
            <EmptyState title={t.help.noResults} />
          ) : (
            results.map((article) => (
              <Link
                key={article.id}
                href={`/app/help/${article.id}`}
                className="bs-help-result-link"
              >
                <b>{article.title}</b>
                <span>{article.summary}</span>
              </Link>
            ))
          )}
        </div>
      ) : (
        <div className="bs-category-grid">
          {categories.map((category) => {
            const Icon = categoryIcons[category.icon] ?? BookOpen;
            const articles = searchHelp("").filter(
              (article) => article.categoryId === category.id,
            );
            const visible = expanded.has(category.id)
              ? articles
              : articles.slice(0, 3);

            return (
              <article key={category.id} className="bs-category-card">
                <div className="bs-category-card-head">
                  <span className="bs-category-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>{category.name}</h2>
                    <p>{category.description}</p>
                  </div>
                </div>

                <ul className="bs-category-articles">
                  {visible.map((article) => (
                    <li key={article.id}>
                      <Link href={`/app/help/${article.id}`}>
                        {article.title}
                      </Link>
                    </li>
                  ))}
                </ul>

                {articles.length > 3 ? (
                  <button
                    type="button"
                    className="bs-btn bs-btn-ghost bs-btn-sm"
                    onClick={() => toggleExpand(category.id)}
                  >
                    {expanded.has(category.id)
                      ? t.common.close
                      : t.common.viewAll}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
