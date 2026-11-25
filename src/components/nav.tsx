import Link from "next/link";
import { getLinks, getPosts, getProjects } from "@/lib/content";
import s from "./nav.module.css";

export async function Nav() {
  const [projects, posts, links] = await Promise.all([getProjects(), getPosts(), getLinks()]);
  const items = [
    projects.length > 0 && { href: "/#projects", label: "Projects" },
    posts.length > 0 && { href: "/#writing", label: "Writing" },
    links.length > 0 && { href: "/#contact", label: "Contact" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <header className={s.bar}>
      <div className={`page ${s.inner}`}>
        <Link href="/" className={s.name}>
          Josh
        </Link>
        {items.length > 0 && (
          <nav aria-label="Primary">
            <ul className={s.links}>
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={s.link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
