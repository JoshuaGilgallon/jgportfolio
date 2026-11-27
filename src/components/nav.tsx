import Link from "next/link";
import { getLinks, getPosts, getProjects } from "@/lib/content";
import { homeSections } from "@/lib/sections";
import s from "./nav.module.css";
import { ScrollEdge } from "./scroll-edge";

export async function Nav() {
  const [projects, posts, links] = await Promise.all([getProjects(), getPosts(), getLinks()]);
  const items = homeSections({ projects: projects.length, posts: posts.length, links: links.length });

  return (
    <header className={s.bar} data-site-nav>
      <ScrollEdge />
      <div className={`page ${s.inner}`}>
        <Link href="/" className={s.name}>
          Josh
        </Link>
        {items.length > 0 && (
          <nav aria-label="Primary">
            <ul className={s.links}>
              {items.map((item) => (
                <li key={item.id}>
                  <Link href={`/#${item.id}`} className={s.link}>
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
