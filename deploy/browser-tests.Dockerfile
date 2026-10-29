FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea
RUN apt-get update && apt-get upgrade -y \
    && apt-get install --no-install-recommends -y python3-venv && rm -rf /var/lib/apt/lists/* \
    && npm install --global npm@11.21.1 --no-audit --no-fund
COPY backend/requirements.txt /tmp/aac-fixture-requirements.txt
RUN python3 -m venv /opt/aac-fixture-python \
    && /opt/aac-fixture-python/bin/python -m pip install --no-cache-dir --upgrade pip==26.2.2 \
    && /opt/aac-fixture-python/bin/pip install --no-cache-dir -r /tmp/aac-fixture-requirements.txt
ENV E2E_PYTHON=/opt/aac-fixture-python/bin/python
WORKDIR /work/frontend
