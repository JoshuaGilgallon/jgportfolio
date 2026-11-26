// home sections that have content
export function homeSections(count: { projects: number; posts: number; links: number }) {
  return [
    count.projects > 0 && { id: "projects", label: "Projects" },
    count.posts > 0 && { id: "writing", label: "Writing" },
    count.links > 0 && { id: "contact", label: "Contact" },
  ].filter(Boolean) as { id: string; label: string }[];
}
