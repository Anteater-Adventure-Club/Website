FROM node:22.23.1-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ARG SOURCE_COMMIT=development
RUN npm run build && node -e "require('fs').writeFileSync('dist/version.json',JSON.stringify({release_sha:process.argv[1]}))" "$SOURCE_COMMIT"
FROM docker.io/nginxinc/nginx-unprivileged:1.28.0-alpine@sha256:a6bd0e0995ab4723fb65068665f8016decb67dc6a6a32eddc415c7d1229cada6
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
