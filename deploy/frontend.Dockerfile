FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
RUN apk upgrade --no-cache && npm install --global npm@11.21.1 --no-audit --no-fund
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
COPY assets/static-asset-versions.json /build/assets/static-asset-versions.json
COPY scripts/prepare-static-assets.mjs /build/scripts/prepare-static-assets.mjs
COPY backend/tests/fixtures/person-search.json /build/backend/tests/fixtures/person-search.json
ARG SOURCE_COMMIT=development
RUN npm run build && node -e "require('fs').writeFileSync('dist/version.json',JSON.stringify({release_sha:process.argv[1]}))" "$SOURCE_COMMIT"
FROM docker.io/nginxinc/nginx-unprivileged:1.30.6-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
USER root
# Docker initializes a new named volume with this directory's ownership.
RUN apk upgrade --no-cache && apk add --no-cache python3 && mkdir -p /var/lib/aac/assets && chown -R 101:101 /var/lib/aac
USER 101:101
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/aac-security-headers.conf
COPY --chmod=755 deploy/publish-assets.sh /docker-entrypoint.d/40-publish-assets.sh
COPY deploy/asset-store.py /opt/aac/asset-store.py
COPY --chmod=755 deploy/retain-assets.sh /docker-entrypoint.d/45-retain-assets.sh
COPY --from=build /build/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD python3 /opt/aac/asset-store.py health && wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
