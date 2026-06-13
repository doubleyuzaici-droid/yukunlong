"""Symbol Workspace V2 — 公司事件 / 龙虎榜机构席位 数据源 (D 级 BE-5 + BE-7)

akshare 是可选依赖（pyproject.toml 的 china extra）。
当 akshare 不可用 / 接口报错 / 网络不通时，全部函数返回空 list，
让上层路由能保留 success=True，前端走 partial 态。
"""
from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

try:
    import akshare as ak  # type: ignore[import-untyped]
    _AK_AVAILABLE = True
except Exception:  # pragma: no cover - 环境没装 akshare
    ak = None  # type: ignore[assignment]
    _AK_AVAILABLE = False


def is_available() -> bool:
    return _AK_AVAILABLE


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _event_id(symbol: str, date: str, event_type: str, title: str) -> str:
    raw = f"{symbol}|{date}|{event_type}|{title}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _desk_id(symbol: str, date: str, desk_name: str) -> str:
    raw = f"{symbol}|{date}|{desk_name}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _stem(symbol: str) -> str:
    """600519.SH → 600519，akshare 的 lhb/解禁 接口大多用裸代码。"""
    if "." in symbol:
        return symbol.split(".", 1)[0]
    return symbol


def _safe(fn, *args, label: str = "", **kwargs) -> Any:
    if not _AK_AVAILABLE:
        return None
    try:
        return fn(*args, **kwargs)
    except Exception as exc:  # pragma: no cover - 外部接口异常
        # 不要让上层 500；上层会把 None 转为空数组
        import logging

        logging.getLogger(__name__).warning(
            "akshare %s failed (%s): %s", label, ",".join(map(str, args)), exc
        )
        return None


# ============================================================
# BE-5: 公司事件
# ============================================================


def fetch_unlock_events(symbol: str) -> list[dict]:
    """限售解禁。akshare: stock_restricted_release_summary_em。

    返回字段：date / amount / shares / pct
    """
    if not _AK_AVAILABLE:
        return []
    df = _safe(
        ak.stock_restricted_release_summary_em,
        symbol=_stem(symbol),
        label="restricted_release",
    )
    if df is None or len(df) == 0:
        return []
    out: list[dict] = []
    code = _stem(symbol)
    for _, row in df.iterrows():
        # akshare 字段名因版本不同会变；用宽松取值
        date = str(row.get("解禁时间") or row.get("解禁日期") or row.get("date") or "")[:10]
        amount = row.get("解禁市值") or row.get("解禁金额") or None
        if not date:
            continue
        title = f"限售解禁 {row.get('占总股本比例', '')}"
        try:
            amount_f = float(amount) if amount is not None else None
        except (TypeError, ValueError):
            amount_f = None
        out.append(
            {
                "event_id": _event_id(symbol, date, "unlock", title),
                "symbol": symbol,
                "event_date": date,
                "event_type": "unlock",
                "title": title.strip(),
                "tone": "warning",
                "note": str(row.get("解除限售股份类型") or ""),
                "amount": amount_f,
                "source": "akshare:stock_restricted_release_summary_em",
                "url": None,
                "created_at": _now_iso(),
            }
        )
    return out


def fetch_dividend_events(symbol: str) -> list[dict]:
    """分红派息。akshare: stock_dividend_cninfo。"""
    if not _AK_AVAILABLE:
        return []
    df = _safe(ak.stock_dividend_cninfo, symbol=_stem(symbol), label="dividend")
    if df is None or len(df) == 0:
        return []
    out: list[dict] = []
    for _, row in df.iterrows():
        date = str(row.get("除权除息日期") or row.get("派息日期") or row.get("公告日期") or "")[:10]
        if not date:
            continue
        plan = str(row.get("分红方案") or row.get("派息方案") or "")
        out.append(
            {
                "event_id": _event_id(symbol, date, "dividend", plan or "分红派息"),
                "symbol": symbol,
                "event_date": date,
                "event_type": "dividend",
                "title": plan.strip() or "分红派息",
                "tone": "success",
                "note": str(row.get("利润分配") or ""),
                "amount": None,
                "source": "akshare:stock_dividend_cninfo",
                "url": None,
                "created_at": _now_iso(),
            }
        )
    return out


# ============================================================
# BE-7: 龙虎榜机构席位
# ============================================================


def fetch_lhb_desks(symbol: str, start: str, end: str) -> list[dict]:
    """龙虎榜每日详情。akshare: stock_lhb_detail_em / stock_lhb_stock_detail_em。

    符号会按日期遍历返回；只关心 buy_amount/sell_amount/desk_name。
    """
    if not _AK_AVAILABLE:
        return []
    df = _safe(
        ak.stock_lhb_stock_detail_em,
        symbol=_stem(symbol),
        date=end.replace("-", ""),
        flag="买入",
        label="lhb_buy",
    )
    if df is None:
        return []
    # 通常返回字段：交易营业部 / 买入金额 / 卖出金额 / 净买入金额 / 类型
    out: list[dict] = []
    for _, row in df.iterrows():
        desk_name = str(row.get("交易营业部") or row.get("营业部名称") or "").strip()
        if not desk_name:
            continue
        try:
            buy_amount = float(row.get("买入金额") or 0)
        except (TypeError, ValueError):
            buy_amount = 0.0
        try:
            sell_amount = float(row.get("卖出金额") or 0)
        except (TypeError, ValueError):
            sell_amount = 0.0
        try:
            net = float(row.get("净额") or row.get("净买入金额") or (buy_amount - sell_amount))
        except (TypeError, ValueError):
            net = buy_amount - sell_amount
        if "沪股通" in desk_name or "深股通" in desk_name or "陆股通" in desk_name:
            tag = "北向"
        elif "机构" in desk_name:
            tag = "机构"
        else:
            tag = "游资"
        out.append(
            {
                "desk_id": _desk_id(symbol, end, desk_name),
                "date": end,
                "symbol": symbol,
                "desk_name": desk_name,
                "desk_tag": tag,
                "net_buy": net,
                "buy_amount": buy_amount,
                "sell_amount": sell_amount,
                "source": "akshare:stock_lhb_stock_detail_em",
                "created_at": _now_iso(),
            }
        )
    return out


# ============================================================
# #4: 卖方研报 / 一致预期（stock_research_report_em）
# 注意：该接口有"东财评级/机构/日期/盈利预测EPS"，但通常无明确目标价列
# ============================================================


def _report_id(symbol: str, date: str, org: str, title: str) -> str:
    raw = f"{symbol}|{date}|{org}|{title}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _pick_col(row: dict, *keywords: str):
    """从一行 dict 里按关键字模糊找列值（容错不同 akshare 版本列名）。"""
    for key, val in row.items():
        k = str(key)
        if any(kw in k for kw in keywords):
            if val is not None and str(val).strip() not in ("", "nan", "None", "--"):
                return val
    return None


def _to_float(v) -> float | None:
    if v is None:
        return None
    try:
        f = float(str(v).replace(",", "").replace("%", "").strip())
        if f != f:  # NaN
            return None
        return f
    except (TypeError, ValueError):
        return None


def _to_ratio(v) -> float | None:
    value = _to_float(v)
    if value is None:
        return None
    return value / 100 if abs(value) > 1 else value


def _quarter_end_for(value: str) -> str:
    text = str(value or "")[:10]
    try:
        year = int(text[:4])
        month = int(text[5:7])
    except (TypeError, ValueError):
        now = datetime.utcnow()
        year, month = now.year, now.month
    if month <= 3:
        return f"{year - 1}1231"
    if month <= 6:
        return f"{year}0331"
    if month <= 9:
        return f"{year}0630"
    return f"{year}0930"


def _first_row_for_code(df: Any, symbol: str) -> dict | None:
    if df is None or len(df) == 0:
        return None
    code = _stem(symbol)
    for _, raw in df.iterrows():
        row = raw.to_dict()
        row_code = str(
            _pick_col(row, "代码", "股票代码", "证券代码") or ""
        ).zfill(6)
        if row_code == code:
            return row
    return None


def fetch_holding_concentration(symbol: str, end: str) -> dict:
    """筹码集中度：北向持股、公募重仓、股东户数。

    这些 AKShare 接口字段随版本变化较多，本函数尽量宽松解析；任何数据源失败都只留下
    null 字段，让上层接口展示 partial 态。
    """
    if not _AK_AVAILABLE:
        return {}

    code = _stem(symbol)
    row: dict[str, Any] = {
        "date": end,
        "symbol": symbol,
        "northbound_float_pct": None,
        "northbound_total_pct": None,
        "fund_float_pct": None,
        "fund_count": None,
        "shareholder_count": None,
        "shareholder_count_delta_pct": None,
        "top10_holder_pct": None,
        "source": "akshare",
        "updated_at": _now_iso(),
    }

    market = "沪股通" if symbol.upper().endswith(".SH") else "深股通"
    north = _safe(
        ak.stock_hsgt_hold_stock_em,
        market=market,
        indicator="30日排行",
        label="hsgt_hold",
    )
    north_row = _first_row_for_code(north, symbol)
    if north_row:
        row["northbound_float_pct"] = _to_ratio(
            _pick_col(north_row, "占流通股比", "占流通", "流通股本比")
        )
        row["northbound_total_pct"] = _to_ratio(
            _pick_col(north_row, "占总股本比", "总股本比")
        )

    fund = _safe(
        ak.stock_report_fund_hold_detail,
        symbol=code,
        date=_quarter_end_for(end),
        label="fund_hold",
    )
    if fund is not None and len(fund) > 0:
        ratios = []
        for _, raw in fund.iterrows():
            parsed = _to_ratio(_pick_col(raw.to_dict(), "占流通股比", "持股占流通股比", "占流通"))
            if parsed is not None:
                ratios.append(parsed)
        row["fund_count"] = int(len(fund))
        row["fund_float_pct"] = sum(ratios) if ratios else None

    holders = _safe(ak.stock_zh_a_gdhs, symbol="最新", label="shareholder_count")
    holder_row = _first_row_for_code(holders, symbol)
    if holder_row:
        count = _to_float(_pick_col(holder_row, "股东户数", "股东人数"))
        row["shareholder_count"] = int(count) if count is not None else None
        row["shareholder_count_delta_pct"] = _to_ratio(
            _pick_col(holder_row, "较上期变化", "户数变化", "增减比例", "环比")
        )
        row["top10_holder_pct"] = _to_ratio(
            _pick_col(holder_row, "前十大股东持股比例", "十大股东持股比例", "前十")
        )

    return row


def fetch_research_reports(symbol: str) -> list[dict]:
    """个股研报列表。容错提取：日期 / 机构 / 评级 / EPS 预测 / 目标价(若有)。

    akshare 不可用或接口异常时返回 []。
    """
    if not _AK_AVAILABLE:
        return []
    df = _safe(ak.stock_research_report_em, symbol=_stem(symbol), label="research_report")
    if df is None or len(df) == 0:
        return []
    out: list[dict] = []
    for _, raw in df.iterrows():
        row = raw.to_dict()
        date = str(_pick_col(row, "日期") or "")[:10]
        if not date:
            continue
        org = _pick_col(row, "机构")
        rating = _pick_col(row, "评级")
        title = _pick_col(row, "报告名称", "标题")
        industry = _pick_col(row, "行业")
        url = _pick_col(row, "PDF", "链接", "url")
        # 盈利预测 EPS：列名形如 "2026-盈利预测-收益"，优先取最近年度的"收益/EPS"
        eps = _to_float(_pick_col(row, "盈利预测-收益", "预测EPS", "EPS"))
        target = _to_float(_pick_col(row, "目标价"))
        org_str = str(org or "").strip()
        title_str = str(title or "").strip()
        out.append(
            {
                "report_id": _report_id(symbol, date, org_str, title_str),
                "symbol": symbol,
                "date": date,
                "org": org_str or None,
                "rating": str(rating or "").strip() or None,
                "title": title_str or None,
                "eps_forecast": eps,
                "target_price": target,
                "industry": str(industry or "").strip() or None,
                "url": str(url or "").strip() or None,
                "synced_at": _now_iso(),
            }
        )
    return out
