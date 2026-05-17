def render_event_backtest_report(result: dict) -> str:
    lines = ["# 事件回测报告", ""]
    lines.append(f"- 样本数：{len(result.get('events', []))}")
    lines.append(f"- 跳过事件：{len(result.get('failures', []))}")
    lines.append("")
    lines.append("| 信号 | 样本数 | 20日胜率 | 20日中位数收益 |")
    lines.append("|---|---:|---:|---:|")
    for row in result.get("summary", []):
        lines.append(
            f"| {row['signal_name']} | {row['sample_count']} | "
            f"{row['win_rate_20d']:.1%} | {row['median_ret_20d']:.2%} |"
        )
    return "\n".join(lines)


def _fmt_pct(value: float | int | None) -> str:
    return f"{value:.2%}" if isinstance(value, (int, float)) else "-"


def _fmt_money(value: float | int | None) -> str:
    return f"{value:,.0f}" if isinstance(value, (int, float)) else "-"


def _fmt_number(value: float | int | None) -> str:
    return f"{value:.2f}" if isinstance(value, (int, float)) else "-"


def render_portfolio_backtest_report(result: dict) -> str:
    metrics = result.get("metrics", {})
    distribution = result.get("return_distribution", {})
    diagnostics = result.get("risk_diagnostics", {})
    lifecycle = result.get("position_lifecycle", [])
    attribution = result.get("trade_attribution", [])
    benchmark_curve = result.get("benchmark_curve", [])

    lines = ["# 组合回测报告", ""]
    lines.append("## 核心指标")
    lines.append("")
    lines.append(f"- 策略版本：{result.get('strategy_version', '-')}")
    lines.append(f"- 初始资金：{_fmt_money(metrics.get('initial_cash'))}")
    lines.append(f"- 最终权益：{_fmt_money(metrics.get('final_equity'))}")
    lines.append(f"- 总收益：{_fmt_pct(metrics.get('total_return'))}")
    lines.append(f"- 基准收益：{_fmt_pct(metrics.get('benchmark_total_return'))}")
    lines.append(f"- 超额收益：{_fmt_pct(metrics.get('excess_return'))}")
    lines.append(f"- 最大回撤：{_fmt_pct(metrics.get('max_drawdown'))}")
    lines.append(f"- 胜率：{_fmt_pct(metrics.get('win_rate'))}")
    lines.append(
        "- Sharpe / Sortino / Calmar："
        f"{_fmt_number(metrics.get('sharpe'))} / "
        f"{_fmt_number(metrics.get('sortino'))} / "
        f"{_fmt_number(metrics.get('calmar'))}"
    )
    lines.append("")

    lines.append("## 回测完整性检查")
    lines.append("")
    lines.append(f"- 基准：{metrics.get('benchmark_symbol', '-')}，覆盖率 {_fmt_pct(metrics.get('benchmark_coverage'))}，状态 {diagnostics.get('benchmark_status', '-')}")
    lines.append(f"- 权益点：{len(result.get('equity_curve', []))}，基准点：{len(benchmark_curve)}")
    lines.append(f"- 交易日志：{len(result.get('trades', []))} 条，完整持仓：{len(lifecycle)} 笔")
    lines.append(f"- 资金占用峰值：{_fmt_pct(diagnostics.get('exposure_peak_pct'))}")
    lines.append(f"- 成本/最终权益：{_fmt_pct(diagnostics.get('cost_to_equity_pct'))}")
    lines.append(f"- 最长回撤持续：{diagnostics.get('longest_drawdown_points', 0)} 个权益点")
    lines.append("")

    lines.append("## 收益分布")
    lines.append("")
    lines.append(f"- 样本：{distribution.get('total_count', 0)} 笔，盈利 {distribution.get('win_count', 0)} 笔，亏损 {distribution.get('loss_count', 0)} 笔")
    lines.append(f"- 平均收益：{_fmt_pct(distribution.get('average_return'))}，中位收益：{_fmt_pct(distribution.get('median_return'))}")
    lines.append(f"- 最好/最差：{_fmt_pct(distribution.get('best_return'))} / {_fmt_pct(distribution.get('worst_return'))}")
    lines.append("")
    lines.append("| 区间 | 数量 |")
    lines.append("|---|---:|")
    for bucket in distribution.get("buckets", []):
        lines.append(f"| {bucket.get('label', '-')} | {bucket.get('count', 0)} |")
    lines.append("")

    lines.append("## 交易归因")
    lines.append("")
    lines.append("| 标的 | 市场 | 笔数 | 胜率 | 净贡献 | 平均收益 |")
    lines.append("|---|---|---:|---:|---:|---:|")
    for row in attribution[:20]:
        lines.append(
            f"| {row.get('symbol', '-')} | {row.get('market', '-')} | "
            f"{row.get('trade_count', 0)} | {_fmt_pct(row.get('win_rate'))} | "
            f"{_fmt_money(row.get('net_pnl'))} | {_fmt_pct(row.get('avg_return'))} |"
        )
    if not attribution:
        lines.append("| - | - | 0 | - | - | - |")
    lines.append("")

    lines.append("## 风险提示")
    lines.append("")
    lines.append("- 本报告基于本地历史数据、T+1 开盘撮合、成本模型、停牌/涨跌停/低流动性过滤生成。")
    lines.append("- 回测结果不代表真实可成交价格，不构成投资建议。")
    return "\n".join(lines)
