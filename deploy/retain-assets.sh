#!/bin/sh
set -eu
rm -f /tmp/aac-assets-ready /tmp/aac-asset-retention.json
# A supervisor clears HTTP readiness even if the retention worker is killed.
(
    python3 /opt/aac/asset-store.py watch || true
    rm -f /tmp/aac-assets-ready
) &

# Nginx starts only after publication and the first heartbeat have succeeded.
attempt=0
until python3 /opt/aac/asset-store.py health 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 10 ]; then
        echo "Asset retention worker did not start" >&2
        exit 1
    fi
    sleep 1
done
