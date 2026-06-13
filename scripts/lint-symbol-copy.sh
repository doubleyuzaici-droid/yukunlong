#!/usr/bin/env bash
# Symbol Workspace V2 — 文案 lint
# 禁止内部工程语言泄露到用户可见的字符串里。
# 对应 docs/plans/2026-05-23-symbol-workspace-v2-copy-review.md §1
#
# 兼容 BSD grep（macOS 默认）。
# 例外：含 // copy-lint:ignore 注释的行 + .test. 文件

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RANGE="$REPO_ROOT/TradingAgents/frontend/src/pages/symbol"

if [ ! -d "$RANGE" ]; then
  echo "⚠  $RANGE 不存在，跳过 lint"
  exit 0
fi

# 每个 pattern 是单独的简单 ERE
patterns_file="$(mktemp)"
cat > "$patterns_file" <<'PATTERNS'
BE-[0-9]+|工程内部 ticket 编号
/api/[A-Za-z_-]+|REST 路径
extend /[A-Za-z]|英文 API 改造说明
\bakshare\b|第三方库名 (akshare)
\btushare\b|第三方库名 (tushare)
\byfinance\b|第三方库名 (yfinance)
ETA Phase|内部 Phase 排期
ETA 20[0-9][0-9]-Q|年度内部排期
纯函数|工程师视角术语
PATTERNS

VIOLATIONS=()

while IFS= read -r file; do
  [[ "$file" == *.test.* ]] && continue
  rel="${file#$REPO_ROOT/}"
  while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    pattern="${entry%%|*}"
    explain="${entry#*|}"
    # 单 pattern 扫描，BSD ERE
    hits="$(grep -nE "$pattern" "$file" 2>/dev/null || true)"
    [ -z "$hits" ] && continue
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      # 行号 / 行内容
      lineno="${line%%:*}"
      rest="${line#*:}"
      # 跳过包含豁免注释的行
      if echo "$rest" | grep -q 'copy-lint:ignore'; then
        continue
      fi
      # 跳过纯 import 与单行注释
      trimmed="$(echo "$rest" | sed -e 's/^[[:space:]]*//')"
      case "$trimmed" in
        import*|"//"*|"*"*|"/*"*) continue ;;
      esac
      VIOLATIONS+=("$rel:$lineno  [$explain]")
      VIOLATIONS+=("    $trimmed")
    done <<< "$hits"
  done < "$patterns_file"
done < <(find "$RANGE" -type f -name "*.tsx" -o -name "*.ts")

rm -f "$patterns_file"

if [ "${#VIOLATIONS[@]}" -gt 0 ]; then
  echo "❌ 发现 $((${#VIOLATIONS[@]} / 2)) 处疑似工程语言泄露："
  echo ""
  printf '%s\n' "${VIOLATIONS[@]}"
  echo ""
  echo "如果是合理用法（注释 / A-B 切换提示），请在该行末尾加 // copy-lint:ignore"
  exit 1
fi

echo "✅ symbol workspace V2 文案 lint 通过"
