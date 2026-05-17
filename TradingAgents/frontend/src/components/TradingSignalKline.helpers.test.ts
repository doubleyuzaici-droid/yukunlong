import {
  buildAdvancedIndicators,
  buildIndicatorSectionLayout,
  buildMomentumIndicators,
  buildTrendOverlayIndicators,
  buildVisiblePriceExtrema,
  buildVolumeMomentumIndicators,
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

const trendOverlayBars = [
  ...mixedTrendBars,
  { date: "2026-05-20", open: 12, high: 12.4, low: 10.8, close: 11.1, volume: 760, amount: 8_436 },
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

testBuildsVisibleVolumeDistribution();
testHandlesMissingBarsExplicitly();
testBuildsFutuStyleAdvancedIndicators();
testAdvancedIndicatorsNeedEnoughSamples();
testBuildsMomentumIndicatorSet();
testMomentumIndicatorsNeedEnoughSamples();
testCompactIndicatorLayoutKeepsLegacyBands();
testSplitIndicatorLayoutCreatesSeparateSubCharts();
testBuildsTrendOverlayIndicators();
testTrendOverlayIndicatorsNeedEnoughSamples();
testBuildsVolumeMomentumIndicators();
testVolumeMomentumIndicatorsNeedEnoughSamples();
testBuildsVisiblePriceExtrema();
testVisiblePriceExtremaNeedUsableBars();
