import {
  applyChartPreferencePreset,
  buildAdvancedIndicators,
  buildCandlestickPatternAnnotations,
  buildFibonacciRetracementLevels,
  buildIndicatorSectionLayout,
  buildIndicatorPanelReadouts,
  buildMeasuredRangeStats,
  buildMomentumIndicators,
  buildPriceGapAnnotations,
  buildPriceStructureTrendLines,
  buildSupportResistanceLevels,
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
  matchChartPreferencePreset,
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
  vwap: true,
  levels: true,
  signals: true,
  events: true,
  relative: true,
  profile: true,
  fibonacci: true,
  supportResistance: true,
  trendLines: true,
  patterns: true,
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

const technicalSignalBars = [
  { date: "2026-05-01", open: 10, high: 10.2, low: 9.8, close: 10, maFast: 9.8, maSlow: 10, dif: -0.08, dea: 0.02, bollUpper: 11, bollLower: 9 },
  { date: "2026-05-02", open: 10, high: 10.9, low: 9.9, close: 10.8, maFast: 10.2, maSlow: 10.1, dif: -0.04, dea: 0.01, bollUpper: 11.2, bollLower: 9.1 },
  { date: "2026-05-03", open: 10.8, high: 11, low: 10.4, close: 10.9, maFast: 10.5, maSlow: 10.2, dif: 0.05, dea: 0.02, bollUpper: 11.4, bollLower: 9.3 },
  { date: "2026-05-04", open: 10.9, high: 12.4, low: 10.8, close: 12.2, maFast: 10.9, maSlow: 10.4, dif: 0.08, dea: 0.03, bollUpper: 12, bollLower: 9.5 },
  { date: "2026-05-05", open: 12.2, high: 12.3, low: 11, close: 11.2, maFast: 11.2, maSlow: 11, dif: 0.04, dea: 0.02, bollUpper: 12.5, bollLower: 9.8 },
  { date: "2026-05-06", open: 11.2, high: 11.3, low: 10.6, close: 10.8, maFast: 10.9, maSlow: 11.1, dif: 0.01, dea: 0.03, bollUpper: 12.2, bollLower: 9.6 },
  { date: "2026-05-07", open: 10.8, high: 10.9, low: 8.7, close: 8.8, maFast: 10.3, maSlow: 10.9, dif: -0.03, dea: 0.02, bollUpper: 11.8, bollLower: 9 },
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
}

function testAppliesTrendChartPreferencePreset() {
  const prefs = applyChartPreferencePreset(baseChartPrefs, "trend");

  assertEqual(prefs.ma, true, "trend preset keeps moving averages");
  assertEqual(prefs.ema, true, "trend preset enables EMA");
  assertEqual(prefs.boll, true, "trend preset keeps BOLL");
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

function testUnknownChartPreferencePresetIsNoop() {
  const prefs = applyChartPreferencePreset(baseChartPrefs, "missing-preset");

  assertEqual(prefs, baseChartPrefs, "unknown preset keeps the original preferences object");
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

function testBuildsSplitIndicatorPanelReadouts() {
  const readouts = buildIndicatorPanelReadouts({
    close: 13.5,
    ma20: 12.3,
    bollMid: 12.8,
    volume: 650,
    volumeRatio: 1.4,
    dif: 0.32,
    dea: 0.18,
    macd: 0.28,
    rsi14: 62.4,
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
    atr: 1.52,
    obv: 1280000,
  }, { mode: "split" });

  assertEqual(readouts.length, 7, "split readouts cover every visible chart section");
  assertEqual(readouts.find((group) => group.key === "price")?.items.map((item) => item.label).join(","), "C,MA20,BOLL", "price readout keeps core price overlays");
  assertEqual(readouts.find((group) => group.key === "advanced")?.items.map((item) => item.label).join(","), "CR,BR,EMV,MFI,VR", "advanced readout keeps energy and money-flow values");
  assertEqual(readouts.find((group) => group.key === "momentum")?.items.map((item) => item.label).join(","), "+DI,-DI,ADX,CCI,WR,BIAS,DMA,TRIX", "momentum readout keeps directional and momentum values");
  assertEqual(readouts.find((group) => group.key === "volatility")?.items.map((item) => item.label).join(","), "ATR,OBV", "volatility readout keeps range and cumulative volume values");
}

function testCompactIndicatorPanelReadoutsFoldExtraIndicators() {
  const readouts = buildIndicatorPanelReadouts({
    rsi14: 54.2,
    kdjJ: 61.8,
    cr: 118,
    pdi: 23.4,
    bias: -1.6,
    trix: 0.18,
  }, { mode: "compact" });
  const oscillator = readouts.find((group) => group.key === "oscillator");

  assertEqual(readouts.some((group) => group.key === "advanced"), false, "compact readouts do not point to hidden advanced panel");
  assertEqual(readouts.some((group) => group.key === "momentum"), false, "compact readouts do not point to hidden momentum panel");
  assertEqual(oscillator?.items.map((item) => item.label).join(","), "RSI,J,CR,+DI,BIAS,TRIX", "compact oscillator folds extra indicator readings");
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
  const indicators = buildVolatilityVolumeIndicators(trendOverlayBars, { atrPeriod: 3 });
  const latest = indicators[indicators.length - 1];

  assertEqual(indicators.length, trendOverlayBars.length, "volatility volume indicators preserve bar count");
  assertOk(latest, "latest volatility volume indicator exists");
  assertEqual(indicators[0]?.obv, 0, "OBV starts from a neutral baseline");
  assertApprox(indicators[2]?.atr, 1.3, 0.001, "ATR averages true range once the period is ready");
  assertApprox(latest?.atr, 1.6667, 0.001, "ATR captures the latest volatility range");
  assertApprox(latest?.obv, -660, 0.001, "OBV accumulates signed volume by close direction");
}

function testVolatilityVolumeIndicatorsNeedEnoughSamples() {
  const indicators = buildVolatilityVolumeIndicators(trendOverlayBars.slice(0, 2), { atrPeriod: 3 });
  const latest = indicators[indicators.length - 1];

  assertEqual(latest?.atr, null, "ATR is missing before its period is ready");
  assertApprox(latest?.obv, 300, 0.001, "OBV is available from the first close direction");
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

testBuildsVisibleVolumeDistribution();
testAppliesTrendChartPreferencePreset();
testMatchesChartPreferencePresetFromValues();
testUnknownChartPreferencePresetIsNoop();
testBuildsMeasuredRangeStats();
testMeasuredRangeStatsKeepSelectionDirection();
testHandlesMissingBarsExplicitly();
testBuildsVolumeProfileLevelAnnotations();
testBuildsFutuStyleAdvancedIndicators();
testAdvancedIndicatorsNeedEnoughSamples();
testBuildsMomentumIndicatorSet();
testMomentumIndicatorsNeedEnoughSamples();
testCompactIndicatorLayoutKeepsLegacyBands();
testSplitIndicatorLayoutCreatesSeparateSubCharts();
testBuildsSplitIndicatorPanelReadouts();
testCompactIndicatorPanelReadoutsFoldExtraIndicators();
testBuildsTrendOverlayIndicators();
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
testBuildsTechnicalIndicatorAnnotations();
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
