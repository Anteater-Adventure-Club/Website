FROM python:3.12.14-slim-bookworm@sha256:1aaa65a85fda306ffb8b910824d4e93bdce61e212c7e87168123ea3073b41a1a
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/backend
WORKDIR /app/backend
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home aac
COPY backend/ ./
COPY deploy/start-api.py /app/deploy/start-api.py
COPY deploy/healthcheck.py /app/deploy/healthcheck.py
RUN mkdir -p /app/media && chown aac:aac /app/media
ARG SOURCE_COMMIT=development
ENV RELEASE_SHA=$SOURCE_COMMIT
USER aac
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=3 CMD python /app/deploy/healthcheck.py
CMD ["python", "/app/deploy/start-api.py"]
