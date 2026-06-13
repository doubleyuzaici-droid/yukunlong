// 6 个核心 mapper 的单测 — 每个 mapper 3 个 case:
//   1) 完整数据 → 应返回真实值 + missing = []
//   2) 部分 null → 应返回 null + 该字段在 missing 里
//   3) 完全缺失 → 应返回兜底值 + missing 全列出
import {
  mapDecision,
  mapDisclosures,
  mapHeader,
  mapIndicators,
  mapNarrative,
  mapProfile,
  mapHoldingConcentration,
  mapQualityMetrics,
  mapDataStatus,
  mapRiskBudgetContext,
} from "./mappers.js";
import {
  SYMBOL_KLINE_HISTORY_LIMIT,
  defaultKlineStart,
} from "./fetchers.js";

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
function assertIncludes(arr: string[], item: string, msg: string) {
  if (!arr.includes(item)) {
    throw new Error(`${msg}: expected ${item} in [${arr.join(", ")}]`);
  }
}
function assertNotIncludes(arr: string[], item: string, msg: string) {
  if (arr.includes(item)) {
    throw new Error(`${msg}: did not expect ${item}`);
  }
}

(function testKlineHistoryUsesThreeYearWindow() {
  assertEqual(defaultKlineStart("2026-06-13"), "2023-06-13", "kline start defaults to 3 years");
  assertEqual(SYMBOL_KLINE_HISTORY_LIMIT, 900, "kline limit covers about 3 trading years");
})();

// ============================================================
// 1) mapHeader
// ============================================================
(function testHeaderFull() {
  const result = mapHeader({
    history: {
      symbol: "600519.SH",
      asset_type: "equity",
      name: "贵州茅台",
      start: "2026-01-01",
      end: "2026-05-23",
      bar_count: 90,
      bars: [],
      quote: {
        symbol: "600519.SH",
        market: "CHINA",
        status: "ok",
        price: 1623.5,
        change: -14.5,
        change_pct: -0.0089,
        open: 1640,
        high: 1645,
        low: 1620,
        prev_close: 1638,
        freshness_status: "fresh",
        freshness_text: "实时",
        trade_date: "2026-05-23",
        sparkline: [],
      },
    } as never,
    realtime: null,
  });
  assertEqual(result.data.symbol, "600519.SH", "header.symbol");
  assertEqual(result.data.price, 1623.5, "header.price");
  assertEqual(result.data.change_pct, -0.0089, "header.change_pct");
  assertEqual(result.missing.length, 0, "header.missing 空");
})();

(function testHeaderPartial() {
  const result = mapHeader({
    history: {
      symbol: "600519.SH",
      bar_count: 0,
      bars: [],
      quote: null,
    } as never,
    realtime: null,
  });
  assertEqual(result.data.price, null, "header.price 缺失");
  assertIncludes(result.missing, "price", "header.missing 含 price");
})();

(function testHeaderEmpty() {
  const result = mapHeader({ history: null, realtime: null });
  assertEqual(result.data.symbol, "-", "header.symbol 兜底");
  assertEqual(result.data.price, null, "header.price null");
})();

// ============================================================
// 2) mapProfile
// ============================================================
(function testProfileFull() {
  const result = mapProfile({
    history: null,
    context: {
      industry: { name: "白酒", sub_name: "高端白酒", pe_percentile: 0.42 },
      factor_snapshot: { turnover_pct: 0.0042 },
      trading_rules: { is_st: false, is_suspended: false },
    } as never,
    fundamentals: {
      security_profile: {
        symbol: "600519.SH",
        market_cap: 2_038_400_000_000,
        free_float_market_cap: 1_326_000_000_000,
      },
      valuation_snapshot: { pe_ttm: 26.4, pb: 9.1, dividend_yield: 0.024 },
    } as never,
  });
  assertEqual(result.data.industry, "白酒", "profile.industry");
  // 2038.4 亿 (允许浮点)
  if (Math.abs((result.data.market_cap_yi ?? 0) - 20384) > 0.1) {
    throw new Error("market_cap_yi 应为 ~20384");
  }
  assertEqual(result.data.pe_ttm, 26.4, "pe_ttm");
  assertEqual(result.missing.length, 0, "profile.missing 应为空");
})();

(function testProfilePartial() {
  const result = mapProfile({
    history: null,
    context: { industry: { name: "白酒" } } as never,
    fundamentals: null,
  });
  assertEqual(result.data.market_cap_yi, null, "缺市值");
  assertIncludes(result.missing, "market_cap", "missing 含 market_cap");
  assertIncludes(result.missing, "pe_ttm", "missing 含 pe_ttm");
})();

(function testProfileEmpty() {
  const result = mapProfile({ history: null, context: null, fundamentals: null });
  assertEqual(result.data.industry, "-", "industry 兜底");
  assertEqual(result.data.pe_ttm, null, "pe_ttm null");
})();

// ============================================================
// 3) mapDecision
// ============================================================
(function testDecisionFull() {
  const result = mapDecision({
    mode: "conservative",
    analysis: {
      strategy_name: "V2 多指标共振",
      symbol: "600519.SH",
      latest_bar: { date: "2026-05-23" },
      decision: { action: "watch", label: "观察等待", tone: "warn" },
      buy_signal: {
        score: 0.76,
        factors: { trend: 0.82, momentum: 0.41, volume: 0.55, market: 0.3, money: 0.68 },
      },
      market_filter: { drivers: ["白酒动销改善"] },
      checklist: [{ label: "趋势确认", passed: true, detail: "" }],
      data_quality: { bar_count: 200 },
    } as never,
  });
  assertEqual(result.data.title, "观察等待", "decision.title");
  assertEqual(result.data.tone, "warn", "decision.tone");
  assertEqual(result.data.score, 76, "decision.score = 76");
  assertEqual(result.data.factors.length, 5, "5 因子");
})();

(function testDecisionReduceDoesNotUseBullishTrendAction() {
  const result = mapDecision({
    mode: "conservative",
    analysis: {
      strategy_name: "V2 多指标共振",
      symbol: "601318.SH",
      latest_bar: { date: "2026-05-18" },
      decision: { action: "reduce", label: "减仓预警", tone: "warn" },
      trend_state: { label: "强多头", action: "积极做多" },
      buy_signal: {
        score: 0.18,
        factors: { trend: -0.08, momentum: -0.5, oversold: 1.42, volume: 0.11, market: 0.17 },
      },
      sell_signal: {
        score: 0.45,
        warning_level: { level: 3, label: "三级 卖警", action: "减仓 50%" },
      },
      market_filter: { drivers: ["大盘趋势 弱多头", "RSI14 54.7", "MarketStrength 0.17"] },
      data_quality: { bar_count: 243 },
    } as never,
  });

  assertEqual(result.data.title, "减仓预警", "风险态主标题来自 decision.label");
  assertEqual(result.data.action, "暂停开新仓，已有仓位按规则减仓", "减仓预警不回退到趋势动作");
  assertEqual(result.data.rationale?.[0], "买入强度 18，低于保守模式买入门槛 55", "风险态理由使用买入强度口径");
})();

(function testDecisionPartial() {
  const result = mapDecision({
    mode: "aggressive",
    analysis: {
      strategy_name: "V2",
      symbol: "x",
      latest_bar: {},
      decision: { action: "x", label: "x", tone: "neutral" },
      buy_signal: {},
    } as never,
  });
  assertEqual(result.data.score, null, "score 缺失为 null");
  assertIncludes(result.missing, "score", "missing 含 score");
  assertIncludes(result.missing, "factors", "missing 含 factors");
})();

(function testDecisionEmpty() {
  const result = mapDecision({ mode: "conservative", analysis: null });
  assertEqual(result.data.title, "策略读取中", "兜底标题");
  assertIncludes(result.missing, "decision", "missing 含 decision");
})();

// ============================================================
// 4) mapNarrative
// ============================================================
(function testNarrativeFull() {
  const result = mapNarrative({
    analysis: {
      market_filter: { drivers: ["EMA21/89 多头排列", "行业 RS 前 15%"] },
      checklist: [
        { label: "趋势确认", passed: true, detail: "" },
        { label: "动能弱", passed: false, detail: "" },
      ],
      data_quality: {
        warnings: ["MACD 顶背离"],
        blocking_reasons: [],
      },
    } as never,
  });
  if (result.data.bull.length === 0) throw new Error("bull 不应为空");
  if (result.data.falsify.length === 0) throw new Error("falsify 不应为空");
  // 已发生为 false（MACD 来自 warnings 而不是 blocking）
  assertEqual(result.data.falsify[0].occurred, false, "warning → occurred=false");
})();

(function testNarrativeBlocker() {
  const result = mapNarrative({
    analysis: {
      data_quality: { warnings: [], blocking_reasons: ["跌破 EMA89"] },
    } as never,
  });
  assertEqual(result.data.falsify[0].occurred, true, "blocker → occurred=true");
})();

(function testNarrativeEmpty() {
  const result = mapNarrative({ analysis: null });
  assertEqual(result.data.bull.length, 0, "bull 空");
  assertIncludes(result.missing, "narrative", "missing 含 narrative");
})();

// ============================================================
// 5) mapIndicators
// ============================================================
(function testIndicatorsFull() {
  const result = mapIndicators({
    context: {
      factor_snapshot: {
        rsi14: 67.3,
        volume_ratio20: 1.4,
        atr14: 48.2,
        ret20: 0.04,
        ma20: 1620,
        ma60: 1500,
        ma120: 1400,
        rel_strength_industry20: 0.03,
        rel_strength_index20: 0.052,
        northbound_inflow_5d: 200_000_000,
      },
      factor_series: [],
    } as never,
    history: null,
  });
  assertEqual(result.data.length, 3, "三栏");
  assertEqual(result.data[0].horizon, "short", "short 列");
  assertIncludes(result.missing, "indicators.long", "long 列 partial");
})();

(function testIndicatorsPartial() {
  const result = mapIndicators({
    context: { factor_snapshot: { rsi14: 67 }, factor_series: [] } as never,
    history: null,
  });
  // 短线列至少 RSI 有值 → 不应 push 'indicators.short'
  assertNotIncludes(result.missing, "indicators.short", "短线列有 RSI 不算空");
})();

(function testIndicatorsEmpty() {
  const result = mapIndicators({ context: null, history: null });
  assertIncludes(result.missing, "indicators.long", "long 列 partial");
})();

// ============================================================
// 6) mapDataStatus
// ============================================================
(function testDataStatusReady() {
  const status = mapDataStatus({
    symbol: "x",
    date: "2026-05-23",
    asset_type: "equity",
    score: 0.95,
    level: "ready",
    summary: { ready_count: 6, warn_count: 0, blocker_count: 0, total_count: 6 },
    categories: [],
    next_actions: [],
  } as never);
  assertEqual(status.kind, "ok", "ready → ok");
  assertEqual(status.can_retry, true, "ok 也允许重试");
})();

(function testDataStatusBlocked() {
  const status = mapDataStatus({
    symbol: "x",
    date: "x",
    asset_type: "equity",
    score: 0,
    level: "blocked",
    summary: { ready_count: 0, warn_count: 0, blocker_count: 3, total_count: 3 },
    categories: [
      { key: "factor", status: "blocker", label: "因子", coverage: 0, impact: "", evidence: [], next_step: "", target_view: "" },
    ],
    next_actions: [{ key: "x", priority: "P0", label: "同步因子", action: "x", target_view: "x" }],
  } as never);
  assertEqual(status.kind, "blocked", "blocked → blocked");
  assertEqual(status.can_retry, false, "blocked 不允许重试");
  assertIncludes(status.affected, "factor", "affected 含 factor");
})();

(function testDataStatusNull() {
  const status = mapDataStatus(null);
  assertEqual(status.kind, "blocked", "null → blocked");
})();

// ============================================================
// 衍生：mapDisclosures + mapRiskBudgetContext
// ============================================================
(function testDisclosuresClassify() {
  const out = mapDisclosures({
    items: [
      { news_id: "1", date: "2026-05-22", headline: "中金给买入评级" },
      { news_id: "2", date: "2026-05-15", headline: "Q1 业绩超预期" },
      { news_id: "3", date: "2026-05-10", headline: "收到关注函" },
    ],
  } as never);
  assertEqual(out[0].tag, "评级", "评级分类");
  assertEqual(out[1].tag, "业绩", "业绩分类");
  assertEqual(out[2].tag, "监管", "监管分类");
})();

(function testRiskBudgetCtx() {
  const ctx = mapRiskBudgetContext({
    history: {
      bars: [
        { date: "2026-05-20", low: 1500 },
        { date: "2026-05-21", low: 1480 },
        { date: "2026-05-22", low: 1520 },
      ],
      quote: { price: 1623.5 },
    } as never,
    context: { factor_snapshot: { atr14: 48.2 } } as never,
  });
  assertEqual(ctx.entry, 1623.5, "entry 取 quote.price");
  assertEqual(ctx.atr14, 48.2, "atr14");
  assertEqual(ctx.support_price, 1480, "support = min(60D low)");
  assertEqual(ctx.lot_size, 100, "A 股 lot=100");
})();

// ============================================================
// 专业投研 P0：盈利质量 + 筹码集中度
// ============================================================
(function testQualityMetricsMapper() {
  const out = mapQualityMetrics({
    available: true,
    gross_margin: 0.912,
    net_margin: 0.4674,
    operating_cashflow: 92_000_000_000,
    ocf_to_net_income: 1.0698,
    free_cashflow: 80_000_000_000,
    debt_to_assets: 0.1818,
    roe: 0.315,
    quality_score: 0.94,
    flags: [
      {
        key: "cashflow_quality",
        label: "现金流覆盖净利",
        value: 1.0698,
        tone: "success",
        detail: "经营现金流高于净利润",
      },
    ],
  } as never);

  assertEqual(out?.available, true, "quality.available");
  assertEqual(out?.score, 0.94, "quality.score");
  assertEqual(out?.metrics[0].label, "毛利率", "quality metric label");
  assertEqual(out?.flags[0].key, "cashflow_quality", "quality flag");
})();

(function testHoldingConcentrationMapper() {
  const out = mapHoldingConcentration({
    available: true,
    northbound_float_pct: 0.124,
    northbound_total_pct: 0.118,
    fund_float_pct: 0.087,
    fund_count: 132,
    shareholder_count: 125000,
    shareholder_count_delta_pct: -0.08,
    top10_holder_pct: 0.642,
    concentration_score: 0.88,
    items: [
      {
        key: "northbound",
        label: "北向占流通",
        value: 0.124,
        tone: "success",
        detail: "陆股通持股占流通股比例",
      },
    ],
  } as never);

  assertEqual(out?.available, true, "holding.available");
  assertEqual(out?.score, 0.88, "holding.score");
  assertEqual(out?.fund_count, 132, "holding fund count");
  assertEqual(out?.items[0].key, "northbound", "holding item");
})();

// eslint-disable-next-line no-console
console.log("mappers tests: PASS");
