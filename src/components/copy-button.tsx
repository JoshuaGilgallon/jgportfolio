"use client";

import { useEffect, useRef, useState } from "react";
import { HapticTap } from "./haptic-tap";
import { Check, Copy } from "./icons";

export function CopyButton({
  value,
  className,
  valueClassName,
  iconClassName,
  children,
}: {
  value: string;
  className?: string;
  valueClassName?: string;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // no clipboard access, the text can still be selected
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {children}
      <span className={valueClassName} aria-live="polite">
        {copied ? "Copied" : value}
      </span>
      {copied ? <Check className={iconClassName} /> : <Copy className={iconClassName} />}
      <HapticTap />
    </button>
  );
}
