#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT/frontend"

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo ">> Installing dependencies..."
  npm install
fi

# Start Next.js dev server
echo ">> Starting frontend at http://localhost:3000"
echo ">> API proxy → http://localhost:8000/api/v1"
npm run dev
