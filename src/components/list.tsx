import Link from "next/link";
import { ArrowUpRight } from "./icons";
import s from "./list.module.css";

/** An inset grouped list: one squircle, rows divided by inset hairlines. */
export function List({ children }: { children: React.ReactNode }) {
  return <ul className={`${s.list} sq`}>{children}</ul>;
}

export function Row({
  href,
  title,
  subtitle,
  meta,
}: {
  href?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  const external = !!href && /^https?:\/\//.test(href);
  const content = (
    <>
      <span className={s.text}>
        <span className={s.title}>
          {title}
          {external && (
            <>
              <ArrowUpRight className={s.external} />
              <span className="visually-hidden"> (external site)</span>
            </>
          )}
        </span>
        {subtitle && <span className={s.subtitle}>{subtitle}</span>}
      </span>
      {meta && <span className={s.meta}>{meta}</span>}
    </>
  );

  return (
    <li className={s.item}>
      {!href ? (
        <div className={s.row}>{content}</div>
      ) : external ? (
        <a href={href} className={s.row}>
          {content}
        </a>
      ) : (
        <Link href={href} className={s.row}>
          {content}
        </Link>
      )}
    </li>
  );
}
