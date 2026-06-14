#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Activate virtual environment
source venv/bin/activate

# Run any pending Alembic migrations
echo ">> Running database migrations..."
alembic upgrade head

# Start FastAPI dev server with hot-reload
echo ">> Starting backend at http://127.0.0.1:8000"
echo ">> Docs: http://127.0.0.1:8000/docs"
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
