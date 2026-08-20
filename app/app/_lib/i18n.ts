"use client";

import { useSyncExternalStore } from "react";
import { businessCopy, type BusinessMessages } from "./business-messages";

export type Language = "en" | "zh";
export type LocalizedText = { en: string; zh: string };

export type I18nState = {
  language: Language;
  hydrated: boolean;
};

const STORAGE_KEY = "nuochong-language";

const serverSnapshot: I18nState = {
  language: "en",
  hydrated: false,
};

let state: I18nState = serverSnapshot;
const listeners = new Set<() => void>();

function getSnapshot(): I18nState {
  return state;
}

function getServerSnapshot(): I18nState {
  return serverSnapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function readQueryLanguage(): Language | null {
  if (typeof window === "undefined") return null;

  const query = new URLSearchParams(window.location.search).get("lang");
  if (query === "zh" || query === "en") return query;

  return null;
}

function readStoredLanguage(): Language | null {
  if (typeof window === "undefined") return null;

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "zh" || saved === "en") return saved;

  return null;
}

function resolveInitialLanguage(): Language {
  const query = readQueryLanguage();
  if (query) return query;

  const saved = readStoredLanguage();
  if (saved) return saved;

  if (
    typeof navigator !== "undefined" &&
    navigator.language?.toLowerCase().startsWith("zh")
  ) {
    return "zh";
  }

  return "en";
}

function applyDocumentLanguage(language: Language): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
}

export function hydrateLanguage(): void {
  if (typeof window === "undefined") return;

  const language = resolveInitialLanguage();
  state = { language, hydrated: true };
  applyDocumentLanguage(language);
  emit();
}

export function setLanguage(next: Language): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, next);

    const url = new URL(window.location.href);
    if (next === "zh") {
      url.searchParams.set("lang", "zh");
    } else {
      url.searchParams.delete("lang");
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  state = { language: next, hydrated: true };
  applyDocumentLanguage(next);
  emit();
}

export function useI18n(): {
  language: Language;
  hydrated: boolean;
  t: BusinessMessages;
  setLanguage: (next: Language) => void;
} {
  const { language, hydrated } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return {
    language,
    hydrated,
    t: businessCopy[language],
    setLanguage,
  };
}
