# Josh — portfolio

A small, fast personal site with a private `/admin` for managing projects,
writing, publications and contact links.

- **Next.js 16** (App Router, Cache Components). Public pages are prerendered
  and cached; every admin change calls `updateTag`, so the site stays static
  until the moment something changes.
- **SQLite via libsql + Drizzle**. A local file in development; any libsql
  URL (e.g. Turso) in production.
- **Auth.js** credentials provider with a single admin defined in `.env`.

## Getting started

```bash
npm install
cp .env.example .env        # then fill it in (see below)
npm run hash-password       # prints ADMIN_PASSWORD_HASH=… for .env
openssl rand -base64 32     # use as AUTH_SECRET
npm run dev                 # migrations run automatically
```

Open <http://localhost:3000/admin> and sign in.

`npm run db:seed` fills an **empty** database with demo content so you can
see the design. None of it is real: delete it from `/admin`, or remove
`data/portfolio.db` to start clean.

## Environment

| Variable              | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `ADMIN_USERNAME`      | The one admin username.                                     |
| `ADMIN_PASSWORD_HASH` | scrypt hash from `npm run hash-password` (never plaintext). |
| `AUTH_SECRET`         | Signs the session cookie. 32+ random bytes.                 |
| `DATABASE_URL`        | `file:./data/portfolio.db` locally, `libsql://…` in prod.   |
| `DATABASE_AUTH_TOKEN` | Only for remote libsql/Turso.                               |
| `SITE_URL`            | Public origin, for canonical URLs, sitemap, RSS and HSTS.   |

## Security

- Passwords are stored as a salted scrypt hash. Username and password are
  compared in constant time, and the hash is always computed so timing
  doesn't reveal which part was wrong.
- Sign-in is rate limited: 5 attempts per IP and 30 in total per 15 minutes,
  held in memory, so it only counts within one server process. The IP comes
  from `X-Forwarded-For`, so run behind a proxy that overwrites that header.
  A determined attacker could otherwise rotate it, and could use the global
  cap to keep you locked out for 15 minutes.
- Sessions are signed, HTTP-only JWT cookies that expire after 8 hours.
- `proxy.ts` redirects signed-out visitors away from `/admin`. Every admin
  page **and every Server Action** checks the session again on its own, so
  the proxy is never the only guard.
- Input is validated with zod. URLs must be `https://` (or `mailto:` for
  links), and Markdown is rendered without raw HTML.
- Security headers: CSP, `frame-ancestors 'none'`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, and HSTS when `SITE_URL` is HTTPS.
- `/admin` is `noindex` and disallowed in `robots.txt`.

## Deploying

The site needs a Node server (`npm run build && npm start`) and a database
that persists. On a VPS or container, the default SQLite file works if
`data/` is on a persistent volume. On serverless hosts (e.g. Vercel), use
Turso: set `DATABASE_URL=libsql://…` and `DATABASE_AUTH_TOKEN`.
Migrations run before every build.

Edits from `/admin` appear immediately. Next.js keeps tag invalidations in
memory, though, so a page nobody has opened since an edit could show the old
version after a restart. Every page refreshes in the background every 10
minutes (the `content` profile in `next.config.ts`), which caps that.

## Design notes

- One 680px column in light mode, with Apple's system colours and type scale
  set in Instrument Sans (self-hosted via `next/font`).
- **Project pane.** Clicking a project card makes the card fly out of the
  grid and morph into a centred pane over a frosted (Gaussian-blurred) page;
  closing morphs it back into its slot. It uses an intercepted route
  (`src/app/(site)/@modal`) and the native `<dialog>`. The URL changes, so
  the link is shareable, Back closes it, and a refresh shows the full
  `/projects/[slug]` page. On touch screens you can also pull the pane down
  to dismiss it, as with an iOS sheet. It has its own overlay scrollbar
  (`src/components/scrollbar.tsx`): a slim pill that shows while
  scrolling, widens to be dragged with a mouse, and stays out of the way of
  swipes. Everywhere else, scrollbars are thin and quiet.
- **Touch.** Hover effects only apply on devices that can hover, so they
  don't stick after a tap; presses get the same highlight instead.
- **Motion.** Animations use Apple's own springs, ported from the Liquid
  Glass research library. `src/lib/morph.ts` is AnimationKit's liquid
  morph, stepped every frame: grow 0.8/0.3, shrink 0.9/0.3, content blurs
  out 0.8/0.45 and blurs in 1.0/0.3 after 30 ms, plus a kick spring, all at
  0.7× speed. Set `PIVOT` in `src/components/modal.tsx` for the slower
  J-path "flying" variant. The other transitions use `--spring` and
  `--spring-smooth` in `globals.css`. These are the same springs sampled
  into CSS `linear()` curves; regenerate them with
  `npx tsx scripts/springs.ts`. With reduced motion turned on, the pane
  appears and closes without moving.
- **Squircles.** Every rounded surface uses the `.sq` utility with a
  nominal radius `--r`. In browsers that support `corner-shape` it draws
  `superellipse(1.7)` over 1.53× the radius, which lands on Apple's own
  continuous-corner curve (checked against the iOS bezier path). Elsewhere
  it falls back to a circular radius `r`. Icon tiles use Apple's 22.37%
  corner ratio.
