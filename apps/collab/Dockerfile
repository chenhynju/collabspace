# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/collab/package.json apps/collab/
COPY packages packages
RUN pnpm install --frozen-lockfile --filter @collabspace/collab...
COPY apps/collab/src apps/collab/src
ENV NODE_ENV=production COLLAB_PORT=3002 COLLAB_HOST=0.0.0.0
USER node
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3002/health/ready >/dev/null || exit 1
WORKDIR /app/apps/collab
CMD ["node", "src/server.cjs"]
