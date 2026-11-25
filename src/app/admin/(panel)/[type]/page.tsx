import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MoveButtons } from "@/components/admin/move-buttons";
import { contentTypes, isContentType } from "@/lib/admin/config";
import { listEntries } from "@/lib/admin/store";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import s from "@/components/admin/admin.module.css";

// Private and per-request: blocking on the session and database is intended.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/admin/[type]">): Promise<Metadata> {
  const { type } = await params;
  return { title: isContentType(type) ? contentTypes[type].label : "Not found" };
}

export default async function ListPage({ params }: PageProps<"/admin/[type]">) {
  await requireAdmin();
  const { type } = await params;
  if (!isContentType(type)) notFound();

  const config = contentTypes[type];
  const rows = (await listEntries(type)) as Array<{
    id: number;
    title?: string;
    label?: string;
    value?: string;
    published: boolean;
    date?: Date;
    year?: string;
    venue?: string;
  }>;

  return (
    <main>
      <div className={s.head}>
        <h1 className={s.title}>{config.label}</h1>
        <Link href={`/admin/${type}/new`} className={s.primary}>
          New {config.singular}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className={`${s.empty} sq`}>
          <p>No {config.label.toLowerCase()} yet.</p>
        </div>
      ) : (
        <ul className={`${s.list} sq`}>
          {rows.map((row, i) => {
            const title = row.title ?? row.label ?? "Untitled";
            const detail =
              type === "posts" && row.date
                ? formatDate(row.date)
                : type === "links"
                  ? row.value
                  : [row.venue, row.year].filter(Boolean).join(" · ");
            return (
              <li key={row.id} className={s.item}>
                <Link href={`/admin/${type}/${row.id}`} className={s.row}>
                  <span className={s.rowTitle}>{title}</span>
                  {!row.published && <span className={`${s.badge} sq`}>{type === "links" ? "Hidden" : "Draft"}</span>}
                  {detail && <span className={s.rowMeta}>{detail}</span>}
                </Link>
                {config.ordered && (
                  <MoveButtons type={type} id={row.id} first={i === 0} last={i === rows.length - 1} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
