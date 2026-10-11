# Construir desde la raíz del repositorio: docker build -f apps/web/Dockerfile .
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# La web reenvía /api a este destino interno (red de Docker). Se fija en tiempo de construcción.
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
# Versión que muestra el pie de página («1.2.3+abc1234»). CI la pasa como build-arg.
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web --include-workspace-root --no-audit --no-fund
COPY apps/web apps/web
RUN npm run build --workspace apps/web

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=1000:1000 /app/apps/web/.next/standalone ./
COPY --from=build --chown=1000:1000 /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=1000:1000 /app/apps/web/public ./apps/web/public
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/como-funciona').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
