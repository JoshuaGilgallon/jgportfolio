import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryForm } from "@/components/admin/entry-form";
import { saveEntry } from "@/lib/admin/actions";
import { contentTypes, isContentType } from "@/lib/admin/config";
import { defaultValues } from "@/lib/admin/store";
import { requireAdmin } from "@/lib/session";

// Private and per-request: blocking on the session and database is intended.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/admin/[type]/new">): Promise<Metadata> {
  const { type } = await params;
  return { title: isContentType(type) ? `New ${contentTypes[type].singular}` : "Not found" };
}

export default async function NewEntryPage({ params }: PageProps<"/admin/[type]/new">) {
  await requireAdmin();
  const { type } = await params;
  if (!isContentType(type)) notFound();

  return <EntryForm type={type} values={defaultValues(type)} action={saveEntry.bind(null, type, null)} />;
}
