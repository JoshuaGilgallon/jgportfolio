import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectDetail } from "@/components/project-detail";
import { TextLink } from "@/components/text-link";
import { getProject, getProjects } from "@/lib/content";
import a from "../../article.module.css";

// full page version, for direct visits and refreshes

const PLACEHOLDER = "__none__";

export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.length ? projects.map((p) => ({ slug: p.slug })) : [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const project = await getProject((await params).slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.summary || undefined,
    alternates: { canonical: `/projects/${project.slug}` },
  };
}

export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <>
      <div className={a.header}>
        <span className={a.back}>
          <TextLink href="/#projects" back>
            Projects
          </TextLink>
        </span>
      </div>
      <Suspense fallback={<div className={a.pending} />}>
        <ProjectDetail slug={params.then((p) => p.slug)} />
      </Suspense>
    </>
  );
}
