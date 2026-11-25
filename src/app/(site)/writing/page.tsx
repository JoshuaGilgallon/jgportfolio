import type { Metadata } from "next";
import { List, Row } from "@/components/list";
import { TextLink } from "@/components/text-link";
import { getPosts } from "@/lib/content";
import { formatDate } from "@/lib/format";
import a from "../article.module.css";
import s from "./writing.module.css";

export const metadata: Metadata = {
  title: "Writing",
  description: "Notes on cloud architecture, low-level systems, and design.",
};

export default async function WritingPage() {
  const posts = await getPosts();

  // Grouped by year, newest first, like a photo library.
  const years = new Map<number, typeof posts>();
  for (const post of posts) {
    const year = post.date.getUTCFullYear();
    years.set(year, [...(years.get(year) ?? []), post]);
  }

  return (
    <>
      <header className={a.header}>
        <span className={a.back}>
          <TextLink href="/" back>
            Home
          </TextLink>
        </span>
        <h1 className={a.title}>Writing</h1>
        <p className={a.summary}>Notes on cloud architecture, low-level systems, and design.</p>
      </header>

      {posts.length === 0 ? (
        <p className={s.empty}>Nothing here yet.</p>
      ) : (
        [...years].map(([year, items]) => (
          <section key={year} className={s.year} aria-labelledby={`y${year}`}>
            <h2 id={`y${year}`} className={s.yearTitle}>
              {year}
            </h2>
            <List>
              {items.map((post) => (
                <Row
                  key={post.slug}
                  href={`/writing/${post.slug}`}
                  title={post.title}
                  subtitle={post.summary}
                  meta={<time dateTime={post.date.toISOString()}>{formatDate(post.date).replace(/ \d{4}$/, "")}</time>}
                />
              ))}
            </List>
          </section>
        ))
      )}
    </>
  );
}
