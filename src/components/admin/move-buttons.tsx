import { moveEntry } from "@/lib/admin/actions";
import type { ContentType } from "@/lib/admin/config";
import s from "./admin.module.css";

function Arrow({ up }: { up?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={up ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

export function MoveButtons({ type, id, first, last }: { type: ContentType; id: number; first: boolean; last: boolean }) {
  return (
    <div className={s.move}>
      <form action={moveEntry.bind(null, type, id, "up")}>
        <button type="submit" className={s.moveButton} disabled={first} aria-label="Move up">
          <Arrow up />
        </button>
      </form>
      <form action={moveEntry.bind(null, type, id, "down")}>
        <button type="submit" className={s.moveButton} disabled={last} aria-label="Move down">
          <Arrow />
        </button>
      </form>
    </div>
  );
}
