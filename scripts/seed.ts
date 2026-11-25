/**
 * DEMO CONTENT ONLY. Fills an empty database with sample entries so the
 * design can be previewed. None of it is real: replace or delete every
 * entry from /admin before going live.
 *
 * Usage: npm run db:seed            (only runs on an empty database)
 *        npm run db:seed -- --reset (wipes all content first)
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/lib/db/schema";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./data/portfolio.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});
const db = drizzle(client, { schema });

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const samplePost = `Every allocator is a set of trade-offs you make on behalf of someone else's program. This one trades generality for predictability.

## The shape of the problem

Most objects in a hot path are the same size. Instead of asking a general-purpose allocator to rediscover that fact on every call, a slab keeps a free list per size class:

\`\`\`c
typedef struct slab {
    void *free;       /* singly linked list threaded through free objects */
    size_t size;      /* object size for this slab */
    struct slab *next;
} slab_t;

static inline void *slab_alloc(slab_t *s) {
    void *obj = s->free;
    if (obj) s->free = *(void **)obj;
    return obj;
}
\`\`\`

Allocation becomes a pointer swap. Freeing is the same in reverse.

## What it costs

- Memory is reserved per size class, so sparse workloads waste space.
- Objects can't grow in place.
- You now own fragmentation, which used to be someone else's problem.

> The fastest code is the code that doesn't run. The second fastest is the code that already knows the answer.

In practice the trade is worth it whenever allocation shows up in a profile, which is more often than you'd think.`;

async function main() {
  const reset = process.argv.includes("--reset");
  const existing = await db.select({ id: schema.posts.id }).from(schema.posts).limit(1);
  const existingProjects = await db.select({ id: schema.projects.id }).from(schema.projects).limit(1);
  if (!reset && (existing.length || existingProjects.length)) {
    console.log("Database already has content; nothing seeded. Pass --reset to replace it.");
    return;
  }
  if (reset) {
    for (const table of [schema.posts, schema.projects, schema.publications, schema.links]) await db.delete(table);
  }

  await db.insert(schema.projects).values([
    {
      slug: "slab",
      title: "Slab",
      summary: "A predictable, lock-free slab allocator for latency-sensitive services.",
      body: samplePost,
      year: "2025",
      tags: "C, Linux",
      repoUrl: "https://github.com/",
      position: 0,
      published: true,
    },
    {
      slug: "edge-cache",
      title: "Edge Cache",
      summary: "A multi-region caching layer that keeps p99 reads under ten milliseconds.",
      year: "2025",
      tags: "Go, AWS, Terraform",
      url: "https://example.com",
      position: 1,
      published: true,
    },
    {
      slug: "tracekit",
      title: "Tracekit",
      summary: "Tiny eBPF probes for watching syscalls in production without the overhead.",
      year: "2024",
      tags: "Rust, eBPF",
      repoUrl: "https://github.com/",
      position: 2,
      published: true,
    },
    {
      slug: "quiet",
      title: "Quiet",
      summary: "A calm, keyboard-first status page for small infrastructure teams.",
      year: "2024",
      tags: "TypeScript, Design",
      url: "https://example.com",
      position: 3,
      published: true,
    },
  ]);

  await db.insert(schema.posts).values([
    {
      slug: "a-slab-allocator-in-200-lines",
      title: "A slab allocator in 200 lines",
      summary: "Trading generality for predictability, one size class at a time.",
      body: samplePost,
      date: day("2025-10-14"),
      published: true,
    },
    {
      slug: "boring-infrastructure",
      title: "In praise of boring infrastructure",
      summary: "The best systems are the ones nobody has to think about at 3am.",
      body: "Boring is a feature. " + samplePost.split("\n\n")[0],
      date: day("2025-08-02"),
      published: true,
    },
    {
      slug: "design-is-how-it-works",
      title: "Design is how it works",
      summary: "Why I care about the parts of software nobody asked me to polish.",
      body: samplePost.split("\n\n")[0],
      date: day("2025-03-21"),
      published: true,
    },
  ]);

  await db.insert(schema.publications).values([
    {
      title: "Predictable Allocation for Latency-Critical Services",
      authors: "J. Gilgallon, A. Example",
      venue: "Sample Workshop",
      year: "2025",
      url: "https://example.com",
      position: 0,
      published: true,
    },
  ]);

  await db.insert(schema.links).values([
    { kind: "email", label: "Email", value: "hello@example.com", position: 0, published: true },
    { kind: "github", label: "GitHub", value: "your-handle", href: "https://github.com/", position: 1, published: true },
    { kind: "discord", label: "Discord", value: "your-handle", position: 2, published: true },
    { kind: "linkedin", label: "LinkedIn", value: "your-handle", href: "https://www.linkedin.com/", position: 3, published: true },
  ]);

  console.log("✓ Seeded demo content. Replace it from /admin before going live.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => client.close());
