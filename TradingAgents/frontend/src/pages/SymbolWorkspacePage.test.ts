import {
  buildKlineEvidenceEvents,
  buildMarketAnalysisOverview,
  buildOverviewTechnicalCharts,
  buildRelativeStrengthTrendModel,
  classifyIndicatorTone,
} from "./SymbolWorkspacePage.helpers.js";

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

function testBuildsOverviewTechnicalCharts() {
  const charts = buildOverviewTechnicalCharts(sampleBars());
  const distance = charts.find((item: any) => item.key === "ma-distance");
  const macd = charts.find((item: any) => item.key === "macd");
  const rsi = charts.find((item: any) => item.key === "rsi");
  const kdj = charts.find((item: any) => item.key === "kdj-j");
  const boll = charts.find((item: any) => item.key === "boll-position");
  const atr = charts.find((item: any) => item.key === "atr-volatility");
  const obv = charts.find((item: any) => item.key === "obv-trend");
  const missing = buildOverviewTechnicalCharts([]);

  assertEqual(charts.length, 7, "overview exposes seven technical mini charts");
  assertOk(distance?.points.length, "MA distance chart has points");
  assertOk(macd?.points.some((point: any) => point.tone === "good"), "MACD chart carries bar tones");
  assertOk(rsi?.points.every((point: any) => point.value >= 0 && point.value <= 100), "RSI chart is bounded to oscillator scale");
  assertOk(kdj?.points.every((point: any) => point.value >= 0 && point.value <= 100), "KDJ chart clips J values into oscillator scale");
  assertOk(boll?.points.every((point: any) => point.value >= 0 && point.value <= 100), "BOLL position chart is bounded to channel scale");
  assertOk(atr?.points.every((point: any) => point.value >= 0), "ATR volatility chart uses non-negative percent values");
  assertOk(obv?.points.length, "OBV trend chart exposes volume-price confirmation points");
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
  assertOk(events.some((event) => event.kind === "market" && event.detail.includes("000300.SH")), "failed market filter creates an event");
}

testClassifiesIndicatorTones();
testBuildsBullishOverview();
testMissingDataStaysVisible();
testBuildsOverviewTechnicalCharts();
testBuildsRelativeStrengthTrendModel();
testBuildsKlineEvidenceEvents();
