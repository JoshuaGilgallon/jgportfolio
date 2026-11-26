"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import prose from "../prose.module.css";

// no syntax colours in the preview
export function Preview({ markdown }: { markdown: string }) {
  return (
    <div className={prose.prose}>
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </div>
  );
}
