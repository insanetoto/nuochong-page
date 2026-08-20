"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getHelpArticleById,
  getHelpCategoryById,
  mockHelpArticles,
} from "../../_lib/help";
import { useI18n } from "../../_lib/i18n";
import { HelpSidebar } from "./HelpSidebar";

export function HelpDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState<"helpful" | "not-helpful" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const article = getHelpArticleById(id);

  if (!article) {
    return (
      <div className="bs-help-layout">
        <HelpSidebar />
        <div className="bs-help-body">
          <h1>{t.help.noResults}</h1>
        </div>
      </div>
    );
  }

  const category = getHelpCategoryById(article.categoryId);
  const categoryArticles = mockHelpArticles.filter(
    (item) => item.categoryId === article.categoryId,
  );
  const currentIndex = categoryArticles.findIndex((item) => item.id === id);
  const previous = categoryArticles[currentIndex - 1];
  const next = categoryArticles[currentIndex + 1];
  const related = mockHelpArticles
    .filter((item) => item.id !== id && item.categoryId !== article.categoryId)
    .slice(0, 3);

  function submitFeedback() {
    setFeedbackSent(true);
    window.setTimeout(() => setFeedbackSent(false), 2000);
  }

  return (
    <div className="bs-help-layout">
      <HelpSidebar activeArticleId={id} />

      <div className="bs-help-body">
        <Link href="/app/help" className="bs-help-back">
          <ArrowLeft size={16} aria-hidden="true" />
          {t.help.backToHelp}
        </Link>

        <article className="bs-help-article">
          <div className="bs-help-article-head">
            <span className="bs-help-article-category">
              {category?.name ?? t.help.article}
            </span>
            <h1>{article.title}</h1>
            <p className="bs-help-article-updated">
              {t.common.updatedAt} {article.updatedAt}
            </p>
          </div>

          <div className="bs-help-article-content">
            {article.content.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          <div className="bs-help-pager">
            {previous ? (
              <Link href={`/app/help/${previous.id}`} className="bs-help-pager-link">
                <small>{t.common.previous}</small>
                <span>{previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/app/help/${next.id}`}
                className="bs-help-pager-link bs-help-pager-next"
              >
                <small>{t.common.next}</small>
                <span>{next.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </div>
        </article>

        {related.length > 0 ? (
          <section className="bs-help-recommend">
            <h2>{t.help.relatedArticles}</h2>
            {related.map((item) => (
              <Link key={item.id} href={`/app/help/${item.id}`}>
                {item.title}
              </Link>
            ))}
          </section>
        ) : null}

        <section className="bs-help-feedback">
          <p>{t.help.wasThisHelpful}</p>
          <div className="bs-help-feedback-actions">
            <button
              type="button"
              className={`bs-btn bs-btn-ghost bs-btn-sm${
                feedback === "helpful" ? " active" : ""
              }`}
              onClick={() => setFeedback("helpful")}
            >
              {t.help.helpful}
            </button>
            <button
              type="button"
              className={`bs-btn bs-btn-ghost bs-btn-sm${
                feedback === "not-helpful" ? " active" : ""
              }`}
              onClick={() => setFeedback("not-helpful")}
            >
              {t.help.notHelpful}
            </button>
          </div>

          <textarea
            className="bs-textarea"
            rows={2}
            placeholder={t.common.feedbackPlaceholder}
            value={feedbackText}
            onChange={(event) => setFeedbackText(event.target.value)}
          />

          <button
            type="button"
            className="bs-btn bs-btn-primary bs-btn-sm"
            onClick={submitFeedback}
          >
            {t.common.submitFeedback}
          </button>

          {feedbackSent ? (
            <span className="bs-inline-status" role="status">
              {t.help.feedbackThanks}
            </span>
          ) : null}
        </section>
      </div>
    </div>
  );
}
