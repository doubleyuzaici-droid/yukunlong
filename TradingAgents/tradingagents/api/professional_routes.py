from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
import time
from collections import Counter, defaultdict
from datetime import date as dt_date, datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from tradingagents.api.schemas import ApiResponse
from tradingagents.dataflows.interface import route_to_vendor
from tradingagents.research.index_catalog import resolve_index_profile
from tradingagents.research.db import get_connection, init_db
from tradingagents.research.market_data import derive_index_factor_series, normalize_market_symbol
from tradingagents.research.repository import list_watchlist

router = APIRouter(prefix="/api/professional", tags=["professional"])


class ProfessionalSyncRequest(BaseModel):
    symbols: list[str] | None = None
    start: str | None = None
    end: str | None = None
    source: str = "auto"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _row(row: Any) -> dict | None:
    return dict(row) if row else None


def _rows(rows: list[Any]) -> list[dict]:
    return [dict(row) for row in rows]


def _default_start(end: str, days: int = 180) -> str:
    return (dt_date.fromisoformat(end) - timedelta(days=days)).isoformat()


def _sync_symbols(symbols: list[str] | None) -> list[str]:
    if symbols:
        return [normalize_market_symbol(symbol) for symbol in symbols if symbol.strip()]
    return [row["symbol"] for row in list_watchlist()]


def _record_sync_trace(
    *,
    job_type: str,
    start: str,
    end: str,
    symbol: str | None = None,
    primary_source: str | None = None,
    fallback_source: str | None = None,
    status: str = "success",
    rows_written: int = 0,
    elapsed_ms: int | None = None,
    error: str | None = None,
) -> None:
    init_db()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO sync_trace (
                trace_id, symbol, job_type, start, end, primary_source,
                fallback_source, status, rows_written, elapsed_ms, error, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                uuid4().hex,
                symbol,
                job_type,
                start,
                end,
                primary_source,
                fallback_source,
                status,
                rows_written,
                elapsed_ms,
                error[:500] if error else None,
                _now(),
            ),
        )
        conn.commit()


def _number_after(label: str, text: str) -> float | None:
    pattern = rf"\b{re.escape(label)}\s*[:=]\s*([-+]?\d+(?:\.\d+)?)"
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        return None
    value = float(match.group(1))
    return value if math.isfinite(value) else None


def _ratio_after(label: str, text: str) -> float | None:
    value = _number_after(label, text)
    if value is None:
        return None
    return value / 100 if abs(value) > 1 else value


def _normalize_report_date(value: str | None, fallback: str) -> str:
    text = str(value or "").strip()
    if not text:
        return fallback
    match = re.search(r"\d{4}[-/]?\d{2}[-/]?\d{2}", text)
    if not match:
        return fallback
    raw = match.group(0).replace("/", "-")
    if "-" not in raw and len(raw) == 8:
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
    return raw[:10]


def _safe_number(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if not text or text.lower() in {"none", "nan", "null", "-"}:
        return None
    try:
        parsed = float(text)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _metric_key(value: str) -> str:
    text = re.sub(r"[^A-Za-z0-9]+", "_", str(value or "").strip()).strip("_").lower()
    aliases = {
        "n_income": "net_income",
        "net_income_to_common": "net_income",
        "net_income_common_stockholders": "net_income",
        "total_revenue": "revenue",
        "grossprofit_margin": "gross_margin",
        "gross_profit_margin": "gross_margin",
        "total_liab": "total_liabilities",
        "total_liabilities_net_minority_interest": "total_liabilities",
        "total_hldr_eqy": "total_equity",
        "total_hldr_eqy_exc_min_int": "total_equity",
        "stockholders_equity": "total_equity",
        "n_cashflow_act": "operating_cashflow",
        "operating_cash_flow": "operating_cashflow",
        "total_cash_from_operating_activities": "operating_cashflow",
        "n_cashflow_inv_act": "investing_cashflow",
        "investing_cash_flow": "investing_cashflow",
        "n_cash_flows_fin_act": "financing_cashflow",
        "financing_cash_flow": "financing_cashflow",
        "free_cash_flow": "free_cashflow",
    }
    return aliases.get(text, text)


def _parse_key_value_statement(
    *,
    statement_type: str,
    text: str,
    symbol: str,
    fallback_date: str,
    source: str,
) -> list[dict]:
    pairs = re.findall(r"\b([A-Za-z][A-Za-z0-9_]*)\s*=\s*([-+]?\d+(?:\.\d+)?)", text)
    metrics = {
        _metric_key(key): value
        for key, raw_value in pairs
        if (value := _safe_number(raw_value)) is not None
    }
    if not metrics:
        return []
    date_match = re.search(r"as of\s+([0-9][0-9\-/]{7,9})", text, flags=re.IGNORECASE)
    return [
        {
            "date": _normalize_report_date(date_match.group(1) if date_match else None, fallback_date),
            "symbol": symbol,
            "statement_type": statement_type,
            "period": "latest",
            "metrics": metrics,
            "source": source,
            "raw_text": text[:4000],
            "updated_at": _now(),
        }
    ]


def _parse_csv_statement(
    *,
    statement_type: str,
    text: str,
    symbol: str,
    fallback_date: str,
    source: str,
) -> list[dict]:
    lines = [
        line
        for line in text.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if not lines or "," not in lines[0]:
        return []
    rows = list(csv.reader(io.StringIO("\n".join(lines))))
    if not rows or len(rows[0]) < 2:
        return []
    periods = rows[0][1:]
    parsed: list[dict] = []
    for index, period in enumerate(periods, start=1):
        metrics: dict[str, float] = {}
        for row in rows[1:]:
            if len(row) <= index:
                continue
            value = _safe_number(row[index])
            if value is None:
                continue
            key = _metric_key(row[0])
            if key:
                metrics[key] = value
        if metrics:
            parsed.append(
                {
                    "date": _normalize_report_date(period, fallback_date),
                    "symbol": symbol,
                    "statement_type": statement_type,
                    "period": "quarterly",
                    "metrics": metrics,
                    "source": source,
                    "raw_text": text[:4000],
                    "updated_at": _now(),
                }
            )
    return parsed


def _parse_financial_statement_rows(
    *,
    statement_type: str,
    text: str,
    symbol: str,
    fallback_date: str,
    source: str,
) -> list[dict]:
    if not text or re.search(r"\b(no|error)\b", text[:80], flags=re.IGNORECASE):
        return []
    rows = _parse_csv_statement(
        statement_type=statement_type,
        text=text,
        symbol=symbol,
        fallback_date=fallback_date,
        source=source,
    )
    if rows:
        return rows[:4]
    return _parse_key_value_statement(
        statement_type=statement_type,
        text=text,
        symbol=symbol,
        fallback_date=fallback_date,
        source=source,
    )


def _field_coverage(row: dict | None, columns: list[str]) -> float:
    if not row:
        return 0.0
    usable = [column for column in columns if row.get(column) is not None]
    return len(usable) / len(columns) if columns else 0.0


def _readiness_category(
    *,
    key: str,
    label: str,
    status: str,
    coverage: float,
    impact: str,
    evidence: list[str],
    next_step: str,
    target_view: str,
    metadata: dict | None = None,
) -> dict:
    return {
        "key": key,
        "label": label,
        "status": status,
        "coverage": max(0.0, min(1.0, coverage)),
        "impact": impact,
        "evidence": evidence,
        "next_step": next_step,
        "target_view": target_view,
        "metadata": metadata or {},
    }


def _analysis_level(score: float, blocker_count: int) -> str:
    if blocker_count:
        return "blocked"
    if score >= 0.8:
        return "ready"
    if score >= 0.25:
        return "partial"
    return "thin"


def _is_placeholder_news(row: dict) -> bool:
    text = " ".join(
        str(row.get(field) or "").strip().lower()
        for field in ("headline", "summary")
    )
    return "no news found" in text or "暂无新闻" in text


def _news_evidence_stats(symbol: str, end: str) -> dict:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT news_id, date, headline, source, summary
            FROM news_evidence
            WHERE symbol = ? AND date <= ?
            ORDER BY date DESC
            """,
            (symbol, end),
        ).fetchall()
    items = _rows(rows)
    valid_items = [item for item in items if not _is_placeholder_news(item)]
    return {
        "total_count": len(items),
        "valid_count": len(valid_items),
        "placeholder_count": len(items) - len(valid_items),
        "latest_date": items[0]["date"] if items else None,
        "source_count": len({item.get("source") for item in valid_items if item.get("source")}),
    }


def _build_analysis_readiness(symbol: str, date: str | None = None) -> dict:
    init_db()
    normalized = normalize_market_symbol(symbol)
    resolved_date = date or dt_date.today().isoformat()
    index_profile = resolve_index_profile(normalized)
    asset_type = "index" if index_profile else "equity"

    with get_connection() as conn:
        security_profile = conn.execute(
            "SELECT * FROM security_master WHERE symbol = ?",
            (normalized,),
        ).fetchone()
        watchlist_profile = conn.execute(
            "SELECT * FROM watchlist WHERE symbol = ?",
            (normalized,),
        ).fetchone()
        if index_profile:
            latest_bar = conn.execute(
                """
                SELECT *
                FROM index_bars
                WHERE index_symbol = ? AND date <= ?
                ORDER BY date DESC
                LIMIT 1
                """,
                (normalized, resolved_date),
            ).fetchone()
            bar_count = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM index_bars
                WHERE index_symbol = ? AND date <= ?
                """,
                (normalized, resolved_date),
            ).fetchone()
            factor_row = None
            fund_flow_count = {"count": 0, "latest_date": None}
        else:
            latest_bar = conn.execute(
                """
                SELECT *
                FROM daily_bars
                WHERE symbol = ? AND date <= ?
                ORDER BY date DESC
                LIMIT 1
                """,
                (normalized, resolved_date),
            ).fetchone()
            bar_count = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM daily_bars
                WHERE symbol = ? AND date <= ?
                """,
                (normalized, resolved_date),
            ).fetchone()
            factor_row = conn.execute(
                """
                SELECT *
                FROM factor_daily
                WHERE symbol = ? AND date <= ?
                ORDER BY date DESC
                LIMIT 1
                """,
                (normalized, resolved_date),
            ).fetchone()
            factor_count_row = conn.execute(
                """
                SELECT COUNT(*) AS count, MAX(date) AS latest_date
                FROM factor_daily
                WHERE symbol = ? AND date <= ?
                """,
                (normalized, resolved_date),
            ).fetchone()
            fund_flow_count = conn.execute(
                """
                SELECT COUNT(*) AS count, MAX(date) AS latest_date
                FROM fund_flow_daily
                WHERE symbol = ? AND date <= ?
                """,
                (normalized, resolved_date),
            ).fetchone()
        fundamental_row = conn.execute(
            """
            SELECT *
            FROM fundamental_snapshot
            WHERE symbol = ? AND date <= ?
            ORDER BY date DESC
            LIMIT 1
            """,
            (normalized, resolved_date),
        ).fetchone()
        financial_statement_stats = conn.execute(
            """
            SELECT COUNT(DISTINCT statement_type) AS type_count, MAX(date) AS latest_date
            FROM financial_statement
            WHERE symbol = ? AND date <= ?
            """,
            (normalized, resolved_date),
        ).fetchone()
        signals = conn.execute(
            """
            SELECT COUNT(*) AS count, MAX(date) AS latest_date
            FROM signal_log
            WHERE symbol = ? AND date <= ?
            """,
            (normalized, resolved_date),
        ).fetchone()
        reviews = conn.execute(
            """
            SELECT COUNT(*) AS count, MAX(created_at) AS latest_at
            FROM agent_decision_log
            WHERE symbol = ? AND date <= ?
            """,
            (normalized, resolved_date),
        ).fetchone()
        attributions = conn.execute(
            """
            SELECT COUNT(*) AS count, MAX(er.updated_at) AS latest_at
            FROM event_return er
            JOIN signal_log s ON s.signal_id = er.signal_id
            WHERE s.symbol = ? AND s.date <= ?
            """,
            (normalized, resolved_date),
        ).fetchone()

    security = _row(security_profile)
    watchlist = _row(watchlist_profile)
    latest_bar_dict = _row(latest_bar)
    factor = _row(factor_row)
    fundamental = _row(fundamental_row)
    financial_statement_type_count = int(financial_statement_stats["type_count"] or 0) if financial_statement_stats else 0
    financial_statement_latest_date = financial_statement_stats["latest_date"] if financial_statement_stats else None
    news_stats = _news_evidence_stats(normalized, resolved_date)
    signal_count = int(signals["count"] or 0) if signals else 0
    review_count = int(reviews["count"] or 0) if reviews else 0
    attribution_count = int(attributions["count"] or 0) if attributions else 0
    bar_total = int(bar_count["count"] or 0) if bar_count else 0
    fund_flow_total = int(fund_flow_count["count"] or 0) if fund_flow_count else 0

    categories = []
    security_coverage = (
        1.0 if index_profile else _field_coverage(
            security,
            ["symbol", "name", "market", "industry", "currency", "lot_size"],
        )
    )
    categories.append(
        _readiness_category(
            key="security_master",
            label="标的主数据",
            status="ready" if index_profile or security_coverage >= 0.6 else "warn",
            coverage=security_coverage,
            impact="影响名称、行业、币种、上市信息和交易单位识别",
            evidence=[
                f"security_master {'已覆盖' if security else '缺失'}",
                f"watchlist {watchlist.get('name') if watchlist else '未加入'}",
            ],
            next_step="补齐 security_master 的公司名称、行业、币种、每手股数和上市信息",
            target_view="symbolWorkspace",
            metadata={"watchlist": watchlist or {}, "security_master": security or {}},
        )
    )
    categories.append(
        _readiness_category(
            key="market_data",
            label="行情日线",
            status="ready" if latest_bar_dict else "blocker",
            coverage=_field_coverage(
                latest_bar_dict,
                ["open", "high", "low", "close", "volume", "amount", "source"],
            ),
            impact="行情缺失时 K 线、收益、信号和回测都不可用",
            evidence=[
                f"{'index_bars' if index_profile else 'daily_bars'} {bar_total} 行",
                f"最新 {latest_bar_dict.get('date') if latest_bar_dict else '-'}",
            ],
            next_step="同步历史行情和最新交易日数据",
            target_view="symbolWorkspace",
            metadata={"row_count": bar_total, "latest_date": latest_bar_dict.get("date") if latest_bar_dict else None},
        )
    )
    if index_profile:
        factor_snapshot, _, factor_rows = _index_factor_payload(normalized, resolved_date)
        factor = factor_snapshot
        factor_count = len(factor_rows)
    else:
        factor_count = int(factor_count_row["count"] or 0) if factor_count_row else 0
    categories.append(
        _readiness_category(
            key="technical_factors",
            label="技术因子",
            status="ready" if factor else "warn",
            coverage=_field_coverage(
                factor,
                ["ma20", "ma60", "rsi14", "ret20", "rel_strength_index20"],
            ),
            impact="影响趋势、动量、相对强弱和策略评分",
            evidence=[f"factor rows {factor_count}", f"最新 {factor.get('date') if factor else '-'}"],
            next_step="运行因子计算流水线",
            target_view="factorResearch",
            metadata={"row_count": factor_count},
        )
    )
    fundamental_coverage = max(
        _field_coverage(
            fundamental,
            ["revenue", "net_income", "roe", "pe_ttm", "pb", "source"],
        ),
        min(financial_statement_type_count / 3, 1.0),
    )
    fundamental_status = "not_applicable" if index_profile else ("ready" if fundamental_coverage > 0 else "warn")
    categories.append(
        _readiness_category(
            key="fundamentals",
            label="财报与估值",
            status="ready" if fundamental_status in {"ready", "not_applicable"} else "warn",
            coverage=1.0 if index_profile else fundamental_coverage,
            impact="影响三表、估值、盈利质量和业务判断",
            evidence=[
                "指数标的不适用个股三表" if index_profile else f"fundamental_snapshot {'已覆盖' if fundamental else '0 条'}",
                "指数标的不适用财报" if index_profile else f"financial_statement {financial_statement_type_count}/3 类",
                f"最新财报 {financial_statement_latest_date or '-'}",
            ],
            next_step="获取利润表、资产负债表、现金流和估值倍数",
            target_view="fundamentals",
            metadata={
                "status_detail": fundamental_status,
                "financial_statement_type_count": financial_statement_type_count,
                "financial_statement_latest_date": financial_statement_latest_date,
            },
        )
    )
    categories.append(
        _readiness_category(
            key="news_evidence",
            label="新闻证据",
            status="ready" if news_stats["valid_count"] else "warn",
            coverage=1.0 if news_stats["valid_count"] else 0.0,
            impact="影响新闻、舆情、催化和风险解释的可审计性",
            evidence=[
                f"新闻 {news_stats['total_count']} 条",
                f"有效证据 {news_stats['valid_count']} 条",
                f"占位 {news_stats['placeholder_count']} 条",
            ],
            next_step="同步真实公告、新闻和产品/业务催化证据，替换占位新闻",
            target_view="newsEvidence",
            metadata=news_stats,
        )
    )
    categories.append(
        _readiness_category(
            key="fund_flow",
            label="资金流",
            status="ready" if fund_flow_total else "warn",
            coverage=1.0 if fund_flow_total else 0.0,
            impact="影响资金确认、南向/主力资金和成交异常判断",
            evidence=[f"fund_flow_daily {fund_flow_total} 行", f"最新 {fund_flow_count['latest_date'] if fund_flow_count else '-'}"],
            next_step="同步主力资金、南向资金、沽空比例或成交额异常数据",
            target_view="symbolWorkspace",
            metadata={"row_count": fund_flow_total},
        )
    )
    categories.append(
        _readiness_category(
            key="signals",
            label="策略信号",
            status="ready" if signal_count else "warn",
            coverage=1.0 if signal_count else 0.0,
            impact="影响 K 线信号点、审查入口和执行队列",
            evidence=[f"signal_log {signal_count} 条", f"最新 {signals['latest_date'] if signals else '-'}"],
            next_step="运行策略扫描或生成 V2 信号",
            target_view="symbolWorkspace",
            metadata={"row_count": signal_count},
        )
    )
    categories.append(
        _readiness_category(
            key="agent_review",
            label="Agent 审查",
            status="ready" if review_count else "warn",
            coverage=1.0 if review_count else 0.0,
            impact="影响信号是否可进入研究执行和风险复核",
            evidence=[f"agent_decision_log {review_count} 条", f"最新 {reviews['latest_at'] if reviews else '-'}"],
            next_step="对最新策略信号运行 Agent 审查",
            target_view="review",
            metadata={"row_count": review_count},
        )
    )
    categories.append(
        _readiness_category(
            key="attribution",
            label="后验归因",
            status="ready" if attribution_count else "warn",
            coverage=1.0 if attribution_count else 0.0,
            impact="影响信号效果复盘、胜率和失败原因分析",
            evidence=[f"event_return {attribution_count} 条", f"最新 {attributions['latest_at'] if attributions else '-'}"],
            next_step="运行事件收益归因或等待信号形成足够后验窗口",
            target_view="history",
            metadata={"row_count": attribution_count},
        )
    )
    lot_size_ready = bool(index_profile or (security and security.get("lot_size")) or normalized.endswith(".HK") or normalized.endswith((".SH", ".SZ", ".BJ")))
    categories.append(
        _readiness_category(
            key="trading_rules",
            label="交易规则",
            status="ready" if lot_size_ready else "warn",
            coverage=1.0 if lot_size_ready else 0.5,
            impact="影响仓位取整、交收规则和模拟执行一致性",
            evidence=[
                "指数需映射可交易代理" if index_profile else f"推断市场 {normalized.split('.')[-1] if '.' in normalized else 'US'}",
                f"security lot_size {security.get('lot_size') if security else '-'}",
            ],
            next_step="统一 security_master、策略仓位和回测执行使用的交易单位",
            target_view="symbolWorkspace",
            metadata={"asset_type": asset_type},
        )
    )

    ready_count = sum(1 for item in categories if item["status"] == "ready")
    warn_count = sum(1 for item in categories if item["status"] == "warn")
    blocker_count = sum(1 for item in categories if item["status"] == "blocker")
    score = sum(item["coverage"] for item in categories) / len(categories) if categories else 0.0
    next_actions = []
    action_map = {
        "security_master": ("complete_security_master", "P0", "补齐主数据"),
        "market_data": ("sync_market_data", "P0", "同步行情"),
        "technical_factors": ("compute_factors", "P1", "计算技术因子"),
        "fundamentals": ("sync_fundamentals", "P1", "获取财报"),
        "news_evidence": ("replace_placeholder_news", "P1", "补真实新闻证据"),
        "fund_flow": ("sync_fund_flow", "P1", "同步资金流"),
        "signals": ("generate_signals", "P1", "生成策略信号"),
        "agent_review": ("run_agent_review", "P1", "运行 Agent 审查"),
        "attribution": ("compute_attribution", "P2", "计算后验归因"),
        "trading_rules": ("align_trading_rules", "P0", "统一交易规则"),
    }
    for item in categories:
        if item["status"] == "ready":
            continue
        action_key, priority, label = action_map[item["key"]]
        next_actions.append(
            {
                "key": action_key,
                "priority": priority,
                "label": label,
                "action": item["next_step"],
                "target_view": item["target_view"],
            }
        )
    next_actions.sort(key=lambda item: {"P0": 0, "P1": 1, "P2": 2}.get(item["priority"], 9))
    return {
        "symbol": normalized,
        "date": resolved_date,
        "asset_type": asset_type,
        "score": score,
        "level": _analysis_level(score, blocker_count),
        "summary": {
            "ready_count": ready_count,
            "warn_count": warn_count,
            "blocker_count": blocker_count,
            "total_count": len(categories),
        },
        "categories": categories,
        "next_actions": next_actions,
        "disclaimer": "完整度评分用于披露研究数据缺口，不构成投资建议或实盘指令。",
    }


def _spearman(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 2 or len(xs) != len(ys):
        return None

    def ranks(values: list[float]) -> list[float]:
        ordered = sorted(enumerate(values), key=lambda item: item[1])
        result = [0.0] * len(values)
        index = 0
        while index < len(ordered):
            end = index + 1
            while end < len(ordered) and ordered[end][1] == ordered[index][1]:
                end += 1
            rank = (index + end + 1) / 2
            for original_index, _ in ordered[index:end]:
                result[original_index] = rank
            index = end
        return result

    rx = ranks(xs)
    ry = ranks(ys)
    mx = sum(rx) / len(rx)
    my = sum(ry) / len(ry)
    numerator = sum((left - mx) * (right - my) for left, right in zip(rx, ry))
    denominator_x = math.sqrt(sum((value - mx) ** 2 for value in rx))
    denominator_y = math.sqrt(sum((value - my) ** 2 for value in ry))
    if denominator_x == 0 or denominator_y == 0:
        return None
    return numerator / (denominator_x * denominator_y)


def _safe_json_list(value: str | None) -> list[Any]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def _latest_row(table: str, symbol: str, end: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT *
            FROM {table}
            WHERE symbol = ? AND date <= ?
            ORDER BY date DESC
            LIMIT 1
            """,
            (symbol, end),
        ).fetchone()
    return _row(row)


def _upsert_financial_statement_rows(rows: list[dict]) -> int:
    if not rows:
        return 0
    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO financial_statement (
                date, symbol, statement_type, period, metrics_json,
                source, raw_text, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, symbol, statement_type) DO UPDATE SET
                period = excluded.period,
                metrics_json = excluded.metrics_json,
                source = excluded.source,
                raw_text = excluded.raw_text,
                updated_at = excluded.updated_at
            """,
            [
                (
                    row["date"],
                    row["symbol"],
                    row["statement_type"],
                    row.get("period"),
                    json.dumps(row.get("metrics") or {}, ensure_ascii=False),
                    row.get("source"),
                    row.get("raw_text"),
                    row.get("updated_at"),
                )
                for row in rows
            ],
        )
        conn.commit()
    return len(rows)


def _financial_reports_payload(symbol: str, end: str) -> dict:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM financial_statement
            WHERE symbol = ? AND date <= ?
            ORDER BY date DESC, statement_type
            """,
            (symbol, end),
        ).fetchall()
    items = []
    latest_by_type: dict[str, dict] = {}
    for row in _rows(rows):
        try:
            metrics = json.loads(row.get("metrics_json") or "{}")
        except (TypeError, ValueError):
            metrics = {}
        item = {
            "date": row.get("date"),
            "statement_type": row.get("statement_type"),
            "period": row.get("period"),
            "metrics": metrics,
            "source": row.get("source"),
            "updated_at": row.get("updated_at"),
        }
        items.append(item)
        statement_type = str(item["statement_type"] or "")
        if statement_type and statement_type not in latest_by_type:
            latest_by_type[statement_type] = item
    expected = ["income", "balance", "cashflow"]
    available_count = sum(1 for key in expected if key in latest_by_type)
    return {
        "items": items[:12],
        "latest_by_type": latest_by_type,
        "summary": {
            "available_count": available_count,
            "missing_count": len(expected) - available_count,
            "latest_date": items[0]["date"] if items else None,
            "statement_types": sorted(latest_by_type),
        },
    }


def _latest_index_row(index_symbol: str, end: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM index_bars
            WHERE index_symbol = ? AND date <= ?
            ORDER BY date DESC
            LIMIT 1
            """,
            (index_symbol, end),
        ).fetchone()
    return _row(row)


def _recent_index_rows(index_symbol: str, end: str, limit: int = 180) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM index_bars
            WHERE index_symbol = ? AND date <= ?
            ORDER BY date DESC
            LIMIT ?
            """,
            (index_symbol, end, limit),
        ).fetchall()
    return list(reversed(_rows(rows)))


def _count_index_rows(index_symbol: str, start: str, end: str) -> int:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM index_bars
            WHERE index_symbol = ? AND date >= ? AND date <= ?
            """,
            (index_symbol, start, end),
        ).fetchone()
    return int(row["count"] or 0) if row else 0


def _index_factor_payload(index_symbol: str, end: str, limit: int = 180) -> tuple[dict | None, list[dict], list[dict]]:
    rows = _recent_index_rows(index_symbol, end, limit)
    factors = derive_index_factor_series(index_symbol, rows)
    return (factors[-1] if factors else None, factors, rows)


TRADE_PROXY_CATALOG: dict[str, list[dict]] = {
    "HSI": [
        {
            "symbol": "2800.HK",
            "name": "盈富基金",
            "market": "HONGKONG",
            "proxy_type": "ETF",
            "currency": "HKD",
            "lot_size": 500,
            "cost_bps": 15.565,
            "tracking_note": "恒生指数现货 ETF 代理，需关注折溢价、成交额和港股印花税/平台费。",
        }
    ],
    "000016.SH": [
        {
            "symbol": "510050.SH",
            "name": "上证50ETF",
            "market": "CHINA",
            "proxy_type": "ETF",
            "currency": "CNY",
            "lot_size": 100,
            "cost_bps": 3.0,
            "tracking_note": "上证50宽基 ETF 代理，适合把指数信号转成可模拟交易标的。",
        }
    ],
    "000300.SH": [
        {
            "symbol": "510300.SH",
            "name": "沪深300ETF",
            "market": "CHINA",
            "proxy_type": "ETF",
            "currency": "CNY",
            "lot_size": 100,
            "cost_bps": 3.0,
            "tracking_note": "沪深300宽基 ETF 代理，用于大盘/核心资产方向执行。",
        }
    ],
    "000905.SH": [
        {
            "symbol": "510500.SH",
            "name": "中证500ETF",
            "market": "CHINA",
            "proxy_type": "ETF",
            "currency": "CNY",
            "lot_size": 100,
            "cost_bps": 3.0,
            "tracking_note": "中证500宽基 ETF 代理，用于中盘风格执行。",
        }
    ],
    "000852.SH": [
        {
            "symbol": "512100.SH",
            "name": "中证1000ETF",
            "market": "CHINA",
            "proxy_type": "ETF",
            "currency": "CNY",
            "lot_size": 100,
            "cost_bps": 3.0,
            "tracking_note": "中证1000宽基 ETF 代理，用于小盘/成长风格执行。",
        }
    ],
}


def _infer_market(symbol: str) -> str:
    value = str(symbol).upper()
    if value.endswith(".HK"):
        return "HONGKONG"
    if value.endswith((".SH", ".SZ", ".BJ")):
        return "CHINA"
    return "US"


def _build_trade_proxy(symbol: str, date: str | None = None) -> dict:
    normalized = normalize_market_symbol(symbol)
    resolved_date = date or dt_date.today().isoformat()
    index_profile = resolve_index_profile(normalized)
    if index_profile:
        proxies = TRADE_PROXY_CATALOG.get(index_profile.canonical_symbol, [])
        default_proxy = proxies[0] if proxies else None
        status = "mapped" if default_proxy else "unmapped"
        checks = [
            {
                "key": "proxy_mapping",
                "label": "代理映射",
                "status": "pass" if default_proxy else "warn",
                "detail": (
                    f"默认代理 {default_proxy['symbol']} {default_proxy['name']}"
                    if default_proxy
                    else "尚未配置默认可交易代理"
                ),
            },
            {
                "key": "liquidity",
                "label": "流动性复核",
                "status": "warn",
                "detail": "执行前复核 ETF/期货成交额、买卖价差和盘口深度。",
            },
            {
                "key": "basis_tracking",
                "label": "基差/跟踪误差",
                "status": "warn",
                "detail": "指数信号执行需监控折溢价、跟踪误差和合约展期风险。",
            },
        ]
        return {
            "symbol": normalized,
            "asset_type": "index",
            "name": index_profile.name,
            "date": resolved_date,
            "status": status,
            "default_proxy": default_proxy,
            "alternatives": proxies[1:],
            "execution_checks": checks,
            "disclaimer": "指数不可直接交易；本映射用于研究和模拟执行，不构成真实下单建议。",
        }

    return {
        "symbol": normalized,
        "asset_type": "equity",
        "date": resolved_date,
        "status": "direct",
        "default_proxy": {
            "symbol": normalized,
            "name": normalized,
            "market": _infer_market(normalized),
            "proxy_type": "DIRECT_EQUITY",
            "currency": "HKD" if normalized.endswith(".HK") else "CNY" if normalized.endswith((".SH", ".SZ", ".BJ")) else "USD",
            "lot_size": 1 if normalized.endswith(".HK") else 100 if normalized.endswith((".SH", ".SZ", ".BJ")) else 1,
            "cost_bps": 15.565 if normalized.endswith(".HK") else 3.0 if normalized.endswith((".SH", ".SZ", ".BJ")) else 5.0,
            "tracking_note": "个股信号可直接映射到自身，仍需执行停牌、流动性、成本和组合风险检查。",
        },
        "alternatives": [],
        "execution_checks": [
            {
                "key": "direct_trading",
                "label": "直接交易标的",
                "status": "pass",
                "detail": "个股不需要指数代理，但仍需走交易计划和风控闸门。",
            }
        ],
        "disclaimer": "代理映射用于研究和模拟执行，不构成真实下单建议。",
    }


@router.get("/trade-proxy", response_model=ApiResponse)
async def get_trade_proxy(symbol: str, date: str | None = None):
    return ApiResponse(success=True, data=_build_trade_proxy(symbol, date))


@router.get("/fundamentals", response_model=ApiResponse)
async def get_professional_fundamentals(
    symbol: str,
    end: str | None = None,
):
    init_db()
    normalized = normalize_market_symbol(symbol)
    resolved_end = end or dt_date.today().isoformat()
    index_profile = resolve_index_profile(normalized)
    if index_profile:
        latest_bar = _latest_index_row(normalized, resolved_end)
        factor_snapshot, _, _ = _index_factor_payload(normalized, resolved_end)
        return ApiResponse(
            success=True,
            data={
                "symbol": normalized,
                "asset_type": "index",
                "end": resolved_end,
                "security_profile": {
                    "symbol": normalized,
                    "name": index_profile.name,
                    "industry": "宽基指数",
                    "market": index_profile.market,
                },
                "market_snapshot": latest_bar,
                "valuation_snapshot": None,
                "financial_reports": {
                    "items": [],
                    "latest_by_type": {},
                    "summary": {
                        "available_count": 0,
                        "missing_count": 0,
                        "latest_date": None,
                        "statement_types": [],
                    },
                },
                "factor_snapshot": factor_snapshot,
                "agent_evidence": [],
                "data_quality": {
                    "fundamental_applicable": False,
                    "fundamental_available": None,
                    "financial_reports_available": None,
                    "market_price_available": latest_bar is not None,
                    "factor_available": factor_snapshot is not None,
                    "disclosure": "指数标的不适用个股三表估值，专业判断以指数行情、风格和可交易代理工具为准",
                },
            },
        )
    with get_connection() as conn:
        profile = conn.execute(
            "SELECT * FROM security_master WHERE symbol = ?",
            (normalized,),
        ).fetchone()
        latest_bar = conn.execute(
            """
            SELECT *
            FROM daily_bars
            WHERE symbol = ? AND date <= ?
            ORDER BY date DESC
            LIMIT 1
            """,
            (normalized, resolved_end),
        ).fetchone()
        latest_report = conn.execute(
            """
            SELECT date, signal_id, signal_name, evidence_json, risk_json, score
            FROM signal_log
            WHERE symbol = ? AND date <= ?
            ORDER BY date DESC, score DESC
            LIMIT 5
            """,
            (normalized, resolved_end),
        ).fetchall()
    valuation = _latest_row("fundamental_snapshot", normalized, resolved_end)
    financial_reports = _financial_reports_payload(normalized, resolved_end)
    factor = _latest_row("factor_daily", normalized, resolved_end)
    return ApiResponse(
        success=True,
        data={
            "symbol": normalized,
            "end": resolved_end,
            "security_profile": _row(profile)
            or {"symbol": normalized, "name": None, "industry": None, "market": None},
            "market_snapshot": _row(latest_bar),
            "valuation_snapshot": valuation,
            "financial_reports": financial_reports,
            "factor_snapshot": factor,
            "agent_evidence": _rows(latest_report),
            "data_quality": {
                "fundamental_available": valuation is not None,
                "financial_reports_available": financial_reports["summary"]["available_count"] > 0,
                "market_price_available": latest_bar is not None,
                "factor_available": factor is not None,
                "disclosure": "未落库的财务字段不会被估算或填充为假数据",
            },
        },
    )


@router.post("/fundamentals/sync", response_model=ApiResponse)
async def sync_professional_fundamentals(request: ProfessionalSyncRequest):
    init_db()
    resolved_end = request.end or dt_date.today().isoformat()
    symbols = _sync_symbols(request.symbols)
    started = time.perf_counter()
    rows_written = 0
    statement_rows_written = 0
    failures: list[dict] = []
    for symbol in symbols:
        normalized = normalize_market_symbol(symbol)
        fetched: dict[str, str] = {}
        for method in (
            "get_fundamentals",
            "get_income_statement",
            "get_balance_sheet",
            "get_cashflow",
        ):
            try:
                fetched[method] = route_to_vendor(method, normalized)
            except Exception as exc:
                failures.append({"symbol": normalized, "method": method, "error": str(exc)})
        if not fetched:
            _record_sync_trace(
                job_type="sync-fundamentals",
                symbol=normalized,
                start=resolved_end,
                end=resolved_end,
                primary_source=request.source,
                status="failed",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                error="no financial data source returned data",
            )
            continue

        combined = "\n".join([
            fetched.get("get_fundamentals", ""),
            fetched.get("get_income_statement", ""),
        ])
        snapshot = {
            "date": resolved_end,
            "symbol": normalized,
            "revenue": _number_after("revenue", combined),
            "net_income": _number_after("n_income", combined) or _number_after("net_income", combined),
            "eps": _number_after("eps", combined),
            "roe": _ratio_after("ROE", combined) or _ratio_after("roe", combined),
            "gross_margin": _ratio_after("gross_margin", combined) or _ratio_after("grossprofit_margin", combined),
            "pe_ttm": _number_after("pe_ttm", combined) or _number_after("PE", combined),
            "pb": _number_after("pb", combined) or _number_after("PB", combined),
            "dividend_yield": _ratio_after("dividend_yield", combined),
            "source": request.source,
            "updated_at": _now(),
        }
        coverage = _field_coverage(
            snapshot,
            ["revenue", "net_income", "eps", "roe", "gross_margin", "pe_ttm", "pb", "dividend_yield"],
        )

        statement_rows: list[dict] = []
        for method, statement_type in (
            ("get_income_statement", "income"),
            ("get_balance_sheet", "balance"),
            ("get_cashflow", "cashflow"),
        ):
            statement_rows.extend(
                _parse_financial_statement_rows(
                    statement_type=statement_type,
                    text=fetched.get(method, ""),
                    symbol=normalized,
                    fallback_date=resolved_end,
                    source=request.source,
                )
            )
        statement_count = _upsert_financial_statement_rows(statement_rows)
        statement_rows_written += statement_count

        if coverage > 0:
            with get_connection() as conn:
                conn.execute(
                    """
                    INSERT INTO fundamental_snapshot (
                        date, symbol, revenue, net_income, eps, roe, gross_margin,
                        pe_ttm, pb, dividend_yield, source, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(date, symbol) DO UPDATE SET
                        revenue = excluded.revenue,
                        net_income = excluded.net_income,
                        eps = excluded.eps,
                        roe = excluded.roe,
                        gross_margin = excluded.gross_margin,
                        pe_ttm = excluded.pe_ttm,
                        pb = excluded.pb,
                        dividend_yield = excluded.dividend_yield,
                        source = excluded.source,
                        updated_at = excluded.updated_at
                    """,
                    (
                        snapshot["date"],
                        snapshot["symbol"],
                        snapshot["revenue"],
                        snapshot["net_income"],
                        snapshot["eps"],
                        snapshot["roe"],
                        snapshot["gross_margin"],
                        snapshot["pe_ttm"],
                        snapshot["pb"],
                        snapshot["dividend_yield"],
                        snapshot["source"],
                        snapshot["updated_at"],
                    ),
                )
                conn.commit()
            rows_written += 1
        elif statement_count == 0:
            failures.append({"symbol": normalized, "error": "no parsable financial report fields"})
            continue

        _record_sync_trace(
            job_type="sync-fundamentals",
            symbol=normalized,
            start=resolved_end,
            end=resolved_end,
            primary_source=request.source,
            status="success",
            rows_written=(1 if coverage > 0 else 0) + statement_count,
            elapsed_ms=int((time.perf_counter() - started) * 1000),
        )
    return ApiResponse(
        success=True,
        data={
            "symbols": symbols,
            "end": resolved_end,
            "source": request.source,
            "rows_written": rows_written,
            "statement_rows_written": statement_rows_written,
            "failures": failures,
        },
    )


@router.get("/news-evidence", response_model=ApiResponse)
async def get_news_evidence(
    symbol: str,
    start: str | None = None,
    end: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
):
    init_db()
    normalized = normalize_market_symbol(symbol)
    resolved_end = end or dt_date.today().isoformat()
    resolved_start = start or _default_start(resolved_end, 30)
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM news_evidence
            WHERE symbol = ? AND date >= ? AND date <= ?
            ORDER BY date DESC, credibility DESC
            LIMIT ?
            """,
            (normalized, resolved_start, resolved_end, limit),
        ).fetchall()
    items = _rows(rows)
    distribution = Counter(item.get("sentiment") or "unknown" for item in items)
    return ApiResponse(
        success=True,
        data={
            "symbol": normalized,
            "start": resolved_start,
            "end": resolved_end,
            "items": items,
            "sentiment_distribution": dict(distribution),
            "evidence_quality": {
                "item_count": len(items),
                "high_credibility_count": sum(
                    1 for item in items if (item.get("credibility") or 0) >= 0.75
                ),
                "source_count": len({item.get("source") for item in items if item.get("source")}),
            },
        },
    )


def _parse_news_items(symbol: str, text: str, default_date: str, source: str) -> list[dict]:
    items: list[dict] = []
    lines = text.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        match = re.match(r"^-\s+\*\*(?P<date>[^*]+)\*\*\s+(?P<headline>.+)$", line)
        if not match:
            index += 1
            continue
        news_date = match.group("date").strip()[:10] or default_date
        headline = match.group("headline").strip()
        summary_parts = []
        lookahead = index + 1
        while lookahead < len(lines) and lines[lookahead].startswith("  "):
            summary_parts.append(lines[lookahead].strip())
            lookahead += 1
        raw_id = f"{symbol}|{news_date}|{headline}|{source}"
        items.append(
            {
                "news_id": hashlib.sha1(raw_id.encode("utf-8")).hexdigest(),
                "date": news_date,
                "symbol": symbol,
                "headline": headline[:240],
                "source": source,
                "url": None,
                "sentiment": "neutral",
                "credibility": 0.72,
                "summary": " ".join(summary_parts)[:500] if summary_parts else None,
                "created_at": _now(),
            }
        )
        index = max(lookahead, index + 1)
    if not items and text.strip():
        headline = text.strip().splitlines()[0][:240]
        raw_id = f"{symbol}|{default_date}|{headline}|{source}"
        items.append(
            {
                "news_id": hashlib.sha1(raw_id.encode("utf-8")).hexdigest(),
                "date": default_date,
                "symbol": symbol,
                "headline": headline,
                "source": source,
                "url": None,
                "sentiment": "neutral",
                "credibility": 0.55,
                "summary": text.strip()[:500],
                "created_at": _now(),
            }
        )
    return items


@router.post("/news-evidence/sync", response_model=ApiResponse)
async def sync_news_evidence(request: ProfessionalSyncRequest):
    init_db()
    resolved_end = request.end or dt_date.today().isoformat()
    resolved_start = request.start or _default_start(resolved_end, 30)
    symbols = _sync_symbols(request.symbols)
    started = time.perf_counter()
    rows_written = 0
    failures: list[dict] = []
    for symbol in symbols:
        normalized = normalize_market_symbol(symbol)
        try:
            text = route_to_vendor("get_news", normalized, resolved_start, resolved_end)
            items = _parse_news_items(normalized, text, resolved_end, request.source)
        except Exception as exc:
            failures.append({"symbol": normalized, "error": str(exc)})
            _record_sync_trace(
                job_type="sync-news-evidence",
                symbol=normalized,
                start=resolved_start,
                end=resolved_end,
                primary_source=request.source,
                status="failed",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                error=str(exc),
            )
            continue
        with get_connection() as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO news_evidence (
                    news_id, date, symbol, headline, source, url, sentiment,
                    credibility, summary, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        item["news_id"],
                        item["date"],
                        item["symbol"],
                        item["headline"],
                        item["source"],
                        item["url"],
                        item["sentiment"],
                        item["credibility"],
                        item["summary"],
                        item["created_at"],
                    )
                    for item in items
                ],
            )
            conn.commit()
        rows_written += len(items)
        _record_sync_trace(
            job_type="sync-news-evidence",
            symbol=normalized,
            start=resolved_start,
            end=resolved_end,
            primary_source=request.source,
            status="success" if items else "empty",
            rows_written=len(items),
            elapsed_ms=int((time.perf_counter() - started) * 1000),
        )
    return ApiResponse(
        success=True,
        data={
            "symbols": symbols,
            "start": resolved_start,
            "end": resolved_end,
            "source": request.source,
            "rows_written": rows_written,
            "failures": failures,
        },
    )


def _rank_metric(rows: list[dict], symbol: str, metric: str) -> dict:
    ranked = [
        row for row in rows if isinstance(row.get(metric), (int, float))
    ]
    ranked.sort(key=lambda item: item[metric], reverse=True)
    rank = next((index + 1 for index, row in enumerate(ranked) if row["symbol"] == symbol), None)
    return {
        "metric": metric,
        "rank": rank,
        "total": len(ranked),
        "percentile": (1 - (rank - 1) / len(ranked)) if rank and ranked else None,
        "leader": ranked[0] if ranked else None,
    }


def _factor_effectiveness(
    *,
    factor_date: str,
    industry: str | None,
    metric: str = "rel_strength_index20",
) -> dict:
    with get_connection() as conn:
        factor_rows = _rows(
            conn.execute(
                """
                SELECT f.symbol, f.date, f.rel_strength_index20, f.rel_strength_industry20, f.ret20, w.industry
                FROM factor_daily f
                LEFT JOIN watchlist w ON w.symbol = f.symbol
                WHERE f.date <= ?
                  AND (? IS NULL OR w.industry = ?)
                ORDER BY f.date DESC
                LIMIT 200
                """,
                (factor_date, industry, industry),
            ).fetchall()
        )
        bar_rows = _rows(
            conn.execute(
                """
                SELECT symbol, date, close
                FROM daily_bars
                WHERE date >= ?
                ORDER BY symbol, date
                """,
                ((dt_date.fromisoformat(factor_date) - timedelta(days=30)).isoformat(),),
            ).fetchall()
        )
    bars_by_symbol: dict[str, list[dict]] = defaultdict(list)
    for row in bar_rows:
        bars_by_symbol[row["symbol"]].append(row)

    observations: list[dict] = []
    for row in factor_rows:
        factor_value = row.get(metric)
        if not isinstance(factor_value, (int, float)):
            factor_value = row.get("rel_strength_industry20")
        if not isinstance(factor_value, (int, float)):
            continue
        bars = bars_by_symbol.get(row["symbol"], [])
        current_index = next((index for index, bar in enumerate(bars) if bar["date"] >= row["date"]), None)
        if current_index is None or current_index >= len(bars) - 1:
            continue
        future_index = min(len(bars) - 1, current_index + 20)
        current_close = bars[current_index].get("close")
        future_close = bars[future_index].get("close")
        if not isinstance(current_close, (int, float)) or not isinstance(future_close, (int, float)) or current_close == 0:
            continue
        forward_return = future_close / current_close - 1
        observations.append(
            {
                "symbol": row["symbol"],
                "factor": float(factor_value),
                "forward_return": forward_return,
                "date": row["date"],
                "forward_date": bars[future_index]["date"],
            }
        )

    xs = [row["factor"] for row in observations]
    ys = [row["forward_return"] for row in observations]
    rank_ic = _spearman(xs, ys)
    sorted_obs = sorted(observations, key=lambda row: row["factor"], reverse=True)
    bucket_size = max(1, math.ceil(len(sorted_obs) * 0.25)) if sorted_obs else 0
    top = sorted_obs[:bucket_size]
    bottom = sorted_obs[-bucket_size:] if bucket_size else []
    avg = lambda rows: sum(row["forward_return"] for row in rows) / len(rows) if rows else None
    return {
        "method": "forward_20d_spearman",
        "metric": metric,
        "observations": len(observations),
        "rank_ic20": rank_ic,
        "top_bucket_return": avg(top),
        "bottom_bucket_return": avg(bottom),
        "spread": (avg(top) - avg(bottom)) if top and bottom else None,
        "warnings": [] if len(observations) >= 5 else ["有效样本少于 5，IC 仅作方向性参考"],
        "top_examples": top[:5],
        "bottom_examples": bottom[:5],
    }


@router.get("/factors", response_model=ApiResponse)
async def get_factor_research(symbol: str, date: str | None = None):
    init_db()
    normalized = normalize_market_symbol(symbol)
    resolved_date = date or dt_date.today().isoformat()
    index_profile = resolve_index_profile(normalized)
    if index_profile:
        factor_snapshot, factor_series, rows = _index_factor_payload(normalized, resolved_date)
        if not factor_snapshot:
            return ApiResponse(
                success=True,
                data={
                    "symbol": normalized,
                    "asset_type": "index",
                    "name": index_profile.name,
                    "date": resolved_date,
                    "factor_snapshot": None,
                    "industry_peer_count": 0,
                    "rankings": {},
                    "peer_rows": [],
                    "style_exposure": {},
                    "factor_effectiveness": {
                        "method": "index_derived_technicals",
                        "observations": 0,
                        "warnings": ["缺少指数行情，无法生成指数技术快照"],
                    },
                },
            )
        style_exposure = {
            "trend": factor_snapshot.get("ret20"),
            "relative_strength": factor_snapshot.get("rel_strength_index20"),
            "liquidity_impulse": factor_snapshot.get("amount_ratio20"),
            "volatility": factor_snapshot.get("atr14"),
            "momentum_quality": factor_snapshot.get("ret20"),
        }
        return ApiResponse(
            success=True,
            data={
                "symbol": normalized,
                "asset_type": "index",
                "name": index_profile.name,
                "date": factor_snapshot.get("date"),
                "industry": "宽基指数",
                "factor_snapshot": factor_snapshot,
                "industry_peer_count": 0,
                "rankings": {},
                "peer_rows": [],
                "style_exposure": style_exposure,
                "factor_series": factor_series[-120:],
                "factor_effectiveness": {
                    "method": "index_derived_technicals",
                    "observations": max(0, len(rows) - 20),
                    "rank_ic20": None,
                    "top_bucket_return": None,
                    "bottom_bucket_return": None,
                    "spread": None,
                    "warnings": ["指数因子为自身时间序列技术快照，不做个股横截面 IC 排名"],
                },
            },
        )
    with get_connection() as conn:
        target = conn.execute(
            """
            SELECT f.*, w.industry
            FROM factor_daily f
            LEFT JOIN watchlist w ON w.symbol = f.symbol
            WHERE f.symbol = ? AND f.date <= ?
            ORDER BY f.date DESC
            LIMIT 1
            """,
            (normalized, resolved_date),
        ).fetchone()
    if not target:
        return ApiResponse(
            success=True,
            data={
                "symbol": normalized,
                "date": resolved_date,
                "factor_snapshot": None,
                "industry_peer_count": 0,
                "rankings": {},
                "peer_rows": [],
                "style_exposure": {},
            },
        )
    factor_date = target["date"]
    industry = target["industry"]
    with get_connection() as conn:
        peer_rows = conn.execute(
            """
            SELECT f.*, w.industry
            FROM factor_daily f
            LEFT JOIN watchlist w ON w.symbol = f.symbol
            WHERE f.date = ?
              AND (? IS NULL OR w.industry = ?)
            ORDER BY f.rel_strength_index20 DESC
            """,
            (factor_date, industry, industry),
        ).fetchall()
    peers = _rows(peer_rows)
    rankings = {
        metric: _rank_metric(peers, normalized, metric)
        for metric in [
            "rel_strength_index20",
            "rel_strength_industry20",
            "ret20",
            "ret60",
            "volume_ratio20",
            "amount_ratio20",
        ]
    }
    snapshot = dict(target)
    style_exposure = {
        "trend": snapshot.get("ret20"),
        "relative_strength": snapshot.get("rel_strength_index20"),
        "liquidity_impulse": snapshot.get("amount_ratio20"),
        "volatility": snapshot.get("atr14"),
        "momentum_quality": (
            (snapshot.get("ret20") or 0) - abs((snapshot.get("rel_strength_industry20") or 0))
        ),
    }
    return ApiResponse(
        success=True,
        data={
            "symbol": normalized,
            "date": factor_date,
            "industry": industry,
            "factor_snapshot": snapshot,
            "industry_peer_count": max(0, len(peers) - 1),
            "rankings": rankings,
            "peer_rows": peers,
            "style_exposure": style_exposure,
            "factor_effectiveness": _factor_effectiveness(
                factor_date=factor_date,
                industry=industry,
            ),
        },
    )


@router.get("/portfolio-risk", response_model=ApiResponse)
async def get_portfolio_risk(
    strategy_version: str = "portfolio_v1",
    date: str | None = None,
):
    init_db()
    resolved_date = date or dt_date.today().isoformat()
    with get_connection() as conn:
        trades = conn.execute(
            """
            SELECT *
            FROM trade_log
            WHERE strategy_version = ? AND date <= ?
            ORDER BY date, trade_id
            """,
            (strategy_version, resolved_date),
        ).fetchall()
        equity = conn.execute(
            """
            SELECT *
            FROM equity_curve
            WHERE strategy_version = ? AND date <= ?
            ORDER BY date DESC
            LIMIT 1
            """,
            (strategy_version, resolved_date),
        ).fetchone()
    positions: dict[str, dict] = {}
    for row in _rows(trades):
        bucket = positions.setdefault(
            row["symbol"],
            {"symbol": row["symbol"], "market": row["market"], "quantity": 0.0, "cost": 0.0},
        )
        quantity = float(row.get("quantity") or 0)
        notional = quantity * float(row.get("price") or 0)
        if row.get("side") == "entry":
            bucket["quantity"] += quantity
            bucket["cost"] += notional
        elif row.get("side") == "exit":
            bucket["quantity"] -= quantity
            bucket["cost"] = max(0.0, bucket["cost"] - notional)

    open_positions = [row for row in positions.values() if abs(row["quantity"]) > 1e-9]
    gross_exposure = sum(abs(row["cost"]) for row in open_positions)
    total_equity = float(equity["equity"]) if equity else 0.0
    for row in open_positions:
        row["weight"] = row["cost"] / total_equity if total_equity else 0.0
    by_market = defaultdict(float)
    for row in open_positions:
        by_market[row["market"] or "UNKNOWN"] += row["cost"]
    industries: dict[str, str] = {}
    close_series: dict[str, list[tuple[str, float]]] = {}
    if open_positions:
        symbols = [row["symbol"] for row in open_positions]
        placeholders = ",".join("?" for _ in symbols)
        with get_connection() as conn:
            industry_rows = conn.execute(
                f"SELECT symbol, industry FROM watchlist WHERE symbol IN ({placeholders})",
                symbols,
            ).fetchall()
            industries = {row["symbol"]: row["industry"] or "UNKNOWN" for row in industry_rows}
            bar_rows = conn.execute(
                f"""
                SELECT symbol, date, close
                FROM daily_bars
                WHERE symbol IN ({placeholders})
                ORDER BY symbol, date DESC
                """,
                symbols,
            ).fetchall()
        for row in _rows(bar_rows):
            if not isinstance(row.get("close"), (int, float)):
                continue
            bucket = close_series.setdefault(row["symbol"], [])
            if len(bucket) < 61:
                bucket.append((row["date"], float(row["close"])))
        close_series = {
            symbol: list(reversed(values))
            for symbol, values in close_series.items()
        }
    by_industry = defaultdict(float)
    for row in open_positions:
        by_industry[industries.get(row["symbol"], "UNKNOWN")] += row["cost"]

    correlation_matrix = []
    for left in open_positions:
        left_values = [value for _, value in close_series.get(left["symbol"], [])]
        left_returns = [
            left_values[index] / left_values[index - 1] - 1
            for index in range(1, len(left_values))
            if left_values[index - 1]
        ]
        row_values = {"symbol": left["symbol"], "correlations": {}}
        for right in open_positions:
            right_values = [value for _, value in close_series.get(right["symbol"], [])]
            right_returns = [
                right_values[index] / right_values[index - 1] - 1
                for index in range(1, len(right_values))
                if right_values[index - 1]
            ]
            paired = list(zip(left_returns[-60:], right_returns[-60:]))
            if left["symbol"] == right["symbol"]:
                corr = 1.0
            elif len(paired) < 2:
                corr = None
            else:
                xs = [item[0] for item in paired]
                ys = [item[1] for item in paired]
                corr = _spearman(xs, ys)
            row_values["correlations"][right["symbol"]] = corr
        correlation_matrix.append(row_values)

    top = max(open_positions, key=lambda row: abs(row["cost"]), default=None)
    current_drawdown = float(equity["drawdown"]) if equity else None
    risk_budget = [
        {
            "symbol": row["symbol"],
            "weight": row["weight"],
            "budget_status": "over" if abs(row["weight"]) > 0.2 else "ok",
            "suggested_max_weight": 0.2,
        }
        for row in open_positions
    ]
    return ApiResponse(
        success=True,
        data={
            "strategy_version": strategy_version,
            "date": resolved_date,
            "positions": open_positions,
            "exposure": {
                "gross_exposure": gross_exposure,
                "net_exposure": sum(row["cost"] for row in open_positions),
                "gross_exposure_pct": gross_exposure / total_equity if total_equity else None,
                "market_exposure": dict(by_market),
                "industry_exposure": dict(by_industry),
            },
            "concentration": {
                "top_symbol": top["symbol"] if top else None,
                "top_weight": top["weight"] if top else None,
                "position_count": len(open_positions),
            },
            "drawdown": {
                "current_drawdown": current_drawdown,
                "equity": total_equity,
                "cash": float(equity["cash"]) if equity else None,
            },
            "stress_tests": [
                {"scenario": "-3% 全组合冲击", "estimated_pnl": -0.03 * gross_exposure},
                {"scenario": "-8% 全组合冲击", "estimated_pnl": -0.08 * gross_exposure},
                {"scenario": "单票最大仓位归零", "estimated_pnl": -(top["cost"] if top else 0.0)},
            ],
            "correlation_matrix": correlation_matrix,
            "risk_budget": risk_budget,
        },
    )


@router.get("/lineage", response_model=ApiResponse)
async def get_data_lineage(symbol: str, date: str | None = None):
    init_db()
    normalized = normalize_market_symbol(symbol)
    resolved_date = date or dt_date.today().isoformat()
    index_profile = resolve_index_profile(normalized)
    if index_profile:
        latest_bar = _latest_index_row(normalized, resolved_date)
        factor_snapshot, _, rows = _index_factor_payload(normalized, resolved_date)
        with get_connection() as conn:
            news = conn.execute(
                """
                SELECT COUNT(*) AS count, MAX(date) AS latest_date, COUNT(DISTINCT source) AS source_count
                FROM news_evidence
                WHERE symbol = ? AND date <= ?
                """,
                (normalized, resolved_date),
            ).fetchone()
            signals = conn.execute(
                """
                SELECT COUNT(*) AS count, MAX(date) AS latest_date
                FROM signal_log
                WHERE symbol = ? AND date <= ?
                """,
                (normalized, resolved_date),
            ).fetchone()
            traces = conn.execute(
                """
                SELECT *
                FROM sync_trace
                WHERE (symbol = ? OR symbol IS NULL) AND end <= ?
                ORDER BY created_at DESC
                LIMIT 8
                """,
                (normalized, resolved_date),
            ).fetchall()
        items = [
            {
                "table": "index_bars",
                "status": "available" if latest_bar else "missing",
                "record_date": latest_bar.get("date") if latest_bar else None,
                "source": latest_bar.get("source") if latest_bar else None,
                "updated_at": latest_bar.get("updated_at") if latest_bar else None,
                "field_coverage": _field_coverage(
                    latest_bar,
                    ["open", "high", "low", "close", "volume", "amount", "source", "updated_at"],
                ),
                "row_count": len(rows),
            },
            {
                "table": "index_technical",
                "status": "available" if factor_snapshot else "missing",
                "record_date": factor_snapshot.get("date") if factor_snapshot else None,
                "source": "index_bars_derived" if factor_snapshot else None,
                "updated_at": factor_snapshot.get("updated_at") if factor_snapshot else None,
                "field_coverage": _field_coverage(
                    factor_snapshot,
                    ["ma20", "rsi14", "atr14", "ret20", "volume_ratio20", "amount_ratio20"],
                ),
                "row_count": len(rows),
            },
            {
                "table": "fundamental_snapshot",
                "status": "not_applicable",
                "record_date": None,
                "source": "index_not_equity",
                "updated_at": None,
                "field_coverage": 1.0,
            },
            {
                "table": "news_evidence",
                "status": "available" if news and news["count"] else "optional_missing",
                "record_date": news["latest_date"] if news else None,
                "source": f"{news['source_count']} sources" if news and news["source_count"] else None,
                "updated_at": None,
                "field_coverage": 1.0,
                "row_count": int(news["count"] or 0) if news else 0,
            },
            {
                "table": "signal_log",
                "status": "available" if signals and signals["count"] else "missing",
                "record_date": signals["latest_date"] if signals else None,
                "source": "local_rules",
                "updated_at": None,
                "field_coverage": 1.0 if signals and signals["count"] else 0.0,
                "row_count": int(signals["count"] or 0) if signals else 0,
            },
        ]
        applicable_items = [
            item for item in items if item["status"] not in {"not_applicable", "optional_missing"}
        ]
        available_count = sum(1 for item in applicable_items if item["status"] == "available")
        return ApiResponse(
            success=True,
            data={
                "symbol": normalized,
                "asset_type": "index",
                "name": index_profile.name,
                "date": resolved_date,
                "items": items,
                "sync_traces": _rows(traces),
                "summary": {
                    "available_count": available_count,
                    "missing_count": len(applicable_items) - available_count,
                    "not_applicable_count": sum(1 for item in items if item["status"] == "not_applicable"),
                    "optional_missing_count": sum(1 for item in items if item["status"] == "optional_missing"),
                    "coverage": available_count / len(applicable_items) if applicable_items else 0.0,
                },
            },
        )
    items = []
    table_specs = [
        ("daily_bars", ["open", "high", "low", "close", "volume", "amount", "source", "updated_at"]),
        ("factor_daily", ["ma20", "ma60", "rsi14", "ret20", "rel_strength_index20", "updated_at"]),
        ("fundamental_snapshot", ["revenue", "net_income", "roe", "pe_ttm", "pb", "source", "updated_at"]),
        ("financial_statement", ["statement_type", "metrics_json", "source", "updated_at"]),
    ]
    for table, columns in table_specs:
        row = _latest_row(table, normalized, resolved_date)
        items.append(
            {
                "table": table,
                "status": "available" if row else "missing",
                "record_date": row.get("date") if row else None,
                "source": row.get("source") if row else None,
                "updated_at": row.get("updated_at") if row else None,
                "field_coverage": _field_coverage(row, columns),
            }
        )
    with get_connection() as conn:
        news = conn.execute(
            """
            SELECT COUNT(*) AS count, MAX(date) AS latest_date, COUNT(DISTINCT source) AS source_count
            FROM news_evidence
            WHERE symbol = ? AND date <= ?
            """,
            (normalized, resolved_date),
        ).fetchone()
        signals = conn.execute(
            """
            SELECT COUNT(*) AS count, MAX(date) AS latest_date
            FROM signal_log
            WHERE symbol = ? AND date <= ?
            """,
            (normalized, resolved_date),
        ).fetchone()
        traces = conn.execute(
            """
            SELECT *
            FROM sync_trace
            WHERE (symbol = ? OR symbol IS NULL) AND end <= ?
            ORDER BY created_at DESC
            LIMIT 8
            """,
            (normalized, resolved_date),
        ).fetchall()
    items.append(
        {
            "table": "news_evidence",
            "status": "available" if news and news["count"] else "missing",
            "record_date": news["latest_date"] if news else None,
            "source": f"{news['source_count']} sources" if news and news["source_count"] else None,
            "updated_at": None,
            "field_coverage": 1.0 if news and news["count"] else 0.0,
            "row_count": int(news["count"] or 0) if news else 0,
        }
    )
    items.append(
        {
            "table": "signal_log",
            "status": "available" if signals and signals["count"] else "missing",
            "record_date": signals["latest_date"] if signals else None,
            "source": "local_rules",
            "updated_at": None,
            "field_coverage": 1.0 if signals and signals["count"] else 0.0,
            "row_count": int(signals["count"] or 0) if signals else 0,
        }
    )
    available_count = sum(1 for item in items if item["status"] == "available")
    return ApiResponse(
        success=True,
        data={
            "symbol": normalized,
            "date": resolved_date,
            "items": items,
            "sync_traces": _rows(traces),
            "summary": {
                "available_count": available_count,
                "missing_count": len(items) - available_count,
                "coverage": available_count / len(items) if items else 0.0,
            },
        },
    )


@router.get("/analysis-readiness", response_model=ApiResponse)
async def get_analysis_readiness(symbol: str, date: str | None = None):
    return ApiResponse(success=True, data=_build_analysis_readiness(symbol, date))


@router.get("/execution-queue", response_model=ApiResponse)
async def get_execution_queue(
    date: str | None = None,
    strategy_version: str | None = None,
    symbol: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    init_db()
    resolved_date = date or dt_date.today().isoformat()
    normalized_symbol = normalize_market_symbol(symbol) if symbol else None
    query = """
        SELECT *
        FROM signal_log
        WHERE date <= ?
          AND direction = 'opportunity'
    """
    params: list[Any] = [resolved_date]
    if normalized_symbol:
        query += " AND symbol = ?"
        params.append(normalized_symbol)
    if strategy_version:
        query += " AND strategy_version = ?"
        params.append(strategy_version)
    query += " ORDER BY date DESC, score DESC LIMIT ?"
    params.append(limit)
    with get_connection() as conn:
        signals = _rows(conn.execute(query, params).fetchall())
        signal_ids = [row["signal_id"] for row in signals]
        latest_reviews: dict[str, dict] = {}
        trade_counts: dict[str, int] = {}
        if signal_ids:
            placeholders = ",".join("?" for _ in signal_ids)
            review_rows = conn.execute(
                f"""
                SELECT *
                FROM agent_decision_log
                WHERE signal_id IN ({placeholders})
                ORDER BY
                    signal_id,
                    COALESCE(resolved_at, created_at) DESC,
                    created_at DESC,
                    review_id DESC
                """,
                signal_ids,
            ).fetchall()
            for row in review_rows:
                latest_reviews.setdefault(row["signal_id"], dict(row))
            trade_rows = _rows(
                conn.execute(
                    """
                    SELECT trade_id
                    FROM trade_log
                    ORDER BY trade_id
                    """
                ).fetchall()
            )
            for signal_id in signal_ids:
                trade_counts[signal_id] = sum(
                    1 for row in trade_rows if str(row.get("trade_id", "")).startswith(f"{signal_id}-")
                )
    items = []
    for signal in signals:
        review = latest_reviews.get(signal["signal_id"], {})
        decision_status = review.get("decision_status") or "pending"
        if trade_counts.get(signal["signal_id"], 0) > 0:
            status = "executed"
        elif decision_status == "adopted":
            status = "approved"
        elif decision_status == "rejected" or review.get("action") == "reject":
            status = "blocked"
        else:
            status = "candidate"
        items.append(
            {
                "signal_id": signal["signal_id"],
                "date": signal["date"],
                "symbol": signal["symbol"],
                "signal_name": signal["signal_name"],
                "signal_level": signal.get("signal_level"),
                "score": signal.get("score"),
                "strategy_version": signal.get("strategy_version"),
                "review_id": review.get("review_id"),
                "review_action": review.get("action"),
                "decision_status": decision_status,
                "execution_status": status,
                "trade_count": trade_counts.get(signal["signal_id"], 0),
                "recommended_next_step": {
                    "approved": "进入模拟组合执行或等待次日成交校验",
                    "blocked": "补充缺失数据或驳回该信号",
                    "executed": "进入复盘和归因",
                    "candidate": "等待 Agent 审查或人工确认",
                }[status],
            }
        )
    counts = Counter(item["execution_status"] for item in items)
    return ApiResponse(
        success=True,
        data={
            "date": resolved_date,
            "symbol": normalized_symbol,
            "strategy_version": strategy_version,
            "items": items,
            "summary": {
                "candidate_count": len(items),
                "approved_count": counts.get("approved", 0),
                "blocked_count": counts.get("blocked", 0),
                "executed_count": counts.get("executed", 0),
                "pending_count": counts.get("candidate", 0),
            },
        },
    )


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _round_price(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 2)


def _load_trading_plan_context(signal_id: str) -> dict | None:
    init_db()
    with get_connection() as conn:
        signal = _row(
            conn.execute(
                """
                SELECT *
                FROM signal_log
                WHERE signal_id = ?
                """,
                (signal_id,),
            ).fetchone()
        )
        if not signal:
            return None
        symbol = signal["symbol"]
        signal_date = signal["date"]
        index_profile = resolve_index_profile(symbol)
        if index_profile:
            daily = _row(
                conn.execute(
                    """
                    SELECT date, index_symbol AS symbol, market, open, high, low, close,
                           volume, amount, source, updated_at
                    FROM index_bars
                    WHERE index_symbol = ? AND date <= ?
                    ORDER BY date DESC
                    LIMIT 1
                    """,
                    (symbol, signal_date),
                ).fetchone()
            )
            factor, _, _ = _index_factor_payload(symbol, signal_date)
        else:
            daily = _row(
                conn.execute(
                    """
                    SELECT *
                    FROM daily_bars
                    WHERE symbol = ? AND date <= ?
                    ORDER BY date DESC
                    LIMIT 1
                    """,
                    (symbol, signal_date),
                ).fetchone()
            )
            factor = _row(
                conn.execute(
                    """
                    SELECT *
                    FROM factor_daily
                    WHERE symbol = ? AND date <= ?
                    ORDER BY date DESC
                    LIMIT 1
                    """,
                    (symbol, signal_date),
                ).fetchone()
            )
        review = _row(
            conn.execute(
                """
                SELECT *
                FROM agent_decision_log
                WHERE signal_id = ?
                ORDER BY COALESCE(resolved_at, created_at) DESC, created_at DESC, review_id DESC
                LIMIT 1
                """,
                (signal_id,),
            ).fetchone()
        )
        quality_rows = _rows(
            conn.execute(
                """
                SELECT *
                FROM data_quality_log
                WHERE (symbol = ? OR symbol IS NULL)
                  AND (date IS NULL OR date <= ?)
                  AND COALESCE(resolution_status, 'open') != 'resolved'
                ORDER BY id DESC
                LIMIT 10
                """,
                (symbol, signal_date),
            ).fetchall()
        )
        trade_count = int(
            conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM trade_log
                WHERE trade_id LIKE ?
                """,
                (f"{signal_id}-%",),
            ).fetchone()["count"]
            or 0
        )
    return {
        "signal": signal,
        "daily": daily,
        "factor": factor,
        "review": review,
        "quality_rows": quality_rows,
        "trade_count": trade_count,
    }


def _build_price_plan(daily: dict | None, factor: dict | None) -> dict:
    close = _as_float(daily.get("close") if daily else None)
    limit_up = _as_float(daily.get("limit_up") if daily else None)
    limit_down = _as_float(daily.get("limit_down") if daily else None)
    atr = _as_float(factor.get("atr14") if factor else None)
    if close is None:
        return {
            "last_close": None,
            "atr14": None,
            "entry_zone": {"low": None, "high": None, "basis": "缺少收盘价，不能生成价格计划"},
            "hard_stop": None,
            "take_profit_1": None,
            "take_profit_2": None,
            "stop_distance_pct": None,
            "max_position_pct": 0.0,
            "max_loss_pct": 0.006,
        }

    resolved_atr = atr if atr and atr > 0 else max(close * 0.025, 0.01)
    entry_low = close - resolved_atr * 0.35
    entry_high = close + resolved_atr * 0.25
    if limit_down is not None:
        entry_low = max(entry_low, limit_down)
    if limit_up is not None:
        entry_high = min(entry_high, limit_up)
    if entry_high < entry_low:
        midpoint = (entry_low + entry_high) / 2
        entry_low = midpoint
        entry_high = midpoint

    hard_stop = close - max(resolved_atr * 1.45, close * 0.025)
    if limit_down is not None:
        hard_stop = max(hard_stop, limit_down)
    stop_distance_pct = (entry_high - hard_stop) / entry_high if entry_high > 0 else None
    max_loss_pct = 0.006
    if stop_distance_pct and stop_distance_pct > 0:
        max_position_pct = min(0.12, max(0.01, max_loss_pct / stop_distance_pct))
    else:
        max_position_pct = 0.0

    return {
        "last_close": _round_price(close),
        "atr14": _round_price(resolved_atr),
        "entry_zone": {
            "low": _round_price(entry_low),
            "high": _round_price(entry_high),
            "basis": "收盘价 ± ATR14 执行带，受涨跌停价格约束",
        },
        "hard_stop": _round_price(hard_stop),
        "take_profit_1": _round_price(close + resolved_atr * 1.1),
        "take_profit_2": _round_price(close + resolved_atr * 2.0),
        "stop_distance_pct": stop_distance_pct,
        "max_position_pct": round(max_position_pct, 4),
        "max_loss_pct": max_loss_pct,
    }


def _risk_gate_check(key: str, label: str, status: str, detail: str) -> dict:
    return {"key": key, "label": label, "status": status, "detail": detail}


def _build_trading_risk_gate(
    *,
    signal: dict,
    daily: dict | None,
    factor: dict | None,
    review: dict | None,
    quality_rows: list[dict],
    risk: dict,
    price_plan: dict,
) -> dict:
    blockers: list[str] = []
    warnings: list[str] = []
    checks: list[dict] = []

    critical_quality = [
        row for row in quality_rows if row.get("severity") in {"critical", "error"}
    ]
    if not daily:
        blockers.append("缺少日线行情，禁止生成交易计划。")
        checks.append(_risk_gate_check("data_quality", "行情完整性", "blocked", "缺少日线行情"))
    elif critical_quality:
        message = critical_quality[0].get("message") or critical_quality[0].get("check_name") or "存在未解决阻断级数据质量问题"
        blockers.append(message)
        checks.append(_risk_gate_check("data_quality", "行情完整性", "blocked", message))
    else:
        checks.append(_risk_gate_check("data_quality", "行情完整性", "pass", "无未解决 critical/error 数据质量问题"))

    if not factor:
        warnings.append("缺少因子快照，ATR、RSI 和量能条件使用保守默认值。")
        checks.append(_risk_gate_check("factor_snapshot", "指标快照", "warn", "缺少 factor_daily"))
    else:
        checks.append(_risk_gate_check("factor_snapshot", "指标快照", "pass", f"因子日期 {factor.get('date')}"))

    decision_status = review.get("decision_status") if review else None
    action = review.get("action") if review else None
    if decision_status == "rejected" or action == "reject":
        blockers.append("Agent/人工审查已驳回，禁止执行。")
        checks.append(_risk_gate_check("review", "审查闭环", "blocked", review.get("review_summary") or "已驳回"))
    elif decision_status in {"adopted", "watch"}:
        checks.append(_risk_gate_check("review", "审查闭环", "pass", f"decision_status={decision_status}"))
    else:
        warnings.append("该信号尚未完成采纳决策，只能观察不能下单。")
        checks.append(_risk_gate_check("review", "审查闭环", "warn", "等待 adopted/watch"))

    if daily and int(daily.get("is_suspended") or 0):
        blockers.append("标的停牌，禁止交易。")
        checks.append(_risk_gate_check("trading_rules", "交易规则", "blocked", "is_suspended=1"))
    elif daily and (daily.get("limit_up") is None or daily.get("limit_down") is None):
        warnings.append("缺少涨跌停字段，执行价格需要人工复核。")
        checks.append(_risk_gate_check("trading_rules", "交易规则", "warn", "缺少 limit_up/limit_down"))
    else:
        checks.append(_risk_gate_check("trading_rules", "交易规则", "pass", "停复牌与涨跌停字段可用"))

    stop_distance = price_plan.get("stop_distance_pct")
    max_position_pct = price_plan.get("max_position_pct") or 0
    if stop_distance is None or max_position_pct <= 0:
        blockers.append("无法计算止损距离，禁止生成仓位建议。")
        checks.append(_risk_gate_check("position_size", "仓位约束", "blocked", "止损距离不可用"))
    elif max_position_pct < 0.02:
        warnings.append("止损距离过宽，计划仓位低于 2%，建议只观察。")
        checks.append(_risk_gate_check("position_size", "仓位约束", "warn", f"建议仓位 {max_position_pct:.1%}"))
    else:
        checks.append(_risk_gate_check("position_size", "仓位约束", "pass", f"单笔最大亏损 {price_plan['max_loss_pct']:.1%}"))

    exposure = risk.get("exposure") or {}
    concentration = risk.get("concentration") or {}
    drawdown = risk.get("drawdown") or {}
    gross_exposure_pct = exposure.get("gross_exposure_pct")
    current_drawdown = drawdown.get("current_drawdown")
    top_weight = concentration.get("top_weight")
    if isinstance(current_drawdown, (int, float)) and current_drawdown < -0.12:
        blockers.append("组合回撤超过 12%，禁止新增风险暴露。")
        checks.append(_risk_gate_check("portfolio_risk", "组合风险", "blocked", f"当前回撤 {current_drawdown:.1%}"))
    elif (
        isinstance(current_drawdown, (int, float))
        and current_drawdown < -0.08
        or isinstance(gross_exposure_pct, (int, float))
        and gross_exposure_pct > 0.85
        or isinstance(top_weight, (int, float))
        and abs(top_weight) > 0.2
    ):
        warnings.append("组合风险偏高，新增仓位需要降档。")
        checks.append(_risk_gate_check("portfolio_risk", "组合风险", "warn", "回撤/暴露/集中度触发关注"))
    else:
        checks.append(_risk_gate_check("portfolio_risk", "组合风险", "pass", "组合风险未触发新增仓位限制"))

    if signal.get("direction") != "opportunity":
        warnings.append("该信号不是机会方向，不生成买入动作。")

    status = "blocked" if blockers else ("warn" if warnings else "pass")
    return {
        "status": status,
        "blockers": blockers,
        "warnings": warnings,
        "checks": checks,
    }


def _build_intraday_monitors(price_plan: dict, factor: dict | None) -> list[dict]:
    entry_zone = price_plan.get("entry_zone") or {}
    volume_ratio = _as_float(factor.get("volume_ratio20") if factor else None)
    return [
        {
            "key": "hard_stop",
            "label": "硬止损",
            "trigger_price": price_plan.get("hard_stop"),
            "direction": "below",
            "severity": "critical",
            "action": "跌破即撤销买入计划或执行减仓，不等待主观判断",
        },
        {
            "key": "no_chase_zone",
            "label": "不追高上沿",
            "trigger_price": entry_zone.get("high"),
            "direction": "above",
            "severity": "warn",
            "action": "高于计划上沿只等待回落，不主动追价",
        },
        {
            "key": "first_take_profit",
            "label": "第一止盈观察",
            "trigger_price": price_plan.get("take_profit_1"),
            "direction": "above",
            "severity": "info",
            "action": "到达第一目标后复核量能和分时承接",
        },
        {
            "key": "volume_confirmation",
            "label": "量能确认",
            "trigger_price": None,
            "direction": "ratio",
            "severity": "info" if volume_ratio is not None and volume_ratio >= 1 else "warn",
            "action": f"量比/20日均量 {volume_ratio:.2f}x" if volume_ratio is not None else "缺少量能倍率，盘中需人工确认成交活跃度",
        },
    ]


def _build_scenario_playbook(price_plan: dict) -> list[dict]:
    entry_zone = price_plan.get("entry_zone") or {}
    return [
        {
            "scenario": "平开或小幅高开",
            "trigger": f"{entry_zone.get('low')}-{entry_zone.get('high')} 执行带内",
            "action": "按计划分批买入，首笔不超过建议仓位的 50%",
        },
        {
            "scenario": "高开超上沿",
            "trigger": f"开盘价高于 {entry_zone.get('high')}",
            "action": "不追价，等待回踩执行带或放弃当日交易",
        },
        {
            "scenario": "低开破硬止损",
            "trigger": f"价格低于 {price_plan.get('hard_stop')}",
            "action": "计划失效，禁止买入并记录未交易原因",
        },
        {
            "scenario": "盘中快速拉升",
            "trigger": f"触及 {price_plan.get('take_profit_1')} 附近",
            "action": "观察量能承接，禁止在第一止盈位上方加仓",
        },
        {
            "scenario": "尾盘仍未达条件",
            "trigger": "未回到执行带且量能不足",
            "action": "取消当日计划，保留到下一交易日重新生成",
        },
    ]


def _build_discipline_checklist(price_plan: dict) -> list[dict]:
    return [
        {
            "key": "planned_entry",
            "label": "是否按计划入场",
            "expected": f"只在 {price_plan.get('entry_zone', {}).get('low')}-{price_plan.get('entry_zone', {}).get('high')} 执行带内成交",
        },
        {
            "key": "position_cap",
            "label": "是否遵守仓位上限",
            "expected": f"单票新增仓位不超过 {price_plan.get('max_position_pct', 0):.1%}",
        },
        {
            "key": "hard_stop",
            "label": "是否执行硬止损",
            "expected": f"跌破 {price_plan.get('hard_stop')} 不做主观扛单",
        },
        {
            "key": "execution_quality",
            "label": "是否记录成交质量",
            "expected": "记录成交价、滑点、未成交原因和是否触发涨跌停限制",
        },
        {
            "key": "post_trade_review",
            "label": "是否完成盘后复盘",
            "expected": "复核原始假设、盘中触发项和次日计划调整",
        },
    ]


async def _build_trading_plan(signal_id: str, strategy_version: str) -> dict | None:
    context = _load_trading_plan_context(signal_id)
    if not context:
        return None
    signal = context["signal"]
    daily = context["daily"]
    factor = context["factor"]
    review = context["review"]
    risk = (await get_portfolio_risk(strategy_version=strategy_version, date=signal["date"])).data or {}
    price_plan = _build_price_plan(daily, factor)
    risk_gate = _build_trading_risk_gate(
        signal=signal,
        daily=daily,
        factor=factor,
        review=review,
        quality_rows=context["quality_rows"],
        risk=risk,
        price_plan=price_plan,
    )
    action = "watch"
    if risk_gate["status"] == "blocked":
        action = "blocked"
    elif signal.get("direction") == "opportunity" and review and review.get("decision_status") == "adopted":
        action = "buy"

    evidence = _safe_json_list(signal.get("evidence_json"))
    risks = _safe_json_list(signal.get("risk_json"))
    invalids = _safe_json_list(signal.get("invalid_json"))
    no_trade_reasons = list(risk_gate["blockers"])
    if action == "watch" and not no_trade_reasons:
        no_trade_reasons = list(risk_gate["warnings"][:2])

    invalidation_rules = [
        *invalids,
        f"收盘跌破硬止损 {price_plan.get('hard_stop')}",
        "Agent 审查状态改为 rejected",
        "出现未解决 critical/error 数据质量问题",
    ]
    return {
        "signal_id": signal["signal_id"],
        "symbol": signal["symbol"],
        "date": signal["date"],
        "signal_name": signal["signal_name"],
        "signal_level": signal.get("signal_level"),
        "strategy_version": signal.get("strategy_version"),
        "action": action,
        "review": {
            "review_id": review.get("review_id") if review else None,
            "decision_status": review.get("decision_status") if review else "pending",
            "confidence": review.get("confidence") if review else None,
            "summary": review.get("review_summary") if review else None,
        },
        "last_close": price_plan["last_close"],
        "atr14": price_plan["atr14"],
        "entry_zone": price_plan["entry_zone"],
        "hard_stop": price_plan["hard_stop"],
        "take_profit_1": price_plan["take_profit_1"],
        "take_profit_2": price_plan["take_profit_2"],
        "max_position_pct": price_plan["max_position_pct"],
        "max_loss_pct": price_plan["max_loss_pct"],
        "stop_distance_pct": price_plan["stop_distance_pct"],
        "add_condition": "仅当价格回到执行带、量能不弱于20日均量且风险闸门未阻断时加仓",
        "reduce_condition": "跌破硬止损、第一止盈后量能背离或 Agent 改判时减仓/退出",
        "no_trade_reasons": no_trade_reasons,
        "invalidation_rules": invalidation_rules,
        "evidence": evidence,
        "risks": risks,
        "risk_gate": risk_gate,
        "intraday_monitors": _build_intraday_monitors(price_plan, factor),
        "scenario_playbook": _build_scenario_playbook(price_plan),
        "discipline_checklist": _build_discipline_checklist(price_plan),
        "audit": {
            "daily_date": daily.get("date") if daily else None,
            "factor_date": factor.get("date") if factor else None,
            "trade_count": context["trade_count"],
            "generated_at": _now(),
            "disclaimer": "交易计划用于研究和模拟执行约束，不构成实盘指令。",
        },
    }


@router.get("/trading-plan", response_model=ApiResponse)
async def get_trading_plan(
    signal_id: str,
    strategy_version: str = "portfolio_v1",
):
    plan = await _build_trading_plan(signal_id=signal_id, strategy_version=strategy_version)
    if not plan:
        return ApiResponse(success=False, error=f"signal_id {signal_id} not found")
    return ApiResponse(success=True, data=plan)


@router.get("/signal-explain", response_model=ApiResponse)
async def get_signal_explain(
    signal_id: str,
    strategy_version: str = "resonance_v2",
):
    init_db()
    with get_connection() as conn:
        signal = _row(
            conn.execute(
                """
                SELECT *
                FROM signal_log
                WHERE signal_id = ?
                """,
                (signal_id,),
            ).fetchone()
        )
        if not signal:
            return ApiResponse(success=False, error=f"signal_id {signal_id} not found")
        review = _row(
            conn.execute(
                """
                SELECT *
                FROM agent_decision_log
                WHERE signal_id = ?
                ORDER BY COALESCE(resolved_at, created_at) DESC, created_at DESC, review_id DESC
                LIMIT 1
                """,
                (signal_id,),
            ).fetchone()
        )
        attribution = _row(
            conn.execute(
                """
                SELECT *
                FROM event_return
                WHERE signal_id = ?
                """,
                (signal_id,),
            ).fetchone()
        )

    symbol = signal["symbol"]
    signal_date = signal["date"]
    lineage = (await get_data_lineage(symbol, signal_date)).data or {}
    trading_plan = await _build_trading_plan(signal_id=signal_id, strategy_version=strategy_version)
    trade_proxy = _build_trade_proxy(symbol, signal_date)
    evidence = _safe_json_list(signal.get("evidence_json"))
    risks = _safe_json_list(signal.get("risk_json"))
    invalids = _safe_json_list(signal.get("invalid_json"))
    review_payload = {
        "review_id": review.get("review_id") if review else None,
        "action": review.get("action") if review else None,
        "confidence": review.get("confidence") if review else None,
        "decision_status": (review.get("decision_status") if review else None) or "pending",
        "summary": review.get("review_summary") if review else None,
        "bull_points": _safe_json_list(review.get("bull_points_json") if review else None),
        "bear_points": _safe_json_list(review.get("bear_points_json") if review else None),
        "risk_flags": _safe_json_list(review.get("risk_flags_json") if review else None),
        "missing_data": _safe_json_list(review.get("missing_data_json") if review else None),
    }
    decision_action = (trading_plan or {}).get("action") or (
        "blocked" if review_payload["decision_status"] == "rejected" else "watch"
    )
    return ApiResponse(
        success=True,
        data={
            "signal": {
                "signal_id": signal["signal_id"],
                "date": signal["date"],
                "symbol": signal["symbol"],
                "market": signal.get("market"),
                "signal_name": signal.get("signal_name"),
                "signal_level": signal.get("signal_level"),
                "direction": signal.get("direction"),
                "score": signal.get("score"),
                "strategy_version": signal.get("strategy_version"),
            },
            "layers": {
                "decision": {
                    "action": decision_action,
                    "review_status": review_payload["decision_status"],
                    "risk_status": ((trading_plan or {}).get("risk_gate") or {}).get("status"),
                    "next_step": _trading_next_step(
                        decision_action,
                        ((trading_plan or {}).get("risk_gate") or {}).get("status") or "warn",
                    ),
                },
                "explain": {
                    "evidence": evidence,
                    "risks": risks,
                    "invalidations": invalids,
                    "review_bull_points": review_payload["bull_points"],
                    "review_bear_points": review_payload["bear_points"],
                },
                "audit": {
                    "lineage": lineage,
                    "trade_proxy_status": trade_proxy.get("status"),
                    "generated_at": _now(),
                },
            },
            "review": review_payload,
            "attribution": attribution,
            "trading_plan": trading_plan,
            "trade_proxy": trade_proxy,
            "quality": {
                "trust_level": (
                    "good"
                    if (lineage.get("summary") or {}).get("coverage", 0) >= 0.8
                    else "warn"
                ),
                "missing_tables": [
                    item.get("table")
                    for item in lineage.get("items", [])
                    if item.get("status") == "missing"
                ],
            },
            "disclaimer": "信号解释用于研究审查和模拟执行，不构成投资建议或实盘指令。",
        },
    )


def _trading_next_step(action: str, risk_status: str) -> str:
    if action == "blocked" or risk_status == "blocked":
        return "禁止交易，先处理阻断项"
    if action == "buy":
        return "按交易计划执行并进入盘中监控"
    return "保留观察，等待审查或入场条件"


@router.get("/trading-calendar", response_model=ApiResponse)
async def get_trading_calendar(
    date: str | None = None,
    strategy_version: str = "portfolio_v1",
    limit: int = Query(default=30, ge=1, le=100),
):
    init_db()
    resolved_date = date or dt_date.today().isoformat()
    with get_connection() as conn:
        signals = _rows(
            conn.execute(
                """
                SELECT signal_id
                FROM signal_log
                WHERE date <= ?
                  AND direction = 'opportunity'
                ORDER BY date DESC, score DESC
                LIMIT ?
                """,
                (resolved_date, limit),
            ).fetchall()
        )
    plans = [
        await _build_trading_plan(row["signal_id"], strategy_version)
        for row in signals
    ]
    items = []
    for plan in plans:
        if not plan:
            continue
        risk_status = plan["risk_gate"]["status"]
        items.append(
            {
                "signal_id": plan["signal_id"],
                "date": plan["date"],
                "symbol": plan["symbol"],
                "signal_name": plan["signal_name"],
                "action": plan["action"],
                "risk_status": risk_status,
                "entry_zone": plan["entry_zone"],
                "hard_stop": plan["hard_stop"],
                "max_position_pct": plan["max_position_pct"],
                "monitor_count": len(plan["intraday_monitors"]),
                "blocker_count": len(plan["risk_gate"]["blockers"]),
                "warning_count": len(plan["risk_gate"]["warnings"]),
                "next_step": _trading_next_step(plan["action"], risk_status),
            }
        )
    return ApiResponse(
        success=True,
        data={
            "date": resolved_date,
            "strategy_version": strategy_version,
            "items": items,
            "summary": {
                "plan_count": len(items),
                "buy_count": sum(1 for item in items if item["action"] == "buy"),
                "blocked_count": sum(1 for item in items if item["action"] == "blocked"),
                "watch_count": sum(1 for item in items if item["action"] == "watch"),
                "monitor_count": sum(int(item["monitor_count"]) for item in items),
                "review_due_count": sum(1 for item in items if item["action"] == "watch"),
            },
        },
    )


def _decision_brief_status(
    *,
    trust_level: str,
    top_signal: dict | None,
    queue_summary: dict,
    risk_flags: list[str],
) -> dict:
    if trust_level == "blocked":
        return {
            "status": "blocked",
            "label": "禁止下结论",
            "summary": "核心数据缺口过大，只允许查看审计与补数建议。",
            "tone": "risk",
        }
    if queue_summary.get("approved_count", 0) > 0 and top_signal:
        return {
            "status": "actionable",
            "label": "可进入研究执行",
            "summary": f"{top_signal['symbol']} 有已采纳信号，执行前需确认成本、仓位和不可成交风险。",
            "tone": "opportunity" if not risk_flags else "watch",
        }
    if top_signal:
        return {
            "status": "watch",
            "label": "等待确认",
            "summary": "存在可研究信号，但还没有完成 Agent/人工审查闭环。",
            "tone": "watch",
        }
    return {
        "status": "empty",
        "label": "今日无强动作",
        "summary": "当前标的没有新的可执行信号，建议关注数据质量、组合风险和历史复盘。",
        "tone": "neutral",
    }


def _brief_next_steps(
    *,
    trust_level: str,
    missing_tables: list[str],
    queue_summary: dict,
    risk_flags: list[str],
) -> list[dict]:
    steps: list[dict] = []
    if trust_level != "good":
        steps.append(
            {
                "priority": "P0",
                "title": "补齐核心数据缺口",
                "detail": f"缺失或覆盖不足：{', '.join(missing_tables) if missing_tables else '字段覆盖偏低'}",
                "target_view": "health",
            }
        )
    if queue_summary.get("approved_count", 0) > 0:
        steps.append(
            {
                "priority": "P0",
                "title": "确认模拟执行参数",
                "detail": "已采纳信号进入执行前，检查仓位、滑点、成交限制和止损计划。",
                "target_view": "review",
            }
        )
    elif queue_summary.get("pending_count", 0) > 0:
        steps.append(
            {
                "priority": "P0",
                "title": "完成信号审查闭环",
                "detail": "候选信号仍在等待 Agent 审查或人工确认。",
                "target_view": "review",
            }
        )
    for flag in risk_flags[:2]:
        steps.append(
            {
                "priority": "P1",
                "title": "复核组合风险",
                "detail": flag,
                "target_view": "portfolioRisk",
            }
        )
    if not steps:
        steps.append(
            {
                "priority": "P1",
                "title": "更新复盘和归因",
                "detail": "当前没有阻断项，建议沉淀今日观察、历史胜率和失败标签。",
                "target_view": "report",
            }
        )
    return steps


def _governance_item(
    *,
    key: str,
    title: str,
    status: str,
    user_impact: str,
    evidence: list[str],
    target_view: str,
    depth: str,
) -> dict:
    return {
        "key": key,
        "title": title,
        "status": status,
        "user_impact": user_impact,
        "evidence": evidence,
        "target_view": target_view,
        "depth": depth,
    }


def _coverage_status(value: float, *, ready: float = 0.75, warn: float = 0.35) -> str:
    if value >= ready:
        return "ready"
    if value >= warn:
        return "warn"
    return "blocker"


@router.get("/investment-governance", response_model=ApiResponse)
async def get_investment_governance(
    symbol: str,
    date: str | None = None,
    strategy_version: str = "portfolio_v1",
):
    init_db()
    normalized = normalize_market_symbol(symbol)
    resolved_date = date or dt_date.today().isoformat()
    index_profile = resolve_index_profile(normalized)
    if index_profile:
        latest_bar = _latest_index_row(normalized, resolved_date)
        factor, _, rows = _index_factor_payload(normalized, resolved_date)
        with get_connection() as conn:
            signal_stats = _row(
                conn.execute(
                    """
                    SELECT
                        COUNT(*) AS signal_count,
                        SUM(CASE WHEN e.signal_id IS NOT NULL THEN 1 ELSE 0 END) AS attributed_count
                    FROM signal_log s
                    LEFT JOIN event_return e ON e.signal_id = s.signal_id
                    WHERE s.symbol = ? AND s.date <= ?
                    """,
                    (normalized, resolved_date),
                ).fetchone()
            ) or {"signal_count": 0, "attributed_count": 0}
            news_stats = _row(
                conn.execute(
                    """
                    SELECT COUNT(*) AS news_count, COUNT(DISTINCT source) AS source_count
                    FROM news_evidence
                    WHERE symbol = ? AND date <= ?
                    """,
                    (normalized, resolved_date),
                ).fetchone()
            ) or {"news_count": 0, "source_count": 0}
            trade_stats = _row(
                conn.execute(
                    """
                    SELECT
                        COUNT(*) AS trade_count,
                        SUM(CASE WHEN cost IS NOT NULL AND cost > 0 THEN 1 ELSE 0 END) AS costed_count
                    FROM trade_log
                    WHERE strategy_version = ? AND symbol = ? AND date <= ?
                    """,
                    (strategy_version, normalized, resolved_date),
                ).fetchone()
            ) or {"trade_count": 0, "costed_count": 0}
            quality_stats = _row(
                conn.execute(
                    """
                    SELECT
                        COUNT(*) AS open_count,
                        SUM(CASE WHEN severity IN ('critical', 'error') THEN 1 ELSE 0 END) AS blocker_count
                    FROM data_quality_log
                    WHERE (symbol = ? OR symbol IS NULL)
                      AND (date IS NULL OR date <= ?)
                      AND COALESCE(resolution_status, 'open') != 'resolved'
                    """,
                    (normalized, resolved_date),
                ).fetchone()
            ) or {"open_count": 0, "blocker_count": 0}
        risk = (await get_portfolio_risk(strategy_version=strategy_version, date=resolved_date)).data or {}
        signal_count = int(signal_stats.get("signal_count") or 0)
        attributed_count = int(signal_stats.get("attributed_count") or 0)
        attribution_coverage = attributed_count / signal_count if signal_count else 0.0
        risk_budget = risk.get("risk_budget") or []
        trade_proxy = _build_trade_proxy(normalized, resolved_date)
        default_proxy = trade_proxy.get("default_proxy") or {}
        p0_items = [
            _governance_item(
                key="index_history_integrity",
                title="指数行情/成交额口径",
                status="ready" if latest_bar and len(rows) >= 20 else ("warn" if latest_bar else "blocker"),
                user_impact="指数策略必须先确认宽基行情、成交额和最新交易日一致。",
                evidence=[
                    f"最新指数日线 {latest_bar.get('date') if latest_bar else '-'}",
                    f"可用样本 {len(rows)}",
                ],
                target_view="symbolWorkspace",
                depth="audit",
            ),
            _governance_item(
                key="universe_benchmark",
                title="指数自身基准体系",
                status="ready" if latest_bar else "blocker",
                user_impact="指数标的以自身时间序列和风格代理作为参照，不能按个股行业样本判断。",
                evidence=[f"指数 {index_profile.name}", f"代码 {normalized}"],
                target_view="factorResearch",
                depth="explain",
            ),
            _governance_item(
                key="execution_model",
                title="ETF/期货代理执行模型",
                status="ready" if int(trade_stats.get("trade_count") or 0) and int(trade_stats.get("costed_count") or 0) else "warn",
                user_impact="指数不能直接下单，执行前必须映射 ETF、股指期货或篮子组合。",
                evidence=[
                    f"交易样本 {int(trade_stats.get('trade_count') or 0)}",
                    f"成本记录 {int(trade_stats.get('costed_count') or 0)}",
                ],
                target_view="backtest",
                depth="audit",
            ),
            _governance_item(
                key="signal_attribution",
                title="指数信号归因/复盘闭环",
                status="ready" if attribution_coverage >= 0.5 else "warn",
                user_impact="指数信号需要解释后续收益、回撤和风格轮动是否按预期发生。",
                evidence=[
                    f"信号 {signal_count}",
                    f"已归因 {attributed_count}",
                    f"覆盖 {attribution_coverage:.0%}",
                ],
                target_view="signalHistory",
                depth="explain",
            ),
            _governance_item(
                key="hard_data_block",
                title="数据质量阻断机制",
                status="ready" if int(quality_stats.get("blocker_count") or 0) == 0 else "blocker",
                user_impact="核心指数行情有阻断问题时，只允许观察和补数。",
                evidence=[
                    f"未解决问题 {int(quality_stats.get('open_count') or 0)}",
                    f"阻断问题 {int(quality_stats.get('blocker_count') or 0)}",
                ],
                target_view="health",
                depth="audit",
            ),
        ]
        p1_items = [
            _governance_item(
                key="index_factor_validation",
                title="指数趋势/波动/量能验证",
                status="ready" if factor and len(rows) >= 20 else "warn",
                user_impact="指数研究更关注趋势、波动、成交额和风格轮动，而不是个股财务。",
                evidence=[
                    f"样本 {len(rows)}",
                    f"20日收益 {factor.get('ret20') if factor else '-'}",
                ],
                target_view="factorResearch",
                depth="audit",
            ),
            _governance_item(
                key="trade_proxy_mapping",
                title="可交易代理映射",
                status="ready" if trade_proxy.get("status") == "mapped" else "warn",
                user_impact="专业执行需要把指数信号映射到 ETF/期货并纳入流动性、折溢价和合约展期。",
                evidence=[
                    "当前已识别为指数标的",
                    (
                        f"默认代理 {default_proxy.get('symbol')} {default_proxy.get('name')}"
                        if default_proxy
                        else "尚未绑定默认交易代理"
                    ),
                    f"检查项 {len(trade_proxy.get('execution_checks') or [])}",
                ],
                target_view="backtest",
                depth="decision",
            ),
            _governance_item(
                key="news_event_taxonomy",
                title="宏观/政策/风格事件结构化",
                status="ready" if int(news_stats.get("news_count") or 0) and int(news_stats.get("source_count") or 0) else "warn",
                user_impact="指数事件应按政策、流动性、风格、风险偏好分类进入证据链。",
                evidence=[
                    f"新闻 {int(news_stats.get('news_count') or 0)}",
                    f"来源 {int(news_stats.get('source_count') or 0)}",
                ],
                target_view="newsEvidence",
                depth="explain",
            ),
            _governance_item(
                key="portfolio_risk_depth",
                title="组合风险深度",
                status="ready" if risk_budget else "warn",
                user_impact="指数仓位也需要暴露、回撤、相关性和压力测试约束。",
                evidence=[
                    f"持仓 {risk.get('concentration', {}).get('position_count', 0)}",
                    f"风险预算 {len(risk_budget)}",
                ],
                target_view="portfolioRisk",
                depth="explain",
            ),
            _governance_item(
                key="committee_report",
                title="投委会式报告结构",
                status="ready",
                user_impact="日报需要固定沉淀指数状态、组合风险、信号和明日观察清单。",
                evidence=["专业日报接口已接入", "投研首页已分层"],
                target_view="report",
                depth="decision",
            ),
            _governance_item(
                key="ux_layering",
                title="决策层/解释层/审计层体验",
                status="ready",
                user_impact="指数结论默认显示动作和风险灯，展开后追溯行情和技术口径。",
                evidence=["投研首页", "解释入口", "审计入口"],
                target_view="brief",
                depth="decision",
            ),
        ]
        all_items = p0_items + p1_items
        ready_count = sum(1 for item in all_items if item["status"] == "ready")
        blocker_items = [item for item in p0_items if item["status"] == "blocker"]
        return ApiResponse(
            success=True,
            data={
                "symbol": normalized,
                "asset_type": "index",
                "name": index_profile.name,
                "date": resolved_date,
                "strategy_version": strategy_version,
                "groups": {"P0": p0_items, "P1": p1_items},
                "summary": {
                    "p0_total": len(p0_items),
                    "p0_ready_count": sum(1 for item in p0_items if item["status"] == "ready"),
                    "p0_blocker_count": len(blocker_items),
                    "p1_total": len(p1_items),
                    "p1_ready_count": sum(1 for item in p1_items if item["status"] == "ready"),
                    "decision_blocked": bool(blocker_items),
                    "maturity_score": ready_count / len(all_items) if all_items else 0.0,
                },
                "hard_blocks": blocker_items,
                "generated_at": _now(),
            },
        )
    with get_connection() as conn:
        daily = _row(
            conn.execute(
                """
                SELECT *
                FROM daily_bars
                WHERE symbol = ? AND date <= ?
                ORDER BY date DESC
                LIMIT 1
                """,
                (normalized, resolved_date),
            ).fetchone()
        )
        factor = _row(
            conn.execute(
                """
                SELECT *
                FROM factor_daily
                WHERE symbol = ? AND date <= ?
                ORDER BY date DESC
                LIMIT 1
                """,
                (normalized, resolved_date),
            ).fetchone()
        )
        fundamental = _row(
            conn.execute(
                """
                SELECT *
                FROM fundamental_snapshot
                WHERE symbol = ? AND date <= ?
                ORDER BY date DESC
                LIMIT 1
                """,
                (normalized, resolved_date),
            ).fetchone()
        )
        profile = _row(
            conn.execute(
                """
                SELECT symbol, name, market, industry
                FROM watchlist
                WHERE symbol = ?
                """,
                (normalized,),
            ).fetchone()
        )
        if not profile:
            profile = _row(
                conn.execute(
                    """
                    SELECT symbol, name, market, industry
                    FROM security_master
                    WHERE symbol = ?
                    """,
                    (normalized,),
                ).fetchone()
            )
        instrument_market = (
            (profile or {}).get("market")
            or (daily or {}).get("market")
            or ("HONGKONG" if normalized.endswith(".HK") else "CHINA" if normalized.endswith((".SH", ".SZ", ".BJ")) else "US")
        )
        instrument_market = str(instrument_market).upper()
        industry = profile.get("industry") if profile else None
        peer_count = int(
            conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM watchlist
                WHERE (? IS NULL OR industry = ?)
                """,
                (industry, industry),
            ).fetchone()["count"]
            or 0
        )
        index_bar = _row(
            conn.execute(
                """
                SELECT *
                FROM index_bars
                WHERE date <= ?
                ORDER BY date DESC
                LIMIT 1
                """,
                (resolved_date,),
            ).fetchone()
        )
        signal_stats = _row(
            conn.execute(
                """
                SELECT
                    COUNT(*) AS signal_count,
                    SUM(CASE WHEN e.signal_id IS NOT NULL THEN 1 ELSE 0 END) AS attributed_count
                FROM signal_log s
                LEFT JOIN event_return e ON e.signal_id = s.signal_id
                WHERE s.symbol = ? AND s.date <= ?
                """,
                (normalized, resolved_date),
            ).fetchone()
        ) or {"signal_count": 0, "attributed_count": 0}
        news_stats = _row(
            conn.execute(
                """
                SELECT COUNT(*) AS news_count, COUNT(DISTINCT source) AS source_count
                FROM news_evidence
                WHERE symbol = ? AND date <= ?
                """,
                (normalized, resolved_date),
            ).fetchone()
        ) or {"news_count": 0, "source_count": 0}
        trade_stats = _row(
            conn.execute(
                """
                SELECT
                    COUNT(*) AS trade_count,
                    SUM(CASE WHEN cost IS NOT NULL AND cost > 0 THEN 1 ELSE 0 END) AS costed_count
                FROM trade_log
                WHERE strategy_version = ? AND symbol = ? AND date <= ?
                """,
                (strategy_version, normalized, resolved_date),
            ).fetchone()
        ) or {"trade_count": 0, "costed_count": 0}
        quality_stats = _row(
            conn.execute(
                """
                SELECT
                    COUNT(*) AS open_count,
                    SUM(CASE WHEN severity IN ('critical', 'error') THEN 1 ELSE 0 END) AS blocker_count
                FROM data_quality_log
                WHERE (symbol = ? OR symbol IS NULL)
                  AND (date IS NULL OR date <= ?)
                  AND COALESCE(resolution_status, 'open') != 'resolved'
                  AND NOT (
                    ? IS NOT NULL
                    AND check_name IN ('data_sync', 'index_sync')
                    AND created_at IS NOT NULL
                    AND created_at < ?
                  )
                """,
                (
                    normalized,
                    resolved_date,
                    daily.get("updated_at") if daily else None,
                    daily.get("updated_at") if daily else None,
                ),
            ).fetchone()
        ) or {"open_count": 0, "blocker_count": 0}

    risk = (await get_portfolio_risk(strategy_version=strategy_version, date=resolved_date)).data or {}

    adjustment_fields = [
        daily.get("adj_factor") if daily else None,
        daily.get("limit_up") if daily else None,
        daily.get("limit_down") if daily else None,
        daily.get("is_suspended") if daily else None,
    ]
    adjustment_coverage = sum(value is not None for value in adjustment_fields) / len(adjustment_fields)
    if not daily:
        adjustment_status = "blocker"
        adjustment_evidence = ["最新日线 -", "缺少行情，无法确认交易规则口径"]
    elif instrument_market == "CHINA":
        adjustment_status = _coverage_status(adjustment_coverage, ready=1.0, warn=0.5)
        adjustment_evidence = [
            f"最新日线 {daily.get('date')}",
            f"复权与交易规则字段覆盖 {adjustment_coverage:.0%}",
        ]
    else:
        has_ohlc = all(daily.get(field) is not None for field in ("open", "high", "low", "close"))
        adjustment_status = "ready" if has_ohlc else "warn"
        market_label = "港股" if instrument_market == "HONGKONG" else instrument_market
        adjustment_evidence = [
            f"最新日线 {daily.get('date')}",
            f"{market_label}无A股涨跌停限制，按本市场交易规则评估",
            f"停牌字段 {'已覆盖' if daily.get('is_suspended') is not None else '缺失'}",
        ]
    signal_count = int(signal_stats.get("signal_count") or 0)
    attributed_count = int(signal_stats.get("attributed_count") or 0)
    attribution_coverage = attributed_count / signal_count if signal_count else 0.0
    fundamental_coverage = _field_coverage(
        fundamental,
        ["revenue", "net_income", "eps", "roe", "gross_margin", "pe_ttm", "pb", "dividend_yield"],
    )
    factor_effectiveness = (
        _factor_effectiveness(factor_date=factor["date"], industry=industry)
        if factor and factor.get("date")
        else {"observations": 0}
    )
    risk_budget = risk.get("risk_budget") or []
    p0_items = [
        _governance_item(
            key="price_adjustment_trading_rules",
            title="复权/停复牌/涨跌停口径",
            status=adjustment_status,
            user_impact="K线、因子和回测必须共享同一价格口径，否则收益和信号会失真。",
            evidence=adjustment_evidence,
            target_view="symbolWorkspace",
            depth="audit",
        ),
        _governance_item(
            key="universe_benchmark",
            title="股票池/行业/基准体系",
            status="ready" if industry and peer_count >= 2 and index_bar else ("warn" if industry or index_bar else "blocker"),
            user_impact="相对强弱、行业暴露和超额收益必须有稳定参照系。",
            evidence=[
                f"行业 {industry or '-'}",
                f"同组样本 {peer_count}",
                f"基准 {index_bar.get('index_symbol') if index_bar else '-'}",
            ],
            target_view="factorResearch",
            depth="explain",
        ),
        _governance_item(
            key="execution_model",
            title="交易撮合/成本模型",
            status="ready" if int(trade_stats.get("trade_count") or 0) and int(trade_stats.get("costed_count") or 0) else "warn",
            user_impact="执行前需要明确成本、滑点、仓位和不可成交假设。",
            evidence=[
                f"交易样本 {int(trade_stats.get('trade_count') or 0)}",
                f"成本记录 {int(trade_stats.get('costed_count') or 0)}",
            ],
            target_view="backtest",
            depth="audit",
        ),
        _governance_item(
            key="signal_attribution",
            title="信号归因/复盘闭环",
            status="ready" if attribution_coverage >= 0.5 else ("warn" if signal_count else "blocker"),
            user_impact="每个信号需要解释收益来源、失败原因和是否违反原计划。",
            evidence=[
                f"信号 {signal_count}",
                f"已归因 {attributed_count}",
                f"覆盖 {attribution_coverage:.0%}",
            ],
            target_view="signalHistory",
            depth="explain",
        ),
        _governance_item(
            key="hard_data_block",
            title="数据质量阻断机制",
            status="ready" if int(quality_stats.get("blocker_count") or 0) == 0 else "blocker",
            user_impact="核心数据有阻断问题时，系统只能给观察/补数建议，不能给强动作。",
            evidence=[
                f"未解决问题 {int(quality_stats.get('open_count') or 0)}",
                f"阻断问题 {int(quality_stats.get('blocker_count') or 0)}",
            ],
            target_view="health",
            depth="audit",
        ),
    ]
    p1_items = [
        _governance_item(
            key="fundamental_depth",
            title="财务/估值分析深度",
            status=_coverage_status(fundamental_coverage, ready=0.75, warn=0.35),
            user_impact="基本面结论需要三表、盈利能力、估值和现金流质量支撑。",
            evidence=[
                f"财务字段覆盖 {fundamental_coverage:.0%}",
                f"来源 {fundamental.get('source') if fundamental else '-'}",
            ],
            target_view="fundamentals",
            depth="explain",
        ),
        _governance_item(
            key="news_event_taxonomy",
            title="新闻事件结构化",
            status="ready" if int(news_stats.get("news_count") or 0) and int(news_stats.get("source_count") or 0) else "warn",
            user_impact="新闻需要按事件类型、来源可信度和影响方向进入证据链。",
            evidence=[
                f"新闻 {int(news_stats.get('news_count') or 0)}",
                f"来源 {int(news_stats.get('source_count') or 0)}",
            ],
            target_view="newsEvidence",
            depth="explain",
        ),
        _governance_item(
            key="factor_validation",
            title="因子有效性验证",
            status="ready" if int(factor_effectiveness.get("observations") or 0) >= 3 else ("warn" if factor else "blocker"),
            user_impact="因子要看 IC、分层收益、衰减和样本数，避免只看单点排名。",
            evidence=[
                f"样本 {int(factor_effectiveness.get('observations') or 0)}",
                f"RankIC {factor_effectiveness.get('rank_ic20') if factor_effectiveness.get('rank_ic20') is not None else '-'}",
            ],
            target_view="factorResearch",
            depth="audit",
        ),
        _governance_item(
            key="portfolio_risk_depth",
            title="组合风险深度",
            status="ready" if risk_budget else "warn",
            user_impact="组合需要风险预算、行业暴露、集中度和压力测试，而不是只看个股。",
            evidence=[
                f"持仓 {risk.get('concentration', {}).get('position_count', 0)}",
                f"风险预算 {len(risk_budget)}",
            ],
            target_view="portfolioRisk",
            depth="explain",
        ),
        _governance_item(
            key="committee_report",
            title="投委会式报告结构",
            status="ready",
            user_impact="日报需要固定沉淀市场结论、组合风险、信号、异常数据和明日观察清单。",
            evidence=["专业日报接口已接入", "投研首页已分层"],
            target_view="report",
            depth="decision",
        ),
        _governance_item(
            key="ux_layering",
            title="决策层/解释层/审计层体验",
            status="ready",
            user_impact="默认降低认知负担，专业用户仍可追溯到底层指标和口径。",
            evidence=["投研首页", "解释入口", "审计入口"],
            target_view="brief",
            depth="decision",
        ),
    ]
    all_items = p0_items + p1_items
    ready_count = sum(1 for item in all_items if item["status"] == "ready")
    blocker_items = [item for item in p0_items if item["status"] == "blocker"]
    maturity_score = ready_count / len(all_items) if all_items else 0.0
    return ApiResponse(
        success=True,
        data={
            "symbol": normalized,
            "date": resolved_date,
            "strategy_version": strategy_version,
            "groups": {"P0": p0_items, "P1": p1_items},
            "summary": {
                "p0_total": len(p0_items),
                "p0_ready_count": sum(1 for item in p0_items if item["status"] == "ready"),
                "p0_blocker_count": len(blocker_items),
                "p1_total": len(p1_items),
                "p1_ready_count": sum(1 for item in p1_items if item["status"] == "ready"),
                "decision_blocked": bool(blocker_items),
                "maturity_score": maturity_score,
            },
            "hard_blocks": blocker_items,
            "generated_at": _now(),
        },
    )


@router.get("/decision-brief", response_model=ApiResponse)
async def get_decision_brief(
    symbol: str,
    date: str | None = None,
    strategy_version: str = "portfolio_v1",
):
    init_db()
    normalized = normalize_market_symbol(symbol)
    resolved_date = date or dt_date.today().isoformat()
    lineage = (await get_data_lineage(normalized, resolved_date)).data or {}
    queue = (
        await get_execution_queue(
            date=resolved_date,
            strategy_version=None,
            symbol=normalized,
            limit=100,
        )
    ).data or {}
    risk = (await get_portfolio_risk(strategy_version=strategy_version, date=resolved_date)).data or {}

    with get_connection() as conn:
        top_signal_row = conn.execute(
            """
            SELECT s.*, e.ret_20d, e.max_adverse_20d, e.fail_reason
            FROM signal_log s
            LEFT JOIN event_return e ON e.signal_id = s.signal_id
            WHERE s.symbol = ? AND s.date <= ?
            ORDER BY s.date DESC, s.score DESC
            LIMIT 1
            """,
            (normalized, resolved_date),
        ).fetchone()
        open_quality_rows = conn.execute(
            """
            SELECT *
            FROM data_quality_log
            WHERE (symbol = ? OR symbol IS NULL)
              AND (date IS NULL OR date <= ?)
              AND COALESCE(resolution_status, 'open') != 'resolved'
            ORDER BY id DESC
            LIMIT 8
            """,
            (normalized, resolved_date),
        ).fetchall()
        latest_review_row = None
        if top_signal_row:
            latest_review_row = conn.execute(
                """
                SELECT *
                FROM agent_decision_log
                WHERE signal_id = ?
                ORDER BY COALESCE(resolved_at, created_at) DESC, created_at DESC, review_id DESC
                LIMIT 1
                """,
                (top_signal_row["signal_id"],),
            ).fetchone()

    top_signal = _row(top_signal_row)
    if top_signal:
        top_signal["evidence"] = _safe_json_list(top_signal.get("evidence_json"))[:3]
        top_signal["risks"] = _safe_json_list(top_signal.get("risk_json"))[:3]
    latest_review = _row(latest_review_row)
    if latest_review:
        latest_review["risk_flags"] = _safe_json_list(latest_review.get("risk_flags_json"))[:3]
        latest_review["missing_data"] = _safe_json_list(latest_review.get("missing_data_json"))[:3]

    lineage_items = lineage.get("items", [])
    missing_tables = [item["table"] for item in lineage_items if item.get("status") == "missing"]
    coverage = float(lineage.get("summary", {}).get("coverage") or 0)
    low_coverage_tables = [
        item["table"]
        for item in lineage_items
        if item.get("status") == "available" and float(item.get("field_coverage") or 0) < 0.6
    ]
    trust_level = "good"
    if coverage < 0.6 or "daily_bars" in missing_tables or "factor_daily" in missing_tables:
        trust_level = "blocked"
    elif missing_tables or low_coverage_tables:
        trust_level = "warn"

    risk_flags: list[str] = []
    exposure = risk.get("exposure", {})
    concentration = risk.get("concentration", {})
    drawdown = risk.get("drawdown", {})
    gross_exposure_pct = exposure.get("gross_exposure_pct")
    top_weight = concentration.get("top_weight")
    current_drawdown = drawdown.get("current_drawdown")
    if isinstance(gross_exposure_pct, (int, float)) and gross_exposure_pct > 0.85:
        risk_flags.append("组合总暴露超过 85%，需要复核现金与风险预算。")
    if isinstance(top_weight, (int, float)) and abs(top_weight) > 0.2:
        risk_flags.append(f"单票 {concentration.get('top_symbol') or '-'} 权重超过 20%。")
    if isinstance(current_drawdown, (int, float)) and current_drawdown < -0.08:
        risk_flags.append("当前组合回撤超过 8%，建议降低新增风险暴露。")

    queue_summary = queue.get("summary", {})
    decision_layer = _decision_brief_status(
        trust_level=trust_level,
        top_signal=top_signal,
        queue_summary=queue_summary,
        risk_flags=risk_flags,
    )
    next_steps = _brief_next_steps(
        trust_level=trust_level,
        missing_tables=missing_tables + low_coverage_tables,
        queue_summary=queue_summary,
        risk_flags=risk_flags,
    )
    explainers = [
        {
            "label": "个股工作台",
            "value": top_signal["signal_name"] if top_signal else "暂无主信号",
            "detail": "查看 K 线、V2策略、买卖确认和价格通道。",
            "target_view": "symbolWorkspace",
        },
        {
            "label": "信号审查",
            "value": latest_review.get("decision_status") if latest_review else "pending",
            "detail": latest_review.get("review_summary") if latest_review else "等待 Agent 审查闭环。",
            "target_view": "review",
        },
        {
            "label": "回测审计",
            "value": "成本/不可成交/基准",
            "detail": "查看事件回测、组合回测、滑点、仓位约束和不可成交样本。",
            "target_view": "backtest",
        },
        {
            "label": "数据血缘",
            "value": f"{int(coverage * 100)}%",
            "detail": "查看行情、因子、财务、新闻和信号的数据可用性。",
            "target_view": "fundamentals",
        },
    ]

    return ApiResponse(
        success=True,
        data={
            "symbol": normalized,
            "date": resolved_date,
            "strategy_version": strategy_version,
            "decision_layer": decision_layer,
            "layers": [
                {"key": "decision", "label": "决策层", "summary": "默认只展示动作、风险灯和下一步。"},
                {"key": "explain", "label": "解释层", "summary": "展开查看信号依据、审查结论和风险来源。"},
                {"key": "audit", "label": "审计层", "summary": "继续追溯数据血缘、回测口径和同步记录。"},
            ],
            "trust": {
                "level": trust_level,
                "coverage": coverage,
                "missing_tables": missing_tables,
                "low_coverage_tables": low_coverage_tables,
                "items": lineage_items,
                "open_quality_issues": _rows(open_quality_rows),
            },
            "today": {
                "top_signal": top_signal,
                "latest_review": latest_review,
                "queue_summary": queue_summary,
                "queue_items": queue.get("items", [])[:8],
            },
            "risk": {
                "position_count": concentration.get("position_count", 0),
                "gross_exposure_pct": gross_exposure_pct,
                "top_symbol": concentration.get("top_symbol"),
                "top_weight": top_weight,
                "current_drawdown": current_drawdown,
                "risk_flags": risk_flags,
            },
            "explainers": explainers,
            "next_steps": next_steps,
            "audit": {
                "generated_at": _now(),
                "sync_trace_count": len(lineage.get("sync_traces", [])),
                "sync_traces": lineage.get("sync_traces", [])[:5],
                "disclaimer": "本简报用于研究分层与审计，不构成投资建议或实盘指令。",
            },
        },
    )


@router.get("/sync-trace", response_model=ApiResponse)
async def get_sync_trace(
    symbol: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
):
    init_db()
    normalized = normalize_market_symbol(symbol) if symbol else None
    query = """
        SELECT *
        FROM sync_trace
    """
    params: list[Any] = []
    if normalized:
        query += " WHERE symbol = ?"
        params.append(normalized)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    with get_connection() as conn:
        traces = _rows(conn.execute(query, params).fetchall())
    status_counts = Counter(row.get("status") or "unknown" for row in traces)
    return ApiResponse(
        success=True,
        data={
            "symbol": normalized,
            "traces": traces,
            "summary": {
                "total": len(traces),
                "success_count": status_counts.get("success", 0),
                "failed_count": status_counts.get("failed", 0) + status_counts.get("error", 0),
                "status_counts": dict(status_counts),
            },
        },
    )
