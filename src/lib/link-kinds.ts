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

/** Email gets a mailto: automatically; a link with no URL becomes copy-to-clipboard. */
export function resolveLinkHref(kind: string, value: string, href: string) {
  if (href) return href;
  if (kind === "email" && value) return `mailto:${value}`;
  return "";
}
