import type { MetadataRoute } from "next";
import { getPosts, getProjects } from "@/lib/content";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, projects] = await Promise.all([getPosts(), getProjects()]);
  return [
    { url: site.url, priority: 1 },
    ...(posts.length ? [{ url: `${site.url}/writing`, lastModified: posts[0].updatedAt }] : []),
    ...posts.map((p) => ({ url: `${site.url}/writing/${p.slug}`, lastModified: p.updatedAt })),
    ...projects.map((p) => ({ url: `${site.url}/projects/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
