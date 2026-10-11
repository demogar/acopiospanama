# Construir desde la raíz del repositorio: docker build -f apps/api/Dockerfile .
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api --include-workspace-root --no-audit --no-fund
COPY apps/api apps/api
RUN npm run build --workspace apps/api

# Solo dependencias de producción, a partir de lo ya instalado (sin una segunda descarga).
FROM build AS deps
RUN npm prune --omit=dev --workspace apps/api --include-workspace-root --no-audit --no-fund && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime
# Versión visible en /api/health: «1.2.3+abc1234». CI la pasa como build-arg.
ARG APP_VERSION=dev
ENV NODE_ENV=production APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=deps --chown=1000:1000 /app/node_modules ./node_modules
COPY --from=deps --chown=1000:1000 /app/package.json ./package.json
COPY --from=build --chown=1000:1000 /app/apps/api/dist ./apps/api/dist
COPY --chown=1000:1000 apps/api/package.json ./apps/api/package.json
COPY --chown=1000:1000 apps/api/migrations ./apps/api/migrations
WORKDIR /app/apps/api
USER 1000:1000
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
# Aplica migraciones pendientes (con candado) y arranca.
CMD ["sh", "-c", "node dist/cli/cli.js migrate && exec node dist/main.js"]
