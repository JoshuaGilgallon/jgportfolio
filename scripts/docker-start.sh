#!/bin/sh
set -e
node_modules/.bin/tsx scripts/migrate.ts
# start from a clean compile so old cached pages don't stick around
rm -rf .next
cp -a .next-compiled .next
node_modules/.bin/next build --experimental-build-mode generate
exec node_modules/.bin/next start
