def render_optimizer_report(
    summary: list[dict],
    failures: list[dict] | None = None,
    ablation_steps: list[str] | None = None,
) -> str:
    lines = ["# 策略调优诊断", "", "| 信号 | 样本数 | 20日胜率 | 20日平均收益 |"]
    lines.append("|---|---:|---:|---:|")
    for row in summary:
        lines.append(
            f"| {row['signal_name']} | {row['sample_count']} | "
            f"{row['win_rate_20d']:.1%} | {row['mean_ret_20d']:.2%} |"
        )
    if failures is not None:
        lines.extend(["", "## 失败归因", "", "| 原因 | 样本数 |", "|---|---:|"])
        for row in failures:
            lines.append(f"| {row['fail_reason']} | {row['sample_count']} |")
    if ablation_steps is not None:
        lines.extend(["", "## 消融检查", ""])
        for step in ablation_steps:
            lines.append(f"- {step}")
    return "\n".join(lines)
