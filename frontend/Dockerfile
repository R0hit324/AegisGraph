# AegisGraph frontend image — Phase 1 foundation.
# Stage 1: reproducible build from lockfile. Stage 2: unprivileged nginx serving
# the static SPA with a healthcheck; the API is reached directly at the
# configured VITE_API_BASE_URL (public value only — never build-time secrets).

FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first (cached layer).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# NOTE (SECURITY): VITE_* values are compiled into public browser JS. Only
# non-secret values may be passed here.
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx-unprivileged runs as UID 101 (non-root) and listens on 8080.
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
