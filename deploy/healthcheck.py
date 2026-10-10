"""Readiness probe shared by the image and Coolify, without shell commands."""
import os
import urllib.request

port = int(os.environ.get("PORT", "8000"))
with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health/ready", timeout=4) as response:
    if response.status != 200:
        raise SystemExit(1)
