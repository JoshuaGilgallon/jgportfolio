"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/admin/auth-actions";
import s from "./login.module.css";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className={s.form}>
      <div className={`${s.fields} sq`}>
        <label className="visually-hidden" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          className={s.input}
          placeholder="Username"
          defaultValue={state.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus={!state.username}
        />
        <label className="visually-hidden" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className={s.input}
          placeholder="Password"
          autoComplete="current-password"
          required
          autoFocus={!!state.username}
        />
      </div>
      <p className={s.error} role="alert">
        {state.error}
      </p>
      <button type="submit" className={s.submit} disabled={pending}>
        {pending ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
