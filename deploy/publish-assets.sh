#!/bin/sh
set -eu
python3 "${AAC_ASSET_MANAGER:-/opt/aac/asset-store.py}" publish
