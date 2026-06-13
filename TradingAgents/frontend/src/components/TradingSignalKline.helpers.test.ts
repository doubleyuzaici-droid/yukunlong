import {
  applyChartParameterPreset,
  applyChartPreferencePreset,
  buildManualDrawingStorageKey,
  buildIntradayMinuteBars,
  buildLightweightChartSeries,
  buildLightweightPriceLines,
  buildAlphaTrendSeries,
  buildAlphaTrendBacktestSummary,
  buildAlphaTrendOptimizationSummary,
  buildLightweightAlphaTrendSeries,
  buildLightweightSuperTrendSeries,
  buildLightweightTensionFlowTrendSeries,
  buildSuperTrendBacktestSummary,
  buildTensionFlowTrendBacktestSummary,
  buildLightweightTrendHoverReadouts,
  buildLightweightVisibleLogicalRange,
  buildLightweightMaPeriodKey,
  buildAdvancedIndicators,
  buildCandlestickPatternAnnotations,
  buildFibonacciRetracementLevels,
  buildIndicatorSectionLayout,
  buildIndicatorPanelReadouts,
  buildIndicatorAxisTicks,
  buildIndicatorThresholdGuides,
  buildIndicatorThresholdZones,
  buildIndicatorBandAreaPath,
  buildChartLayerSummary,
  buildIndicatorStateSummary,
  buildOverlayPriceLabels,
  buildIndicatorValueLabels,
  buildKlineEventSummary,
  buildKlineEventDensity,
  buildCompactAnnotationDisplay,
  buildKlineEventBacktestSummary,
  shouldRenderDenseChartLayer,
  buildReadableStrategyDecisionCopy,
  buildStrategyFactorTooltip,
  buildStrategyScoreTooltip,
  buildStrategyStrengthTooltip,
  buildTradeDecisionChecklistTooltip,
  buildStrategyPriceLevelTooltip,
  buildRiskBudgetTooltip,
  buildStrategyTradeMarkerLabel,
  buildStrategyBacktestTradeMarkers,
  buildTradingViewTradeMarkerReadout,
  tradingViewTradeMarkerColor,
  isActionableStrategyTradeMarker,
  resolveStrategyTradeMarkerKind,
  isStrategyTradeMarker,
  buildReadableStrategyGateText,
  buildRelativeStrengthOverlaySeries,
  buildLatestPriceLine,
  buildKlineRangeNavigator,
  buildHeikinAshiBars,
  rightOffsetFromKlineNavigatorX,
  buildTrendRibbonAreaSegments,
  buildIchimokuIndicators,
  buildEnvelopeIndicators,
  buildMikeIndicators,
  buildPsychologicalLineIndicators,
  buildOscillatorIndicators,
  buildFundFlowOverlayGeometry,
  buildLimitPriceLines,
  buildKlineHoverMetrics,
  buildVolumeMovingAverageValues,
  mapClientPointToChartViewBox,
  buildManualDrawingGeometry,
  buildPriceAxisScale,
  buildPriceAdjustedBars,
  buildMeasuredRangeStats,
  buildMomentumIndicators,
  buildPriceGapAnnotations,
  buildPriceStructureTrendLines,
  buildSupportResistanceLevels,
  buildTdsSequentialAnnotations,
  buildTechnicalIndicatorAnnotations,
  buildTechnicalDivergenceAnnotations,
  buildTrendOverlayIndicators,
  buildTrendRegimeBands,
  buildVisiblePriceExtrema,
  buildVolumeProfileLevelAnnotations,
  buildVolumeSignalAnnotations,
  buildVolumeMomentumIndicators,
  buildVolatilityVolumeIndicators,
  buildVolumeProfile,
  matchChartParameterPreset,
  matchChartPreferencePreset,
  normalizeManualDrawings,
  normalizePriceAxisMode,
  normalizePriceAdjustmentMode,
  normalizeKlineRenderMode,
  priceAdjustmentPriceByFactor,
  priceAxisPriceFromY,
  priceAxisValueFromPrice,
  priceAxisYOf,
  resolveLimitCandleState,
  selectIndicatorReadoutSnapshot,
} from "./TradingSignalKline.helpers.js";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertApprox(actual: number | null | undefined, expected: number, tolerance: number, message: string) {
  if (typeof actual !== "number" || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ${expected} +/- ${tolerance}, got ${String(actual)}`);
  }
}

function assertOk(value: unknown, message: string) {
  if (!value) {
    throw new Error(message);
  }
}

function testBuildsIntradayMinuteBarsFromRealtimePoints() {
  const minuteBars = buildIntradayMinuteBars(
    [
      {
        symbol: "01024.HK",
        date: "2026-05-12",
        time: "09:30",
        datetime: "2026-05-12T09:30:00+08:00",
        price: 52.1,
        volume: 1000,
        amount: 52100,
      },
      {
        symbol: "01024.HK",
        date: "2026-05-12",
        time: "09:31",
        datetime: "2026-05-12T09:31:00+08:00",
        price: 52.6,
        volume: 1300,
        amount: 68380,
      },
    ],
    {
      symbol: "01024.HK",
      market: "HONGKONG",
      prevClose: 51.6,
      source: "futu_rt_data",
    },
  );

  assertEqual(minuteBars.length, 2, "intraday points create minute bars");
  assertEqual(minuteBars[0].date, "2026-05-12 09:30", "minute bar keeps time label in sortable date");
  assertEqual(minuteBars[0].open, 51.6, "first minute opens from previous close when available");
  assertEqual(minuteBars[1].open, 52.1, "next minute opens from previous tick price");
  assertEqual(minuteBars[1].close, 52.6, "minute close uses tick price");
  assertEqual(minuteBars[1].source, "futu_rt_data", "minute bars preserve intraday source");
}

function testBuildsLightweightChartSeriesFromMarketBars() {
  const series = buildLightweightChartSeries([
    {
      date: "2026-05-18",
      symbol: "600519.SH",
      market: "CHINA",
      open: 100,
      high: 106,
      low: 99,
      close: 104,
      volume: 1200,
    },
    {
      date: "2026-05-19",
      symbol: "600519.SH",
      market: "CHINA",
      open: 104,
      high: 105,
      low: 96,
      close: 98,
      volume: 1500,
    },
    {
      date: "2026-05-20",
      symbol: "600519.SH",
      market: "CHINA",
      open: null,
      high: 105,
      low: 96,
      close: 101,
      volume: 1600,
    },
  ]);

  assertEqual(series.candles.length, 2, "lightweight chart series filters bars without valid OHLC");
  assertEqual(series.candles[0]?.time, "2026-05-18", "daily bars keep ISO date time");
  assertEqual(series.candles[1]?.close, 98, "candles keep close price");
  assertEqual(series.volume[0]?.color, "rgba(16, 185, 129, 0.42)", "rising volume bar uses positive color");
  assertEqual(series.volume[1]?.color, "rgba(239, 68, 68, 0.42)", "falling volume bar uses risk color");
}

function testBuildsLightweightChartOverlays() {
  const series = buildLightweightChartSeries([
    { date: "2026-05-18", symbol: "600519.SH", market: "CHINA", open: 10, high: 11, low: 9, close: 10, volume: 100 },
    { date: "2026-05-19", symbol: "600519.SH", market: "CHINA", open: 10, high: 12, low: 9, close: 11, volume: 100 },
    { date: "2026-05-20", symbol: "600519.SH", market: "CHINA", open: 11, high: 13, low: 10, close: 12, volume: 100 },
  ], {
    bollPeriod: 3,
    maPeriods: [2, 3],
  });

  assertEqual(series.maLines.length, 2, "requested MA lines are returned");
  assertEqual(series.maLines[0]?.period, 2, "MA line keeps period metadata");
  assertEqual(series.maLines[0]?.data.length, 2, "MA2 starts once enough closes exist");
  assertApprox(series.maLines[0]?.data[0]?.value, 10.5, 0.001, "MA2 calculates average close");
  assertEqual(series.boll.upper.length, 1, "BOLL upper starts once enough closes exist");
  assertEqual(series.boll.mid[0]?.time, "2026-05-20", "BOLL keeps source candle time");
}

function testBuildsLightweightSuperTrendSeriesAndSignals() {
  const series = buildLightweightSuperTrendSeries([
    { date: "2026-05-18", symbol: "600519.SH", market: "CHINA", open: 10, high: 11, low: 9, close: 10, volume: 100 },
    { date: "2026-05-19", symbol: "600519.SH", market: "CHINA", open: 10.5, high: 12, low: 10, close: 11.5, volume: 110 },
    { date: "2026-05-20", symbol: "600519.SH", market: "CHINA", open: 11.5, high: 13, low: 11, close: 12.5, volume: 120 },
    { date: "2026-05-21", symbol: "600519.SH", market: "CHINA", open: 12.5, high: 13, low: 11.5, close: 12.8, volume: 130 },
    { date: "2026-05-22", symbol: "600519.SH", market: "CHINA", open: 12.7, high: 13, low: 8.2, close: 8.6, volume: 180 },
    { date: "2026-05-25", symbol: "600519.SH", market: "CHINA", open: 8.7, high: 9.2, low: 7.8, close: 8.1, volume: 160 },
    { date: "2026-05-26", symbol: "600519.SH", market: "CHINA", open: 8.2, high: 11.8, low: 8.1, close: 11.6, volume: 190 },
    { date: "2026-05-27", symbol: "600519.SH", market: "CHINA", open: null, high: 12.2, low: 10.7, close: 11.9, volume: 140 },
    { date: "2026-05-28", symbol: "600519.SH", market: "CHINA", open: 11.7, high: 12.9, low: 11.2, close: 12.6, volume: 150 },
  ], {
    atrPeriod: 3,
    multiplier: 1,
  });

  assertOk(series.up.length > 0, "supertrend creates bullish line points");
  assertOk(series.down.length > 0, "supertrend creates bearish line points");
  assertEqual(series.signals.map((signal) => signal.side).join(","), "sell,buy", "supertrend emits sell then buy reversals");
  assertEqual(series.signals[0]?.time, "2026-05-22", "sell signal uses reversal candle time");
  assertEqual(series.signals[1]?.time, "2026-05-26", "buy signal uses reversal candle time");
  assertEqual(
    series.up.some((point) => point.time === "2026-05-27"),
    false,
    "supertrend ignores bars without valid OHLC",
  );
}

function testBuildsLightweightTrendHoverReadouts() {
  const superTrend = buildLightweightSuperTrendSeries([
    { date: "2026-05-18", symbol: "600519.SH", market: "CHINA", open: 10, high: 11, low: 9, close: 10, volume: 100 },
    { date: "2026-05-19", symbol: "600519.SH", market: "CHINA", open: 10.5, high: 12, low: 10, close: 11.5, volume: 110 },
    { date: "2026-05-20", symbol: "600519.SH", market: "CHINA", open: 11.5, high: 13, low: 11, close: 12.5, volume: 120 },
    { date: "2026-05-21", symbol: "600519.SH", market: "CHINA", open: 12.5, high: 13, low: 11.5, close: 12.8, volume: 130 },
    { date: "2026-05-22", symbol: "600519.SH", market: "CHINA", open: 12.7, high: 13, low: 8.2, close: 8.6, volume: 180 },
    { date: "2026-05-25", symbol: "600519.SH", market: "CHINA", open: 8.7, high: 9.2, low: 7.8, close: 8.1, volume: 160 },
    { date: "2026-05-26", symbol: "600519.SH", market: "CHINA", open: 8.2, high: 11.8, low: 8.1, close: 11.6, volume: 190 },
  ], {
    atrPeriod: 3,
    multiplier: 1,
  });

  const bearishReadouts = buildLightweightTrendHoverReadouts({
    showSuperTrend: true,
    superTrend,
    time: "2026-05-25",
  });
  assertEqual(bearishReadouts[0]?.label, "ST 空头", "hover readout labels bearish SuperTrend state");
  assertEqual(bearishReadouts[0]?.tone, "risk", "bearish SuperTrend readout uses risk tone");

  const bullishReadouts = buildLightweightTrendHoverReadouts({
    showSuperTrend: true,
    superTrend,
    time: "2026-05-26",
  });
  assertEqual(bullishReadouts[0]?.label, "ST 多头", "hover readout labels bullish SuperTrend state");
  assertEqual(bullishReadouts[0]?.tone, "good", "bullish SuperTrend readout uses good tone");
  assertEqual(
    buildLightweightTrendHoverReadouts({ showSuperTrend: false, superTrend, time: "2026-05-26" }).length,
    0,
    "hover readout respects the optional SuperTrend toggle",
  );
}

function testBuildsSuperTrendBacktestSummary() {
  const summary = buildSuperTrendBacktestSummary([
    { date: "2026-05-18", symbol: "600519.SH", market: "CHINA", open: 10, high: 11, low: 9, close: 10, volume: 100 },
    { date: "2026-05-19", symbol: "600519.SH", market: "CHINA", open: 10.5, high: 12, low: 10, close: 11.5, volume: 110 },
    { date: "2026-05-20", symbol: "600519.SH", market: "CHINA", open: 11.5, high: 13, low: 11, close: 12.5, volume: 120 },
    { date: "2026-05-21", symbol: "600519.SH", market: "CHINA", open: 12.5, high: 13, low: 11.5, close: 12.8, volume: 130 },
    { date: "2026-05-22", symbol: "600519.SH", market: "CHINA", open: 12.7, high: 13, low: 8.2, close: 8.6, volume: 180 },
    { date: "2026-05-25", symbol: "600519.SH", market: "CHINA", open: 8.7, high: 9.2, low: 7.8, close: 8.1, volume: 160 },
    { date: "2026-05-26", symbol: "600519.SH", market: "CHINA", open: 8.2, high: 11.8, low: 8.1, close: 11.6, volume: 190 },
    { date: "2026-05-27", symbol: "600519.SH", market: "CHINA", open: 11.7, high: 12.2, low: 11.2, close: 12, volume: 140 },
    { date: "2026-05-28", symbol: "600519.SH", market: "CHINA", open: 11.9, high: 12.5, low: 11.5, close: 12.3, volume: 150 },
    { date: "2026-05-29", symbol: "600519.SH", market: "CHINA", open: 12.1, high: 12.4, low: 7.2, close: 7.6, volume: 210 },
    { date: "2026-06-01", symbol: "600519.SH", market: "CHINA", open: 7.5, high: 8, low: 7.1, close: 7.4, volume: 200 },
  ], {
    atrPeriod: 3,
    multiplier: 1,
  });

  assertEqual(summary.atrPeriod, 3, "supertrend backtest keeps ATR period");
  assertEqual(summary.multiplier, 1, "supertrend backtest keeps multiplier");
  assertEqual(summary.signalCount, 3, "supertrend backtest counts all trend flips");
  assertEqual(summary.buySignalCount, 1, "supertrend backtest counts buy flips");
  assertEqual(summary.sellSignalCount, 2, "supertrend backtest counts sell flips");
  assertEqual(summary.tradeCount, 1, "supertrend backtest pairs buy and next sell as one trade");
  assertEqual(summary.openTradeCount, 0, "closed supertrend backtest has no open positions");
  assertEqual(summary.winRate, 0, "losing supertrend trade has zero win rate");
  assertApprox(summary.cumulativeReturnPct, -35.897, 0.01, "supertrend backtest uses next-open execution");
  assertApprox(summary.maxDrawdownPct, 35.897, 0.01, "supertrend backtest reports drawdown magnitude");
  assertEqual(summary.latestSignal?.side, "sell", "supertrend backtest exposes latest signal");
  assertEqual(summary.items[0]?.label, "ST胜率", "supertrend backtest exposes display cards");
}

function superTrendEnhancedFilterBars() {
  const bars: Array<{
    date: string;
    symbol: string;
    market: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> = [];
  let currentDate = Date.UTC(2026, 0, 1);
  const pushBar = (close: number, span = 1) => {
    const previousClose = bars[bars.length - 1]?.close ?? close;
    const open = (previousClose + close) / 2;
    bars.push({
      date: new Date(currentDate).toISOString().slice(0, 10),
      symbol: "HSTECH",
      market: "HONGKONG",
      open,
      high: Math.max(open, close) + span,
      low: Math.min(open, close) - span,
      close,
      volume: 1000,
    });
    currentDate += 24 * 60 * 60 * 1000;
  };

  for (let index = 0; index < 125; index += 1) pushBar(100 + index * 0.45, 0.8);
  [150, 142, 136, 130, 126, 124].forEach((close) => pushBar(close, 1.2));
  [126, 129, 132, 134, 136, 138, 137, 136, 134, 132, 130, 128].forEach((close) => pushBar(close, 1));
  [124, 120, 118, 116, 114].forEach((close) => pushBar(close, 1.2));
  [118, 122, 126, 130, 136, 142, 148, 154, 162, 170, 178, 186].forEach((close) => pushBar(close, 1.2));
  [180, 170, 160, 150, 140].forEach((close) => pushBar(close, 1.4));
  return bars;
}

function testBuildsSuperTrendBacktestSummaryWithTrendBreakoutFilter() {
  const bars = superTrendEnhancedFilterBars();
  const base = buildSuperTrendBacktestSummary(bars, { atrPeriod: 3, multiplier: 1 });
  const filtered = buildSuperTrendBacktestSummary(bars, {
    atrPeriod: 3,
    entryFilter: "trendBreakout",
    multiplier: 1,
  });

  assertEqual(base.tradeCount, 2, "base supertrend backtest keeps weak and confirmed trades");
  assertEqual(filtered.entryFilter, "trendBreakout", "enhanced supertrend summary exposes the filter mode");
  assertEqual(filtered.tradeCount, 1, "enhanced filter waits for trend and breakout confirmation");
  assertEqual(filtered.trades[0]?.entryDate, "2026-06-04", "enhanced filter enters after confirmation bar");
  assertOk(filtered.winRate > base.winRate, "enhanced filter improves hit rate on weak breakout sample");
  assertEqual(filtered.items[0]?.label, "ST增强", "enhanced filter exposes display cards");
}

function alphaTrendSignalBars() {
  return [
    { date: "2026-05-18", symbol: "600519.SH", market: "CHINA", open: 10, high: 10.4, low: 9.5, close: 9.8, volume: 100 },
    { date: "2026-05-19", symbol: "600519.SH", market: "CHINA", open: 9.8, high: 10, low: 8.8, close: 9.1, volume: 130 },
    { date: "2026-05-20", symbol: "600519.SH", market: "CHINA", open: 9.1, high: 9.4, low: 8.1, close: 8.5, volume: 150 },
    { date: "2026-05-21", symbol: "600519.SH", market: "CHINA", open: 8.5, high: 8.8, low: 7.7, close: 8.1, volume: 160 },
    { date: "2026-05-22", symbol: "600519.SH", market: "CHINA", open: 8.1, high: 9.2, low: 7.9, close: 8.9, volume: 190 },
    { date: "2026-05-25", symbol: "600519.SH", market: "CHINA", open: 8.9, high: 10.5, low: 8.7, close: 10.2, volume: 220 },
    { date: "2026-05-26", symbol: "600519.SH", market: "CHINA", open: 10.2, high: 11.8, low: 10, close: 11.3, volume: 260 },
    { date: "2026-05-27", symbol: "600519.SH", market: "CHINA", open: 11.3, high: 11.5, low: 10.1, close: 10.4, volume: 240 },
    { date: "2026-05-28", symbol: "600519.SH", market: "CHINA", open: 10.4, high: 10.8, low: 9.1, close: 9.4, volume: 280 },
    { date: "2026-05-29", symbol: "600519.SH", market: "CHINA", open: 9.4, high: 9.6, low: 8, close: 8.5, volume: 300 },
    { date: "2026-06-01", symbol: "600519.SH", market: "CHINA", open: 8.5, high: 8.6, low: 5.2, close: 5.5, volume: 360 },
    { date: "2026-06-02", symbol: "600519.SH", market: "CHINA", open: 5.5, high: 6.1, low: 4.8, close: 5.1, volume: 330 },
    { date: "2026-06-03", symbol: "600519.SH", market: "CHINA", open: 5.1, high: 5.6, low: 4.5, close: 4.8, volume: 340 },
    { date: "2026-06-04", symbol: "600519.SH", market: "CHINA", open: 4.8, high: 7.2, low: 4.7, close: 6.9, volume: 380 },
    { date: "2026-06-05", symbol: "600519.SH", market: "CHINA", open: 6.9, high: 9.4, low: 6.8, close: 9.1, volume: 420 },
    { date: "2026-06-08", symbol: "600519.SH", market: "CHINA", open: 9.1, high: 10.2, low: 8.8, close: 9.8, volume: 430 },
    { date: "2026-06-09", symbol: "600519.SH", market: "CHINA", open: 9.8, high: 13.2, low: 9.7, close: 12.8, volume: 470 },
    { date: "2026-06-10", symbol: "600519.SH", market: "CHINA", open: 12.8, high: 15.5, low: 12.4, close: 15.1, volume: 500 },
    { date: "2026-06-11", symbol: "600519.SH", market: "CHINA", open: 15.1, high: 16.8, low: 14.9, close: 16.2, volume: 520 },
  ];
}

function testBuildsAlphaTrendSeriesAndSignals() {
  const series = buildAlphaTrendSeries(alphaTrendSignalBars(), {
    multiplier: 1,
    period: 3,
  });

  assertEqual(series.points.length, 19, "alphatrend preserves valid source bar count");
  assertEqual(series.points[0]?.alphaTrend, null, "alphatrend waits for enough ATR and MFI samples");
  assertOk(series.points.some((point) => typeof point.alphaTrend === "number" && typeof point.lagAlphaTrend === "number"), "alphatrend emits current and lagged values");
  assertOk(series.points.some((point) => point.trend === "up"), "alphatrend emits bullish trend states");
  assertOk(series.points.some((point) => point.trend === "down"), "alphatrend emits bearish trend states");
  assertEqual(series.signals.map((signal) => signal.side).join(","), "sell,buy", "alphatrend emits SELL then BUY crossovers");
  assertEqual(series.signals[0]?.date, "2026-06-02", "alphatrend sell uses crossunder candle date");
  assertEqual(series.signals[1]?.date, "2026-06-10", "alphatrend buy uses crossover candle date");
}

function alphaTrendBacktestBars() {
  return [
    ...alphaTrendSignalBars(),
    { date: "2026-06-12", symbol: "600519.SH", market: "CHINA", open: 16.2, high: 16.5, low: 12, close: 12.5, volume: 600 },
    { date: "2026-06-15", symbol: "600519.SH", market: "CHINA", open: 12.5, high: 12.7, low: 9, close: 9.3, volume: 620 },
    { date: "2026-06-16", symbol: "600519.SH", market: "CHINA", open: 9.3, high: 9.5, low: 7, close: 7.2, volume: 640 },
    { date: "2026-06-17", symbol: "600519.SH", market: "CHINA", open: 7.2, high: 7.4, low: 5.8, close: 6, volume: 660 },
  ];
}

function testBuildsAlphaTrendBacktestSummary() {
  const closedSummary = buildAlphaTrendBacktestSummary(alphaTrendBacktestBars(), {
    multiplier: 1,
    period: 3,
  });

  assertEqual(closedSummary.signalCount, 3, "alphatrend backtest counts all AT signals");
  assertEqual(closedSummary.buySignalCount, 1, "alphatrend backtest counts buy signals");
  assertEqual(closedSummary.sellSignalCount, 2, "alphatrend backtest counts sell signals");
  assertEqual(closedSummary.tradeCount, 1, "alphatrend backtest pairs buy with next sell");
  assertEqual(closedSummary.openTradeCount, 0, "closed alphatrend backtest has no open positions");
  assertEqual(closedSummary.winRate, 0, "losing alphatrend trade has zero win rate");
  assertApprox(closedSummary.cumulativeReturnPct, -60.265, 0.01, "alphatrend backtest compounds trade returns");
  assertApprox(closedSummary.maxDrawdownPct, 60.265, 0.01, "alphatrend backtest reports positive drawdown magnitude");
  assertApprox(closedSummary.averageHoldBars, 5, 0.001, "alphatrend backtest measures hold bars from entry to exit");
  assertEqual(closedSummary.items[0]?.label, "AT胜率", "alphatrend backtest exposes display cards");
  assertEqual(closedSummary.items[0]?.value, "0.0%", "alphatrend backtest formats win rate");

  const openSummary = buildAlphaTrendBacktestSummary(alphaTrendSignalBars(), {
    multiplier: 1,
    period: 3,
  });
  assertEqual(openSummary.tradeCount, 1, "open alphatrend position is included as latest-price mark-to-market");
  assertEqual(openSummary.openTradeCount, 1, "open alphatrend backtest reports open position count");
  assertApprox(openSummary.winRate, 1, 0.001, "profitable open alphatrend trade contributes to current hit rate");
  assertApprox(openSummary.cumulativeReturnPct, 7.285, 0.01, "open alphatrend trade uses latest close for mark-to-market");
  assertEqual(openSummary.latestSignal?.side, "buy", "alphatrend backtest exposes latest signal");
}

function testBuildsAlphaTrendOptimizationSummary() {
  const summary = buildAlphaTrendOptimizationSummary(alphaTrendBacktestBars(), {
    currentMultiplier: 1,
    currentPeriod: 3,
    minTrades: 1,
    multiplierCandidates: [0.8, 1, 1.2],
    periodCandidates: [3, 4, 5],
    topN: 3,
  });

  assertEqual(summary.candidateCount, 9, "optimization scans every period/multiplier combination");
  assertEqual(summary.topCandidates.length, 3, "optimization returns requested top candidates");
  assertEqual(summary.best?.period, 4, "optimization favors lower drawdown when scores tie");
  assertEqual(summary.best?.multiplier, 0.8, "optimization keeps best multiplier");
  assertEqual(summary.current?.period, 3, "optimization exposes current period candidate");
  assertEqual(summary.current?.multiplier, 1, "optimization exposes current multiplier candidate");
  assertOk((summary.best?.score ?? 0) > (summary.current?.score ?? 0), "optimization ranks best above current");
  assertEqual(summary.items[0]?.label, "AT最优参数", "optimization exposes display cards");
  assertOk(summary.items[0]?.value.includes("4/0.8"), "optimization display names best parameter pair");
}

function tensionFlowTrendBars() {
  return [
    { date: "2026-05-18", symbol: "600519.SH", market: "CHINA", open: 10, high: 10.2, low: 9.4, close: 9.7, volume: 100 },
    { date: "2026-05-19", symbol: "600519.SH", market: "CHINA", open: 9.7, high: 9.9, low: 8.8, close: 9.1, volume: 120 },
    { date: "2026-05-20", symbol: "600519.SH", market: "CHINA", open: 9.1, high: 9.2, low: 8.2, close: 8.5, volume: 130 },
    { date: "2026-05-21", symbol: "600519.SH", market: "CHINA", open: 8.5, high: 8.8, low: 8.1, close: 8.3, volume: 140 },
    { date: "2026-05-22", symbol: "600519.SH", market: "CHINA", open: 8.3, high: 9.7, low: 8.2, close: 9.4, volume: 170 },
    { date: "2026-05-25", symbol: "600519.SH", market: "CHINA", open: 9.4, high: 10.8, low: 9.3, close: 10.5, volume: 190 },
    { date: "2026-05-26", symbol: "600519.SH", market: "CHINA", open: 10.5, high: 12.6, low: 10.4, close: 12.1, volume: 230 },
    { date: "2026-05-27", symbol: "600519.SH", market: "CHINA", open: 12.1, high: 13.8, low: 12, close: 13.4, volume: 250 },
    { date: "2026-05-28", symbol: "600519.SH", market: "CHINA", open: 13.4, high: 13.5, low: 11.8, close: 12.1, volume: 260 },
    { date: "2026-05-29", symbol: "600519.SH", market: "CHINA", open: 12.1, high: 12.2, low: 10.4, close: 10.8, volume: 270 },
    { date: "2026-06-01", symbol: "600519.SH", market: "CHINA", open: 10.8, high: 10.9, low: 8.1, close: 8.5, volume: 300 },
    { date: "2026-06-02", symbol: "600519.SH", market: "CHINA", open: 8.5, high: 8.8, low: 7.2, close: 7.6, volume: 310 },
    { date: "2026-06-03", symbol: "600519.SH", market: "CHINA", open: null, high: 8.9, low: 7.6, close: 8.4, volume: 320 },
    { date: "2026-06-04", symbol: "600519.SH", market: "CHINA", open: 7.6, high: 9.6, low: 7.5, close: 9.3, volume: 340 },
    { date: "2026-06-05", symbol: "600519.SH", market: "CHINA", open: 9.3, high: 11.4, low: 9.2, close: 11, volume: 360 },
    { date: "2026-06-08", symbol: "600519.SH", market: "CHINA", open: 11, high: 12.8, low: 10.9, close: 12.5, volume: 380 },
    { date: "2026-06-09", symbol: "600519.SH", market: "CHINA", open: 12.5, high: 14.8, low: 12.4, close: 14.4, volume: 420 },
    { date: "2026-06-10", symbol: "600519.SH", market: "CHINA", open: 14.4, high: 17.6, low: 14.2, close: 17.1, volume: 460 },
  ];
}

function testBuildsLightweightTensionFlowTrendSeriesAndSignals() {
  const series = buildLightweightTensionFlowTrendSeries(tensionFlowTrendBars(), {
    hmaLength: 3,
    ribbonWidth: 0.4,
    signalGap: 2,
    zScoreLength: 4,
  });

  assertOk(series.baselineUp.length > 0, "tension flow creates bullish HMA baseline points");
  assertOk(series.baselineDown.length > 0, "tension flow creates bearish HMA baseline points");
  assertOk(series.upperRibbon.length > 0, "tension flow creates upper ribbon");
  assertOk(series.lowerRibbon.length > 0, "tension flow creates lower ribbon");
  assertEqual(
    series.baselineUp.some((point) => point.time === "2026-06-03"),
    false,
    "tension flow ignores bars without valid OHLC",
  );
  assertOk(series.signals.some((signal) => signal.side === "buy"), "tension flow emits buy START signals");
  assertOk(series.signals.some((signal) => signal.side === "sell"), "tension flow emits sell START signals");
  assertOk(series.latest?.status === "strong" || series.latest?.status === "overextended", "tension flow exposes latest energy status");
}

function testBuildsTensionFlowTrendBacktestSummary() {
  const summary = buildTensionFlowTrendBacktestSummary(tensionFlowTrendBars(), {
    atrStopMultiplier: 0.8,
    hmaLength: 3,
    maxTrades: 4,
    ribbonWidth: 0.4,
    riskRewardRatio: 0.8,
    signalGap: 2,
    stopAtrLength: 3,
    zScoreLength: 4,
  });

  assertOk(summary.signalCount >= 2, "tension flow backtest counts START signals");
  assertEqual(summary.totalClosed, summary.winCount + summary.lossCount, "tension flow backtest separates wins and losses");
  assertOk(summary.items.some((item) => item.key === "winRate"), "tension flow backtest exposes win-rate card");
  assertOk(summary.items.some((item) => item.key === "energy"), "tension flow backtest exposes energy card");
  assertOk(summary.winRate >= 0 && summary.winRate <= 1, "tension flow backtest win rate is normalized");
}

function testBuildsLightweightAlphaTrendSeries() {
  const series = buildLightweightAlphaTrendSeries(alphaTrendSignalBars(), {
    multiplier: 1,
    period: 3,
  });

  assertOk(series.current.length > 0, "lightweight alphatrend exposes current line data");
  assertOk(series.lag.length > 0, "lightweight alphatrend exposes lag line data");
  assertOk(series.fill.length > 0, "lightweight alphatrend exposes fill band data");
  assertEqual(series.signals.map((signal) => signal.side).join(","), "sell,buy", "lightweight alphatrend maps BUY/SELL markers");
  assertEqual(series.signals[0]?.id, "alphatrend:sell:2026-06-02", "lightweight alphatrend creates stable sell marker id");
  assertEqual(series.signals[1]?.id, "alphatrend:buy:2026-06-10", "lightweight alphatrend creates stable buy marker id");
}

function testAlphaTrendFallsBackToRsiWhenVolumeIsMissing() {
  const volumeSeries = buildAlphaTrendSeries([
    { date: "2026-05-18", open: 10, high: 10.4, low: 9.5, close: 9.8, volume: null },
    { date: "2026-05-19", open: 9.8, high: 10, low: 8.8, close: 9.1, volume: null },
    { date: "2026-05-20", open: 9.1, high: 9.4, low: 8.1, close: 8.5, volume: null },
    { date: "2026-05-21", open: 8.5, high: 8.8, low: 7.7, close: 8.1, volume: null },
    { date: "2026-05-22", open: 8.1, high: 9.2, low: 7.9, close: 8.9, volume: null },
    { date: "2026-05-25", open: 8.9, high: 10.5, low: 8.7, close: 10.2, volume: null },
    { date: "2026-05-26", open: 10.2, high: 11.8, low: 10, close: 11.3, volume: null },
  ], {
    multiplier: 1,
    period: 3,
  });
  const forcedRsiSeries = buildAlphaTrendSeries([
    { date: "2026-05-18", open: 10, high: 10.4, low: 9.5, close: 9.8, volume: 100 },
    { date: "2026-05-19", open: 9.8, high: 10, low: 8.8, close: 9.1, volume: 130 },
    { date: "2026-05-20", open: 9.1, high: 9.4, low: 8.1, close: 8.5, volume: 150 },
    { date: "2026-05-21", open: 8.5, high: 8.8, low: 7.7, close: 8.1, volume: 160 },
    { date: "2026-05-22", open: 8.1, high: 9.2, low: 7.9, close: 8.9, volume: 190 },
    { date: "2026-05-25", open: 8.9, high: 10.5, low: 8.7, close: 10.2, volume: 220 },
    { date: "2026-05-26", open: 10.2, high: 11.8, low: 10, close: 11.3, volume: 260 },
  ], {
    multiplier: 1,
    noVolumeData: true,
    period: 3,
  });

  assertEqual(volumeSeries.source, "rsi", "missing volume automatically uses RSI calculation");
  assertEqual(forcedRsiSeries.source, "rsi", "explicit noVolumeData uses RSI calculation");
  assertEqual(
    volumeSeries.points.map((point) => point.alphaTrend ?? "-").join(","),
    forcedRsiSeries.points.map((point) => point.alphaTrend ?? "-").join(","),
    "automatic RSI fallback matches explicit RSI mode",
  );
}

function testBuildsStableLightweightMaPeriodKey() {
  const first = buildLightweightMaPeriodKey([5, 20, 60, 120]);
  const second = buildLightweightMaPeriodKey([5, 20, 60, 120]);
  const cleaned = buildLightweightMaPeriodKey([5, 0, 20, 20, 60, 120, 120.5]);

  assertEqual(first, second, "same MA periods produce stable key across array instances");
  assertEqual(cleaned, "5,20,60,120", "MA key removes invalid and duplicate periods");
}

function testBuildsLightweightVisibleLogicalRange() {
  const latestWindow = buildLightweightVisibleLogicalRange({
    total: 260,
    visibleCount: 120,
    rightOffset: 0,
  });
  assertEqual(latestWindow?.from, 140, "latest 120-bar window starts at total - visible");
  assertEqual(latestWindow?.to, 259, "latest 120-bar window ends at latest bar");

  const shiftedWindow = buildLightweightVisibleLogicalRange({
    total: 260,
    visibleCount: 120,
    rightOffset: 10,
  });
  assertEqual(shiftedWindow?.from, 130, "right offset shifts window into history");
  assertEqual(shiftedWindow?.to, 249, "right offset keeps requested visible count");

  const allWindow = buildLightweightVisibleLogicalRange({
    total: 80,
    visibleCount: 120,
    rightOffset: 10,
  });
  assertEqual(allWindow?.from, 0, "oversized window clamps to first bar");
  assertEqual(allWindow?.to, 79, "oversized window clamps to latest bar");
}

function testBuildsLightweightPriceLines() {
  const lines = buildLightweightPriceLines([
    { id: "latest", label: "最新", price: 1291.91, tone: "good", style: "dotted", axisLabelVisible: true },
    { id: "buy", label: "计划买入", price: 1260, tone: "warn", style: "solid" },
    { id: "invalid", label: "无效", price: null, tone: "neutral" },
  ]);

  assertEqual(lines.length, 2, "price lines drop missing prices");
  assertEqual(lines[0]?.title, "最新", "price line keeps readable title");
  assertEqual(lines[0]?.axisLabelVisible, true, "latest price line keeps axis label");
  assertEqual(lines[0]?.lineStyle, "dotted", "price line keeps requested style");
  assertEqual(lines[1]?.color, "rgba(245, 158, 11, 0.84)", "warn tone maps to amber");
}

function testBuildsReadableStrategyGateText() {
  const marketGate = buildReadableStrategyGateText({
    gate: "M2",
    marketPassed: false,
    marketStatus: "reject",
    benchmarkSymbol: "HSI",
  });

  assertEqual(marketGate.label, "市场环境", "M2 uses a reader-facing label");
  assertEqual(marketGate.status, "不适合开仓", "failed market filter explains the action");
  assertOk(marketGate.detail.includes("HSI"), "market detail keeps the benchmark");
  assertOk(!marketGate.detail.includes("reject"), "market detail hides raw internal status");

  const buyGate = buildReadableStrategyGateText({
    gate: "M3",
    buyTriggered: false,
    buyScore: 0.074,
    buyThreshold: 0.5,
  });

  assertEqual(buyGate.label, "买入信号", "M3 uses a plain label");
  assertEqual(buyGate.status, "信号不足", "inactive buy trigger explains why not to buy");
  assertOk(buyGate.detail.includes("买入强度 0.074"), "buy detail shows readable score");
  assertOk(buyGate.detail.includes("低于触发线 0.500"), "buy detail shows readable threshold");
  assertOk(!buyGate.detail.includes("S_buy"), "buy detail hides raw factor names");
}

function testBuildsReadableStrategyDecisionCopy() {
  const copy = buildReadableStrategyDecisionCopy({
    date: "2026-05-19",
    symbol: "01024.HK",
    modeLabel: "保守硬 AND",
    decisionLabel: "趋势未通过",
    decisionAction: "继续观察",
    steps: [
      {
        key: "M1",
        label: "个股趋势",
        status: "不支持买入",
        detail: "周线趋势偏弱，顺势买入胜率不足。",
        tone: "bad",
      },
      {
        key: "M2",
        label: "市场环境",
        status: "不适合开仓",
        detail: "HSI 未通过大盘过滤，先避免逆势开新仓。",
        tone: "bad",
      },
      {
        key: "M3",
        label: "买入信号",
        status: "信号不足",
        detail: "买入强度 0.074，低于触发线 0.500。",
        tone: "bad",
      },
    ],
  });

  assertEqual(copy.title, "当前不建议买入", "blocked strategy uses a decisive headline");
  assertOk(copy.subtitle.includes("01024.HK"), "subtitle keeps symbol context");
  assertOk(copy.subtitle.includes("继续观察，不开新仓"), "subtitle states the immediate action");
  assertOk(copy.reasons.includes("个股趋势尚未转强，顺势买入胜率不足。"), "summary explains trend block");
  assertOk(copy.reasons.includes("大盘环境未通过过滤，暂不逆风开仓。"), "summary explains market block");
  assertOk(!copy.reasons.join(" ").includes("M1"), "summary avoids internal step codes");
}

function testBuildsStrategyFactorTooltip() {
  const trend = buildStrategyFactorTooltip({ label: "趋势", buy: -0.1234, sell: 1 });
  assertOk(trend.includes("现价相对 EMA60"), "trend tooltip explains the buy formula");
  assertOk(trend.includes("负值拖累买入分"), "trend tooltip explains negative opportunity values");
  assertOk(trend.includes("跌破 EMA21"), "trend tooltip explains the risk trigger");
  assertOk(trend.includes("当前机会 -0.123"), "trend tooltip includes formatted opportunity value");
  assertOk(trend.includes("当前风险 1.000"), "trend tooltip includes formatted risk value");

  const kdj = buildStrategyFactorTooltip({ label: "超卖 / KDJ", buy: 1.417, sell: 0 });
  assertOk(kdj.includes("KDJ-J 低于 30"), "KDJ tooltip explains oversold opportunity");
  assertOk(kdj.includes("高位回落"), "KDJ tooltip explains risk trigger");
  assertOk(kdj.includes("1 表示风险触发"), "KDJ tooltip explains binary risk values");

  const momentum = buildStrategyFactorTooltip({ label: "动能", buy: -0.084, sell: null });
  assertOk(momentum.includes("MACD 柱相对 ATR"), "short momentum label maps to MACD explanation");
}

function testBuildsStrategyScoreAndStrengthTooltips() {
  const score = buildStrategyScoreTooltip({ score: 62, mode: "conservative", readiness: 0.84 });
  assertOk(score.includes("买入强度"), "score tooltip explains the buy strength score");
  assertOk(!score.includes("综合评分"), "score tooltip avoids ambiguous score wording");
  assertOk(score.includes("保守模式门槛 55"), "score tooltip explains conservative threshold");
  assertOk(score.includes("因子完整度 84%"), "score tooltip includes readiness");

  const buy = buildStrategyStrengthTooltip({ kind: "buy", value: 0.417 });
  assertOk(buy.includes("S_buy"), "buy tooltip names the weighted buy score");
  assertOk(buy.includes("当前买入强度 0.417"), "buy tooltip includes formatted buy value");

  const sell = buildStrategyStrengthTooltip({ kind: "sell", value: 0.65 });
  assertOk(sell.includes("S_sell"), "sell tooltip names the weighted sell score");
  assertOk(sell.includes("不能和买入强度直接相减"), "sell tooltip warns about different scales");
}

function testBuildsTradePlanAndRiskTooltips() {
  const checklist = buildTradeDecisionChecklistTooltip({ side: "buy", activeCount: 4, total: 5 });
  assertOk(checklist.includes("5 项技术检查"), "checklist tooltip explains the count");
  assertOk(checklist.includes("不是模型置信度"), "checklist tooltip avoids confidence confusion");
  assertOk(checklist.includes("当前通过 4/5"), "checklist tooltip includes current count");

  const stop = buildStrategyPriceLevelTooltip({ key: "stop", label: "止损" });
  assertOk(stop.includes("ATR"), "stop tooltip explains ATR stop logic");
  assertOk(stop.includes("风控线"), "stop tooltip frames stop as risk control");

  const risk = buildRiskBudgetTooltip({ method: "atr", lotSize: 100 });
  assertOk(risk.includes("单笔可承受亏损"), "risk tooltip explains sizing numerator");
  assertOk(risk.includes("止损距离"), "risk tooltip explains sizing denominator");
  assertOk(risk.includes("100 股"), "risk tooltip includes lot size");
}

function testBuildsStrategyTradeMarkers() {
  const buy = {
    signal_id: "resonance-v2-conservative-01024.HK-2026-05-18",
    signal_name: "V2 多指标共振",
    direction: "opportunity",
  };
  const reduce = {
    signal_id: "signal-2026-05-18",
    signal_name: "V2多指标共振",
    signal_level: "减仓预警",
    direction: "reduce",
  };
  const technical = {
    signal_id: "macd-2026-05-18",
    signal_name: "MACD 死叉",
    direction: "sell",
  };

  assertEqual(isStrategyTradeMarker(buy), true, "V2 resonance signals are strategy trade markers");
  assertEqual(resolveStrategyTradeMarkerKind(buy), "buy", "opportunity strategy signal becomes buy marker");
  assertEqual(buildStrategyTradeMarkerLabel(buy), "买", "buy strategy marker uses buy label");
  assertEqual(resolveStrategyTradeMarkerKind(reduce), "reduce", "reduce strategy signal keeps reduce marker");
  assertEqual(buildStrategyTradeMarkerLabel(reduce), "减", "reduce strategy marker uses reduce label");
  assertEqual(isStrategyTradeMarker(technical), false, "plain technical sell signal is not a strategy trade marker");
  assertEqual(resolveStrategyTradeMarkerKind(technical), null, "technical signals do not become strategy trade markers");
  assertEqual(isActionableStrategyTradeMarker({ signal_name: "V2多指标共振", direction: "neutral" }), false, "neutral strategy observations are not actionable markers");
}

function testUsesRedGreenTradingViewTradeMarkerColors() {
  assertEqual(tradingViewTradeMarkerColor("buy"), "#22c55e", "buy markers use green");
  assertEqual(tradingViewTradeMarkerColor("opportunity"), "#22c55e", "opportunity markers use green");
  assertEqual(tradingViewTradeMarkerColor("sell"), "#ef4444", "sell markers use red");
  assertEqual(tradingViewTradeMarkerColor("risk"), "#ef4444", "risk markers use red");
  assertEqual(tradingViewTradeMarkerColor("reduce"), "#ef4444", "reduce markers use red");
}

function testBuildsTradingViewTradeMarkerReadout() {
  const buy = buildTradingViewTradeMarkerReadout({
    date: "2026-06-10",
    fallbackPrice: 13.1,
    label: "AT BUY",
    prefix: "AlphaTrend",
    price: 12.98,
    side: "buy",
  });
  assertEqual(buy?.title, "AlphaTrend 买点", "buy marker readout names buy point");
  assertEqual(buy?.subtitle, "AT BUY", "buy marker readout keeps indicator label");
  assertEqual(buy?.date, "2026-06-10", "buy marker readout keeps signal date");
  assertEqual(buy?.price, 12.98, "buy marker readout prefers signal price");
  assertEqual(buy?.tone, "good", "buy marker readout uses good tone");

  const sell = buildTradingViewTradeMarkerReadout({
    date: "2026-06-02",
    fallbackPrice: 9.44,
    label: "ST Sell",
    prefix: "SuperTrend",
    price: null,
    side: "sell",
  });
  assertEqual(sell?.title, "SuperTrend 卖点", "sell marker readout names sell point");
  assertEqual(sell?.price, 9.44, "sell marker readout falls back to candle price");
  assertEqual(sell?.tone, "risk", "sell marker readout uses risk tone");
  assertEqual(buildTradingViewTradeMarkerReadout({ date: "", side: "buy" }), null, "marker readout requires a date");
}

function testBuildsHistoricalStrategyTradeMarkersFromBacktest() {
  const fromTrades = buildStrategyBacktestTradeMarkers({
    symbol: "01024.HK",
    mode: "conservative",
    trades: [
      { date: "2026-02-03", side: "entry", price: 42.1, quantity: 200, reason: "buy_allowed" },
      { date: "2026-03-08", side: "exit", price: 48.2, quantity: 100, reason: "reduce" },
      { date: "2026-04-10", side: "exit", price: 44.7, quantity: 100, reason: "stop_price" },
    ],
    signals: [
      { date: "2026-01-22", action: "observe", label: "继续观察" },
      { date: "2026-01-23", action: "buy_watch", label: "观察买点" },
    ],
  });

  assertEqual(fromTrades.length, 3, "trade markers use executed backtest legs and ignore observations");
  assertEqual(fromTrades.map((item) => item.direction).join(","), "buy,reduce,sell", "trade markers map entry/reduce/exit to buy/reduce/sell");
  assertEqual(fromTrades.map((item) => buildStrategyTradeMarkerLabel(item)).join(","), "买,减,卖", "trade markers expose readable buy/sell labels");
  assertEqual(fromTrades[0]?.entry_price, 42.1, "trade marker keeps executed price");

  const fallbackSignals = buildStrategyBacktestTradeMarkers({
    symbol: "01024.HK",
    mode: "conservative",
    trades: [],
    signals: [
      { date: "2026-02-01", action: "observe", label: "继续观察" },
      { date: "2026-02-02", action: "buy_allowed", label: "允许买入", buy_score: 0.71 },
      { date: "2026-02-20", action: "reduce", label: "减仓", sell_score: 0.61 },
      { date: "2026-03-12", action: "exit", label: "退出", sell_score: 0.8 },
      { date: "2026-03-18", action: "hold", label: "持有" },
    ],
  });

  assertEqual(fallbackSignals.length, 3, "signal fallback only keeps actionable strategy decisions");
  assertEqual(fallbackSignals.map((item) => item.direction).join(","), "buy,reduce,sell", "signal fallback maps actions to buy/reduce/sell");
  assertEqual(fallbackSignals.map((item) => item.date).join(","), "2026-02-02,2026-02-20,2026-03-12", "signal fallback drops observe and hold dates");
}

const bars = [
  { date: "2026-05-11", open: 10, high: 11, low: 9.8, close: 10.8, volume: 100, amount: 1_080 },
  { date: "2026-05-12", open: 10.8, high: 12, low: 10.6, close: 11.6, volume: 300, amount: 3_480 },
  { date: "2026-05-13", open: 11.6, high: 12.5, low: 11.2, close: 11.4, volume: 200, amount: 2_280 },
  { date: "2026-05-14", open: 11.4, high: 13, low: 11.3, close: 12.7, volume: 500, amount: 6_350 },
];

const baseChartPrefs = {
  ma: true,
  ema: true,
  boll: true,
  supertrend: false,
  alphaTrend: false,
  tensionFlowTrend: false,
  vwap: true,
  mike: true,
  levels: true,
  limitLines: true,
  tradeMarkers: true,
  signals: true,
  events: true,
  relative: true,
  profile: true,
  fundFlow: true,
  ichimoku: true,
  fibonacci: true,
  supportResistance: true,
  trendLines: true,
  patterns: true,
  tds9: true,
  indicatorSignals: true,
  divergences: true,
  volumeSignals: true,
  trendRegime: true,
  sar: true,
  bbi: true,
  volume: true,
  macd: true,
  rsi: true,
  kdj: true,
  advanced: true,
  momentum: true,
  biasDma: true,
  volumeMomentum: true,
  volatility: true,
  subCharts: true,
  measure: true,
};

const baseChartParams = {
  maFast: 5,
  maMid: 20,
  maSlow: 60,
  emaFast: 12,
  emaSlow: 26,
  bollPeriod: 20,
  bollMultiplier: 2,
  superTrendAtrPeriod: 10,
  superTrendMultiplier: 3,
  alphaTrendPeriod: 14,
  alphaTrendMultiplier: 1,
  tensionFlowHmaLength: 50,
  tensionFlowZScoreLength: 50,
  tensionFlowRibbonWidth: 0.5,
  tensionFlowSignalGap: 30,
  tensionFlowAtrStopMultiplier: 2,
  tensionFlowRiskReward: 1,
  tensionFlowMaxTrades: 100,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  rsiPeriod: 14,
  kdjPeriod: 9,
  crPeriod: 26,
  emvPeriod: 14,
  momentumPeriod: 14,
  biasPeriod: 6,
  dmaFast: 10,
  dmaSlow: 50,
  dmaSignal: 10,
  volumeMomentumPeriod: 26,
  rocPeriod: 12,
  trixPeriod: 12,
  trixSignal: 9,
  atrPeriod: 14,
};

const drawingCandles = [
  { date: "2026-05-01", periodLabel: "05-01", x: 48 },
  { date: "2026-05-02", periodLabel: "05-02", x: 120 },
  { date: "2026-05-03", periodLabel: "05-03", x: 192 },
];

const drawingBounds = {
  plotLeft: 48,
  plotRight: 925,
  priceTop: 80,
  priceBottom: 420,
  priceMin: 10,
  priceMax: 20,
};

const mixedTrendBars = [
  ...bars,
  { date: "2026-05-15", open: 12.7, high: 13.2, low: 12.1, close: 12.3, volume: 450, amount: 5_535 },
  { date: "2026-05-18", open: 12.3, high: 13.8, low: 12.2, close: 13.5, volume: 650, amount: 8_775 },
  { date: "2026-05-19", open: 13.5, high: 13.6, low: 11.8, close: 12, volume: 700, amount: 8_400 },
];

const trendOverlayBars = [
  ...mixedTrendBars,
  { date: "2026-05-20", open: 12, high: 12.4, low: 10.8, close: 11.1, volume: 760, amount: 8_436 },
];

const gapBars = [
  { date: "2026-05-11", open: 10, high: 10.5, low: 9.8, close: 10.2, volume: 100, amount: 1_020 },
  { date: "2026-05-12", open: 11.4, high: 12, low: 11.2, close: 11.8, volume: 320, amount: 3_776 },
  { date: "2026-05-13", open: 11.7, high: 11.9, low: 11, close: 11.2, volume: 280, amount: 3_136 },
  { date: "2026-05-14", open: 10, high: 10.4, low: 9.7, close: 10, volume: 460, amount: 4_600 },
];

const structureBars = [
  { date: "2026-05-01", open: 10, high: 10.5, low: 9.8, close: 10.2, volume: 100, amount: 1_020 },
  { date: "2026-05-02", open: 10.2, high: 11.4, low: 10.1, close: 11, volume: 180, amount: 1_980 },
  { date: "2026-05-03", open: 11, high: 12.2, low: 10.8, close: 11.8, volume: 220, amount: 2_596 },
  { date: "2026-05-04", open: 11.8, high: 11.6, low: 10.7, close: 10.9, volume: 210, amount: 2_289 },
  { date: "2026-05-05", open: 10.9, high: 10.9, low: 9.9, close: 10.2, volume: 190, amount: 1_938 },
  { date: "2026-05-06", open: 10.2, high: 10.8, low: 9.4, close: 9.8, volume: 260, amount: 2_548 },
  { date: "2026-05-07", open: 9.8, high: 11.2, low: 9.7, close: 10.9, volume: 300, amount: 3_270 },
  { date: "2026-05-08", open: 10.9, high: 12.1, low: 10.6, close: 11.7, volume: 320, amount: 3_744 },
  { date: "2026-05-09", open: 11.7, high: 11.9, low: 10.8, close: 11.1, volume: 250, amount: 2_775 },
  { date: "2026-05-10", open: 11.1, high: 11.3, low: 9.6, close: 10, volume: 280, amount: 2_800 },
  { date: "2026-05-11", open: 10, high: 10.7, low: 9.7, close: 10.4, volume: 240, amount: 2_496 },
  { date: "2026-05-12", open: 10.4, high: 11.8, low: 10.2, close: 11.5, volume: 300, amount: 3_450 },
];

const patternBars = [
  { date: "2026-05-01", open: 10.2, high: 10.4, low: 9.9, close: 10, volume: 120, amount: 1_200 },
  { date: "2026-05-02", open: 10, high: 10.6, low: 9.6, close: 10.03, volume: 140, amount: 1_404 },
  { date: "2026-05-03", open: 10.2, high: 10.4, low: 9.7, close: 9.8, volume: 180, amount: 1_764 },
  { date: "2026-05-04", open: 9.7, high: 10.6, low: 9.6, close: 10.5, volume: 260, amount: 2_730 },
  { date: "2026-05-05", open: 10.4, high: 11.2, low: 10.3, close: 11, volume: 210, amount: 2_310 },
  { date: "2026-05-06", open: 11.1, high: 11.3, low: 10.1, close: 10.2, volume: 280, amount: 2_856 },
  { date: "2026-05-07", open: 10.3, high: 10.55, low: 9.4, close: 10.5, volume: 320, amount: 3_360 },
];

const risingTdsBars = Array.from({ length: 13 }, (_, index) => {
  const close = index < 4 ? 10 : 10 + index - 3;
  return {
    date: `2026-06-${String(index + 1).padStart(2, "0")}`,
    open: close - 0.2,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 100 + index,
    amount: close * (100 + index),
  };
});

const fallingTdsBars = Array.from({ length: 13 }, (_, index) => {
  const close = index < 4 ? 20 : 20 - index + 3;
  return {
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    open: close + 0.2,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 100 + index,
    amount: close * (100 + index),
  };
});

const partialTdsBars = risingTdsBars.slice(0, 10);
const failedPartialTdsBars = [
  ...risingTdsBars.slice(0, 10),
  { date: "2026-06-11", open: 9.5, high: 9.8, low: 9.2, close: 9.5, volume: 120, amount: 1_140 },
];

const eventBacktestBars = [
  { date: "2026-08-01", open: 9.8, high: 10.2, low: 9.6, close: 10, volume: 100, amount: 1_000 },
  { date: "2026-08-02", open: 10.2, high: 11.4, low: 10, close: 11, volume: 130, amount: 1_430 },
  { date: "2026-08-03", open: 11.2, high: 12.4, low: 11, close: 12, volume: 150, amount: 1_800 },
  { date: "2026-08-04", open: 11.8, high: 12, low: 10.8, close: 11, volume: 160, amount: 1_760 },
  { date: "2026-08-05", open: 11.4, high: 12.8, low: 11.2, close: 12.5, volume: 180, amount: 2_250 },
  { date: "2026-08-06", open: 12.4, high: 12.6, low: 11.8, close: 12, volume: 170, amount: 2_040 },
];

const technicalSignalBars = [
  { date: "2026-05-01", open: 10, high: 10.2, low: 9.8, close: 10, maFast: 9.8, maSlow: 10, dif: -0.08, dea: 0.02, bollUpper: 11, bollLower: 9 },
  { date: "2026-05-02", open: 10, high: 10.9, low: 9.9, close: 10.8, maFast: 10.2, maSlow: 10.1, dif: -0.04, dea: 0.01, bollUpper: 11.2, bollLower: 9.1 },
  { date: "2026-05-03", open: 10.8, high: 11, low: 10.4, close: 10.9, maFast: 10.5, maSlow: 10.2, dif: 0.05, dea: 0.02, bollUpper: 11.4, bollLower: 9.3 },
  { date: "2026-05-04", open: 10.9, high: 12.4, low: 10.8, close: 12.2, maFast: 10.9, maSlow: 10.4, dif: 0.08, dea: 0.03, bollUpper: 12, bollLower: 9.5 },
  { date: "2026-05-05", open: 12.2, high: 12.3, low: 11, close: 11.2, maFast: 11.2, maSlow: 11, dif: 0.04, dea: 0.02, bollUpper: 12.5, bollLower: 9.8 },
  { date: "2026-05-06", open: 11.2, high: 11.3, low: 10.6, close: 10.8, maFast: 10.9, maSlow: 11.1, dif: 0.01, dea: 0.03, bollUpper: 12.2, bollLower: 9.6 },
  { date: "2026-05-07", open: 10.8, high: 10.9, low: 8.7, close: 8.8, maFast: 10.3, maSlow: 10.9, dif: -0.03, dea: 0.02, bollUpper: 11.8, bollLower: 9 },
];

const technicalMomentumSignalBars = [
  { date: "2026-05-01", open: 10, high: 10.5, low: 9.5, close: 10, rsi14: 28, kdjK: 15, kdjD: 20, pdi: 10, mdi: 20, cci: -120, wr: -85 },
  { date: "2026-05-02", open: 10, high: 11.2, low: 9.9, close: 10.8, rsi14: 32, kdjK: 25, kdjD: 18, pdi: 22, mdi: 18, cci: -80, wr: -78 },
  { date: "2026-05-03", open: 10.8, high: 12, low: 10.6, close: 11.7, rsi14: 72, kdjK: 84, kdjD: 76, pdi: 31, mdi: 16, cci: 128, wr: -18 },
  { date: "2026-05-04", open: 11.7, high: 11.9, low: 10.1, close: 10.5, rsi14: 66, kdjK: 70, kdjD: 78, pdi: 16, mdi: 24, cci: -116, wr: -42 },
];

const divergenceBars = [
  { date: "2026-05-01", open: 10, high: 10, low: 9.5, close: 9.8, rsi14: 45, macd: 0 },
  { date: "2026-05-02", open: 9.8, high: 10.8, low: 9, close: 9.4, rsi14: 34, macd: -0.5 },
  { date: "2026-05-03", open: 9.4, high: 10.5, low: 9.4, close: 10.1, rsi14: 39, macd: -0.4 },
  { date: "2026-05-04", open: 10.1, high: 10.9, low: 8.6, close: 10, rsi14: 43, macd: -0.2 },
  { date: "2026-05-05", open: 10, high: 10.4, low: 9.2, close: 10.2, rsi14: 48, macd: 0 },
  { date: "2026-05-06", open: 10.2, high: 12.2, low: 10.1, close: 12, rsi14: 76, macd: 0.8 },
  { date: "2026-05-07", open: 12, high: 11.5, low: 10.4, close: 11.1, rsi14: 70, macd: 0.7 },
  { date: "2026-05-08", open: 11.1, high: 12, low: 10.8, close: 11.8, rsi14: 72, macd: 0.6 },
  { date: "2026-05-09", open: 11.8, high: 12.8, low: 11.1, close: 12.4, rsi14: 66, macd: 0.3 },
  { date: "2026-05-10", open: 12.4, high: 12.1, low: 11, close: 11.5, rsi14: 64, macd: 0.2 },
];

const volumeSignalBars = [
  { date: "2026-05-01", open: 10, high: 10.2, low: 9.8, close: 10, volume: 100, amount: 1_000 },
  { date: "2026-05-02", open: 10, high: 10.3, low: 9.9, close: 10.1, volume: 110, amount: 1_111 },
  { date: "2026-05-03", open: 10.1, high: 10.2, low: 9.9, close: 10, volume: 90, amount: 900 },
  { date: "2026-05-04", open: 10, high: 10.7, low: 9.9, close: 10.5, volume: 240, amount: 2_520 },
  { date: "2026-05-05", open: 10.5, high: 10.7, low: 10.3, close: 10.55, volume: 120, amount: 1_266 },
  { date: "2026-05-06", open: 10.4, high: 10.6, low: 9.9, close: 10, volume: 310, amount: 3_100 },
  { date: "2026-05-07", open: 10, high: 10.1, low: 9.95, close: 10.03, volume: 40, amount: 401.2 },
];

const trendRegimeBars = [
  { date: "2026-05-01", close: 11, maFast: 11, maMid: 10, maSlow: 9 },
  { date: "2026-05-02", close: 12, maFast: 11.6, maMid: 10.5, maSlow: 9.5 },
  { date: "2026-05-03", close: 10.8, maFast: 10.7, maMid: 10.8, maSlow: 10.1 },
  { date: "2026-05-04", close: 10.2, maFast: 10.1, maMid: 10.6, maSlow: 10.2 },
  { date: "2026-05-05", close: 9.5, maFast: 9.8, maMid: 10.2, maSlow: 10.8 },
  { date: "2026-05-06", close: 9, maFast: 9.4, maMid: 10, maSlow: 10.5 },
  { date: "2026-05-07", close: 8.8, maFast: 9.1, maMid: 9.8, maSlow: 10.2 },
];

const priceStructureTrendBars = [
  { date: "2026-05-01", open: 10, high: 10.5, low: 9.8, close: 10.2 },
  { date: "2026-05-02", open: 10.2, high: 11.4, low: 10.1, close: 11 },
  { date: "2026-05-03", open: 11, high: 12.2, low: 10.8, close: 11.8 },
  { date: "2026-05-04", open: 11.8, high: 11.6, low: 10.7, close: 10.9 },
  { date: "2026-05-05", open: 10.9, high: 10.9, low: 9.9, close: 10.2 },
  { date: "2026-05-06", open: 10.2, high: 10.8, low: 9.4, close: 9.8 },
  { date: "2026-05-07", open: 9.8, high: 11.2, low: 9.7, close: 10.9 },
  { date: "2026-05-08", open: 10.9, high: 12.1, low: 10.6, close: 11.7 },
  { date: "2026-05-09", open: 11.7, high: 11.9, low: 10.8, close: 11.1 },
  { date: "2026-05-10", open: 11.1, high: 11.3, low: 9.6, close: 10 },
  { date: "2026-05-11", open: 10, high: 10.7, low: 9.7, close: 10.4 },
  { date: "2026-05-12", open: 10.4, high: 11.8, low: 10.2, close: 11.5 },
];

function testBuildsVisibleVolumeDistribution() {
  const profile = buildVolumeProfile(bars, { binCount: 4, currentPrice: 11.8 });

  assertEqual(profile.bins.length, 4, "profile respects requested bin count");
  assertApprox(profile.totalVolume, 1_100, 0.001, "profile conserves total volume");
  assertApprox(profile.weightedAveragePrice, 11.9909, 0.001, "profile exposes average cost line");
  assertOk(profile.pointOfControl, "profile exposes peak chip area");
  assertOk(profile.currentBin, "profile locates current price bin");
  assertEqual(profile.currentBin?.side, "current", "current price bin is marked current");
  assertOk(profile.supportBin, "profile locates nearest support chip area");
  assertOk(profile.resistanceBin, "profile locates nearest resistance chip area");
  assertEqual(profile.bins.some((bin) => bin.widthPercent === 100), true, "largest bin is normalized to 100 width");
  assertApprox(profile.winningVolumeRatio, 0.5228, 0.001, "profile estimates winning chip ratio below current price");
  assertApprox(profile.lockedVolumeRatio, 0.4772, 0.001, "profile estimates locked chip ratio above current price");
  assertApprox(profile.costRange70?.percent, 0.7, 0.001, "profile exposes Futu-style 70 percent cost range");
  assertApprox(profile.costRange70?.low, 10.897, 0.001, "profile 70 percent cost range lower edge uses volume quantile");
  assertApprox(profile.costRange70?.high, 12.531, 0.001, "profile 70 percent cost range upper edge uses volume quantile");
  assertApprox(profile.costRange70?.concentrationRatio, 0.1385, 0.001, "profile 70 percent concentration is relative to current price");
  assertApprox(profile.costRange90?.percent, 0.9, 0.001, "profile exposes Futu-style 90 percent cost range");
}

function testBuildsLimitPriceLinesFromFinitePrices() {
  const lines = buildLimitPriceLines([
    { x: 48, limit_up: 11, limit_down: 9 },
    { x: 120, limit_up: null, limit_down: 9.2 },
    { x: 192, limit_up: 12, limit_down: Number.NaN },
  ], (price) => 200 - price * 10);

  assertEqual(lines.upLine, "48.00,90.00 192.00,80.00", "limit-up line keeps finite prices only");
  assertEqual(lines.downLine, "48.00,110.00 120.00,108.00", "limit-down line keeps finite prices only");
  assertApprox(lines.latestUp?.price, 12, 0.001, "latest valid limit-up price is exposed");
  assertApprox(lines.latestDown?.price, 9.2, 0.001, "latest valid limit-down price is exposed");
  assertEqual(lines.values.length, 4, "finite limit prices are available for price-domain expansion");
}

function testMapsClientPointToSplitChartViewBox() {
  const point = mapClientPointToChartViewBox({
    clientX: 550,
    clientY: 620,
    rect: { left: 50, top: 120, width: 1000, height: 1000 },
    viewBoxWidth: 1000,
    viewBoxHeight: 1012,
  });

  assertApprox(point.x, 500, 0.001, "x maps to the SVG viewBox width");
  assertApprox(point.y, 506, 0.001, "y maps to the full split-indicator viewBox height");
}

function testBuildsKlineHoverMetrics() {
  const metrics = buildKlineHoverMetrics({
    close: 10,
    volume: 200,
    amount: 2_120,
    limit_up: 11,
    limit_down: 9,
    is_limit_up: false,
  });

  assertApprox(metrics.averagePrice, 10.6, 0.001, "hover metrics expose average transaction price");
  assertApprox(metrics.limitUpDistancePct, 0.1, 0.001, "limit-up distance is relative to close");
  assertApprox(metrics.limitDownDistancePct, -0.1, 0.001, "limit-down distance is relative to close");
  assertEqual(metrics.statusLabel, "普通", "ordinary candles get a neutral status label");
}

function testBuildsVolumeMovingAverageValues() {
  const values = buildVolumeMovingAverageValues([100, 200, 300, 400, 500, 600], 3);

  assertEqual(values[0], null, "moving average waits for a full volume window");
  assertEqual(values[1], null, "moving average keeps early samples empty");
  assertApprox(values[2], 200, 0.001, "third sample averages the first 3 volumes");
  assertApprox(values[5], 500, 0.001, "latest sample averages the latest 3 volumes");
}

function testBuildsFundFlowOverlayGeometry() {
  const geometry = buildFundFlowOverlayGeometry(
    [
      { date: "2026-05-01", x: 48, width: 9 },
      { date: "2026-05-02", x: 96, width: 9 },
    ],
    [
      { date: "2026-05-01", main_net_inflow: 100, large_net_inflow: -50, northbound_net_inflow: 0 },
      { date: "2026-05-02", main_net_inflow: -200, large_net_inflow: 50, northbound_net_inflow: 100 },
    ],
    { top: 100, bottom: 160 },
  );

  assertEqual(geometry.bars.length, 6, "fund-flow overlay emits three series bars per matched candle");
  assertApprox(geometry.zeroY, 130, 0.001, "fund-flow overlay uses the middle of the volume band as zero");
  assertEqual(geometry.bars[0]?.tone, "positive", "positive main flow is marked positive");
  assertApprox(geometry.bars[0]?.height, 14, 0.001, "positive bar height scales by max absolute flow");
  assertEqual(geometry.bars[3]?.tone, "negative", "negative main flow is marked negative");
  assertApprox(geometry.bars[3]?.y, 130, 0.001, "negative bars start at the zero baseline");
  assertApprox(geometry.latest?.main_net_inflow, -200, 0.001, "latest matched fund-flow row is exposed for readouts");
}

function testResolvesLimitCandleState() {
  assertEqual(
    resolveLimitCandleState({ close: 10, limit_up: 10, limit_down: 9, is_suspended: true }),
    "suspended",
    "suspended state takes priority over limit prices",
  );
  assertEqual(
    resolveLimitCandleState({ close: 10, is_limit_up: true }),
    "limit-up",
    "explicit limit-up flag is honored",
  );
  assertEqual(
    resolveLimitCandleState({ close: 9, limit_down: 9 }),
    "limit-down",
    "close price matching limit-down is detected",
  );
  assertEqual(
    resolveLimitCandleState({ close: 10, limit_up: 11, limit_down: 9 }),
    null,
    "ordinary candles have no limit state",
  );
}

function testAppliesTrendChartPreferencePreset() {
  const prefs = applyChartPreferencePreset({ ...baseChartPrefs, ene: false }, "trend");
  const fullPrefs = applyChartPreferencePreset(baseChartPrefs, "full");

  assertEqual(prefs.ma, true, "trend preset keeps moving averages");
  assertEqual(prefs.ema, true, "trend preset enables EMA");
  assertEqual(prefs.boll, true, "trend preset keeps BOLL");
  assertEqual(prefs.supertrend, true, "trend preset keeps SuperTrend");
  assertEqual(prefs.alphaTrend, true, "trend preset enables AlphaTrend");
  assertEqual(prefs.tensionFlowTrend, true, "trend preset enables Tension Flow Trend");
  assertEqual(fullPrefs.alphaTrend, true, "full preset enables AlphaTrend");
  assertEqual(fullPrefs.tensionFlowTrend, true, "full preset enables Tension Flow Trend");
  assertEqual(prefs.ene, true, "trend preset enables ENE envelope");
  assertEqual(prefs.limitLines, true, "trend preset keeps A-share limit price lines");
  assertEqual(prefs.trendRegime, true, "trend preset enables trend background");
  assertEqual(prefs.trendLines, true, "trend preset enables structure trend lines");
  assertEqual(prefs.macd, true, "trend preset keeps MACD");
  assertEqual(prefs.rsi, false, "trend preset hides oscillator-only RSI");
  assertEqual(prefs.kdj, false, "trend preset hides oscillator-only KDJ");
  assertEqual(prefs.volumeMomentum, false, "trend preset hides volume momentum panel");
  assertEqual(prefs.measure, false, "preset application exits measuring mode");
}

function testMatchesChartPreferencePresetFromValues() {
  const prefs = applyChartPreferencePreset(baseChartPrefs, "oscillator");

  assertEqual(matchChartPreferencePreset(prefs), "oscillator", "preset matcher identifies the current oscillator view");
  assertEqual(matchChartPreferencePreset({ ...prefs, rsi: false }), null, "manual edits make the preset custom");
}

function testBuildsChartLayerSummary() {
  const prefs = applyChartPreferencePreset(baseChartPrefs, "trend");
  const summary = buildChartLayerSummary(prefs);
  const preset = summary.find((item) => item.key === "preset");
  const overlays = summary.find((item) => item.key === "overlays");
  const subcharts = summary.find((item) => item.key === "subcharts");
  const annotations = summary.find((item) => item.key === "annotations");
  const mode = summary.find((item) => item.key === "mode");

  assertEqual(summary.length, 5, "layer summary exposes preset plus layer groups");
  assertEqual(preset?.value, "趋势", "layer summary names matched preset");
  assertEqual(overlays?.value, "11项", "layer summary counts active main overlays");
  assertOk(overlays?.detail.includes("ST"), "trend overlay summary includes SuperTrend");
  assertOk(overlays?.detail.includes("AT"), "trend overlay summary includes AlphaTrend");
  assertOk(overlays?.detail.includes("TFT"), "trend overlay summary includes Tension Flow Trend");
  assertOk(overlays?.detail.includes("一目"), "trend overlay summary includes Ichimoku");
  assertOk((subcharts?.enabledCount || 0) > 0, "layer summary counts active subcharts");
  assertOk(annotations?.detail.includes("趋势带"), "layer summary exposes annotation layers");
  assertOk(annotations?.detail.includes("买卖"), "layer summary exposes strategy trade markers separately from technical signals");
  assertEqual(mode?.value, "分屏", "layer summary names split subchart mode");
}

function testBuildsIndicatorStateSummary() {
  const summary = buildIndicatorStateSummary({
    close: 121,
    ma20: 112,
    ma60: 105,
    bollUpper: 120,
    bollMid: 112,
    bollLower: 104,
    vwap: 114,
    volume: 3_200_000,
    volumeMa5: 2_100_000,
    volumeMa20: 1_900_000,
    volumeRatio: 1.9,
    dif: 1.2,
    dea: 0.8,
    macd: 0.8,
    rsi14: 76,
    kdjK: 84,
    cci: 128,
    wr: -18,
    pdi: 31,
    mdi: 18,
    adx: 29,
    mfi: 62,
    vr: 150,
    atr: 3.1,
    bias: 3.6,
  });
  const trend = summary.find((item) => item.key === "trend");
  const momentum = summary.find((item) => item.key === "momentum");
  const volume = summary.find((item) => item.key === "volume");
  const volatility = summary.find((item) => item.key === "volatility");
  const position = summary.find((item) => item.key === "position");

  assertEqual(summary.length, 5, "indicator state summary exposes five dimensions");
  assertEqual(trend?.value, "多头延续", "indicator state summary identifies bullish trend");
  assertEqual(momentum?.value, "高位钝化", "indicator state summary flags overbought momentum");
  assertEqual(volume?.value, "放量配合", "indicator state summary identifies active volume");
  assertEqual(volatility?.value, "波动扩张", "indicator state summary identifies elevated volatility");
  assertEqual(position?.value, "上轨压力", "indicator state summary identifies upper Bollinger pressure");
}

function testUnknownChartPreferencePresetIsNoop() {
  const prefs = applyChartPreferencePreset(baseChartPrefs, "missing-preset");

  assertEqual(prefs, baseChartPrefs, "unknown preset keeps the original preferences object");
}

function testAppliesShortTermChartParameterPreset() {
  const params = applyChartParameterPreset(baseChartParams, "short");

  assertEqual(params.maFast, 3, "short preset uses faster MA fast period");
  assertEqual(params.maMid, 10, "short preset uses faster MA mid period");
  assertEqual(params.maSlow, 30, "short preset uses faster MA slow period");
  assertEqual(params.emaFast, 6, "short preset uses faster EMA fast period");
  assertEqual(params.emaSlow, 13, "short preset uses faster EMA slow period");
  assertEqual(params.macdFast, 6, "short preset uses faster MACD fast period");
  assertEqual(params.macdSlow, 13, "short preset uses faster MACD slow period");
  assertEqual(params.macdSignal, 5, "short preset uses faster MACD signal period");
  assertEqual(params.rsiPeriod, 7, "short preset uses shorter RSI period");
  assertEqual(params.superTrendAtrPeriod, 7, "short preset uses shorter SuperTrend ATR period");
  assertEqual(params.alphaTrendPeriod, 7, "short preset uses shorter AlphaTrend period");
  assertEqual(params.alphaTrendMultiplier, 1, "short preset keeps AlphaTrend multiplier conservative");
  assertEqual(params.tensionFlowHmaLength, 34, "short preset uses faster Tension Flow HMA");
  assertEqual(params.tensionFlowSignalGap, 18, "short preset reduces Tension Flow cooldown");
  assertEqual(params.atrPeriod, 10, "short preset uses shorter ATR period");
}

function testMatchesChartParameterPresetFromValues() {
  const params = applyChartParameterPreset(baseChartParams, "swing");

  assertEqual(matchChartParameterPreset(params), "swing", "parameter matcher identifies the current swing preset");
  assertEqual(matchChartParameterPreset({ ...params, emaFast: 18 }), null, "manual EMA edits make the preset custom");
  assertEqual(matchChartParameterPreset({ ...params, bollMultiplier: 2.3 }), null, "manual parameter edits make the preset custom");
}

function testUnknownChartParameterPresetIsNoop() {
  const params = applyChartParameterPreset(baseChartParams, "missing-preset");

  assertEqual(params, baseChartParams, "unknown parameter preset keeps the original parameter object");
}

function testBuildsManualHorizontalDrawingGeometry() {
  const geometry = buildManualDrawingGeometry([
    {
      id: "h1",
      type: "horizontal",
      start: { date: "2026-05-02", label: "05-02", price: 15 },
    },
  ], drawingCandles, drawingBounds);

  assertEqual(geometry.length, 1, "horizontal drawing is visible when price is inside chart bounds");
  assertEqual(geometry[0]?.id, "h1", "horizontal drawing keeps source id");
  assertEqual(geometry[0]?.type, "horizontal", "horizontal drawing keeps source type");
  assertApprox(geometry[0]?.x1, 48, 0.001, "horizontal drawing starts at plot left");
  assertApprox(geometry[0]?.x2, 925, 0.001, "horizontal drawing ends at plot right");
  assertApprox(geometry[0]?.y1, 250, 0.001, "horizontal drawing maps price to chart y");
  assertApprox(geometry[0]?.y2, 250, 0.001, "horizontal drawing keeps y flat");
  assertEqual(geometry[0]?.label, "画线 15.00", "horizontal drawing exposes price label");
}

function testBuildsManualDrawingGeometryOnPercentAxis() {
  const geometry = buildManualDrawingGeometry([
    {
      id: "h-percent",
      type: "horizontal",
      start: { date: "2026-05-02", label: "05-02", price: 10 },
    },
  ], drawingCandles, {
    ...drawingBounds,
    priceAxisBase: 10,
    priceAxisMax: 20,
    priceAxisMin: -10,
    priceAxisMode: "percent",
  });

  assertEqual(geometry.length, 1, "percent axis keeps manual drawings visible when the converted value is inside bounds");
  assertApprox(geometry[0]?.y1, 306.6667, 0.001, "manual drawing maps raw price through percent axis scale");
}

function testBuildsManualTrendDrawingGeometry() {
  const geometry = buildManualDrawingGeometry([
    {
      id: "t1",
      type: "trend",
      start: { date: "2026-05-01", label: "05-01", price: 12 },
      end: { date: "2026-05-03", label: "05-03", price: 18 },
    },
    {
      id: "t2",
      type: "trend",
      start: { date: "2026-05-01", label: "05-01", price: 12 },
      end: { date: "2026-05-30", label: "05-30", price: 18 },
    },
  ], drawingCandles, drawingBounds);

  assertEqual(geometry.length, 1, "trend drawing needs both anchors in the visible window");
  assertEqual(geometry[0]?.id, "t1", "trend drawing keeps visible source id");
  assertApprox(geometry[0]?.x1, 48, 0.001, "trend drawing maps start date to x");
  assertApprox(geometry[0]?.x2, 192, 0.001, "trend drawing maps end date to x");
  assertApprox(geometry[0]?.y1, 352, 0.001, "trend drawing maps start price to y");
  assertApprox(geometry[0]?.y2, 148, 0.001, "trend drawing maps end price to y");
  assertEqual(geometry[0]?.label, "趋势线", "trend drawing exposes readable label");
}

function testNormalizesManualDrawingsForStorage() {
  const drawings = normalizeManualDrawings([
    {
      id: "h1",
      type: "horizontal",
      start: { date: "2026-05-01", label: "05-01", price: 15 },
      ignored: "field",
    },
    {
      id: "t1",
      type: "trend",
      start: { date: "2026-05-01", price: 12 },
      end: { date: "2026-05-03", label: "05-03", price: 18 },
    },
    {
      id: "bad-trend",
      type: "trend",
      start: { date: "2026-05-01", price: 12 },
    },
    {
      id: "bad-price",
      type: "horizontal",
      start: { date: "2026-05-01", price: Number.NaN },
    },
  ], 8);

  assertEqual(drawings.length, 2, "normalizer keeps only usable drawings");
  assertEqual(drawings[0]?.id, "h1", "normalizer keeps horizontal drawing id");
  assertEqual(drawings[0]?.start.label, "05-01", "normalizer keeps optional anchor label");
  assertEqual(Object.prototype.hasOwnProperty.call(drawings[0], "ignored"), false, "normalizer removes unknown fields");
  assertEqual(drawings[1]?.id, "t1", "normalizer keeps completed trend drawing");
  assertEqual(drawings[1]?.end?.price, 18, "normalizer keeps trend end price");

  const limited = normalizeManualDrawings(drawings, 1);
  assertEqual(limited.length, 1, "normalizer trims saved drawing count");
  assertEqual(limited[0]?.id, "t1", "normalizer keeps the most recent drawings when trimming");
}

function testManualDrawingStorageKeyUsesSymbolScope() {
  assertEqual(
    buildManualDrawingStorageKey(" 600519.SH "),
    "tradingagents.tradeSignalKline.drawings.600519.SH",
    "drawing storage key is scoped to normalized symbol",
  );
  assertEqual(
    buildManualDrawingStorageKey(""),
    "tradingagents.tradeSignalKline.drawings.default",
    "drawing storage key falls back for missing symbol",
  );
}

function testBuildsPercentPriceAxisScale() {
  const scale = buildPriceAxisScale([9, 10, 12], {
    basePrice: 10,
    bottom: 420,
    mode: "percent",
    top: 80,
  });

  assertEqual(scale.mode, "percent", "percent axis mode is preserved with a valid base price");
  assertApprox(scale.min, -10, 0.001, "percent axis min uses base-relative return");
  assertApprox(scale.max, 20, 0.001, "percent axis max uses base-relative return");
  assertApprox(priceAxisValueFromPrice(scale, 12), 20, 0.001, "percent axis converts price to percent value");
  assertApprox(priceAxisYOf(scale, 10), 306.6667, 0.001, "percent axis maps base price above the lower bound");
  assertApprox(priceAxisPriceFromY(scale, 80), 12, 0.001, "percent axis converts top y back to raw price");
}

function testPriceAxisModeFallsBackForInvalidInput() {
  assertEqual(normalizePriceAxisMode("percent"), "percent", "valid percent mode is accepted");
  assertEqual(normalizePriceAxisMode("log"), "price", "unknown axis mode falls back to price");

  const scale = buildPriceAxisScale([10, 20], {
    basePrice: 0,
    bottom: 420,
    mode: "percent",
    top: 80,
  });

  assertEqual(scale.mode, "price", "invalid percent base falls back to price axis");
  assertApprox(priceAxisValueFromPrice(scale, 20), 20, 0.001, "fallback scale keeps raw price values");
  assertApprox(priceAxisPriceFromY(scale, 80), 20, 0.001, "fallback scale converts y back to raw price");
}

function testBuildsForwardAdjustedBars() {
  const result = buildPriceAdjustedBars([
    { date: "2026-05-01", open: 10, high: 12, low: 9, close: 11, adj_factor: 2 },
    { date: "2026-05-02", open: 18, high: 22, low: 17, close: 20, adj_factor: 4 },
  ], "forward");

  assertEqual(result.mode, "forward", "valid forward adjustment mode is used");
  assertApprox(result.baseFactor, 4, 0.001, "forward adjustment uses the latest factor as base");
  assertApprox(result.bars[0]?.open, 5, 0.001, "forward adjustment scales earlier open");
  assertApprox(result.bars[0]?.high, 6, 0.001, "forward adjustment scales earlier high");
  assertApprox(result.bars[0]?.low, 4.5, 0.001, "forward adjustment scales earlier low");
  assertApprox(result.bars[0]?.close, 5.5, 0.001, "forward adjustment scales earlier close");
  assertApprox(result.bars[1]?.close, 20, 0.001, "forward adjustment keeps latest close anchored");
}

function testBuildsBackwardAdjustedBars() {
  const result = buildPriceAdjustedBars([
    { date: "2026-05-01", open: 10, high: 12, low: 9, close: 11, adj_factor: 2 },
    { date: "2026-05-02", open: 18, high: 22, low: 17, close: 20, adj_factor: 4 },
  ], "backward");

  assertEqual(result.mode, "backward", "valid backward adjustment mode is used");
  assertApprox(result.baseFactor, 2, 0.001, "backward adjustment uses the first factor as base");
  assertApprox(result.bars[0]?.close, 11, 0.001, "backward adjustment keeps first close anchored");
  assertApprox(result.bars[1]?.close, 40, 0.001, "backward adjustment scales later close");
  assertApprox(priceAdjustmentPriceByFactor(20, 4, result), 40, 0.001, "single raw price can be adjusted with the same scale");
}

function testPriceAdjustmentModeFallback() {
  assertEqual(normalizePriceAdjustmentMode("forward"), "forward", "forward adjustment mode is accepted");
  assertEqual(normalizePriceAdjustmentMode("hfq"), "none", "unknown adjustment mode falls back to none");

  const result = buildPriceAdjustedBars([
    { date: "2026-05-01", close: 11, adj_factor: 2 },
    { date: "2026-05-02", close: 20, adj_factor: null },
  ], "forward");

  assertEqual(result.mode, "none", "missing factors keep the series unadjusted");
  assertApprox(result.bars[0]?.close, 11, 0.001, "fallback keeps raw close");
  assertApprox(priceAdjustmentPriceByFactor(11, 2, result), 11, 0.001, "fallback single price stays raw");
}

function testNormalizesKlineRenderMode() {
  assertEqual(normalizeKlineRenderMode("line"), "line", "line chart mode is accepted");
  assertEqual(normalizeKlineRenderMode("ohlc"), "ohlc", "OHLC bar mode is accepted");
  assertEqual(normalizeKlineRenderMode("heikinAshi"), "heikinAshi", "Heikin-Ashi chart mode is accepted");
  assertEqual(normalizeKlineRenderMode("area"), "candle", "unknown chart mode falls back to candle");
}

function testBuildsHeikinAshiBars() {
  const heikinBars = buildHeikinAshiBars(bars);

  assertEqual(heikinBars.length, 4, "Heikin-Ashi output preserves bar count");
  assertEqual(heikinBars[0]?.date, "2026-05-11", "Heikin-Ashi output keeps source metadata");
  assertApprox(heikinBars[0]?.open, 10.4, 0.001, "first Heikin-Ashi open starts from original open and close midpoint");
  assertApprox(heikinBars[0]?.close, 10.4, 0.001, "first Heikin-Ashi close averages original OHLC");
  assertApprox(heikinBars[1]?.open, 10.4, 0.001, "subsequent Heikin-Ashi open uses previous Heikin-Ashi open and close");
  assertApprox(heikinBars[1]?.close, 11.25, 0.001, "Heikin-Ashi close averages each original OHLC");
  assertApprox(heikinBars[1]?.high, 12, 0.001, "Heikin-Ashi high keeps the max of original high and synthetic body");
  assertApprox(heikinBars[1]?.low, 10.4, 0.001, "Heikin-Ashi low includes the synthetic open");
}

function testBuildsMeasuredRangeStats() {
  const stats = buildMeasuredRangeStats(bars, 0, 3);

  assertOk(stats, "range stats exist for selected endpoints");
  assertEqual(stats?.startIndex, 0, "range stats keep selected start index");
  assertEqual(stats?.endIndex, 3, "range stats keep selected end index");
  assertEqual(stats?.bars, 3, "range stats count interval distance");
  assertEqual(stats?.barCount, 4, "range stats count inclusive candles");
  assertApprox(stats?.change, 1.9, 0.001, "range stats expose price change");
  assertApprox(stats?.changePct, 0.1759, 0.001, "range stats expose selected close return");
  assertApprox(stats?.high, 13, 0.001, "range stats expose interval high");
  assertEqual(stats?.highLabel, "2026-05-14", "range stats keep high date label");
  assertApprox(stats?.low, 9.8, 0.001, "range stats expose interval low");
  assertEqual(stats?.lowLabel, "2026-05-11", "range stats keep low date label");
  assertApprox(stats?.amplitudePct, 0.2963, 0.001, "range stats expose interval amplitude from start close");
  assertApprox(stats?.maxDrawdownPct, -0.096, 0.001, "range stats expose peak-to-trough drawdown");
  assertApprox(stats?.maxRunupPct, 0.3265, 0.001, "range stats expose trough-to-peak runup");
  assertApprox(stats?.totalVolume, 1100, 0.001, "range stats sum selected volume");
  assertApprox(stats?.totalAmount, 13190, 0.001, "range stats sum selected amount");
  assertApprox(stats?.averageVolume, 275, 0.001, "range stats average selected volume");
}

function testMeasuredRangeStatsKeepSelectionDirection() {
  const stats = buildMeasuredRangeStats(bars, 3, 0);

  assertOk(stats, "reverse range stats exist for selected endpoints");
  assertEqual(stats?.startIndex, 3, "reverse range keeps selected start");
  assertEqual(stats?.endIndex, 0, "reverse range keeps selected end");
  assertApprox(stats?.changePct, -0.1496, 0.001, "reverse range return follows selected direction");
  assertEqual(stats?.barCount, 4, "reverse range uses the same inclusive candle set");
}

function testHandlesMissingBarsExplicitly() {
  const profile = buildVolumeProfile([], { binCount: 8, currentPrice: 12 });

  assertEqual(profile.bins.length, 0, "empty input has no fake bins");
  assertEqual(profile.totalVolume, 0, "empty input has zero volume");
  assertEqual(profile.pointOfControl, null, "empty input has no peak chip area");
  assertEqual(profile.currentBin, null, "empty input has no current bin");
  assertEqual(profile.winningVolumeRatio, null, "empty input has no winning chip ratio");
  assertEqual(profile.costRange70, null, "empty input has no 70 percent cost range");
}

function testBuildsVolumeProfileLevelAnnotations() {
  const profile = buildVolumeProfile(bars, { binCount: 4, currentPrice: 11.8 });
  const annotations = buildVolumeProfileLevelAnnotations(profile);

  assertEqual(annotations.length, 3, "profile levels expose poc support and resistance");
  assertEqual(annotations.map((level) => level.key).join(","), "poc,support,resistance", "profile levels keep stable order");
  assertApprox(annotations[0]?.price, 11.8, 0.001, "poc level uses peak bin midpoint");
  assertApprox(annotations[1]?.price, 11, 0.001, "support level uses strongest below-current bin midpoint");
  assertApprox(annotations[2]?.price, 12.6, 0.001, "resistance level uses strongest above-current bin midpoint");
  assertOk(annotations.every((level) => level.percent > 0), "profile levels carry volume share for labels");
}

function testBuildsFutuStyleAdvancedIndicators() {
  const indicators = buildAdvancedIndicators(bars, { period: 3, emvPeriod: 3 });
  const latest = indicators[indicators.length - 1];

  assertEqual(indicators.length, bars.length, "advanced indicators preserve bar count");
  assertOk(latest, "latest advanced indicator exists");
  assertApprox(latest?.cr, 644.4444, 0.001, "CR follows previous mid-price energy formula");
  assertApprox(latest?.ar, 528.5714, 0.001, "AR follows open/high/low popularity formula");
  assertApprox(latest?.br, 528.5714, 0.001, "BR follows previous close willingness formula");
  assertOk((latest?.emv || 0) > 0, "EMV is positive in an easier upward move");
  assertOk((latest?.emvMa || 0) > 0, "EMVMA is available after enough samples");
}

function testAdvancedIndicatorsNeedEnoughSamples() {
  const indicators = buildAdvancedIndicators(bars.slice(0, 2), { period: 3, emvPeriod: 3 });
  const latest = indicators[indicators.length - 1];

  assertEqual(latest?.cr, null, "CR is missing before period is ready");
  assertEqual(latest?.ar, null, "AR is missing before period is ready");
  assertEqual(latest?.br, null, "BR is missing before period is ready");
  assertEqual(latest?.emvMa, null, "EMVMA is missing before smoothing period is ready");
}

function testBuildsMomentumIndicatorSet() {
  const indicators = buildMomentumIndicators(mixedTrendBars, { period: 3 });
  const latest = indicators[indicators.length - 1];

  assertEqual(indicators.length, mixedTrendBars.length, "momentum indicators preserve bar count");
  assertOk(latest, "latest momentum indicator exists");
  assertApprox(latest?.pdi, 17.7778, 0.001, "DMI +DI follows directional movement over true range");
  assertApprox(latest?.mdi, 8.8889, 0.001, "DMI -DI captures the latest downside range expansion");
  assertApprox(latest?.adx, 77.7778, 0.001, "ADX smooths the recent directional index values");
  assertApprox(latest?.cci, -57.5, 0.001, "CCI compares typical price with its mean deviation");
  assertApprox(latest?.wr, -90, 0.001, "WR locates close near the recent low");
}

function testMomentumIndicatorsNeedEnoughSamples() {
  const indicators = buildMomentumIndicators(mixedTrendBars.slice(0, 2), { period: 3 });
  const latest = indicators[indicators.length - 1];

  assertEqual(latest?.pdi, null, "PDI is missing before DMI period is ready");
  assertEqual(latest?.mdi, null, "MDI is missing before DMI period is ready");
  assertEqual(latest?.adx, null, "ADX is missing before enough DX samples are ready");
  assertEqual(latest?.cci, null, "CCI is missing before period is ready");
  assertEqual(latest?.wr, null, "WR is missing before period is ready");
}

function testCompactIndicatorLayoutKeepsLegacyBands() {
  const layout = buildIndicatorSectionLayout("compact");

  assertEqual(layout.viewBoxHeight, 720, "compact layout preserves legacy chart height");
  assertEqual(layout.sections.length, 4, "compact layout preserves four visible sections");
  assertEqual(layout.advanced.top, layout.oscillator.top, "compact layout overlays advanced indicators in oscillator band");
  assertEqual(layout.momentum.top, layout.oscillator.top, "compact layout overlays momentum indicators in oscillator band");
}

function testSplitIndicatorLayoutCreatesSeparateSubCharts() {
  const layout = buildIndicatorSectionLayout("split");

  assertOk(layout.viewBoxHeight > 720, "split layout increases vertical chart space");
  assertEqual(layout.sections.length, 7, "split layout exposes seven chart sections");
  assertOk(layout.advanced.top > layout.oscillator.bottom, "advanced indicators get their own band");
  assertOk(layout.momentum.top > layout.advanced.bottom, "momentum indicators get their own band");
  assertOk(layout.volatility.top > layout.momentum.bottom, "ATR and OBV get their own band");
  assertOk(layout.signalLaneY > layout.volatility.bottom, "signal lane remains below all sub charts");
}

function testBuildsIndicatorAxisTicks() {
  const ticks = buildIndicatorAxisTicks({
    bottom: 220,
    max: 10,
    min: -10,
    precision: 1,
    top: 100,
  });

  assertEqual(ticks.length, 3, "axis ticks default to high, mid and low");
  assertEqual(ticks[0]?.label, "10", "axis tick trims unnecessary decimals");
  assertApprox(ticks[0]?.y, 100, 0.001, "max tick maps to top");
  assertApprox(ticks[1]?.value, 0, 0.001, "mid tick uses the domain midpoint");
  assertApprox(ticks[1]?.y, 160, 0.001, "mid tick maps to the middle of the band");
  assertApprox(ticks[2]?.y, 220, 0.001, "min tick maps to bottom");
}

function testBuildsCompactIndicatorAxisTickLabels() {
  const ticks = buildIndicatorAxisTicks({
    bottom: 220,
    compact: true,
    max: 2_000_000,
    min: 0,
    top: 100,
  });

  assertEqual(ticks[0]?.label, "2M", "large compact axis values use M suffix");
  assertEqual(ticks[1]?.label, "1M", "mid compact axis values use compact suffix");
}

function testBuildsIndicatorThresholdGuides() {
  const guides = buildIndicatorThresholdGuides([
    {
      key: "rsi-70",
      label: "RSI 70",
      section: "oscillator",
      value: 70,
      min: 0,
      max: 100,
      top: 100,
      bottom: 200,
      tone: "risk",
    },
    {
      key: "cci-100",
      label: "CCI +100",
      section: "momentum",
      value: 100,
      min: -200,
      max: 200,
      top: 300,
      bottom: 420,
      tone: "risk",
    },
    {
      key: "hidden",
      label: "hidden",
      section: "momentum",
      value: 999,
      min: -200,
      max: 200,
      top: 300,
      bottom: 420,
    },
  ]);

  assertEqual(guides.length, 2, "threshold guides omit values outside the visible indicator domain");
  assertApprox(guides[0]?.y, 130, 0.001, "oscillator threshold maps by indicator scale");
  assertApprox(guides[1]?.y, 330, 0.001, "momentum threshold maps by centered indicator scale");
  assertEqual(guides[1]?.labelY, 326, "threshold labels sit above their guide line");
  assertEqual(guides[0]?.tone, "risk", "threshold guide preserves tone for styling");
}

function testBuildsIndicatorThresholdZones() {
  const zones = buildIndicatorThresholdZones([
    {
      key: "rsi-overbought",
      section: "oscillator",
      label: "RSI超买",
      fromValue: 70,
      toValue: 100,
      min: 0,
      max: 100,
      top: 100,
      bottom: 200,
      tone: "risk",
    },
    {
      key: "rsi-oversold",
      section: "oscillator",
      label: "RSI超卖",
      fromValue: 0,
      toValue: 30,
      min: 0,
      max: 100,
      top: 100,
      bottom: 200,
      tone: "good",
    },
    {
      key: "hidden",
      section: "momentum",
      label: "hidden",
      fromValue: 240,
      toValue: 280,
      min: -200,
      max: 200,
      top: 300,
      bottom: 420,
    },
  ]);

  assertEqual(zones.length, 2, "threshold zones omit ranges outside the visible indicator domain");
  assertApprox(zones[0]?.y, 100, 0.001, "overbought zone starts at the top of the section");
  assertApprox(zones[0]?.height, 30, 0.001, "overbought zone height follows the threshold range");
  assertApprox(zones[1]?.y, 170, 0.001, "oversold zone maps to the lower part of the section");
  assertApprox(zones[1]?.height, 30, 0.001, "oversold zone height follows the threshold range");
  assertEqual(zones[1]?.tone, "good", "threshold zone preserves tone for styling");
}

function testBuildsLatestPriceLine() {
  const rising = buildLatestPriceLine({
    price: 112,
    prevClose: 100,
    y: 88,
    top: 60,
    bottom: 180,
  });
  const clipped = buildLatestPriceLine({
    price: 96,
    prevClose: 100,
    y: 42,
    top: 60,
    bottom: 180,
  });
  const missing = buildLatestPriceLine({
    price: null,
    prevClose: 100,
    y: 88,
    top: 60,
    bottom: 180,
  });

  assertOk(rising, "latest price line is built for finite price and y");
  assertEqual(rising?.tone, "good", "latest price line marks rising price as good");
  assertApprox(rising?.changePct, 0.12, 0.0001, "latest price line derives change percent");
  assertEqual(rising?.label, "现价", "latest price line uses a market terminal label");
  assertApprox(rising?.y, 88, 0.001, "latest price line keeps visible y");
  assertApprox(rising?.labelY, 81, 0.001, "latest price line places label above the line");
  assertOk(clipped, "latest price line clips y into the price section");
  assertEqual(clipped?.tone, "risk", "latest price line marks falling price as risk");
  assertApprox(clipped?.y, 60, 0.001, "latest price line clips y to section top");
  assertApprox(clipped?.labelY, 73, 0.001, "latest price label stays inside the section after clipping");
  assertEqual(missing, null, "latest price line omits missing price");
}

function testBuildsIndicatorBandAreaPath() {
  const path = buildIndicatorBandAreaPath([
    { x: 10, upperY: 20, lowerY: 80 },
    { x: 20, upperY: 25, lowerY: 78 },
    { x: 30, upperY: 22, lowerY: 70 },
  ]);

  assertEqual(
    path,
    "M 10.00,20.00 L 20.00,25.00 L 30.00,22.00 L 30.00,70.00 L 20.00,78.00 L 10.00,80.00 Z",
    "indicator band area stitches upper points with reversed lower points",
  );
}

function testBuildsOverlayPriceLabelsWithoutOverlap() {
  const labels = buildOverlayPriceLabels(
    [
      { key: "ma20", label: "MA20", price: 12.3, y: 100, tone: "info", priority: 1 },
      { key: "boll", label: "BOLL", price: 12.1, y: 104, tone: "good", priority: 2 },
      { key: "bad", label: "BAD", price: null, y: 108 },
      { key: "vwap", label: "VWAP", price: 11.9, y: 108, tone: "neutral", priority: 3 },
    ],
    { top: 90, bottom: 140, minGap: 14 },
  );

  assertEqual(labels.length, 3, "overlay price labels omit missing values");
  assertEqual(labels.map((label) => label.key).join(","), "ma20,boll,vwap", "labels keep visual order after staggering");
  assertOk(labels[1]!.labelY - labels[0]!.labelY >= 14, "labels respect min vertical gap");
  assertOk(labels[2]!.labelY - labels[1]!.labelY >= 14, "all labels are staggered");
  assertEqual(labels[0]!.tone, "info", "tone preserved");
}

function testBuildsIndicatorValueLabelsBySection() {
  const labels = buildIndicatorValueLabels(
    [
      { key: "dif", section: "macd", group: "macd", label: "DIF", value: 2.12, y: 116, tone: "good", priority: 1, precision: 2 },
      { key: "dea", section: "macd", group: "macd", label: "DEA", value: 2.02, y: 120, tone: "neutral", priority: 2, precision: 2 },
      { key: "empty", section: "macd", group: "macd", label: "BAD", value: null, y: 122 },
      { key: "rsi", section: "oscillator", group: "rsi", label: "RSI", value: 72.4, y: 214, tone: "risk", priority: 1, precision: 1 },
      { key: "unknown", section: "missing", group: "macd", label: "X", value: 1, y: 118 },
    ],
    {
      sections: {
        macd: { top: 100, bottom: 150 },
        oscillator: { top: 200, bottom: 242 },
      },
      minGap: 14,
    },
  );

  assertEqual(labels.length, 3, "indicator value labels omit missing values and unknown sections");
  assertEqual(labels.map((label) => label.key).join(","), "dif,dea,rsi", "indicator labels keep section and visual order");
  assertOk(labels[1]!.labelY - labels[0]!.labelY >= 14, "labels in the same indicator section avoid overlap");
  assertEqual(labels[2]!.section, "oscillator", "labels keep their target section");
  assertEqual(labels[2]!.precision, 1, "formatting metadata is preserved for rendering");
}

function testBuildsKlineRangeNavigator() {
  const navigator = buildKlineRangeNavigator({
    total: 260,
    visibleCount: 60,
    rightOffset: 20,
    plotLeft: 48,
    plotRight: 928,
  });

  assertOk(navigator, "range navigator exists when a partial window is visible");
  assertEqual(navigator?.startIndex, 180, "navigator maps right offset to the visible start index");
  assertEqual(navigator?.endIndex, 239, "navigator maps right offset to the inclusive visible end index");
  assertApprox(navigator?.selectionX, 657.2308, 0.001, "navigator selection starts at the visible window ratio");
  assertApprox(navigator?.selectionWidth, 203.0769, 0.001, "navigator selection width follows visible ratio");
  assertEqual(navigator?.label, "181-240 / 260", "navigator exposes human-readable one-based range");
}

function testKlineRangeNavigatorHidesForFullRange() {
  const navigator = buildKlineRangeNavigator({
    total: 80,
    visibleCount: 80,
    rightOffset: 0,
    plotLeft: 48,
    plotRight: 928,
  });

  assertEqual(navigator, null, "full visible history does not need a navigator selection");
}

function testMapsKlineNavigatorClickToRightOffset() {
  const nextOffset = rightOffsetFromKlineNavigatorX({
    x: 758.7692,
    total: 260,
    visibleCount: 60,
    plotLeft: 48,
    plotRight: 928,
  });

  assertEqual(nextOffset, 20, "navigator click centers the visible window around the clicked history position");
  assertEqual(rightOffsetFromKlineNavigatorX({ x: 928, total: 260, visibleCount: 60, plotLeft: 48, plotRight: 928 }), 0, "right edge jumps to latest");
  assertEqual(rightOffsetFromKlineNavigatorX({ x: 48, total: 260, visibleCount: 60, plotLeft: 48, plotRight: 928 }), 200, "left edge jumps to earliest");
}

function testBuildsTrendRibbonAreaSegments() {
  const segments = buildTrendRibbonAreaSegments([
    { x: 10, fastY: 30, slowY: 58, fastValue: 12, slowValue: 10 },
    { x: 20, fastY: 32, slowY: 56, fastValue: 13, slowValue: 11 },
    { x: 30, fastY: 60, slowY: 38, fastValue: 9, slowValue: 11 },
    { x: 40, fastY: 62, slowY: 36, fastValue: 8, slowValue: 12 },
  ]);

  assertEqual(segments.length, 2, "trend ribbon splits when fast and slow averages cross");
  assertEqual(segments[0]?.tone, "good", "fast average above slow average marks a bullish ribbon");
  assertEqual(segments[0]?.startIndex, 0, "first segment tracks original start index");
  assertEqual(segments[0]?.endIndex, 1, "first segment tracks original end index");
  assertEqual(segments[1]?.tone, "risk", "fast average below slow average marks a bearish ribbon");
  assertOk(segments[1]?.path.includes("M 30.00,38.00"), "bearish segment uses the visual upper boundary first");
}

function testBuildsIchimokuIndicators() {
  const sourceBars = Array.from({ length: 60 }, (_, index) => ({
    high: 11 + index,
    low: 9 + index,
    close: 10 + index,
  }));
  const indicators = buildIchimokuIndicators(sourceBars);

  assertEqual(indicators.length, sourceBars.length, "Ichimoku values preserve source bar count");
  assertApprox(indicators[8]?.conversion, 14, 0.001, "conversion line uses the 9-period high-low midpoint");
  assertEqual(indicators[24]?.base, null, "base line waits for 26 bars");
  assertApprox(indicators[25]?.base, 22.5, 0.001, "base line uses the 26-period high-low midpoint");
  assertApprox(indicators[51]?.spanB, 35.5, 0.001, "span B uses the 52-period high-low midpoint");
  assertApprox(indicators[51]?.spanA, 52.75, 0.001, "span A averages conversion and base lines");
  assertApprox(indicators[20]?.lagging, 56, 0.001, "lagging line exposes the close displaced backward by 26 bars");
}

function testBuildsSplitIndicatorPanelReadouts() {
  const readouts = buildIndicatorPanelReadouts({
    close: 13.5,
    ma20: 12.3,
    bollMid: 12.8,
    volume: 650,
    volumeRatio: 1.4,
    volumeMa5: 620,
    volumeMa10: 580,
    volumeMa20: 520,
    dif: 0.32,
    dea: 0.18,
    macd: 0.28,
    rsi14: 62.4,
    psy: 66.7,
    psyMa: 60.2,
    kdjJ: 78.2,
    cr: 145,
    br: 136,
    emv: 0.0042,
    mfi: 58.6,
    vr: 112.4,
    pdi: 24.5,
    mdi: 16.2,
    adx: 31.8,
    cci: 84.3,
    wr: -21.4,
    bias: 3.6,
    dma: 0.24,
    trix: 0.42,
    osc: -15.4,
    oscEma: -8.2,
    atr: 1.52,
    obv: 1280000,
    bollPercentB: 72.4,
    bollBandwidth: 18.6,
  }, { mode: "split" });

  assertEqual(readouts.length, 7, "split readouts cover every visible chart section");
  assertEqual(readouts.find((group) => group.key === "price")?.items.map((item) => item.label).join(","), "C,MA20,BOLL", "price readout keeps core price overlays");
  assertEqual(readouts.find((group) => group.key === "volume")?.items.map((item) => item.label).join(","), "VOL,量比,VMA5,VMA10,VMA20", "volume readout keeps Futu-style moving-average volume values");
  assertEqual(readouts.find((group) => group.key === "oscillator")?.items.map((item) => item.label).join(","), "RSI,PSY,PSYMA,J", "oscillator readout includes PSY/PSYMA with RSI and KDJ values");
  assertEqual(readouts.find((group) => group.key === "advanced")?.items.map((item) => item.label).join(","), "CR,BR,EMV,MFI,VR", "advanced readout keeps energy and money-flow values");
  assertEqual(readouts.find((group) => group.key === "momentum")?.items.map((item) => item.label).join(","), "+DI,-DI,ADX,CCI,WR,BIAS,DMA,TRIX,OSC,OSCEMA", "momentum readout keeps directional and momentum values");
  assertEqual(readouts.find((group) => group.key === "volatility")?.items.map((item) => item.label).join(","), "ATR,OBV,%B,BBW", "volatility readout keeps range, cumulative volume, and BOLL-derived values");
}

function testCompactIndicatorPanelReadoutsFoldExtraIndicators() {
  const readouts = buildIndicatorPanelReadouts({
    rsi14: 54.2,
    psy: 58.3,
    psyMa: 51.6,
    kdjJ: 61.8,
    cr: 118,
    pdi: 23.4,
    bias: -1.6,
    trix: 0.18,
    osc: 12.5,
  }, { mode: "compact" });
  const oscillator = readouts.find((group) => group.key === "oscillator");

  assertEqual(readouts.some((group) => group.key === "advanced"), false, "compact readouts do not point to hidden advanced panel");
  assertEqual(readouts.some((group) => group.key === "momentum"), false, "compact readouts do not point to hidden momentum panel");
  assertEqual(oscillator?.items.map((item) => item.label).join(","), "RSI,PSY,PSYMA,J,CR,+DI,BIAS,TRIX,OSC", "compact oscillator folds extra indicator readings");
}

function testSelectsCursorIndicatorReadoutSnapshot() {
  const latest = { close: 20, macd: 0.3 };
  const cursor = { close: 18, macd: -0.2 };

  assertEqual(selectIndicatorReadoutSnapshot(latest, cursor), cursor, "cursor snapshot drives indicator readouts while hovering");
  assertEqual(selectIndicatorReadoutSnapshot(latest, null), latest, "latest snapshot remains the fallback when there is no cursor");
  assertEqual(selectIndicatorReadoutSnapshot(null, null), null, "missing snapshots stay explicit");
}

function testBuildsTrendOverlayIndicators() {
  const indicators = buildTrendOverlayIndicators(trendOverlayBars, {
    bbiPeriods: [2, 3, 4, 5],
    biasPeriod: 3,
    dmaFast: 2,
    dmaSlow: 5,
    dmaSignal: 3,
  });
  const latest = indicators[indicators.length - 1];

  assertEqual(indicators.length, trendOverlayBars.length, "trend overlays preserve bar count");
  assertOk(latest, "latest trend overlay exists");
  assertApprox(latest?.sar, 13.8, 0.001, "SAR flips to prior extreme after downside reversal");
  assertApprox(latest?.bbi, 12.07375, 0.001, "BBI averages the configured moving averages");
  assertApprox(latest?.bias, -9.0164, 0.001, "BIAS reports close distance from the moving average");
  assertApprox(latest?.dma, -0.77, 0.001, "DMA reports short MA minus long MA");
  assertApprox(latest?.ama, 0.0667, 0.001, "AMA smooths DMA over the signal period");
}

function testBuildsEnvelopeIndicators() {
  const indicators = buildEnvelopeIndicators(trendOverlayBars, {
    period: 3,
    percent: 6,
  });
  const latest = indicators[indicators.length - 1];

  assertEqual(indicators.length, trendOverlayBars.length, "ENE overlays preserve bar count");
  assertOk(latest, "latest ENE overlay exists");
  assertApprox(latest?.mid, 12.2, 0.001, "ENE middle line uses the configured moving average");
  assertApprox(latest?.upper, 12.932, 0.001, "ENE upper line applies the configured envelope percent");
  assertApprox(latest?.lower, 11.468, 0.001, "ENE lower line applies the configured envelope percent");
}

function testEnvelopeIndicatorsNeedEnoughSamples() {
  const indicators = buildEnvelopeIndicators(trendOverlayBars.slice(0, 2), {
    period: 3,
    percent: 6,
  });
  const latest = indicators[indicators.length - 1];

  assertEqual(latest?.mid, null, "ENE mid is missing before enough moving average samples");
  assertEqual(latest?.upper, null, "ENE upper is missing before enough moving average samples");
  assertEqual(latest?.lower, null, "ENE lower is missing before enough moving average samples");
}

function testBuildsMikeIndicators() {
  const indicators = buildMikeIndicators(bars, { period: 3 });
  const latest = indicators[indicators.length - 1];

  assertEqual(indicators.length, bars.length, "MIKE overlay preserves bar count");
  assertEqual(indicators[1]?.weakResistance, null, "MIKE waits for the configured lookback window");
  assertOk(latest, "latest MIKE indicator exists");
  assertApprox(latest?.weakResistance, 14.0667, 0.001, "MIKE WR uses typical price over the recent low");
  assertApprox(latest?.mediumResistance, 14.7333, 0.001, "MIKE MR uses the recent high-low range");
  assertApprox(latest?.strongResistance, 15.4, 0.001, "MIKE SR projects the full upper range");
  assertApprox(latest?.weakSupport, 11.6667, 0.001, "MIKE WS mirrors typical price below the recent high");
  assertApprox(latest?.mediumSupport, 9.9333, 0.001, "MIKE MS subtracts the recent high-low range");
  assertApprox(latest?.strongSupport, 8.2, 0.001, "MIKE SS projects the full lower range");
}

function testBuildsPsychologicalLineIndicators() {
  const indicators = buildPsychologicalLineIndicators(trendOverlayBars, {
    maPeriod: 3,
    period: 3,
  });
  const latest = indicators[indicators.length - 1];

  assertEqual(indicators.length, trendOverlayBars.length, "PSY indicators preserve bar count");
  assertOk(latest, "latest PSY indicator exists");
  assertApprox(indicators[3]?.psy, 66.6667, 0.001, "PSY counts rising closes over the configured window");
  assertApprox(latest?.psy, 33.3333, 0.001, "PSY updates with the latest rising-close ratio");
  assertApprox(indicators[5]?.psyMa, 55.5556, 0.001, "PSYMA averages configured PSY samples");
  assertApprox(latest?.psyMa, 44.4444, 0.001, "PSYMA follows the latest psychological line average");
}

function testPsychologicalLineIndicatorsNeedEnoughSamples() {
  const indicators = buildPsychologicalLineIndicators(trendOverlayBars.slice(0, 5), {
    maPeriod: 3,
    period: 3,
  });
  const latest = indicators[indicators.length - 1];

  assertOk(typeof latest?.psy === "number", "PSY is available once enough close-to-close comparisons exist");
  assertEqual(latest?.psyMa, null, "PSYMA is missing before enough PSY samples exist");
}

function testBuildsOscillatorIndicators() {
  const indicators = buildOscillatorIndicators(trendOverlayBars, {
    emaPeriod: 3,
    period: 3,
  });
  const latest = indicators[indicators.length - 1];

  assertEqual(indicators.length, trendOverlayBars.length, "OSC indicators preserve bar count");
  assertOk(latest, "latest OSC indicator exists");
  assertApprox(indicators[3]?.osc, 80, 0.001, "OSC compares close with the configured moving average");
  assertApprox(latest?.osc, -110, 0.001, "OSC captures the latest close-to-average distance");
  assertApprox(latest?.oscEma, -57.7083, 0.001, "OSCEMA smooths the OSC line");
}

function testOscillatorIndicatorsNeedEnoughSamples() {
  const indicators = buildOscillatorIndicators(trendOverlayBars.slice(0, 2), {
    emaPeriod: 3,
    period: 3,
  });
  const latest = indicators[indicators.length - 1];

  assertEqual(latest?.osc, null, "OSC is missing before enough moving average samples");
  assertEqual(latest?.oscEma, null, "OSCEMA is missing before OSC starts");
}

function testTrendOverlayIndicatorsNeedEnoughSamples() {
  const indicators = buildTrendOverlayIndicators(trendOverlayBars.slice(0, 2), {
    bbiPeriods: [2, 3, 4, 5],
    biasPeriod: 3,
    dmaFast: 2,
    dmaSlow: 5,
    dmaSignal: 3,
  });
  const latest = indicators[indicators.length - 1];

  assertOk(typeof latest?.sar === "number", "SAR is available from the first bars");
  assertEqual(latest?.bbi, null, "BBI is missing before all moving averages are ready");
  assertEqual(latest?.bias, null, "BIAS is missing before moving average is ready");
  assertEqual(latest?.dma, null, "DMA is missing before long moving average is ready");
  assertEqual(latest?.ama, null, "AMA is missing before enough DMA samples are ready");
}

function testBuildsVolumeMomentumIndicators() {
  const indicators = buildVolumeMomentumIndicators(trendOverlayBars, {
    period: 3,
    rocPeriod: 3,
    trixPeriod: 3,
    trixSignal: 3,
  });
  const latest = indicators[indicators.length - 1];

  assertEqual(indicators.length, trendOverlayBars.length, "volume momentum indicators preserve bar count");
  assertOk(latest, "latest volume momentum indicator exists");
  assertApprox(latest?.vr, 44.5205, 0.001, "VR compares rising volume against falling volume");
  assertApprox(latest?.mfi, 32.9492, 0.001, "MFI compares positive and negative money flow");
  assertApprox(latest?.roc, -9.7561, 0.001, "ROC reports close distance from the lookback close");
  assertApprox(latest?.trix, -0.4237, 0.001, "TRIX reports triple-smoothed EMA momentum");
  assertApprox(latest?.trma, 1.5352, 0.001, "TRMA smooths recent TRIX values");
}

function testVolumeMomentumIndicatorsNeedEnoughSamples() {
  const indicators = buildVolumeMomentumIndicators(trendOverlayBars.slice(0, 2), {
    period: 3,
    rocPeriod: 3,
    trixPeriod: 3,
    trixSignal: 3,
  });
  const latest = indicators[indicators.length - 1];

  assertEqual(latest?.vr, null, "VR is missing before enough directional volume samples");
  assertEqual(latest?.mfi, null, "MFI is missing before enough money flow samples");
  assertEqual(latest?.roc, null, "ROC is missing before enough lookback bars");
  assertOk(typeof latest?.trix === "number", "TRIX starts once triple EMA has a previous value");
  assertEqual(latest?.trma, null, "TRMA is missing before enough TRIX samples");
}

function testBuildsVolatilityVolumeIndicators() {
  const indicators = buildVolatilityVolumeIndicators(trendOverlayBars, {
    atrPeriod: 3,
    bollMultiplier: 2,
    bollPeriod: 3,
  });
  const latest = indicators[indicators.length - 1];

  assertEqual(indicators.length, trendOverlayBars.length, "volatility volume indicators preserve bar count");
  assertOk(latest, "latest volatility volume indicator exists");
  assertEqual(indicators[0]?.obv, 0, "OBV starts from a neutral baseline");
  assertApprox(indicators[2]?.atr, 1.3, 0.001, "ATR averages true range once the period is ready");
  assertApprox(latest?.atr, 1.6667, 0.001, "ATR captures the latest volatility range");
  assertApprox(latest?.obv, -660, 0.001, "OBV accumulates signed volume by close direction");
  assertApprox(latest?.bollPercentB, 22.2208, 0.001, "volatility indicators expose BOLL percent-b position");
  assertApprox(latest?.bollBandwidth, 32.4574, 0.001, "volatility indicators expose BOLL bandwidth percent");
}

function testVolatilityVolumeIndicatorsNeedEnoughSamples() {
  const indicators = buildVolatilityVolumeIndicators(trendOverlayBars.slice(0, 2), {
    atrPeriod: 3,
    bollPeriod: 3,
  });
  const latest = indicators[indicators.length - 1];

  assertEqual(latest?.atr, null, "ATR is missing before its period is ready");
  assertApprox(latest?.obv, 300, 0.001, "OBV is available from the first close direction");
  assertEqual(latest?.bollPercentB, null, "BOLL percent-b is missing before enough close samples");
  assertEqual(latest?.bollBandwidth, null, "BOLL bandwidth is missing before enough close samples");
}

function testBuildsVisiblePriceExtrema() {
  const extrema = buildVisiblePriceExtrema(trendOverlayBars);

  assertOk(extrema, "visible extrema exists for usable bars");
  assertApprox(extrema?.high, 13.8, 0.001, "highest price is captured");
  assertEqual(extrema?.highDate, "2026-05-18", "highest price keeps its date");
  assertEqual(extrema?.highIndex, 5, "highest price keeps its visible index");
  assertApprox(extrema?.low, 9.8, 0.001, "lowest price is captured");
  assertEqual(extrema?.lowDate, "2026-05-11", "lowest price keeps its date");
  assertEqual(extrema?.lowIndex, 0, "lowest price keeps its visible index");
  assertApprox(extrema?.rangePct, 40.8163, 0.001, "rangePct reports high-low spread from the low");
}

function testVisiblePriceExtremaNeedUsableBars() {
  const extrema = buildVisiblePriceExtrema([]);

  assertEqual(extrema, null, "empty input has no fake visible extrema");
}

function testBuildsFibonacciRetracementLevels() {
  const extrema = buildVisiblePriceExtrema(trendOverlayBars);
  const levels = buildFibonacciRetracementLevels(extrema);

  assertEqual(levels.length, 7, "fibonacci retracement exposes standard levels");
  assertEqual(levels.map((level) => level.label).join(","), "0%,23.6%,38.2%,50%,61.8%,78.6%,100%", "fibonacci labels keep standard ratios");
  assertApprox(levels[0]?.price, 13.8, 0.001, "0% level starts at visible high");
  assertApprox(levels[1]?.price, 12.856, 0.001, "23.6% level retraces from visible high");
  assertApprox(levels[2]?.price, 12.272, 0.001, "38.2% level retraces from visible high");
  assertApprox(levels[3]?.price, 11.8, 0.001, "50% level retraces half the visible range");
  assertApprox(levels[4]?.price, 11.328, 0.001, "61.8% level retraces from visible high");
  assertApprox(levels[5]?.price, 10.656, 0.001, "78.6% level retraces from visible high");
  assertApprox(levels[6]?.price, 9.8, 0.001, "100% level ends at visible low");
}

function testFibonacciRetracementNeedsExtrema() {
  const levels = buildFibonacciRetracementLevels(null);

  assertEqual(levels.length, 0, "missing extrema has no fibonacci levels");
}

function testBuildsSupportResistanceLevelsFromSwingPivots() {
  const levels = buildSupportResistanceLevels(structureBars, {
    currentPrice: 11.5,
    maxPerSide: 2,
    minDistancePct: 2,
    swingWindow: 1,
  });
  const support = levels.find((level) => level.type === "support");
  const resistance = levels.find((level) => level.type === "resistance");

  assertEqual(levels.length, 2, "swing pivots produce nearest support and resistance");
  assertOk(support, "support level exists");
  assertOk(resistance, "resistance level exists");
  assertApprox(support?.price, 9.5, 0.001, "nearby swing lows are clustered into one support level");
  assertEqual(support?.touches, 2, "support reports repeated touches");
  assertEqual(support?.lastLabel, "2026-05-10", "support keeps latest touch label");
  assertApprox(support?.distancePct, -17.3913, 0.001, "support distance is measured from current price");
  assertApprox(resistance?.price, 12.15, 0.001, "nearby swing highs are clustered into one resistance level");
  assertEqual(resistance?.touches, 2, "resistance reports repeated touches");
  assertEqual(resistance?.lastLabel, "2026-05-08", "resistance keeps latest touch label");
  assertApprox(resistance?.distancePct, 5.6522, 0.001, "resistance distance is measured from current price");
}

function testSupportResistanceNeedsUsableBars() {
  const levels = buildSupportResistanceLevels([], { currentPrice: 10 });

  assertEqual(levels.length, 0, "empty input has no automatic support or resistance");
}

function testBuildsCandlestickPatternAnnotations() {
  const patterns = buildCandlestickPatternAnnotations(patternBars);

  assertEqual(patterns.length, 4, "classic candlestick patterns are detected");
  assertEqual(
    patterns.map((pattern) => pattern.type).join(","),
    "doji,bullish-engulfing,bearish-engulfing,hammer",
    "patterns keep chronological order",
  );
  assertEqual(patterns.map((pattern) => pattern.label).join(","), "十字星,看涨吞没,看跌吞没,锤头线", "patterns expose Chinese chart labels");
  assertEqual(patterns.map((pattern) => pattern.index).join(","), "1,3,5,6", "patterns anchor to the signal candle");
  assertEqual(patterns.find((pattern) => pattern.type === "bullish-engulfing")?.tone, "good", "bullish engulfing is marked constructive");
  assertEqual(patterns.find((pattern) => pattern.type === "bearish-engulfing")?.tone, "risk", "bearish engulfing is marked risky");
  assertApprox(patterns.find((pattern) => pattern.type === "hammer")?.price, 9.4, 0.001, "hammer anchors to the lower shadow");
}

function testCandlestickPatternsNeedUsableBars() {
  const patterns = buildCandlestickPatternAnnotations([]);

  assertEqual(patterns.length, 0, "empty input has no candlestick patterns");
}

function testBuildsTdsSequentialSellSetup() {
  const annotations = buildTdsSequentialAnnotations(risingTdsBars);

  assertEqual(annotations.length, 9, "completed rising TDS setup exposes nine sell-count labels");
  assertEqual(annotations.map((item) => item.count).join(","), "1,2,3,4,5,6,7,8,9", "sell setup labels count upward");
  assertEqual(
    annotations.map((item) => item.direction).join(","),
    "sell,sell,sell,sell,sell,sell,sell,sell,sell",
    "rising setup is a sell-side TDS sequence",
  );
  assertEqual(annotations[0]?.index, 4, "sell setup starts at the first close above four bars ago");
  assertEqual(annotations[8]?.index, 12, "sell setup ends at the ninth qualifying bar");
  assertEqual(annotations[8]?.tone, "risk", "sell-side TDS 9 is marked as risk");
  assertApprox(annotations[8]?.price, 19.5, 0.001, "sell-side label anchors above the high");
}

function testBuildsTdsSequentialBuySetup() {
  const annotations = buildTdsSequentialAnnotations(fallingTdsBars);

  assertEqual(annotations.length, 9, "completed falling TDS setup exposes nine buy-count labels");
  assertEqual(annotations.map((item) => item.count).join(","), "1,2,3,4,5,6,7,8,9", "buy setup labels count upward");
  assertEqual(
    annotations.map((item) => item.direction).join(","),
    "buy,buy,buy,buy,buy,buy,buy,buy,buy",
    "falling setup is a buy-side TDS sequence",
  );
  assertEqual(annotations[8]?.tone, "good", "buy-side TDS 9 is marked constructive");
  assertApprox(annotations[8]?.price, 10.5, 0.001, "buy-side label anchors below the low");
}

function testBuildsTrailingPartialTdsSequentialSetup() {
  const annotations = buildTdsSequentialAnnotations(partialTdsBars);

  assertEqual(annotations.length, 6, "active TDS setup displays from count six onward");
  assertEqual(annotations.map((item) => item.count).join(","), "1,2,3,4,5,6", "active setup backfills visible counts");
  assertEqual(annotations[5]?.index, 9, "active setup ends at the latest qualifying bar");
}

function testTdsSequentialDropsFailedPartialSetup() {
  const annotations = buildTdsSequentialAnnotations(failedPartialTdsBars);

  assertEqual(annotations.length, 0, "failed partial TDS setup is hidden after the streak breaks");
}

function testBuildsTechnicalIndicatorAnnotations() {
  const events = buildTechnicalIndicatorAnnotations(technicalSignalBars);

  assertEqual(events.length, 6, "technical indicator events detect key crosses and breakouts");
  assertEqual(
    events.map((event) => event.type).join(","),
    "ma-golden-cross,macd-golden-cross,boll-breakout-up,ma-death-cross,macd-death-cross,boll-breakout-down",
    "technical indicator events keep chronological order",
  );
  assertEqual(events.map((event) => event.label).join(","), "MA金叉,MACD金叉,上破BOLL,MA死叉,MACD死叉,下破BOLL", "events expose compact Chinese chart labels");
  assertEqual(events.map((event) => event.index).join(","), "1,2,3,5,5,6", "events anchor to the signal candle");
  assertEqual(events.filter((event) => event.tone === "good").length, 3, "constructive events are marked good");
  assertEqual(events.filter((event) => event.tone === "risk").length, 3, "risk events are marked risk");
  assertApprox(events.find((event) => event.type === "boll-breakout-down")?.price, 10.9, 0.001, "downside events anchor above the candle");
}

function testBuildsMomentumTechnicalIndicatorAnnotations() {
  const events = buildTechnicalIndicatorAnnotations(technicalMomentumSignalBars);

  assertEqual(events.length, 11, "momentum technical indicator events detect oscillator and DMI signals");
  assertEqual(
    events.map((event) => event.type).join(","),
    [
      "rsi-oversold-rebound",
      "kdj-golden-cross",
      "dmi-golden-cross",
      "cci-oversold-rebound",
      "wr-oversold-rebound",
      "rsi-overbought",
      "cci-breakout-up",
      "wr-overbought",
      "kdj-death-cross",
      "dmi-death-cross",
      "cci-breakout-down",
    ].join(","),
    "momentum events keep chronological order",
  );
  assertEqual(
    events.map((event) => event.label).join(","),
    "RSI修复,KDJ金叉,DMI转强,CCI修复,WR修复,RSI超买,CCI强势,WR超买,KDJ死叉,DMI转弱,CCI弱势",
    "momentum events expose compact Chinese labels",
  );
  assertEqual(events.filter((event) => event.tone === "good").length, 6, "constructive oscillator events are marked good");
  assertEqual(events.filter((event) => event.tone === "risk").length, 5, "risk oscillator events are marked risk");
  assertApprox(events.find((event) => event.type === "rsi-overbought")?.price, 12, 0.001, "risk oscillator events anchor above the candle");
  assertApprox(events.find((event) => event.type === "rsi-oversold-rebound")?.price, 9.9, 0.001, "constructive oscillator events anchor below the candle");
}

function testTechnicalIndicatorAnnotationsNeedComparableValues() {
  const events = buildTechnicalIndicatorAnnotations([
    { date: "2026-05-01", open: 10, high: 10.2, low: 9.8, close: 10 },
    { date: "2026-05-02", open: 10, high: 10.3, low: 9.9, close: 10.2 },
  ]);

  assertEqual(events.length, 0, "missing indicator values have no technical indicator events");
}

function testBuildsTechnicalDivergenceAnnotations() {
  const events = buildTechnicalDivergenceAnnotations(divergenceBars, {
    swingWindow: 1,
    minPriceMovePct: 0,
    minIndicatorMove: 0,
  });

  assertEqual(events.length, 4, "RSI and MACD divergences detect paired price/indicator pivots");
  assertEqual(
    events.map((event) => event.type).join(","),
    "rsi-bullish-divergence,macd-bullish-divergence,rsi-bearish-divergence,macd-bearish-divergence",
    "divergences keep chronological and indicator order",
  );
  assertEqual(events.map((event) => event.label).join(","), "RSI底背离,MACD底背离,RSI顶背离,MACD顶背离", "divergences expose compact Chinese labels");
  assertEqual(events.map((event) => event.tone).join(","), "good,good,risk,risk", "bullish and bearish divergences carry chart tone");
  assertEqual(events.map((event) => `${event.startIndex}-${event.index}`).join(","), "1-3,1-3,5-8,5-8", "divergences connect comparable pivots");
  assertApprox(events[0]?.startPrice, 9, 0.001, "bullish divergence starts at the previous low");
  assertApprox(events[0]?.price, 8.6, 0.001, "bullish divergence anchors at the lower low");
  assertApprox(events[0]?.startIndicator, 34, 0.001, "bullish divergence keeps previous RSI value");
  assertApprox(events[0]?.endIndicator, 43, 0.001, "bullish divergence keeps improved RSI value");
  assertApprox(events[2]?.price, 12.8, 0.001, "bearish divergence anchors at the higher high");
  assertApprox(events[3]?.endIndicator, 0.3, 0.001, "MACD bearish divergence keeps weaker momentum value");
}

function testTechnicalDivergenceAnnotationsNeedComparableIndicators() {
  const events = buildTechnicalDivergenceAnnotations(structureBars, { swingWindow: 1 });

  assertEqual(events.length, 0, "missing oscillator values have no divergence annotations");
}

function testBuildsVolumeSignalAnnotations() {
  const events = buildVolumeSignalAnnotations(volumeSignalBars, {
    period: 3,
    surgeRatio: 1.8,
    dryUpRatio: 0.35,
    minMovePct: 1,
    quietMovePct: 0.8,
  });

  assertEqual(events.length, 3, "volume price events detect surge and dry-up conditions");
  assertEqual(events.map((event) => event.type).join(","), "volume-surge-up,volume-surge-down,volume-dry-up", "volume events keep chronological order");
  assertEqual(events.map((event) => event.label).join(","), "放量上涨,放量下跌,缩量整理", "volume events expose compact Chinese labels");
  assertEqual(events.map((event) => event.index).join(","), "3,5,6", "volume events anchor to the signal candle");
  assertEqual(events.map((event) => event.tone).join(","), "good,risk,neutral", "volume events carry chart tone");
  assertApprox(events[0]?.volumeRatio, 2.4, 0.001, "surge up compares with previous volume average");
  assertApprox(events[2]?.volumeRatio, 0.1791, 0.001, "dry-up compares with previous volume average");
  assertApprox(events[1]?.price, 10.6, 0.001, "downside volume event anchors above the candle");
}

function testVolumeSignalAnnotationsNeedEnoughVolumeHistory() {
  const events = buildVolumeSignalAnnotations(volumeSignalBars.slice(0, 3), { period: 3 });

  assertEqual(events.length, 0, "volume events wait for enough previous samples");
}

function testBuildsTrendRegimeBands() {
  const bands = buildTrendRegimeBands(trendRegimeBars);

  assertEqual(bands.length, 3, "trend regimes merge contiguous market stages");
  assertEqual(bands.map((band) => band.type).join(","), "bullish,neutral,bearish", "trend regimes keep chronological order");
  assertEqual(bands.map((band) => band.label).join(","), "多头排列,震荡过渡,空头排列", "trend regimes expose Chinese labels");
  assertEqual(bands.map((band) => `${band.startIndex}-${band.endIndex}`).join(","), "0-1,2-3,4-6", "trend regimes keep original visible indexes");
  assertEqual(bands.map((band) => band.tone).join(","), "good,neutral,risk", "trend regimes carry chart tone");
  assertEqual(bands[0]?.startLabel, "2026-05-01", "trend regime keeps start label");
  assertEqual(bands[2]?.endLabel, "2026-05-07", "trend regime keeps end label");
}

function testTrendRegimeBandsNeedComparableAverages() {
  const bands = buildTrendRegimeBands([
    { date: "2026-05-01", close: 10 },
    { date: "2026-05-02", close: 10.2 },
  ]);

  assertEqual(bands.length, 0, "missing moving averages have no trend regime bands");
}

function testBuildsPriceStructureTrendLines() {
  const lines = buildPriceStructureTrendLines(priceStructureTrendBars, { swingWindow: 1, minSlopePct: 0 });

  assertEqual(lines.length, 2, "trend lines expose latest support and resistance structure");
  assertEqual(lines.map((line) => line.type).join(","), "ascending-support,descending-resistance", "trend lines keep stable display order");

  const support = lines[0];
  assertEqual(support?.label, "上升趋势线", "ascending lows become a support trend line");
  assertEqual(`${support?.anchorStartIndex}-${support?.anchorEndIndex}`, "5-9", "support trend line uses latest rising swing lows");
  assertEqual(`${support?.startIndex}-${support?.endIndex}`, "5-11", "support trend line extends to latest visible bar");
  assertApprox(support?.startPrice, 9.4, 0.001, "support trend line starts at the first low pivot");
  assertApprox(support?.endPrice, 9.7, 0.001, "support trend line projects to latest bar");
  assertEqual(support?.tone, "good", "ascending support is a constructive structure");

  const resistance = lines[1];
  assertEqual(resistance?.label, "下降压力线", "descending highs become a resistance trend line");
  assertEqual(`${resistance?.anchorStartIndex}-${resistance?.anchorEndIndex}`, "2-7", "resistance trend line uses latest falling swing highs");
  assertApprox(resistance?.startPrice, 12.2, 0.001, "resistance trend line starts at the first high pivot");
  assertApprox(resistance?.endPrice, 12.02, 0.001, "resistance trend line projects to latest bar");
  assertEqual(resistance?.tone, "risk", "descending resistance is a pressure structure");
}

function testPriceStructureTrendLinesNeedTwoPivots() {
  const lines = buildPriceStructureTrendLines(bars, { swingWindow: 2 });

  assertEqual(lines.length, 0, "trend lines wait for at least two comparable pivots");
}

function testBuildsPriceGapAnnotations() {
  const gaps = buildPriceGapAnnotations(gapBars, { minGapPct: 1 });

  assertEqual(gaps.length, 2, "strict gaps are detected across adjacent bars");
  assertEqual(gaps[0]?.direction, "up", "first gap is an upward gap");
  assertEqual(gaps[0]?.startIndex, 0, "up gap anchors to previous bar");
  assertEqual(gaps[0]?.endIndex, 1, "up gap anchors to current bar");
  assertApprox(gaps[0]?.lowPrice, 10.5, 0.001, "up gap lower bound uses previous high");
  assertApprox(gaps[0]?.highPrice, 11.2, 0.001, "up gap upper bound uses current low");
  assertApprox(gaps[0]?.gapPct, 6.8627, 0.001, "up gap percent uses previous close");
  assertEqual(gaps[1]?.direction, "down", "second gap is a downward gap");
  assertApprox(gaps[1]?.lowPrice, 10.4, 0.001, "down gap lower bound uses current high");
  assertApprox(gaps[1]?.highPrice, 11, 0.001, "down gap upper bound uses previous low");
}

function testPriceGapAnnotationsRespectThreshold() {
  const gaps = buildPriceGapAnnotations(gapBars, { minGapPct: 7 });

  assertEqual(gaps.length, 0, "threshold filters smaller gaps");
}

function testBuildsKlineEventSummary() {
  const technicalEvents = buildTechnicalIndicatorAnnotations(technicalSignalBars);
  const divergenceEvents = buildTechnicalDivergenceAnnotations(divergenceBars, {
    swingWindow: 1,
    minPriceMovePct: 0,
    minIndicatorMove: 0,
  });
  const volumeEvents = buildVolumeSignalAnnotations(volumeSignalBars, {
    period: 3,
    surgeRatio: 1.8,
    dryUpRatio: 0.35,
    minMovePct: 1,
    quietMovePct: 0.8,
  });
  const patterns = buildCandlestickPatternAnnotations(patternBars);
  const tdsEvents = buildTdsSequentialAnnotations(risingTdsBars);
  const gaps = buildPriceGapAnnotations(gapBars, { minGapPct: 1 });
  const trendBands = buildTrendRegimeBands(trendRegimeBars);
  const summary = buildKlineEventSummary({
    technicalEvents,
    divergenceEvents,
    volumeEvents,
    patterns,
    tdsEvents,
    gaps,
    trendBands,
  });

  assertEqual(summary.length, 7, "event summary keeps one compact item per signal family");
  assertEqual(summary.map((item) => item.key).join(","), "technical,divergence,volume,pattern,tds9,gap,trend", "event summary uses stable display order");
  assertEqual(summary[0]?.value, "6个", "technical item reports total event count");
  assertEqual(summary[0]?.detail, "最近 2026-05-07 下破BOLL", "technical item highlights the latest event");
  assertEqual(summary[1]?.tone, "risk", "latest bearish divergence keeps risk tone");
  assertEqual(summary[2]?.detail, "最近 2026-05-07 缩量整理", "volume item highlights latest volume event");
  assertEqual(summary[4]?.label, "TDS9序列", "TDS9 item exposes the sequential signal family");
  assertEqual(summary[4]?.value, "上涨9", "TDS9 item reports the latest sequence direction and count");
  assertEqual(summary[4]?.detail, "最近 2026-06-13 上涨序列 9", "TDS9 item highlights the latest sequence number");
  assertEqual(summary[4]?.tone, "risk", "rising TDS9 sequence is marked as risk in the radar");
  assertEqual(summary[6]?.value, "空头排列", "trend item reports latest regime label");
}

function testBuildsKlineEventDensity() {
  const density = buildKlineEventDensity({
    visibleCount: 6,
    plotLeft: 100,
    plotRight: 600,
    baselineY: 720,
    maxHeight: 24,
    technicalEvents: [
      { key: "tech-1", type: "ma-golden-cross", label: "MA金叉", tone: "good", index: 1, date: "2026-05-02", dateLabel: "05-02", price: 10.8 },
      { key: "tech-2", type: "macd-death-cross", label: "MACD死叉", tone: "risk", index: 2, date: "2026-05-03", dateLabel: "05-03", price: 11.2 },
    ],
    volumeEvents: [
      { key: "vol-2", type: "volume-surge-up", label: "放量上攻", tone: "good", index: 2, date: "2026-05-03", dateLabel: "05-03", price: 11, volume: 300, averageVolume: 120, volumeRatio: 2.5, changePct: 2.2 },
    ],
    patterns: [
      { key: "pattern-2", type: "doji", label: "十字星", tone: "neutral", index: 2, date: "2026-05-03", dateLabel: "05-03", price: 11 },
    ],
    tdsEvents: [
      { key: "tds-2", direction: "sell", tone: "risk", count: 7, index: 2, date: "2026-05-03", dateLabel: "05-03", price: 11.4 },
    ],
    gaps: [
      { key: "gap-4", direction: "down", startIndex: 3, endIndex: 4, startDate: "2026-05-04", endDate: "2026-05-05", startLabel: "05-04", endLabel: "05-05", lowPrice: 9.7, highPrice: 10.2, gapPct: 3.4 },
    ],
  });

  assertEqual(density.length, 3, "event density groups events by candle index");
  assertEqual(density.map((bar) => `${bar.index}:${bar.count}:${bar.tone}`).join(","), "1:1:good,2:4:mixed,4:1:risk", "event density exposes counts and mixed tone");
  assertApprox(density[0]?.x, 200, 0.001, "event density maps index to chart x");
  assertEqual((density[1]?.height || 0) > (density[0]?.height || 0), true, "larger event clusters get taller bars");
  assertEqual(density[1]?.label, "4个事件", "event density labels cluster count");
  assertOk(density[1]?.detail.includes("MACD死叉"), "event density detail includes event labels");
  assertOk(density[1]?.detail.includes("TDS9上涨7"), "event density includes TDS9 sequence labels");
  assertOk(density[2]?.detail.includes("向下缺口"), "event density includes gap direction labels");
}

function testBuildsCompactAnnotationDisplay() {
  const compact = buildCompactAnnotationDisplay(
    [
      { key: "tech-1", layer: "price-risk", label: "RSI超买", tone: "risk", x: 120, y: 90 },
      { key: "tech-2", layer: "price-risk", label: "WR超买", tone: "risk", x: 128, y: 96 },
      { key: "tech-3", layer: "price-risk", label: "CCI弱势", tone: "risk", x: 170, y: 104 },
      { key: "vol-1", layer: "volume", label: "放量上涨", tone: "good", x: 126, y: 460 },
    ],
    {
      activeKey: "tech-2",
      mode: "compact",
      minClusterGap: 18,
    },
  );
  const expanded = buildCompactAnnotationDisplay(
    [
      { key: "tech-1", layer: "price-risk", label: "RSI超买", tone: "risk", x: 120, y: 90 },
      { key: "tech-2", layer: "price-risk", label: "WR超买", tone: "risk", x: 128, y: 96 },
    ],
    { mode: "all" },
  );

  assertEqual(compact.labelKeys.join(","), "tech-2", "compact mode only labels active annotation");
  assertEqual(compact.clusters.length, 1, "nearby same-layer annotations merge into one badge");
  assertEqual(compact.clusters[0]?.count, 2, "cluster badge reports hidden annotation count");
  assertEqual(compact.clusters[0]?.label, "2", "cluster badge uses compact count label");
  assertOk(compact.clusters[0]?.detail.includes("RSI超买"), "cluster detail keeps merged labels");
  assertEqual(expanded.labelKeys.join(","), "tech-1,tech-2", "expanded mode labels every annotation");
  assertEqual(expanded.clusters.length, 0, "expanded mode does not render density badges");
}

function testDenseChartLayersOnlyRenderInFullMode() {
  const emptySelection = {
    profile: false,
    secondaryIndicators: false,
    signals: false,
    structure: false,
    trendRegime: false,
  };
  const signalSelection = { ...emptySelection, signals: true };
  const structureSelection = { ...emptySelection, structure: true };
  const profileSelection = { ...emptySelection, profile: true };
  const secondarySelection = { ...emptySelection, secondaryIndicators: true };
  const trendSelection = { ...emptySelection, trendRegime: true };

  assertEqual(shouldRenderDenseChartLayer("compact", "annotations", emptySelection), false, "compact mode hides individual annotation markers by default");
  assertEqual(shouldRenderDenseChartLayer("compact", "annotations", signalSelection), true, "signal layer opt-in shows individual annotation markers");
  assertEqual(shouldRenderDenseChartLayer("compact", "clusterBadges", signalSelection), false, "signal layer avoids compact cluster badges");
  assertEqual(shouldRenderDenseChartLayer("compact", "profile", profileSelection), true, "profile layer opt-in shows volume profile overlay");
  assertEqual(shouldRenderDenseChartLayer("compact", "autoLevels", structureSelection), true, "structure layer opt-in shows automatic support overlays");
  assertEqual(shouldRenderDenseChartLayer("compact", "secondaryIndicators", secondarySelection), true, "advanced indicator layer opt-in shows secondary indicators");
  assertEqual(shouldRenderDenseChartLayer("compact", "trendRegime", trendSelection), true, "background layer opt-in shows trend regime backgrounds");
  assertEqual(shouldRenderDenseChartLayer("all", "annotations", emptySelection), true, "full mode renders individual annotation markers");
  assertEqual(shouldRenderDenseChartLayer("all", "profile", emptySelection), true, "full mode renders volume profile overlay");
  assertEqual(shouldRenderDenseChartLayer("all", "secondaryIndicators", emptySelection), true, "full mode renders secondary indicator overlays");
}

function testBuildsKlineEventBacktestSummary() {
  const summary = buildKlineEventBacktestSummary({
    bars: eventBacktestBars,
    horizon: 1,
    technicalEvents: [
      { key: "tech-0", type: "ma-golden-cross", label: "MA金叉", tone: "good", index: 0, date: "2026-08-01", dateLabel: "08-01", price: 10 },
      { key: "tech-2", type: "macd-death-cross", label: "MACD死叉", tone: "risk", index: 2, date: "2026-08-03", dateLabel: "08-03", price: 12 },
      { key: "tech-5", type: "rsi-overbought", label: "RSI超买", tone: "risk", index: 5, date: "2026-08-06", dateLabel: "08-06", price: 12 },
    ],
    tdsEvents: [
      { key: "tds-3", direction: "sell", tone: "risk", count: 9, index: 3, date: "2026-08-04", dateLabel: "08-04", price: 11 },
    ],
  });

  assertEqual(summary.length, 2, "event backtest keeps only signal families with forward samples");
  assertEqual(summary.map((item) => item.key).join(","), "technical,tds9", "event backtest keeps stable family order");
  assertEqual(summary[0]?.label, "技术信号", "technical backtest item keeps the family label");
  assertEqual(summary[0]?.sampleCount, 2, "events without enough future bars are excluded from samples");
  assertEqual(summary[0]?.riseCount, 1, "technical backtest counts next-bar rises");
  assertEqual(summary[0]?.fallCount, 1, "technical backtest counts next-bar falls");
  assertApprox(summary[0]?.riseRate, 0.5, 0.0001, "technical backtest exposes next-bar rise rate");
  assertApprox(summary[0]?.averageReturnPct, 0.8333, 0.001, "technical backtest averages next-bar returns");
  assertEqual(summary[0]?.value, "50.0%", "technical backtest formats rise rate for display");
  assertEqual(summary[0]?.detail, "1日后上涨 1/2 · 均幅 +0.83%", "technical backtest exposes a compact Chinese detail");
  assertEqual(summary[1]?.label, "TDS9序列", "TDS9 backtest item keeps the sequence family label");
  assertEqual(summary[1]?.value, "100.0%", "TDS9 backtest reports its next-bar rise rate");
  assertEqual(summary[1]?.tone, "good", "positive average forward return is marked constructive");
}

function testBuildsRelativeStrengthOverlaySeries() {
  const overlay = buildRelativeStrengthOverlaySeries(
    [
      { date: "2026-09-01" },
      { date: "2026-09-02" },
      { date: "2026-09-03" },
    ],
    [
      { date: "2026-09-01", rel_strength_index20: 0.02, rel_strength_industry20: 0.01 },
      { date: "2026-09-03", rel_strength_index20: -0.01, rel_strength_industry20: 0.04 },
    ],
  );

  assertEqual(overlay.points.length, 2, "relative strength overlay keeps matched factor rows");
  assertEqual(overlay.points.map((point) => point.index).join(","), "0,2", "relative strength overlay maps rows to candle indexes");
  assertApprox(overlay.points[0]?.indexValue, 0.02, 0.0001, "index relative strength is preserved");
  assertApprox(overlay.points[0]?.industryValue, 0.01, 0.0001, "industry relative strength is preserved");
  assertApprox(overlay.latestIndex, -0.01, 0.0001, "latest index relative strength comes from newest visible row");
  assertApprox(overlay.latestIndustry, 0.04, 0.0001, "latest industry relative strength comes from newest visible row");
}

function testBuildsRelativeStrengthOverlaySeriesForPeriodBars() {
  const overlay = buildRelativeStrengthOverlaySeries(
    [
      { date: "2026-09-07", period_start: "2026-09-01", period_end: "2026-09-07" },
    ],
    [
      { date: "2026-09-02", rel_strength_index20: 0.01, rel_strength_industry20: 0.02 },
      { date: "2026-09-06", rel_strength_index20: 0.05, rel_strength_industry20: 0.03 },
      { date: "2026-09-08", rel_strength_index20: 0.09, rel_strength_industry20: 0.08 },
    ],
  );

  assertEqual(overlay.points.length, 1, "period relative strength overlay uses rows inside the candle window");
  assertEqual(overlay.points[0]?.index, 0, "period relative strength overlay maps to the aggregated candle index");
  assertApprox(overlay.points[0]?.indexValue, 0.05, 0.0001, "period relative strength picks the latest in-window index row");
  assertApprox(overlay.points[0]?.industryValue, 0.03, 0.0001, "period relative strength picks the latest in-window industry row");
}

function testBuildsRelativeStrengthOverlaySeriesSkipsMissingValues() {
  const overlay = buildRelativeStrengthOverlaySeries(
    [
      { date: "2026-09-01" },
      { date: "2026-09-02" },
    ],
    [
      { date: "2026-09-01", rel_strength_index20: null, rel_strength_industry20: null },
      { date: "2026-09-02", rel_strength_index20: 0.03, rel_strength_industry20: null },
    ],
  );

  assertEqual(overlay.points.length, 1, "relative strength overlay skips rows without either strength value");
  assertEqual(overlay.points[0]?.industryValue, null, "relative strength overlay preserves missing side as null");
  assertApprox(overlay.latestIndex, 0.03, 0.0001, "relative strength overlay still reports the available latest value");
  assertEqual(overlay.latestIndustry, null, "relative strength overlay keeps latest missing series explicit");
}

testBuildsVisibleVolumeDistribution();
testBuildsLimitPriceLinesFromFinitePrices();
testMapsClientPointToSplitChartViewBox();
testBuildsKlineHoverMetrics();
testBuildsVolumeMovingAverageValues();
testBuildsFundFlowOverlayGeometry();
testResolvesLimitCandleState();
testAppliesTrendChartPreferencePreset();
testMatchesChartPreferencePresetFromValues();
testBuildsChartLayerSummary();
testBuildsIndicatorStateSummary();
testUnknownChartPreferencePresetIsNoop();
testAppliesShortTermChartParameterPreset();
testMatchesChartParameterPresetFromValues();
testUnknownChartParameterPresetIsNoop();
testBuildsManualHorizontalDrawingGeometry();
testBuildsManualDrawingGeometryOnPercentAxis();
testBuildsManualTrendDrawingGeometry();
testNormalizesManualDrawingsForStorage();
testManualDrawingStorageKeyUsesSymbolScope();
testBuildsPercentPriceAxisScale();
testPriceAxisModeFallsBackForInvalidInput();
testBuildsForwardAdjustedBars();
testBuildsBackwardAdjustedBars();
testPriceAdjustmentModeFallback();
testNormalizesKlineRenderMode();
testBuildsHeikinAshiBars();
testBuildsMeasuredRangeStats();
testMeasuredRangeStatsKeepSelectionDirection();
testHandlesMissingBarsExplicitly();
testBuildsIntradayMinuteBarsFromRealtimePoints();
testBuildsLightweightChartSeriesFromMarketBars();
testBuildsLightweightChartOverlays();
testBuildsLightweightSuperTrendSeriesAndSignals();
testBuildsLightweightTrendHoverReadouts();
testBuildsAlphaTrendSeriesAndSignals();
testBuildsAlphaTrendBacktestSummary();
testBuildsAlphaTrendOptimizationSummary();
testBuildsLightweightTensionFlowTrendSeriesAndSignals();
testBuildsTensionFlowTrendBacktestSummary();
testBuildsLightweightAlphaTrendSeries();
testAlphaTrendFallsBackToRsiWhenVolumeIsMissing();
testBuildsStableLightweightMaPeriodKey();
testBuildsLightweightVisibleLogicalRange();
testBuildsLightweightPriceLines();
testBuildsReadableStrategyGateText();
testBuildsReadableStrategyDecisionCopy();
testBuildsStrategyFactorTooltip();
testBuildsStrategyScoreAndStrengthTooltips();
testBuildsTradePlanAndRiskTooltips();
testBuildsStrategyTradeMarkers();
testUsesRedGreenTradingViewTradeMarkerColors();
testBuildsTradingViewTradeMarkerReadout();
testBuildsHistoricalStrategyTradeMarkersFromBacktest();
testBuildsVolumeProfileLevelAnnotations();
testBuildsFutuStyleAdvancedIndicators();
testAdvancedIndicatorsNeedEnoughSamples();
testBuildsMomentumIndicatorSet();
testMomentumIndicatorsNeedEnoughSamples();
testCompactIndicatorLayoutKeepsLegacyBands();
testSplitIndicatorLayoutCreatesSeparateSubCharts();
testBuildsIndicatorAxisTicks();
testBuildsCompactIndicatorAxisTickLabels();
testBuildsIndicatorThresholdGuides();
testBuildsIndicatorThresholdZones();
testBuildsLatestPriceLine();
testBuildsIndicatorBandAreaPath();
testBuildsOverlayPriceLabelsWithoutOverlap();
testBuildsIndicatorValueLabelsBySection();
testBuildsKlineRangeNavigator();
testKlineRangeNavigatorHidesForFullRange();
testMapsKlineNavigatorClickToRightOffset();
testBuildsTrendRibbonAreaSegments();
testBuildsIchimokuIndicators();
testBuildsSplitIndicatorPanelReadouts();
testCompactIndicatorPanelReadoutsFoldExtraIndicators();
testSelectsCursorIndicatorReadoutSnapshot();
testBuildsTrendOverlayIndicators();
testBuildsEnvelopeIndicators();
testEnvelopeIndicatorsNeedEnoughSamples();
testBuildsMikeIndicators();
testBuildsPsychologicalLineIndicators();
testPsychologicalLineIndicatorsNeedEnoughSamples();
testBuildsOscillatorIndicators();
testOscillatorIndicatorsNeedEnoughSamples();
testTrendOverlayIndicatorsNeedEnoughSamples();
testBuildsVolumeMomentumIndicators();
testVolumeMomentumIndicatorsNeedEnoughSamples();
testBuildsVolatilityVolumeIndicators();
testVolatilityVolumeIndicatorsNeedEnoughSamples();
testBuildsVisiblePriceExtrema();
testVisiblePriceExtremaNeedUsableBars();
testBuildsFibonacciRetracementLevels();
testFibonacciRetracementNeedsExtrema();
testBuildsSupportResistanceLevelsFromSwingPivots();
testSupportResistanceNeedsUsableBars();
testBuildsCandlestickPatternAnnotations();
testCandlestickPatternsNeedUsableBars();
testBuildsTdsSequentialSellSetup();
testBuildsTdsSequentialBuySetup();
testBuildsTrailingPartialTdsSequentialSetup();
testTdsSequentialDropsFailedPartialSetup();
testBuildsTechnicalIndicatorAnnotations();
testBuildsMomentumTechnicalIndicatorAnnotations();
testTechnicalIndicatorAnnotationsNeedComparableValues();
testBuildsTechnicalDivergenceAnnotations();
testTechnicalDivergenceAnnotationsNeedComparableIndicators();
testBuildsVolumeSignalAnnotations();
testVolumeSignalAnnotationsNeedEnoughVolumeHistory();
testBuildsTrendRegimeBands();
testTrendRegimeBandsNeedComparableAverages();
testBuildsPriceStructureTrendLines();
testPriceStructureTrendLinesNeedTwoPivots();
testBuildsPriceGapAnnotations();
testPriceGapAnnotationsRespectThreshold();
testBuildsKlineEventSummary();
testBuildsKlineEventDensity();
testBuildsCompactAnnotationDisplay();
testDenseChartLayersOnlyRenderInFullMode();
testBuildsKlineEventBacktestSummary();
testBuildsSuperTrendBacktestSummary();
testBuildsSuperTrendBacktestSummaryWithTrendBreakoutFilter();
testBuildsRelativeStrengthOverlaySeries();
testBuildsRelativeStrengthOverlaySeriesForPeriodBars();
testBuildsRelativeStrengthOverlaySeriesSkipsMissingValues();
