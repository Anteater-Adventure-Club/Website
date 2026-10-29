#!/usr/bin/env bash
# Start only a disposable integration-test database; never reset an existing container.
set -euo pipefail
cd "$(dirname "$0")/.."
database="${1:?Pass aac_test or aac_browser}"
case "$database" in aac_test|aac_browser) ;; *) echo "Use a disposable test database" >&2; exit 1 ;; esac
engine="${AAC_CONTAINER_ENGINE:-docker}"
name="${AAC_TEST_POSTGRES_NAME:-aac-ci-postgres}"
port="${AAC_TEST_POSTGRES_PORT:-55432}"
"$engine" build -f deploy/postgres-tests.Dockerfile -t aac-postgres:test .
"$engine" run --detach --name "$name" \
  -e POSTGRES_USER=aac -e POSTGRES_PASSWORD=aac -e POSTGRES_DB="$database" \
  -p "127.0.0.1:$port:5432" \
  --health-cmd "pg_isready -h 127.0.0.1 -U aac -d $database" \
  --health-interval 5s --health-timeout 5s --health-retries 10 aac-postgres:test
# The temporary setup server accepts Unix-socket connections before TCP is ready.
for ((attempt=0; attempt<60; attempt++)); do
  if "$engine" exec "$name" pg_isready -h 127.0.0.1 -U aac -d "$database"; then exit 0; fi
  sleep 1
done
"$engine" logs "$name"
exit 1
