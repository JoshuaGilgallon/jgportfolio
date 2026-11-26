# Portfolio

A small fast personal site with a private `/admin` for managing projects,
writing, publications and contact links.

- **Next.js 16**
- **SQLite via libsql + Drizzle**
- **Auth.js**

## Getting started

```bash
npm install
cp .env.example .env        # then fill it in (see below)
npm run hash-password       # prints ADMIN_PASSWORD_HASH=… for .env
openssl rand -base64 32     # use as AUTH_SECRET
npm run dev                 # migrations run automatically
```

Open <http://localhost:3000/admin> and sign in.

`npm run db:seed` fills an empty database with demo content so you can
see the design. None of it is actually real: delete it from the `/admin` dashboard, or delete
`data/portfolio.db` to start clean.

## Environment

| Variable              | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `ADMIN_USERNAME`      | The one admin username.                                     |
| `ADMIN_PASSWORD_HASH` | scrypt hash from `npm run hash-password` (don't use plaintext). |
| `AUTH_SECRET`         | Signs the session cookie. 32+ random bytes.                 |
| `DATABASE_URL`        | `file:./data/portfolio.db` locally, `libsql://…` in prod.   |
| `DATABASE_AUTH_TOKEN` | Only for remote libsql/Turso.                               |
| `SITE_URL`            | Public origin   |

## Security

- Passwords are stored as a salted scrypt hash.
- Sign-in is rate limited (although globally, so if youre getting hacked/bruteforced you won't be able to login)
- Sessions are signed HTTP-only JWT cookies that expire after 8 hours.
- `proxy.ts` redirects signed-out visitors away from `/admin` and onto the main site.
- Input is validated with zod. URLs must be `https://` (or `mailto:` for
  links), and Markdown is rendered without using HTML.

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

I will publish something about this on my website soon and then put the link here.
