import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { TextLink } from "@/components/text-link";
import { getPost, getPosts } from "@/lib/content";
import { formatLongDate, readingTime } from "@/lib/format";
import a from "../../article.module.css";

// Cache Components needs at least one param to validate the route at build
// time; an empty site uses a placeholder that resolves to a 404.
const PLACEHOLDER = "__none__";

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.length ? posts.map((p) => ({ slug: p.slug })) : [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({ params }: PageProps<"/writing/[slug]">): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary || undefined,
    alternates: { canonical: `/writing/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary || undefined,
      publishedTime: post.date.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
    },
  };
}

export default function PostPage({ params }: PageProps<"/writing/[slug]">) {
  return (
    <>
      <div className={a.header}>
        <span className={a.back}>
          <TextLink href="/writing" back>
            Writing
          </TextLink>
        </span>
      </div>
      <Suspense fallback={<div className={a.pending} />}>
        <Post slug={params.then((p) => p.slug)} />
      </Suspense>
    </>
  );
}

async function Post({ slug }: { slug: Promise<string> }) {
  const post = await getPost(await slug);
  if (!post) notFound();

  return (
    <article>
      <header>
        <h1 className={a.title}>{post.title}</h1>
        {post.summary && <p className={a.summary}>{post.summary}</p>}
        <p className={a.meta}>
          <time dateTime={post.date.toISOString()}>{formatLongDate(post.date)}</time>
          <span>{readingTime(post.body)} min read</span>
        </p>
      </header>
      <div className={a.body}>
        <Markdown>{post.body}</Markdown>
      </div>
    </article>
  );
}
