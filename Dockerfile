FROM node:26-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Only compiles. Pages are prerendered from the database, which can't be
# reached during an image build, so that step happens at container start.
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node_modules/.bin/next build --experimental-build-mode compile \
  && rm -rf .next/cache \
  && mv .next .next-compiled

FROM base AS run
ENV NODE_ENV=production
# The full node_modules is kept: startup needs tsx to run migrations.
COPY --from=build --chown=node:node /app ./
# Startup recreates .next here.
RUN chown node:node /app
USER node
EXPOSE 3000
CMD ["sh", "scripts/docker-start.sh"]
