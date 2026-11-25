/**
 * Applies pending migrations. Runs automatically before `dev` and `build`,
 * so the tables always exist when Next.js prerenders pages.
 */
import { mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL ?? "file:./data/portfolio.db";
if (url.startsWith("file:")) mkdirSync("data", { recursive: true });

async function main() {
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  client.close();
  console.log("✓ Database is up to date");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
