# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/update-server/web ./apps/update-server/web
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @bbplayer/update-server-web
RUN pnpm --filter @bbplayer/update-server-web build

FROM nginx:alpine AS runtime
COPY apps/update-server/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/update-server/web/dist /usr/share/nginx/html
