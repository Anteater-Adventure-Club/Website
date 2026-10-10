FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7
RUN apt-get update && apt-get install --no-install-recommends -y python3-venv && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt /tmp/aac-fixture-requirements.txt
RUN python3 -m venv /opt/aac-fixture-python && /opt/aac-fixture-python/bin/pip install --no-cache-dir -r /tmp/aac-fixture-requirements.txt
ENV E2E_PYTHON=/opt/aac-fixture-python/bin/python
WORKDIR /work/frontend
