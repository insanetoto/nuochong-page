"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getHelpCategories, mockHelpArticles } from "../../_lib/help";
import { useI18n } from "../../_lib/i18n";

export function HelpSidebar({
  activeArticleId,
}: {
  activeArticleId?: string;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const categories = getHelpCategories();

  return (
    <nav className="bs-help-sidebar" aria-label={t.help.categoryTree}>
      <div className="bs-help-sidebar-title">{t.help.categories}</div>
      {categories.map((category) => {
        const articles = mockHelpArticles.filter(
          (article) => article.categoryId === category.id,
        );

        return (
          <div key={category.id} className="bs-help-tree-group">
            <div className="bs-help-tree-label">{category.name}</div>
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/app/help/${article.id}`}
                className={`bs-help-tree-link${
                  pathname === `/app/help/${article.id}` ||
                  activeArticleId === article.id
                    ? " active"
                    : ""
                }`}
              >
                {article.title}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
