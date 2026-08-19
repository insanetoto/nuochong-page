"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "../_lib/auth";

export function LoginForm() {
  const router = useRouter();
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
      router.push("/app/dashboard");
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form className="bs-login-form" onSubmit={handleSubmit}>
      <h2 id="bs-login-title" className="bs-login-title">
        业务系统登录
      </h2>
      <p className="bs-login-subtitle">使用内部账号登录（admin / ng-alain.com）</p>

      <label className="bs-field">
        <span>用户名</span>
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label className="bs-field">
        <span>密码</span>
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
        {loading ? "登录中…" : "登录"}
      </button>

      <div className="bs-login-links">
        <button type="button" className="bs-login-link">
          忘记密码
        </button>
        <button type="button" className="bs-login-link">
          注册账号
        </button>
      </div>
    </form>
  );
}
