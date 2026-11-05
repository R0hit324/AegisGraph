# AegisGraph backend image — Phase 1 foundation.
# Reproducible install from pinned requirements; non-root runtime user;
# healthcheck against the liveness endpoint (no curl needed in the image).

FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies first (cached layer).
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy only what the running application needs (tests and dev tooling excluded
# via .dockerignore).
COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app

# Non-root runtime user (UID 10001, no shell, no home files).
RUN adduser --disabled-password --gecos "" --uid 10001 aegis
USER 10001

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/live', timeout=3).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
