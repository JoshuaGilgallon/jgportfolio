#!/bin/sh
# Container start: migrate, prerender from the live database, then serve.
set -e
node_modules/.bin/tsx scripts/migrate.ts
# Start from the untouched compile. A restarted container still holds the pages
# and data cached by its last run, which would be served instead of the database's.
rm -rf .next
cp -a .next-compiled .next
node_modules/.bin/next build --experimental-build-mode generate
exec node_modules/.bin/next start
