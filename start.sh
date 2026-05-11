#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TRADINGAGENTS_DIR="$SCRIPT_DIR/TradingAgents"
DATA_DIR="$TRADINGAGENTS_DIR/local_data"
BACKEND_PORT=8100

find_free_port() {
  local port="$1"
  while lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1; do
    port=$((port + 1))
  done
  printf "%s\n" "$port"
}

echo "======================================"
echo " yukunlong / TradingAgents Web Prototype"
echo "======================================"

mkdir -p "$DATA_DIR"/{logs,cache,memory,db,reports}

export TRADINGAGENTS_RESULTS_DIR="$DATA_DIR/logs"
export TRADINGAGENTS_CACHE_DIR="$DATA_DIR/cache"
export TRADINGAGENTS_MEMORY_LOG_PATH="$DATA_DIR/memory/trading_memory.md"

cd "$TRADINGAGENTS_DIR"

if [ ! -d ".venv" ]; then
  echo "[1/4] Creating Python venv..."
  uv venv --python python3.12
fi

echo "[2/4] Installing backend dependencies..."
uv pip install -e ".[china]" fastapi uvicorn sse-starlette

echo "[3/4] Installing frontend dependencies..."
cd "$TRADINGAGENTS_DIR/frontend"
npm install

echo "[4/4] Starting services..."
if lsof -iTCP:"$BACKEND_PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  echo "Backend port $BACKEND_PORT is already in use. Stop that process or update the frontend proxy before retrying."
  exit 1
fi

FRONTEND_PORT="$(find_free_port "${FRONTEND_PORT:-5173}")"

cd "$TRADINGAGENTS_DIR"
.venv/bin/python -m uvicorn tradingagents.api.server:app \
  --host 0.0.0.0 \
  --port "$BACKEND_PORT" \
  --reload &
BACKEND_PID=$!

cd "$TRADINGAGENTS_DIR/frontend"
npx vite --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort &
FRONTEND_PID=$!

echo ""
echo "Backend API: http://localhost:$BACKEND_PORT"
echo "API Docs:    http://localhost:$BACKEND_PORT/docs"
echo "Frontend:    http://localhost:$FRONTEND_PORT"
echo ""
echo "Press Ctrl+C to stop all services."

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

wait
