"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import prose from "../prose.module.css";

/** Client-side preview. Same Markdown pipeline as the site, minus syntax colours. */
export function Preview({ markdown }: { markdown: string }) {
  return (
    <div className={prose.prose}>
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </div>
  );
}
