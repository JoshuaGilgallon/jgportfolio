export const linkKinds = {
  email: { label: "Email" },
  github: { label: "GitHub" },
  discord: { label: "Discord" },
  linkedin: { label: "LinkedIn" },
  x: { label: "X" },
  website: { label: "Website" },
} as const;

export type LinkKind = keyof typeof linkKinds;

export const isLinkKind = (k: string): k is LinkKind => k in linkKinds;

// email gets mailto:, no url means copy
export function resolveLinkHref(kind: string, value: string, href: string) {
  if (href) return href;
  if (kind === "email" && value) return `mailto:${value}`;
  return "";
}
