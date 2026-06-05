import {
  buildKlineEvidenceEvents,
  buildMarketMicrostructureModel,
  buildMarketAnalysisOverview,
  buildOverviewTechnicalCharts,
  buildDisplayQuoteModel,
  buildWorkspaceDataStatusModel,
  buildWorkspaceLoadMessage,
  buildWorkspaceNavigationModel,
  buildRelativeStrengthTrendModel,
  classifyIndicatorTone,
} from "./SymbolWorkspacePage.helpers.js";
import {
  mapDisclosures,
  mapPlaybookHistory,
} from "../api/symbol-workspace/mappers.js";
import { mergeRealtimeTickerQuotes } from "../components/MarketTicker.helpers.js";
import { buildWorkspaceVersionUrl } from "./symbol/featureFlag.js";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertIncludes(value: string, expected: string, message: string) {
  if (!value.includes(expected)) {
    throw new Error(`${message}: expected "${value}" to include "${expected}"`);
  }
}

function assertOk(value: unknown, message: string) {
  if (!value) {
    throw new Error(message);
  }
}

function sampleBars() {
  return Array.from({ length: 90 }, (_, index) => {
    const close = 100 + index * 0.8;
    return {
      date: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
      symbol: "600519.SH",
      market: "CHINA",
      open: close - 0.4,
      high: close + 1.2,
      low: close - 1.1,
      close,
      volume: 1_000_000 + index * 10_000,
      amount: 200_000_000 + index * 2_000_000,
      source: "fixture",
    };
  });
}

function bullishOverview() {
  return buildMarketAnalysisOverview({
    history: {
      symbol: "600519.SH",
      start: "2026-01-01",
      end: "2026-05-17",
      bar_count: 90,
      quote: {
        symbol: "600519.SH",
        market: "CHINA",
        trade_date: "2026-05-17",
        price: 1720,
        prev_close: 1700,
        change: 20,
        change_pct: 0.0118,
        open: 1710,
        high: 1730,
        low: 1695,
        volume: 1_200_000,
        amount: 2_100_000_000,
        source: "fixture",
        status: "ok",
        freshness_status: "fresh",
        freshness_text: "最新交易日",
        delay_policy: "本地日线缓存，非实时行情",
        sparkline: [],
      },
      bars: sampleBars(),
    } as any,
    context: {
      factor_snapshot: {
        date: "2026-05-17",
        symbol: "600519.SH",
        ma20: 1680,
        ma60: 1610,
        ma120: 1540,
        rsi14: 58,
        atr14: 32,
        volume_ratio20: 1.35,
        amount_ratio20: 1.42,
        ret20: 0.08,
        ret60: 0.18,
        rel_strength_index20: 0.06,
        rel_strength_industry20: 0.03,
        main_net_inflow_ratio20: 0.12,
        northbound_inflow_5d: 90000000,
      },
      factor_series: [],
      fund_flow_snapshot: {
        date: "2026-05-17",
        symbol: "600519.SH",
        main_net_inflow: 120000000,
        large_net_inflow: 60000000,
        northbound_net_inflow: 50000000,
      },
      fund_flow_series: [],
      market_state: {
        regime: "bull_trend",
        label: "多头趋势",
        tone: "positive",
        drivers: ["MA多头排列"],
      },
      relative_strength: {
        rank: 3,
        total: 50,
        percentile: 0.94,
      },
      trading_rules: {
        market: "CHINA",
        board: "主板",
        lot_size: 100,
        settlement: "T+1",
        warnings: [],
      },
      data_coverage: {
        bar_rows: 90,
        factor_rows: 90,
        fund_flow_rows: 30,
        latest_bar_date: "2026-05-17",
        latest_factor_date: "2026-05-17",
        latest_fund_flow_date: "2026-05-17",
        source: "fixture",
      },
    } as any,
    signals: [
      {
        signal_id: "sig-1",
        date: "2026-05-17",
        symbol: "600519.SH",
        signal_name: "趋势增强",
        signal_level: "A",
        direction: "opportunity",
        score: 86,
        review_count: 1,
        event_return: {
          ret_20d: 0.06,
          max_adverse_20d: -0.025,
        },
      },
    ],
    readiness: {
      score: 0.8,
      level: "ready",
      summary: { ready_count: 8, warn_count: 1, blocker_count: 0, total_count: 9 },
      categories: [],
      next_actions: [],
    } as any,
    strategyAnalysis: {
      decision: { action: "watch", label: "趋势观察", tone: "positive" },
      trend_state: { label: "周线多头", action: "等待日线确认", strength: 0.72 },
      market_filter: { passed: true, status: "pass", benchmark_symbol: "000300.SH" },
      buy_signal: { score: 0.72, threshold: 0.65, mode_signal: true },
      sell_signal: { score: 0.18, warning_level: { level: 0, label: "无预警", action: "持有观察" } },
      data_quality: { warnings: [], blocking_reasons: [], has_benchmark: true, has_fund_flow: true },
    } as any,
  });
}

function testClassifiesIndicatorTones() {
  assertEqual(classifyIndicatorTone(0.12, 0.05, "higher"), "opportunity", "positive spread is opportunity");
  assertEqual(classifyIndicatorTone(-0.08, -0.03, "higher"), "risk", "negative spread is risk");
  assertEqual(classifyIndicatorTone(null, 0.05, "higher"), "missing", "missing value is explicit");
}

function testBuildsBullishOverview() {
  const overview = bullishOverview();
  const trend = overview.indicators.find((item: any) => item.key === "trend");
  const macd = overview.indicators.find((item: any) => item.key === "macd");
  const chart = overview.chartFeatures.find((item: any) => item.key === "indicator_stack");
  const macdChart = overview.technicalCharts.find((item: any) => item.key === "macd");
  const rsiChart = overview.technicalCharts.find((item: any) => item.key === "rsi");

  assertOk(trend, "trend indicator exists");
  assertOk(macd, "macd indicator exists");
  assertOk(chart, "indicator stack chart feature exists");
  assertOk(macdChart, "MACD overview technical chart exists");
  assertOk(rsiChart, "RSI overview technical chart exists");
  assertEqual(trend?.tone, "opportunity", "MA alignment should be opportunity");
  assertEqual(macd?.tone, "opportunity", "positive trend momentum should be opportunity");
  assertIncludes(chart?.detail || "", "MA", "chart feature lists K-line indicators");
  assertOk((macdChart?.points.length || 0) > 12, "MACD chart exposes compact point series");
  assertOk((rsiChart?.points.length || 0) > 12, "RSI chart exposes compact point series");
}

function testOverviewUsesReadableStrategyCopy() {
  const overview = buildMarketAnalysisOverview({
    history: null,
    context: null,
    signals: [],
    readiness: null,
    strategyAnalysis: {
      latest_bar: { date: "2026-05-19", close: 44.98 },
      decision: { action: "禁止做多", label: "趋势未通过", tone: "neutral" },
      trend_state: { label: "强空头", action: "禁止做多" },
      market_filter: { passed: false, status: "reject", benchmark_symbol: "HSI" },
      buy_signal: { score: 0.074, threshold: 0.5, mode_signal: false },
      sell_signal: { score: 0.2, warning_level: { level: 0, label: "无预警", action: "继续观察" } },
      data_quality: { warnings: [], blocking_reasons: [] },
    } as any,
  });

  assertEqual(overview.summary.title, "当前不建议买入", "overview headline uses a readable strategy decision");
  assertIncludes(overview.summary.subtitle, "继续观察，不开新仓", "overview subtitle states the immediate action");
  assertOk(!overview.summary.subtitle.includes("禁止做多"), "overview subtitle hides raw strategy action");
  const strategyEvidence = overview.evidence.find((item: any) => item.key === "strategy");
  assertEqual(strategyEvidence?.value, "当前不建议买入", "evidence card reuses readable strategy decision");
  assertIncludes(strategyEvidence?.detail || "", "个股趋势尚未转强", "strong bearish trend is treated as a trend block");
  assertOk(!strategyEvidence?.detail.includes("禁止做多"), "evidence card hides raw strategy action");
}

function testMissingDataStaysVisible() {
  const overview = buildMarketAnalysisOverview({
    history: null,
    context: null,
    signals: [],
    readiness: null,
    strategyAnalysis: null,
  });
  const trend = overview.indicators.find((item: any) => item.key === "trend");

  assertEqual(trend?.tone, "missing", "missing market data is not neutral");
  assertIncludes(overview.nextSteps[0], "同步", "missing overview gives sync next step");
}

function testWorkspaceLoadMessagePreservesPartialMarketData() {
  const message = buildWorkspaceLoadMessage({
    historySuccess: true,
    barCount: 128,
    signalSuccess: false,
    signalCount: 0,
    failedServiceLabels: ["信号", "V2策略"],
  });

  assertIncludes(message, "读取 128 根日线", "partial failure still reports loaded bars");
  assertIncludes(message, "0 条信号", "partial failure reports signal fallback count");
  assertIncludes(message, "部分服务不可用：信号、V2策略", "partial failure names unavailable services");
}

function testWorkspaceLoadMessageExplainsDisconnectedBackend() {
  const message = buildWorkspaceLoadMessage({
    historySuccess: false,
    signalSuccess: false,
    signalCount: 0,
    failedServiceLabels: ["行情", "信号", "上下文", "V2策略", "完整度"],
  });

  assertIncludes(message, "后端 API 未连接", "total failure points to backend API");
  assertIncludes(message, "8100", "total failure mentions default API port");
}

function testBuildsOverviewTechnicalCharts() {
  const charts = buildOverviewTechnicalCharts(sampleBars());
  const distance = charts.find((item: any) => item.key === "ma-distance");
  const macd = charts.find((item: any) => item.key === "macd");
  const rsi = charts.find((item: any) => item.key === "rsi");
  const kdj = charts.find((item: any) => item.key === "kdj-j");
  const boll = charts.find((item: any) => item.key === "boll-position");
  const atr = charts.find((item: any) => item.key === "atr-volatility");
  const obv = charts.find((item: any) => item.key === "obv-trend");
  const adx = charts.find((item: any) => item.key === "dmi-adx");
  const cci = charts.find((item: any) => item.key === "cci");
  const wr = charts.find((item: any) => item.key === "williams-r");
  const missing = buildOverviewTechnicalCharts([]);

  assertEqual(charts.length, 10, "overview exposes ten technical mini charts");
  assertOk(distance?.points.length, "MA distance chart has points");
  assertOk(macd?.points.some((point: any) => point.tone === "good"), "MACD chart carries bar tones");
  assertOk(rsi?.points.every((point: any) => point.value >= 0 && point.value <= 100), "RSI chart is bounded to oscillator scale");
  assertOk(kdj?.points.every((point: any) => point.value >= 0 && point.value <= 100), "KDJ chart clips J values into oscillator scale");
  assertOk(boll?.points.every((point: any) => point.value >= 0 && point.value <= 100), "BOLL position chart is bounded to channel scale");
  assertOk(atr?.points.every((point: any) => point.value >= 0), "ATR volatility chart uses non-negative percent values");
  assertOk(obv?.points.length, "OBV trend chart exposes volume-price confirmation points");
  assertOk(adx?.points.every((point: any) => point.value >= 0 && point.value <= 100), "ADX trend strength chart is bounded");
  assertOk(adx?.lines?.some((line: any) => line.key === "plus-di" && line.points.length), "DMI chart exposes +DI companion line");
  assertOk(adx?.lines?.some((line: any) => line.key === "minus-di" && line.points.length), "DMI chart exposes -DI companion line");
  assertOk(cci?.points.length, "CCI oscillator chart exposes points");
  assertOk(wr?.points.every((point: any) => point.value >= -100 && point.value <= 0), "Williams %R chart stays in oscillator scale");
  assertEqual(missing[0]?.tone, "missing", "missing bars create explicit missing technical chart");
  assertIncludes(missing[0]?.detail || "", "同步", "missing chart gives a data next step");
}

function testBuildsRelativeStrengthTrendModel() {
  const rows = Array.from({ length: 36 }, (_, index) => ({
    date: index < 30
      ? `2026-04-${String(index + 1).padStart(2, "0")}`
      : `2026-05-${String(index - 29).padStart(2, "0")}`,
    symbol: "600519.SH",
    rel_strength_index20: -0.05 + index * 0.004,
    rel_strength_industry20: -0.02 + index * 0.003,
  }));
  const model = buildRelativeStrengthTrendModel(rows as any);
  const missing = buildRelativeStrengthTrendModel([]);

  assertEqual(model.points.length, 32, "relative strength chart keeps compact window");
  assertOk(model.latestIndex != null && model.latestIndex > 0, "latest index relative strength is derived");
  assertOk(model.latestIndustry != null && model.latestIndustry > 0, "latest industry relative strength is derived");
  assertEqual(model.tone, "opportunity", "positive relative strength is opportunity");
  assertIncludes(model.detail, "跑赢", "detail explains benchmark relationship");
  assertEqual(missing.tone, "missing", "missing relative strength is explicit");
}

function testBuildsKlineEvidenceEvents() {
  const events = buildKlineEvidenceEvents({
    history: {
      bar_count: 90,
      bars: sampleBars(),
    },
    signals: [
      {
        signal_id: "sig-1",
        date: "2026-05-11",
        signal_name: "趋势增强",
        direction: "opportunity",
        signal_level: "A",
        score: 82,
        review_count: 2,
        evidence_json: JSON.stringify(["MACD金叉", "成交额放大"]),
        risk_json: JSON.stringify(["距离压力位较近"]),
        invalid_json: "跌破MA20",
      } as any,
    ],
    readiness: {
      date: "2026-05-12",
      score: 0.62,
      level: "partial",
      summary: { ready_count: 6, warn_count: 2, blocker_count: 1 },
      categories: [
        { key: "news", label: "新闻证据", status: "warn", next_step: "同步公告和新闻" },
        { key: "fundamental", label: "财务快照", status: "blocker", next_step: "补齐财务指标" },
      ],
      next_actions: [],
    } as any,
    strategyAnalysis: {
      latest_bar: { date: "2026-05-12", close: 118 },
      decision: { action: "watch", label: "等待确认", tone: "neutral" },
      market_filter: { passed: false, status: "benchmark weak", benchmark_symbol: "000300.SH" },
      data_quality: { warnings: ["资金流缺失"], blocking_reasons: ["基准行情不足"] },
    } as any,
  });

  assertEqual(events[0]?.date, "2026-05-11", "events are sorted by chart date");
  assertOk(events.some((event) => event.kind === "evidence" && event.detail.includes("MACD金叉")), "signal evidence creates an event");
  assertOk(events.some((event) => event.kind === "risk" && event.tone === "risk"), "signal risk creates a risk event");
  assertOk(events.some((event) => event.kind === "review" && event.detail.includes("2 次审查")), "review count creates a review event");
  assertOk(events.some((event) => event.kind === "readiness" && event.tone === "risk"), "readiness blocker creates a risk event");
  assertOk(events.some((event) => event.kind === "strategy" && event.detail.includes("基准行情不足")), "strategy blocking reason creates an event");
  const marketEvent = events.find((event) => event.kind === "market");
  assertOk(marketEvent?.detail.includes("000300.SH"), "failed market filter creates an event");
  assertOk(!marketEvent?.detail.includes("benchmark weak"), "failed market filter hides raw backend status");
}

function testBuildsMarketMicrostructureModel() {
  const live = buildMarketMicrostructureModel({
    quote: {
      symbol: "01024.HK",
      market: "HONGKONG",
      trade_date: "2026-05-12",
      trade_time: "16:00:00",
      price: 52.6,
      prev_close: 51.6,
      change: 1.0,
      change_pct: 0.0194,
      open: 56.7,
      high: 57.4,
      low: 52.6,
      volume: 151743764,
      amount: 8288691208,
      source: "futu_snapshot",
      provider: "futu",
      provider_status: "ok",
      status: "live",
      status_text: "富途实时行情快照",
      is_realtime: true,
      delay_policy: "富途 OpenAPI 行情，权限和延迟以 OpenD 登录账号为准",
      refresh_interval_seconds: 12,
      sparkline: [],
      error: null,
    } as any,
    intraday: {
      symbol: "01024.HK",
      market: "HONGKONG",
      date: "2026-05-12",
      interval: "1m",
      point_count: 2,
      points: [
        { symbol: "01024.HK", date: "2026-05-12", time: "09:30", datetime: "2026-05-12T09:30:00+08:00", price: 52.1, volume: 1000, amount: 52100 },
        { symbol: "01024.HK", date: "2026-05-12", time: "09:31", datetime: "2026-05-12T09:31:00+08:00", price: 52.6, volume: 1300, amount: 68380 },
      ],
      source: "futu_rt_data",
      provider: "futu",
      provider_status: "ok",
      status: "live",
      status_text: "富途1分钟分时行情",
      is_realtime: true,
      delay_policy: "富途 OpenAPI 行情，权限和延迟以 OpenD 登录账号为准",
    } as any,
  });
  const unavailable = buildMarketMicrostructureModel({ quote: null, intraday: null });

  assertEqual(live.statusTone, "live", "live futu quote produces live microstructure tone");
  assertEqual(live.sameSource, true, "quote and intraday providers are recognized as same source");
  assertEqual(live.tapeRows.length, 2, "minute points become latest tape rows");
  assertIncludes(live.depthRows[0].detail, "Level 2", "depth rows disclose missing Level 2");
  assertEqual(unavailable.statusTone, "unavailable", "missing data produces unavailable status");
  assertOk(unavailable.warnings.length > 0, "missing model explains what is unavailable");
}

function testBuildsCollapsedWorkspaceDataStatus() {
  const status = buildWorkspaceDataStatusModel({
    history: { bar_count: 120, quote: { source: "futu_snapshot", trade_date: "2026-05-20", freshness_status: "fresh" } } as any,
    context: { data_coverage: { factor_rows: 118, fund_flow_rows: 24 } } as any,
    readiness: {
      score: 0.72,
      level: "partial",
      summary: { ready_count: 6, warn_count: 2, blocker_count: 1, total_count: 9 },
      categories: [
        { key: "fundamental", label: "财务快照", status: "blocker", impact: "估值判断受限", next_step: "同步财务" },
        { key: "news", label: "新闻证据", status: "warn", impact: "事件解释偏薄", next_step: "同步新闻" },
      ],
      next_actions: [{ key: "sync-fundamental", priority: "P0", label: "补财务", action: "sync", target_view: "fundamentals" }],
    } as any,
    strategyAnalysis: { data_quality: { blocking_reasons: ["基准行情不足"], warnings: ["资金流样本偏少"], has_benchmark: false, has_fund_flow: true } } as any,
  });

  assertEqual(status.tone, "blocked", "blocker or strategy blocking reason makes status blocked");
  assertIncludes(status.title, "核心阻断", "blocked status is explicit in the title");
  assertOk(status.metrics.length <= 4, "status summary stays compact");
  assertOk(status.gaps.some((gap: any) => gap.label === "财务快照"), "readiness blocker appears as a gap");
  assertOk(status.warnings.some((warning: string) => warning.includes("基准行情不足")), "strategy blocker is preserved");
  assertIncludes(status.primaryAction || "", "补财务", "primary action comes from readiness next actions");
}

function testBuildsWorkspaceNavigationModel() {
  const navigation = buildWorkspaceNavigationModel({
    currentSymbol: "600519.SH",
    watchlist: [
      { symbol: "600519.SH", name: "贵州茅台", market: "CHINA", status: "active" },
      { symbol: "00700.HK", name: "腾讯控股", market: "HONGKONG", status: "active" },
    ],
    signals: [
      { symbol: "000001.SZ", signal_name: "趋势增强", direction: "opportunity", score: 82, date: "2026-05-20" },
      { symbol: "00700.HK", signal_name: "跌破均线", direction: "risk", score: 76, date: "2026-05-19" },
    ] as any,
    recentSymbols: ["600519.SH", "NVDA"],
  });

  assertEqual(navigation.watchlist[0]?.symbol, "600519.SH", "current symbol stays first in watchlist navigation");
  assertEqual(navigation.watchlist[0]?.active, true, "current symbol is marked active");
  assertOk(navigation.signals.some((item: any) => item.symbol === "000001.SZ" && item.tone === "opportunity"), "signal navigation keeps opportunity candidates");
  assertOk(navigation.risk.some((item: any) => item.symbol === "00700.HK"), "risk signal is promoted to risk section");
  assertOk(navigation.recent.some((item: any) => item.symbol === "NVDA"), "recent symbols are exposed separately");
}

function testDisplayQuotePrefersRealtimeSnapshot() {
  const display = buildDisplayQuoteModel({
    historyQuote: {
      symbol: "600519.SH",
      market: "CHINA",
      trade_date: "2026-05-19",
      price: 1324.3,
      change: 1.3,
      change_pct: 0.001,
      source: "futu_history_kline",
      status: "ok",
      freshness_status: "delayed",
      freshness_text: "延迟 2 天",
      delay_policy: "本地日线缓存，非实时行情",
      sparkline: [],
    } as any,
    realtimeQuote: {
      symbol: "600519.SH",
      market: "CHINA",
      trade_date: "2026-05-21",
      trade_time: "16:14:07",
      timestamp: "2026-05-21T16:14:07+08:00",
      price: 1311,
      change: -4,
      change_pct: -0.003,
      source: "tencent_quote",
      provider: "tencent",
      status: "live",
      status_text: "准实时行情快照",
      is_realtime: true,
      delay_policy: "公开行情源准实时快照，非交易所授权实时行情",
    } as any,
  });

  assertEqual(display.source, "realtime", "live realtime quote wins over delayed history quote");
  assertEqual(display.quote?.price, 1311, "display price uses realtime snapshot");
  assertIncludes(display.freshnessText, "准实时", "display freshness explains realtime snapshot");
  assertIncludes(display.freshnessText, "2026-05-21", "display freshness includes realtime date");
  assertIncludes(display.researchDetail, "研究日线 2026-05-19", "research detail keeps historical daily bar date");
  assertIncludes(display.researchDetail, "延迟 2 天", "research detail preserves history delay");
}

function testDisplayQuoteFallsBackToHistoryQuote() {
  const display = buildDisplayQuoteModel({
    historyQuote: {
      symbol: "600519.SH",
      market: "CHINA",
      trade_date: "2026-05-19",
      price: 1324.3,
      source: "futu_history_kline",
      status: "ok",
      freshness_text: "延迟 2 天",
      sparkline: [],
    } as any,
    realtimeQuote: {
      symbol: "600519.SH",
      market: "CHINA",
      trade_date: null,
      price: null,
      source: "tencent_quote",
      status: "unavailable",
      status_text: "准实时行情不可用",
      is_realtime: false,
    } as any,
  });

  assertEqual(display.source, "history", "unavailable realtime quote falls back to history");
  assertEqual(display.quote?.price, 1324.3, "fallback display price uses history quote");
  assertIncludes(display.freshnessText, "延迟 2 天", "fallback freshness keeps history label");
}

function testTickerQuotesPreferRealtimeSnapshots() {
  const merged = mergeRealtimeTickerQuotes(
    [
      {
        symbol: "600519.SH",
        market: "CHINA",
        trade_date: "2026-05-19",
        price: 1324.3,
        change_pct: 0.001,
        source: "futu_history_kline",
        status: "ok",
        freshness_text: "延迟 2 天",
        sparkline: [],
      },
    ] as any,
    [
      {
        symbol: "600519.SH",
        market: "CHINA",
        trade_date: "2026-05-21",
        trade_time: "16:14:07",
        price: 1311,
        change_pct: -0.003,
        source: "tencent_quote",
        status: "live",
        status_text: "准实时行情快照",
        is_realtime: true,
      },
    ] as any,
  );

  assertEqual(merged[0]?.price, 1311, "top ticker display uses realtime quote when available");
  assertEqual(merged[0]?.source, "tencent_quote", "top ticker source comes from realtime quote");
}

function testV2DisclosureMappingKeepsEvidenceDetail() {
  const items = mapDisclosures({
    symbol: "01024.HK",
    start: "2026-05-01",
    end: "2026-05-18",
    items: [
      {
        news_id: "n1",
        date: "2026-05-18",
        headline: "快手发布一季度业绩，净利润超预期",
        source: "公告",
        url: "https://example.com/report",
        sentiment: "positive",
        credibility: 0.86,
        summary: "广告和电商业务拉动收入增长。",
      },
    ],
  });

  assertEqual(items[0]?.tag, "业绩", "V2 disclosures classify earnings evidence");
  assertEqual(items[0]?.source, "公告", "V2 disclosures preserve evidence source");
  assertEqual(items[0]?.credibility, 0.86, "V2 disclosures preserve credibility score");
  assertIncludes(items[0]?.summary || "", "电商业务", "V2 disclosures preserve evidence summary");
}

function testV2PlaybookHistoryKeepsSignalsAndRecentBars() {
  const history = mapPlaybookHistory({
    signals: [
      {
        signal_id: "sig-1",
        date: "2026-05-18",
        symbol: "01024.HK",
        signal_name: "V2多指标共振",
        signal_level: "C",
        direction: "buy",
        score: 16.5,
        review_count: 1,
        event_return: { ret_20d: 0.072, max_adverse_20d: -0.031 },
      },
    ],
    bars: Array.from({ length: 14 }, (_, index) => ({
      date: `2026-05-${String(index + 1).padStart(2, "0")}`,
      symbol: "01024.HK",
      market: "HONGKONG",
      close: 40 + index,
    })),
  } as any);

  assertEqual(history.signals[0]?.id, "sig-1", "V2 playbook exposes historical signal id");
  assertEqual(history.signals[0]?.ret20d, 0.072, "V2 playbook preserves historical event return");
  assertEqual(history.recentBars.length, 12, "V2 playbook keeps recent 12 bars");
  assertEqual(history.recentBars[0]?.date, "2026-05-14", "V2 recent bars are newest first");
}

function testBuildWorkspaceVersionUrlPreservesContext() {
  const url = buildWorkspaceVersionUrl(
    "http://127.0.0.1:5174/?view=symbolWorkspace&symbol=01024.HK&date=2026-05-18&ws=v1&tab=chart&mode=aggressive",
    "v2",
  );
  assertEqual(
    url,
    "http://127.0.0.1:5174/?view=symbolWorkspace&symbol=01024.HK&date=2026-05-18&ws=v2&tab=chart&mode=aggressive",
    "workspace version switch preserves symbol/date/tab/mode",
  );
}

function testBuildWorkspaceVersionUrlAddsWorkspaceView() {
  const url = buildWorkspaceVersionUrl(
    "http://127.0.0.1:5174/?symbol=600519.SH&date=2026-05-18",
    "v1",
  );
  const params = new URL(url).searchParams;
  assertEqual(params.get("view"), "symbolWorkspace", "workspace switch keeps user in symbol workspace");
  assertEqual(params.get("ws"), "v1", "workspace switch writes requested version");
  assertEqual(params.get("symbol"), "600519.SH", "workspace switch keeps symbol");
}

testClassifiesIndicatorTones();
testBuildsBullishOverview();
testOverviewUsesReadableStrategyCopy();
testMissingDataStaysVisible();
testWorkspaceLoadMessagePreservesPartialMarketData();
testWorkspaceLoadMessageExplainsDisconnectedBackend();
testBuildsOverviewTechnicalCharts();
testBuildsRelativeStrengthTrendModel();
testBuildsKlineEvidenceEvents();
testBuildsMarketMicrostructureModel();
testBuildsCollapsedWorkspaceDataStatus();
testBuildsWorkspaceNavigationModel();
testDisplayQuotePrefersRealtimeSnapshot();
testDisplayQuoteFallsBackToHistoryQuote();
testTickerQuotesPreferRealtimeSnapshots();
testV2DisclosureMappingKeepsEvidenceDetail();
testV2PlaybookHistoryKeepsSignalsAndRecentBars();
testBuildWorkspaceVersionUrlPreservesContext();
testBuildWorkspaceVersionUrlAddsWorkspaceView();
