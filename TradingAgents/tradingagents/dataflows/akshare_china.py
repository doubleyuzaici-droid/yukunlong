from tradingagents.markets.china import normalize_china_symbol
from tradingagents.markets.hongkong import normalize_hk_symbol


def _stock_zh_a_hist(**kwargs):
    import akshare as ak
    return ak.stock_zh_a_hist(**kwargs)


def _stock_hk_hist(**kwargs):
    import akshare as ak
    return ak.stock_hk_hist(**kwargs)


def _stock_news_em(**kwargs):
    import akshare as ak
    return ak.stock_news_em(**kwargs)


def _safe_call(fn, *args, label: str = "", **kwargs):
    try:
        result = fn(*args, **kwargs)
        if result is None or (hasattr(result, "empty") and result.empty):
            return None
        return result
    except Exception:
        return None


def get_china_stock_data_akshare(symbol: str, start_date: str, end_date: str) -> str:
    normalized = normalize_china_symbol(symbol)
    code = normalized.split(".")[0]
    frame = _stock_zh_a_hist(
        symbol=code,
        period="daily",
        start_date=start_date.replace("-", ""),
        end_date=end_date.replace("-", ""),
        adjust="qfq",
    )
    if frame is None or frame.empty:
        return f"No AKShare China A-share stock data found for {normalized} from {start_date} to {end_date}."
    lines = [f"China A-share OHLCV data for {normalized} (AKShare):"]
    for _, row in frame.iterrows():
        lines.append(
            f"{row['日期']}: open={row['开盘']}, high={row['最高']}, low={row['最低']}, "
            f"close={row['收盘']}, volume={row.get('成交量')}"
        )
    return "\n".join(lines)


def get_hk_stock_data_akshare(symbol: str, start_date: str, end_date: str) -> str:
    normalized = normalize_hk_symbol(symbol)
    code = normalized.split(".")[0]
    frame = _stock_hk_hist(
        symbol=code,
        period="daily",
        start_date=start_date.replace("-", ""),
        end_date=end_date.replace("-", ""),
        adjust="qfq",
    )
    if frame is None or frame.empty:
        return f"No AKShare HK stock data found for {normalized} from {start_date} to {end_date}."
    lines = [f"HK OHLCV data for {normalized} (AKShare):"]
    for _, row in frame.iterrows():
        lines.append(
            f"{row['日期']}: open={row['开盘']}, high={row['最高']}, low={row['最低']}, "
            f"close={row['收盘']}, volume={row.get('成交量')}"
        )
    return "\n".join(lines)


def get_china_news_akshare(symbol: str, _start_date: str = "", _end_date: str = "") -> str:
    """Aggregate China A-share news from multiple AKShare channels.

    Sources:
      1. 东方财富个股新闻 (stock_news_em)
      2. 雪球网热帖 (stock_hot_tweet_xq + stock_individual_info_em_xq)
      3. 巨潮资讯 (stock_zh_a_news)
      4. 新浪财经 (stock_individual_info_em → 公司简介/公告)
    """
    normalized = normalize_china_symbol(symbol)
    code = normalized.split(".")[0]
    import akshare as ak

    all_lines = [f"# China A-share news for {normalized}", ""]

    # Channel 1: 东方财富个股新闻
    em = _safe_call(ak.stock_news_em, symbol=code, label="东方财富")
    if em is not None and not em.empty:
        all_lines.append("## 东方财富个股新闻")
        for _, row in em.head(15).iterrows():
            title = row.get("标题", row.get("title", ""))
            pub_time = row.get("发布时间", row.get("pub_time", ""))
            content = row.get("新闻内容", row.get("content", ""))
            if title:
                all_lines.append(f"- **{pub_time}** {title}")
                if content:
                    all_lines.append(f"  {str(content)[:200]}")
            all_lines.append("")
    else:
        all_lines.append("(东方财富新闻暂不可用)")
        all_lines.append("")

    # Channel 2: 雪球网热帖
    xq = _safe_call(lambda: _try_xueqiu(code), label="雪球网")
    if xq:
        all_lines.append("## 雪球网社区热议")
        all_lines.append(xq)
        all_lines.append("")

    # Channel 3: 巨潮资讯A股新闻
    ju = _safe_call(lambda: ak.stock_zh_a_news(symbol=code), label="巨潮资讯")
    if ju is not None and not ju.empty:
        all_lines.append("## 巨潮资讯公告")
        for _, row in ju.head(10).iterrows():
            title = row.get("title", row.get("标题", ""))
            pub_date = row.get("pub_date", row.get("date", row.get("发布时间", "")))
            if title:
                all_lines.append(f"- **{pub_date}** {title}")
            all_lines.append("")
    else:
        all_lines.append("(巨潮资讯暂不可用)")
        all_lines.append("")

    # Channel 4: 新浪财经公司信息
    sina = _safe_call(lambda: _try_sina_info(code), label="新浪财经")
    if sina:
        all_lines.append("## 新浪财经公司信息")
        all_lines.append(sina)
        all_lines.append("")

    if len(all_lines) <= 4:
        return f"No AKShare China news found for {normalized} across all channels."

    return "\n".join(all_lines)


def _try_xueqiu(code: str) -> str:
    """Try to get Xueqiu (雪球) hot tweets and stock info."""
    import akshare as ak
    lines = []

    # Xueqiu hot tweets
    try:
        tweets = ak.stock_hot_tweet_xq(symbol=code)
        if tweets is not None and not tweets.empty:
            for _, row in tweets.head(10).iterrows():
                pub_time = row.get("发布时间", row.get("pub_time", ""))
                content = row.get("内容", row.get("content", ""))
                user = row.get("用户", row.get("user", row.get("用户名", "")))
                likes = row.get("点赞", row.get("likes", ""))
                prefix = f"{user} ({likes}赞)" if user else ""
                if content:
                    lines.append(f"- **{pub_time}** {prefix}")
                    lines.append(f"  {str(content)[:200]}")
                    lines.append("")
    except Exception:
        pass

    # Xueqiu individual stock info
    try:
        info_xq = ak.stock_individual_info_em_xq(symbol=code)
        if info_xq is not None and not info_xq.empty:
            for _, row in info_xq.iterrows():
                key = row.get("item", row.get("指标", ""))
                val = row.get("value", row.get("数值", ""))
                if key and val:
                    lines.append(f"- {key}: {val}")
    except Exception:
        if not lines:
            try:
                info = ak.stock_info_xueqiu(symbol=code)
                if info is not None and not info.empty:
                    lines.append(str(info.to_string())[:500])
            except Exception:
                pass

    return "\n".join(lines) if lines else ""


def _try_sina_info(code: str) -> str:
    """Try to get Sina Finance company info."""
    import akshare as ak
    try:
        info = ak.stock_individual_info_em(symbol=code)
        if info is None or info.empty:
            return ""
        lines = []
        for _, row in info.iterrows():
            key = row.get("item", row.get("指标", ""))
            val = row.get("value", row.get("数值", ""))
            if key and val:
                lines.append(f"- {key}: {val}")
        return "\n".join(lines)
    except Exception:
        pass

    try:
        data = ak.stock_info_sz_name(symbol=code)
        if data is not None and not data.empty:
            return str(data.to_string())
    except Exception:
        pass

    return ""


def get_hk_news_akshare(symbol: str, _start_date: str = "", _end_date: str = "") -> str:
    """Aggregate Hong Kong stock news from multiple AKShare channels.

    Sources:
      1. 东方财富港股新闻 (stock_hk_news_em / stock_news_em fallback)
      2. 雪球网热帖 (stock_hot_tweet_xq)
      3. 东方财富个股信息 (stock_individual_info_em)
      4. 东方财富行业板块新闻
    """
    normalized = normalize_hk_symbol(symbol)
    code = normalized.split(".")[0]
    import akshare as ak

    all_lines = [f"# HK stock news for {normalized}", ""]

    # Channel 1: 东方财富港股新闻
    em_hk = None
    for try_code in (code, f"HK{code}", f"{code}.HK"):
        em_hk = _safe_call(ak.stock_hk_news_em, symbol=try_code, label="港股新闻-东方财富")
        if em_hk is not None:
            break
        em_hk = _safe_call(ak.stock_news_em, symbol=try_code, label="港股新闻-通用")
        if em_hk is not None:
            break

    if em_hk is not None and not em_hk.empty:
        all_lines.append("## 东方财富港股新闻")
        for _, row in em_hk.head(15).iterrows():
            title = row.get("标题", row.get("title", ""))
            pub_time = row.get("发布时间", row.get("pub_time", ""))
            content = row.get("新闻内容", row.get("content", ""))
            if title:
                all_lines.append(f"- **{pub_time}** {title}")
                if content:
                    all_lines.append(f"  {str(content)[:200]}")
            all_lines.append("")
    else:
        all_lines.append("(港股新闻频道暂不可用)")
        all_lines.append("")

    # Channel 2: 雪球网热帖
    xq = _safe_call(lambda: _try_xueqiu(code), label="雪球网")
    if xq:
        all_lines.append("## 雪球网社区热议")
        all_lines.append(xq)
        all_lines.append("")

    # Channel 3: 个股信息
    info = _safe_call(lambda: _try_hk_info(code), label="港股个股信息")
    if info:
        all_lines.append("## 公司基本信息")
        all_lines.append(info)
        all_lines.append("")

    # Channel 4: 行业板块新闻
    sector_news = _safe_call(lambda: _try_sector_news(code, normalized), label="行业新闻")
    if sector_news:
        all_lines.append("## 相关行业动态")
        all_lines.append(sector_news)
        all_lines.append("")

    if len(all_lines) <= 4:
        return f"No AKShare HK news found for {normalized} across all channels."

    return "\n".join(all_lines)


def _try_hk_info(code: str) -> str:
    """Try HK stock company info from multiple sources."""
    import akshare as ak
    lines = []

    try:
        info = ak.stock_individual_info_em(symbol=code)
        if info is not None and not info.empty:
            for _, row in info.iterrows():
                key = row.get("item", row.get("指标", ""))
                val = row.get("value", row.get("数值", ""))
                if key and val:
                    lines.append(f"- {key}: {val}")
    except Exception:
        pass

    try:
        profile = ak.stock_hk_company_profile_em(symbol=code)
        if profile is not None and not profile.empty:
            for _, row in profile.head(10).iterrows():
                for col in profile.columns:
                    val = row.get(col, "")
                    if val and str(val) != "nan":
                        lines.append(f"- {col}: {val}")
    except Exception:
        pass

    try:
        spot = ak.stock_hk_spot_em()
        if spot is not None and not spot.empty:
            match = spot[spot["代码"] == code]
            if not match.empty:
                row = match.iloc[0]
                lines.append(f"- 名称: {row.get('名称', '')}")
                lines.append(f"- 最新价: {row.get('最新价', '')}")
                lines.append(f"- 涨跌幅: {row.get('涨跌幅', '')}")
                lines.append(f"- 成交量: {row.get('成交量', '')}")
                lines.append(f"- 市值: {row.get('总市值', row.get('市值', ''))}")
    except Exception:
        pass

    return "\n".join(lines) if lines else ""


def _try_sector_news(code: str, normalized: str) -> str:
    """Try to get sector/industry related news."""
    import akshare as ak
    try:
        frame = ak.stock_sector_spot_em()
        if frame is None or frame.empty:
            return ""
        lines = []
        for _, row in frame.head(5).iterrows():
            name = row.get("板块名称", row.get("name", ""))
            chg = row.get("涨跌幅", row.get("change", ""))
            if name:
                lines.append(f"- 行业板块 {name}: {chg}")
    except Exception:
        pass
    return "\n".join(lines) if "lines" in dir() and lines else ""
