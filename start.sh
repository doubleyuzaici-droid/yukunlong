#!/bin/bash
# TradingAgents 启动脚本 - 同时启动 FastAPI 后端和 React 前端
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TRADINGAGENTS_DIR="$SCRIPT_DIR/TradingAgents"

echo "======================================"
echo " TradingAgents - Web 原型启动"
echo "======================================"

# 1. 后端环境
echo ""
echo "[1/3] 设置 Python 后端环境..."
cd "$TRADINGAGENTS_DIR"

if [ ! -d ".venv" ]; then
  echo "   创建 venv (Python 3.12)..."
  uv venv --python python3.12
fi

echo "   安装依赖..."
uv pip install -e ".[china]" fastapi uvicorn sse-starlette 2>/dev/null

# 2. 前端依赖
echo ""
echo "[2/3] 安装前端依赖..."
cd "$TRADINGAGENTS_DIR/frontend"
npm install --silent 2>/dev/null || true

# 3. 启动服务
echo ""
echo "[3/3] 启动服务..."
echo "   后端 API: http://localhost:8100"
echo "   API 文档: http://localhost:8100/docs"
echo "   前端页面: http://localhost:5173"
echo ""

cd "$TRADINGAGENTS_DIR"

TRADINGAGENTS_DATA="${TRADINGAGENTS_DIR}/local_data"
export TRADINGAGENTS_RESULTS_DIR="${TRADINGAGENTS_DATA}/logs"
export TRADINGAGENTS_CACHE_DIR="${TRADINGAGENTS_DATA}/cache"
export TRADINGAGENTS_MEMORY_LOG_PATH="${TRADINGAGENTS_DATA}/memory/trading_memory.md"
mkdir -p "${TRADINGAGENTS_DATA}"/{logs,cache,memory}

.venv/bin/python -m uvicorn tradingagents.api.server:app --host 0.0.0.0 --port 8100 --reload &
BACKEND_PID=$!

cd "$TRADINGAGENTS_DIR/frontend"
npx vite --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
