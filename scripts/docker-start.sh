#!/bin/sh
# Container start: migrate, prerender from the live database, then serve.
set -e
node_modules/.bin/tsx scripts/migrate.ts
node_modules/.bin/next build --experimental-build-mode generate
exec node_modules/.bin/next start
