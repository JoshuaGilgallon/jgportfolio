import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProject } from "@/lib/content";
import { splitTags } from "@/lib/format";
import a from "@/app/(site)/article.module.css";
import { ArrowUpRight } from "./icons";
import { Markdown } from "./markdown";

// shared by the modal and the full page
export async function ProjectDetail({ slug, inModal = false }: { slug: Promise<string>; inModal?: boolean }) {
  const project = await getProject(await slug);
  if (!project) notFound();

  const tags = splitTags(project.tags);
  const Heading = inModal ? "h2" : "h1";

  return (
    <article>
      <header>
        <Heading id="project-title" className={`${a.title} ${inModal ? a.flush : ""}`}>
          {project.title}
        </Heading>
        {project.summary && <p className={a.summary}>{project.summary}</p>}
        {(project.year || tags.length > 0) && (
          <p className={a.meta}>
            {project.year && <span>{project.year}</span>}
            {tags.length > 0 && <span>{tags.join(", ")}</span>}
          </p>
        )}
        {(project.url || project.repoUrl) && (
          <div className={a.actions}>
            {project.url && (
              <a href={project.url} className={`${a.button} ${a.primary}`}>
                Visit <ArrowUpRight />
              </a>
            )}
            {project.repoUrl && (
              <a href={project.repoUrl} className={a.button}>
                Source <ArrowUpRight />
              </a>
            )}
          </div>
        )}
      </header>
      {project.body.trim() && (
        <div className={a.body}>
          {/* body streams in after the header */}
          <Suspense fallback={<div className={a.bodyPending} />}>
            <Markdown>{project.body}</Markdown>
          </Suspense>
        </div>
      )}
    </article>
  );
}
