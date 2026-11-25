"use server";

import { asc, desc, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { contentTypeKeys, type ContentType, type SaveState } from "./config";
import { nextPosition, parseEntry, tables } from "./store";

/*
 * Every action re-checks the session before touching anything: Server
 * Actions are public POST endpoints, and bound arguments come back from the
 * client, so `type` and `id` are validated here too.
 */

const typeSchema = z.enum(contentTypeKeys as [ContentType, ...ContentType[]]);
const idSchema = z.number().int().positive();

function isUniqueViolation(error: unknown) {
  const text = String((error as { cause?: unknown })?.cause ?? error);
  return text.includes("UNIQUE constraint failed");
}

export async function saveEntry(
  rawType: ContentType,
  rawId: number | null,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  await requireAdmin();
  const type = typeSchema.parse(rawType);
  const id = rawId === null ? null : idSchema.parse(rawId);

  const parsed = parseEntry(type, formData);
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors, error: "Check the highlighted fields." };

  const table = tables[type];
  let newId: number | null = null;
  try {
    if (id === null) {
      const values =
        type === "posts" ? parsed.data : { ...parsed.data, position: await nextPosition(type) };
      const [row] = await db
        .insert(table)
        .values(values as typeof table.$inferInsert)
        .returning({ id: table.id });
      newId = row.id;
    } else {
      const result = await db
        .update(table)
        .set({ ...(parsed.data as object), updatedAt: new Date() })
        .where(eq(table.id, id))
        .returning({ id: table.id });
      if (result.length === 0) return { error: "This entry no longer exists." };
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { fieldErrors: { slug: "Another entry already uses this slug." }, error: "Check the highlighted fields." };
    }
    console.error("[admin] save failed", error);
    return { error: "Couldn’t save. Try again." };
  }

  updateTag(type);
  if (newId !== null) redirect(`/admin/${type}/${newId}`);
  return { ok: true, savedAt: Date.now() };
}

export async function deleteEntry(rawType: ContentType, rawId: number) {
  await requireAdmin();
  const type = typeSchema.parse(rawType);
  const id = idSchema.parse(rawId);
  const table = tables[type];
  await db.delete(table).where(eq(table.id, id));
  updateTag(type);
  redirect(`/admin/${type}`);
}

export async function moveEntry(rawType: ContentType, rawId: number, direction: "up" | "down") {
  await requireAdmin();
  const type = typeSchema.exclude(["posts"]).parse(rawType);
  const id = idSchema.parse(rawId);
  z.enum(["up", "down"]).parse(direction);

  const table = tables[type];
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .orderBy(asc(table.position), desc(table.id));

  const index = rows.findIndex((r) => r.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= rows.length) return;

  [rows[index], rows[target]] = [rows[target], rows[index]];
  await db.transaction(async (tx) => {
    for (const [position, row] of rows.entries()) {
      await tx.update(table).set({ position }).where(eq(table.id, row.id));
    }
  });
  updateTag(type);
}
