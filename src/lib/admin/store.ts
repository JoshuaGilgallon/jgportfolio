import "server-only";
import { asc, desc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { isoDate, slugify } from "@/lib/format";
import type { ContentType, EntryValues } from "./config";

// no auth checks here, callers must do it

export const tables = {
  posts: schema.posts,
  projects: schema.projects,
  publications: schema.publications,
  links: schema.links,
};

const text = (maxLength: number) => z.string().trim().max(maxLength, `Keep this under ${maxLength} characters.`);
const required = (maxLength: number) => text(maxLength).min(1, "This field is required.");
const webUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Use a full URL starting with https://");
const linkUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^(https?:\/\/|mailto:)[^\s]+$/i.test(v), "Use a URL starting with https:// or mailto:");
const slug = z
  .string()
  .trim()
  .max(80)
  .refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "Lowercase letters, numbers and dashes only.");
const flag = z.string().optional().transform((v) => v === "on");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
  .transform((v) => new Date(`${v}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Pick a valid date.");

const validators = {
  posts: z.object({
    title: required(200),
    slug,
    date,
    summary: text(400),
    body: text(200_000),
    published: flag,
  }),
  projects: z.object({
    title: required(200),
    slug,
    year: text(20),
    summary: text(400),
    tags: text(200),
    url: webUrl,
    repoUrl: webUrl,
    body: text(200_000),
    published: flag,
  }),
  publications: z.object({
    title: required(300),
    authors: text(400),
    venue: text(200),
    year: text(20),
    url: webUrl,
    published: flag,
  }),
  links: z.object({
    kind: z.enum(["email", "github", "discord", "linkedin", "x", "website"]),
    label: required(40),
    value: required(200),
    href: linkUrl,
    published: flag,
  }),
} satisfies Record<ContentType, z.ZodType>;

export type ParsedEntry<T extends ContentType> = z.output<(typeof validators)[T]>;

export function parseEntry<T extends ContentType>(type: T, formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData) if (typeof value === "string") raw[key] = value;
  const result = validators[type].safeParse(raw);
  if (result.success) {
    const data = result.data as Record<string, unknown>;
    if ("slug" in data && !data.slug) data.slug = slugify(String(data.title)) || `untitled-${Date.now()}`;
    return { data: data as ParsedEntry<T> };
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    fieldErrors[key] ??= issue.message;
  }
  return { fieldErrors };
}

export async function listEntries(type: ContentType) {
  const table = tables[type];
  if (type === "posts") {
    return db.select().from(schema.posts).orderBy(desc(schema.posts.date), desc(schema.posts.id));
  }
  const ordered = table as typeof schema.projects | typeof schema.publications | typeof schema.links;
  return db.select().from(ordered).orderBy(asc(ordered.position), desc(ordered.id));
}

export async function getEntry(type: ContentType, id: number) {
  const table = tables[type];
  const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  return row ?? null;
}

export async function nextPosition(type: Exclude<ContentType, "posts">) {
  const table = tables[type];
  const [row] = await db.select({ value: max(table.position) }).from(table);
  return (row?.value ?? -1) + 1;
}

export function toFormValues(row: Record<string, unknown>): EntryValues {
  const values: EntryValues = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) values[key] = isoDate(value);
    else if (typeof value === "boolean") values[key] = value;
    else if (value != null) values[key] = String(value);
  }
  return values;
}

export function defaultValues(type: ContentType): EntryValues {
  switch (type) {
    case "posts":
      return { date: isoDate(new Date()), published: false };
    case "links":
      return { kind: "website", published: true };
    default:
      return { published: false };
  }
}
