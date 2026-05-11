def classify_failure_reason(row: dict) -> str:
    if row.get("fail_reason"):
        return row["fail_reason"]
    if row.get("max_adverse_20d", 0) < -0.08:
        return "large_adverse_move"
    if row.get("ret_20d", 0) < 0:
        return "negative_20d_return"
    return "not_failed"
