#!/usr/bin/env bash
# Symbol Workspace V2 — token 作用域 lint
# 仅检查 pages/symbol/** 域内是否出现裸 hex 颜色（除 tokens.css 之外）
# 对应 bridge §7

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RANGES=(
  "TradingAgents/frontend/src/pages/symbol"
  "TradingAgents/frontend/src/api/symbol-workspace"
  "TradingAgents/frontend/src/types/symbol-workspace.ts"
)
EXCLUDE_PATTERNS=(
  "tokens.css"
  ".test."
)

VIOLATIONS=()

for range in "${RANGES[@]}"; do
  path="$REPO_ROOT/$range"
  [ -e "$path" ] || continue
  while IFS= read -r line; do
    skip=0
    for ex in "${EXCLUDE_PATTERNS[@]}"; do
      if echo "$line" | grep -q "$ex"; then
        skip=1
        break
      fi
    done
    [ "$skip" -eq 1 ] && continue
    VIOLATIONS+=("$line")
  done < <(grep -rnE '#[0-9A-Fa-f]{3,8}' "$path" 2>/dev/null || true)
done

if [ "${#VIOLATIONS[@]}" -gt 0 ]; then
  echo "❌ 发现 ${#VIOLATIONS[@]} 处 hex 颜色裸写（应使用 tokens.css 定义的 CSS variables）:"
  printf '%s\n' "${VIOLATIONS[@]}"
  exit 1
fi

echo "✅ symbol workspace V2 域内 hex 颜色检查通过"
