FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS base
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/experiment-schema/package.json packages/experiment-schema/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .

FROM base AS web-build
ARG SENKU_SITE_URL=http://localhost:3000
ENV SENKU_SITE_URL=$SENKU_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV SENKU_API_INTERNAL_URL=http://api:3001
RUN npm run build -w @senku/experiment-schema && npm run build -w @senku/web

FROM base AS api-build
RUN npm run build -w @senku/experiment-schema && npm run build -w @senku/api

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS web
WORKDIR /workspace
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=web-build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /workspace/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS api-dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/experiment-schema/package.json packages/experiment-schema/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace @senku/api --workspace @senku/experiment-schema --include-workspace-root=false --no-audit --no-fund

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS api
WORKDIR /workspace
ENV NODE_ENV=production PORT=3001
COPY --from=api-dependencies --chown=node:node /workspace/node_modules ./node_modules
COPY --from=api-build --chown=node:node /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=api-build --chown=node:node /workspace/apps/api/dist ./apps/api/dist
COPY --from=api-build --chown=node:node /workspace/packages/experiment-schema/package.json ./packages/experiment-schema/package.json
COPY --from=api-build --chown=node:node /workspace/packages/experiment-schema/dist ./packages/experiment-schema/dist
COPY --chown=node:node scripts/*.cjs ./scripts/
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
