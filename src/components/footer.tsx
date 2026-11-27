import { cacheLife } from "next/cache";
import Link from "next/link";
import { site } from "@/lib/site";
import s from "./footer.module.css";

async function Year() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function Footer() {
  return (
    <footer className="page" data-site-footer>
      <div className={s.footer}>
        <p>
          © <Year /> {site.fullName}
        </p>
        <Link href="/feed.xml" className={s.link}>
          RSS
        </Link>
      </div>
    </footer>
  );
}
