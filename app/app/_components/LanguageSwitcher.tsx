"use client";

import { useI18n } from "../_lib/i18n";

export function LanguageSwitcher() {
  const { language, t, setLanguage } = useI18n();

  return (
    <div
      className="bs-lang-switcher"
      role="group"
      aria-label={t.common.languageLabel}
    >
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
      >
        EN
      </button>
      <button
        type="button"
        className={language === "zh" ? "active" : ""}
        onClick={() => setLanguage("zh")}
        aria-pressed={language === "zh"}
      >
        中文
      </button>
    </div>
  );
}
