def render_optimizer_report(summary: list[dict]) -> str:
    lines = ["# 策略调优诊断", "", "| 信号 | 样本数 | 20日胜率 | 20日平均收益 |"]
    lines.append("|---|---:|---:|---:|")
    for row in summary:
        lines.append(
            f"| {row['signal_name']} | {row['sample_count']} | "
            f"{row['win_rate_20d']:.1%} | {row['mean_ret_20d']:.2%} |"
        )
    return "\n".join(lines)
