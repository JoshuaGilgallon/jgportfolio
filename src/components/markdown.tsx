import rehypeShiki from "@shikijs/rehype";
import { cacheLife } from "next/cache";
import { MarkdownAsync } from "react-markdown";
import remarkGfm from "remark-gfm";
import s from "./prose.module.css";

// raw html stays disabled
export async function Markdown({ children }: { children: string }) {
  // cached so highlighting only runs once per body
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
            // unknown dimensions, so plain img
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
