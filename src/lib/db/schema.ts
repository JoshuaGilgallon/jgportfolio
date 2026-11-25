import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  body: text("body").notNull().default(""),
  date: integer("date", { mode: "timestamp" }).notNull(),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  body: text("body").notNull().default(""),
  year: text("year").notNull().default(""),
  tags: text("tags").notNull().default(""),
  url: text("url").notNull().default(""),
  repoUrl: text("repo_url").notNull().default(""),
  position: integer("position").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const publications = sqliteTable("publications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  authors: text("authors").notNull().default(""),
  venue: text("venue").notNull().default(""),
  year: text("year").notNull().default(""),
  url: text("url").notNull().default(""),
  position: integer("position").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const links = sqliteTable("links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull().default("website"),
  label: text("label").notNull(),
  value: text("value").notNull().default(""),
  href: text("href").notNull().default(""),
  position: integer("position").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export type Post = typeof posts.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Publication = typeof publications.$inferSelect;
export type Link = typeof links.$inferSelect;
