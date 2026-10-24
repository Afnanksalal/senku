FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
WORKDIR /editor
COPY services/molecule-editor/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY services/molecule-editor/health.cjs ./
USER node
CMD ["node", "health.cjs"]
