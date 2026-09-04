# syntax=docker/dockerfile:1

# ---------- build ----------
FROM oven/bun:1.4-slim AS build
WORKDIR /app

# Install dependencies from the lockfile first so it stays cached.
COPY package.json bun.lock tsconfig.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/mcp/package.json ./packages/mcp/package.json
RUN bun install --frozen-lockfile

COPY packages ./packages
COPY apps ./apps
COPY migrations ./migrations
COPY scripts ./scripts

# Release builds stamp the shared product version without committing to main.
ARG APP_VERSION
RUN if [ -n "$APP_VERSION" ]; then bun scripts/set-build-version.ts "$APP_VERSION"; fi

RUN cd apps/web && bun run build

# ---------- runtime ----------
FROM oven/bun:1.4-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/data/architecture.db \
    MIGRATIONS_DIR=/app/migrations \
    AUTH_MODE=none \
    MCP_READ_ONLY=false \
    SEED_EXAMPLE=true

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY LICENSE ./LICENSE
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data && chown -R bun:bun /data /app

USER bun
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT??8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "apps/server/src/index.ts"]
