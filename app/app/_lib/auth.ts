"use client";

import { useSyncExternalStore } from "react";

export type BusinessUser = { name: string; email: string };

export type AuthState = {
  status: "anonymous" | "authenticated";
  user: BusinessUser | null;
  hydrated: boolean;
};

const TOKEN_KEY = "nuochong-business-token";
const USER_KEY = "nuochong-business-user";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "ng-alain.com";

const ADMIN_USER: BusinessUser = {
  name: "诺崇管理员",
  email: "admin@nuochong.work",
};

const serverSnapshot: AuthState = {
  status: "anonymous",
  user: null,
  hydrated: false,
};

let state: AuthState = serverSnapshot;
const listeners = new Set<() => void>();

function getSnapshot(): AuthState {
  return state;
}

function getServerSnapshot(): AuthState {
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

function readStoredUser(): BusinessUser | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<BusinessUser>;
    if (typeof parsed.name === "string" && typeof parsed.email === "string") {
      return { name: parsed.name, email: parsed.email };
    }
  } catch {
    return null;
  }

  return null;
}

export function hydrateAuth(): void {
  if (typeof window === "undefined") return;

  const token = window.localStorage.getItem(TOKEN_KEY);
  const user = readStoredUser();

  state =
    token && user
      ? { status: "authenticated", user, hydrated: true }
      : { status: "anonymous", user: null, hydrated: true };

  emit();
}

export function login(
  username: string,
  password: string,
): { ok: true } | { ok: false; error: string } {
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_KEY, "mock-token");
      window.localStorage.setItem(USER_KEY, JSON.stringify(ADMIN_USER));
    }

    state = { status: "authenticated", user: ADMIN_USER, hydrated: true };
    emit();
    return { ok: true };
  }

  return {
    ok: false,
    error: "invalid-credentials",
  };
}

export function logout(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  }

  state = { status: "anonymous", user: null, hydrated: true };
  emit();
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
