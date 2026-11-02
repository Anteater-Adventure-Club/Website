FROM python:3.12.16-slim-bookworm@sha256:e697c81897302a4c4333bade000d98038fbb21eb064f8ee1fd42d02ebcd9d337 AS runtime
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* \
    && python -m pip install --no-cache-dir --upgrade pip==26.2.2
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/backend
WORKDIR /app/backend
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home aac
COPY backend/ ./
COPY frontend/public/fonts/Chivo-Regular.ttf frontend/public/fonts/Lazydog.otf /app/frontend/public/fonts/
COPY frontend/public/logos/aac.png /app/frontend/public/logos/aac.png
COPY frontend/public/images/about_sequoia.webp frontend/public/images/about_tide_pools.webp frontend/public/images/about_picnic_w3.webp /app/frontend/public/images/
COPY assets/static-asset-versions.json /app/assets/static-asset-versions.json
COPY deploy/start-api.py /app/deploy/start-api.py
COPY deploy/healthcheck.py /app/deploy/healthcheck.py
RUN mkdir -p /app/media && chown aac:aac /app/media
ARG SOURCE_COMMIT=development
ENV RELEASE_SHA=$SOURCE_COMMIT
USER aac

FROM runtime AS sheets-worker
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 CMD python -m app.workers.google_sheets --health
CMD ["python", "-m", "app.workers.google_sheets"]

FROM runtime AS api
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=3 CMD python /app/deploy/healthcheck.py
CMD ["python", "/app/deploy/start-api.py"]
