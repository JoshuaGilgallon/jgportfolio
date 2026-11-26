import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import s from "./reveal.module.css";

export type RevealTier = "title" | "lead" | "body";

// key words start a touch late, less than a step so reading order holds
const HOLD = 0.6;

// marks words to land with more weight, renders nothing itself
export function Key({ children }: { children: ReactNode }) {
  return children;
}

type Props = {
  children: ReactNode;
  tier: RevealTier;
  // ms before the first word
  at: number;
  // ms between words
  step: number;
};

// splits text into words that blur into focus one after another.
// css only, so it plays from the first paint, spaces stay real text
export function Reveal({ children, tier, at, step }: Props) {
  let i = 0;
  let last = at;

  const word = (text: string, key: boolean, n: number) => {
    // stray punctuation, like a full stop after an <em>, rides with the word before
    const delay = /^\p{P}+$/u.test(text) ? last : (last = at + step * (i++ + (key ? HOLD : 0)));
    return (
      <span
        key={n}
        className={s.word}
        data-reveal={tier}
        data-key={key ? "" : undefined}
        style={{ "--d": `${Math.round(delay)}ms` } as CSSProperties}
      >
        {text}
      </span>
    );
  };

  const walk = (node: ReactNode, key: boolean): ReactNode =>
    Children.map(node, (child) => {
      if (typeof child === "string") {
        return child.split(/(\s+)/).map((part, n) => (part.trim() ? word(part, key, n) : part));
      }
      if (!isValidElement<{ children?: ReactNode }>(child)) return child;
      if (child.type === Key) return walk(child.props.children, true);
      const marks = child.type === "em" || child.type === "strong";
      return cloneElement(child as ReactElement<{ children?: ReactNode }>, undefined, walk(child.props.children, key || marks));
    });

  return walk(children, false);
}
