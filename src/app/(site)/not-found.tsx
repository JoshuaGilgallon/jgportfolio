import Link from "next/link";
import s from "../not-found.module.css";

// Rendered inside the site layout (nav, <main>, footer), so no wrapper of its own.
export default function SiteNotFound() {
  return (
    <div className={s.inline}>
      <p className={s.code}>404</p>
      <h1 className={s.title}>This page doesn’t exist.</h1>
      <Link href="/" className={s.link}>
        Go home
      </Link>
    </div>
  );
}
