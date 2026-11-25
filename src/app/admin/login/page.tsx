import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import s from "./login.module.css";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className={s.main}>
      <div className={s.panel}>
        <span className={`${s.mark} sq`} aria-hidden>
          J
        </span>
        <h1 className={s.title}>Sign in</h1>
        <p className={s.subtitle}>Manage projects, writing and links.</p>
        <LoginForm />
      </div>
    </main>
  );
}
