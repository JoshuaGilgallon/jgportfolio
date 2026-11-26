import type { Link } from "@/lib/db/schema";
import { isLinkKind, resolveLinkHref, type LinkKind } from "@/lib/link-kinds";
import { CopyButton } from "./copy-button";
import { ArrowUpRight, DiscordGlyph, GitHubGlyph, GlobeGlyph, LinkedInGlyph, MailGlyph, XGlyph } from "./icons";
import s from "./contact-list.module.css";

const glyphs: Record<LinkKind, React.ComponentType<{ className?: string }>> = {
  email: MailGlyph,
  github: GitHubGlyph,
  discord: DiscordGlyph,
  linkedin: LinkedInGlyph,
  x: XGlyph,
  website: GlobeGlyph,
};

function Tile({ kind }: { kind: string }) {
  const k = isLinkKind(kind) ? kind : "website";
  const Glyph = glyphs[k];
  return (
    <span className={`${s.tile} sq`} data-kind={k} aria-hidden>
      <Glyph className={s.glyph} />
    </span>
  );
}

export function ContactList({ links }: { links: Link[] }) {
  return (
    <ul className={`${s.list} sq`}>
      {links.map((link) => {
        const href = resolveLinkHref(link.kind, link.value, link.href);
        const label = (
          <>
            <Tile kind={link.kind} />
            <span className={s.label}>{link.label}</span>
          </>
        );
        return (
          <li key={link.id} className={s.item}>
            {href ? (
              <a href={href} className={s.row}>
                {label}
                <span className={s.value}>{link.value}</span>
                <ArrowUpRight className={s.icon} />
              </a>
            ) : (
              <CopyButton
                value={link.value}
                className={s.row}
                valueClassName={s.value}
                iconClassName={s.icon}
              >
                {label}
                <span className="visually-hidden">, copy</span>
              </CopyButton>
            )}
          </li>
        );
      })}
    </ul>
  );
}
