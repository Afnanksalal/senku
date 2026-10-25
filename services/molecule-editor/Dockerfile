FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
WORKDIR /editor
COPY services/molecule-editor/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY services/molecule-editor/src ./src
COPY services/molecule-editor/build.cjs ./
RUN node build.cjs
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
WORKDIR /editor
COPY --from=build --chown=node:node /editor/dist ./dist
COPY --chown=node:node services/molecule-editor/health.cjs ./
USER node
EXPOSE 8080
CMD ["node","health.cjs"]
