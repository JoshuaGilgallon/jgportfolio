import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema } from "@/lib/db";

/**
 * Public, read-only content. Every read is cached and tagged; admin Server
 * Actions call `updateTag(<tag>)` after each change, so edits appear at once
 * while pages stay static. The "content" profile (next.config.ts) also
 * refreshes in the background every 10 minutes as a safety net.
 */

export const tags = {
  posts: "posts",
  projects: "projects",
  publications: "publications",
  links: "links",
} as const;

export async function getPosts() {
  "use cache";
  cacheLife("content");
  cacheTag(tags.posts);
  return db
    .select({
      slug: schema.posts.slug,
      title: schema.posts.title,
      summary: schema.posts.summary,
      date: schema.posts.date,
      updatedAt: schema.posts.updatedAt,
    })
    .from(schema.posts)
    .where(eq(schema.posts.published, true))
    .orderBy(desc(schema.posts.date), desc(schema.posts.id));
}

export async function getPost(slug: string) {
  "use cache";
  cacheLife("content");
  cacheTag(tags.posts);
  const [post] = await db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.slug, slug), eq(schema.posts.published, true)))
    .limit(1);
  return post ?? null;
}

export async function getProjects() {
  "use cache";
  cacheLife("content");
  cacheTag(tags.projects);
  return db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.published, true))
    .orderBy(asc(schema.projects.position), desc(schema.projects.id));
}

export async function getProject(slug: string) {
  "use cache";
  cacheLife("content");
  cacheTag(tags.projects);
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.slug, slug), eq(schema.projects.published, true)))
    .limit(1);
  return project ?? null;
}

export async function getPublications() {
  "use cache";
  cacheLife("content");
  cacheTag(tags.publications);
  return db
    .select()
    .from(schema.publications)
    .where(eq(schema.publications.published, true))
    .orderBy(asc(schema.publications.position), desc(schema.publications.id));
}

export async function getLinks() {
  "use cache";
  cacheLife("content");
  cacheTag(tags.links);
  return db
    .select()
    .from(schema.links)
    .where(eq(schema.links.published, true))
    .orderBy(asc(schema.links.position), asc(schema.links.id));
}
