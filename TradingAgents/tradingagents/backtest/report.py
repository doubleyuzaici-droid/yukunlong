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
