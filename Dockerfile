FROM oven/bun:1 AS base
WORKDIR /app

# ── 构建 ──
FROM base AS builder

COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/db/package.json ./packages/db/
COPY apps/server/package.json ./apps/server/
COPY apps/ui/package.json ./apps/ui/

RUN bun install

COPY packages/shared/src ./packages/shared/src
COPY packages/core/src ./packages/core/src
COPY packages/sdk/src ./packages/sdk/src
COPY packages/db/src ./packages/db/src
COPY apps/server/src ./apps/server/src
COPY apps/ui ./apps/ui

COPY packages/shared/vite.config.ts ./packages/shared/
RUN cd packages/shared && bun run build
RUN cd apps/ui && bun run build

# ── 运行 ──
FROM oven/bun:1 AS runner
WORKDIR /app

COPY package.json ./package.json
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY apps/server/package.json ./apps/server/

RUN bun install --production

COPY packages/shared/src ./packages/shared/src
COPY packages/core/src ./packages/core/src
COPY packages/db/src ./packages/db/src
COPY apps/server/src ./apps/server/src
# `@xartifact/x-tinker-shared` resolves through its `main`/`exports` field, which
# point at `dist/index.js` — not `src/`. Copying only the source tree left the
# module unresolvable at runtime ("Cannot find module
# '@xartifact/x-tinker-shared'") and the container crash-looped. core/db are
# unaffected because their `main` is `src/index.ts`.
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/ui/dist ./apps/ui/dist

ENV PORT=3200
ENV NODE_ENV=production
ENV UI_DIST_PATH=/app/apps/ui/dist

EXPOSE 3200

CMD ["bun", "apps/server/src/index.ts"]