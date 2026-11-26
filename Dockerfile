FROM node:26-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# compile only, the database isn't reachable here
# pages get prerendered at container start
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node_modules/.bin/next build --experimental-build-mode compile \
  && rm -rf .next/cache \
  && mv .next .next-compiled

FROM base AS run
ENV NODE_ENV=production
# startup needs tsx for migrations
COPY --from=build --chown=node:node /app ./
# startup recreates .next here
RUN chown node:node /app
USER node
EXPOSE 3000
CMD ["sh", "scripts/docker-start.sh"]
