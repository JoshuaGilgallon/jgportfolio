import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryForm } from "@/components/admin/entry-form";
import { deleteEntry, saveEntry } from "@/lib/admin/actions";
import { contentTypes, isContentType } from "@/lib/admin/config";
import { getEntry, toFormValues } from "@/lib/admin/store";
import { requireAdmin } from "@/lib/session";

// Private and per-request: blocking on the session and database is intended.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/admin/[type]/[id]">): Promise<Metadata> {
  const { type } = await params;
  return { title: isContentType(type) ? `Edit ${contentTypes[type].singular}` : "Not found" };
}

export default async function EditEntryPage({ params }: PageProps<"/admin/[type]/[id]">) {
  await requireAdmin();
  const { type, id: rawId } = await params;
  const id = Number(rawId);
  if (!isContentType(type) || !Number.isInteger(id) || id < 1) notFound();

  const entry = await getEntry(type, id);
  if (!entry) notFound();

  const values = toFormValues(entry);
  const publicHref =
    type === "posts" && entry.published
      ? `/writing/${values.slug}`
      : type === "projects" && entry.published
        ? `/projects/${values.slug}`
        : undefined;

  return (
    <EntryForm
      key={`${type}-${id}`}
      type={type}
      values={values}
      action={saveEntry.bind(null, type, id)}
      onDelete={deleteEntry.bind(null, type, id)}
      publicHref={publicHref}
    />
  );
}
