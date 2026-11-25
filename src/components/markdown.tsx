import rehypeShiki from "@shikijs/rehype";
import { cacheLife } from "next/cache";
import { MarkdownAsync } from "react-markdown";
import remarkGfm from "remark-gfm";
import s from "./prose.module.css";

/**
 * Renders trusted-author Markdown on the server. Raw HTML is never enabled
 * (react-markdown escapes it), and code is highlighted at build time, so the
 * page ships no client JavaScript for it.
 */
export async function Markdown({ children }: { children: string }) {
  // Cached by content: highlighting runs once per distinct body, and the
  // highlighter's internal timing calls stay out of prerendering.
  "use cache";
  cacheLife("content");
  return (
    <div className={s.prose}>
      <MarkdownAsync
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [
            rehypeShiki,
            {
              theme: "github-light",
              lazy: true,
              fallbackLanguage: "text",
              defaultLanguage: "text",
            },
          ],
        ]}
        components={{
          img: ({ src, alt = "", node, ...props }) => (
            // Authors link images by URL; dimensions are unknown, so a plain lazy <img>.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={typeof src === "string" ? src : undefined} alt={alt} loading="lazy" decoding="async" className="sq" {...props} />
          ),
          pre: ({ node, className, ...props }) => <pre className={`${className ?? ""} sq`} {...props} />,
        }}
      >
        {children}
      </MarkdownAsync>
    </div>
  );
}
