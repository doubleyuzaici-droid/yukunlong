import {
  buildAdvancedIndicators,
  buildIndicatorSectionLayout,
  buildMomentumIndicators,
  buildVolumeProfile,
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

const mixedTrendBars = [
  ...bars,
  { date: "2026-05-15", open: 12.7, high: 13.2, low: 12.1, close: 12.3, volume: 450, amount: 5_535 },
  { date: "2026-05-18", open: 12.3, high: 13.8, low: 12.2, close: 13.5, volume: 650, amount: 8_775 },
  { date: "2026-05-19", open: 13.5, high: 13.6, low: 11.8, close: 12, volume: 700, amount: 8_400 },
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

function testHandlesMissingBarsExplicitly() {
  const profile = buildVolumeProfile([], { binCount: 8, currentPrice: 12 });

  assertEqual(profile.bins.length, 0, "empty input has no fake bins");
  assertEqual(profile.totalVolume, 0, "empty input has zero volume");
  assertEqual(profile.pointOfControl, null, "empty input has no peak chip area");
  assertEqual(profile.currentBin, null, "empty input has no current bin");
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
  assertEqual(layout.sections.length, 6, "split layout exposes six chart sections");
  assertOk(layout.advanced.top > layout.oscillator.bottom, "advanced indicators get their own band");
  assertOk(layout.momentum.top > layout.advanced.bottom, "momentum indicators get their own band");
  assertOk(layout.signalLaneY > layout.momentum.bottom, "signal lane remains below all sub charts");
}

testBuildsVisibleVolumeDistribution();
testHandlesMissingBarsExplicitly();
testBuildsFutuStyleAdvancedIndicators();
testAdvancedIndicatorsNeedEnoughSamples();
testBuildsMomentumIndicatorSet();
testMomentumIndicatorsNeedEnoughSamples();
testCompactIndicatorLayoutKeepsLegacyBands();
testSplitIndicatorLayoutCreatesSeparateSubCharts();
