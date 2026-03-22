FROM python:3.12-slim AS base

WORKDIR /app

# Install Poetry
RUN pip install --no-cache-dir poetry==1.8.2

# Copy dependency manifests first for layer caching
COPY pyproject.toml poetry.lock ./

# Install production deps directly into the system Python (no virtualenv in container)
RUN poetry config virtualenvs.create false \
    && poetry install --only main --no-root --no-interaction --no-ansi

# Copy application code and bundled migrations
COPY app/ ./app/
COPY migrations/ ./migrations/

# Artifacts mounted as a volume at runtime
RUN mkdir -p artifacts

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
