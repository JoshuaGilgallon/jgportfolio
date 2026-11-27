import s from "./scroll-edge.module.css";

// progressive blur for content passing under a bar. the parent sets --edge-h and
// needs its own stacking context, so this sits behind its content
export function ScrollEdge() {
  return (
    <div className={s.edge} aria-hidden>
      <div />
      <div />
      <div />
    </div>
  );
}
