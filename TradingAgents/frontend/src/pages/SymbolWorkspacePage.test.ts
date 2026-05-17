import {
  buildMarketAnalysisOverview,
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

  assertOk(trend, "trend indicator exists");
  assertOk(macd, "macd indicator exists");
  assertOk(chart, "indicator stack chart feature exists");
  assertEqual(trend?.tone, "opportunity", "MA alignment should be opportunity");
  assertEqual(macd?.tone, "opportunity", "positive trend momentum should be opportunity");
  assertIncludes(chart?.detail || "", "MA", "chart feature lists K-line indicators");
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

testClassifiesIndicatorTones();
testBuildsBullishOverview();
testMissingDataStaysVisible();
