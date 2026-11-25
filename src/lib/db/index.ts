import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as { libsql?: Client };

const client =
  globalForDb.libsql ??
  createClient({
    url: process.env.DATABASE_URL ?? "file:./data/portfolio.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

export const db = drizzle(client, { schema });
export { schema };
