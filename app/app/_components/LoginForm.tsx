"use client";

import { useState, type FormEvent } from "react";
import { login } from "../_lib/auth";
import { useI18n } from "../_lib/i18n";

export function LoginForm() {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = login(username.trim(), password);
    if (result.ok) {
      window.location.href = "/app/dashboard";
    } else {
      setError(
        result.error === "invalid-credentials"
          ? t.login.invalidCredentials
          : result.error,
      );
      setLoading(false);
    }
  }

  return (
    <form className="bs-login-form" onSubmit={handleSubmit}>
      <h2 id="bs-login-title" className="bs-login-title">
        {t.login.title}
      </h2>
      <p className="bs-login-subtitle">{t.login.subtitle}</p>

      <label className="bs-field">
        <span>{t.login.username}</span>
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label className="bs-field">
        <span>{t.login.password}</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {error ? (
        <div className="bs-form-error" role="alert">
          {error}
        </div>
      ) : null}

      <button type="submit" className="bs-btn bs-btn-primary" disabled={loading}>
        {loading ? t.login.submitting : t.login.submit}
      </button>

      <div className="bs-login-links">
        <button type="button" className="bs-login-link">
          {t.login.forgot}
        </button>
        <button type="button" className="bs-login-link">
          {t.login.register}
        </button>
      </div>
    </form>
  );
}
