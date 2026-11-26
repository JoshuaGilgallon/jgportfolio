import Link from "next/link";
import type { Project } from "@/lib/db/schema";
import { splitTags } from "@/lib/format";
import s from "./project-card.module.css";

// opens the modal, scroll={false} keeps the page in place
export function ProjectCard({ project }: { project: Project }) {
  const tags = splitTags(project.tags);

  return (
    <Link href={`/projects/${project.slug}`} scroll={false} prefetch className={`${s.card} sq`} data-morph-source>
      {project.year && <span className={s.year}>{project.year}</span>}
      <h3 className={s.title}>{project.title}</h3>
      {project.summary && <p className={s.summary}>{project.summary}</p>}
      <div className={s.foot}>
        <p className={s.tags}>{tags.join(" · ")}</p>
        <span className={s.plus} aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path d="M12 6.5v11M6.5 12h11" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

export function ProjectGrid({ children }: { children: React.ReactNode }) {
  return <div className={s.grid}>{children}</div>;
}
