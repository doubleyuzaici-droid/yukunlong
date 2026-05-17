export type VolumeProfileSide = "below" | "current" | "above";

export interface VolumeProfileBarLike {
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
  amount?: number | null;
}

export interface VolumeProfileBin {
  index: number;
  low: number;
  high: number;
  mid: number;
  volume: number;
  amount: number;
  upVolume: number;
  downVolume: number;
  percent: number;
  widthPercent: number;
  side: VolumeProfileSide;
  isPointOfControl: boolean;
}

export interface VolumeProfileModel {
  bins: VolumeProfileBin[];
  totalVolume: number;
  totalAmount: number;
  maxVolume: number;
  priceMin: number | null;
  priceMax: number | null;
  weightedAveragePrice: number | null;
  currentPrice: number | null;
  currentBin: VolumeProfileBin | null;
  pointOfControl: VolumeProfileBin | null;
  supportBin: VolumeProfileBin | null;
  resistanceBin: VolumeProfileBin | null;
}

export interface AdvancedIndicatorSnapshot {
  cr: number | null;
  ar: number | null;
  br: number | null;
  emv: number | null;
  emvMa: number | null;
}

export interface MomentumIndicatorSnapshot {
  pdi: number | null;
  mdi: number | null;
  adx: number | null;
  cci: number | null;
  wr: number | null;
}

export type IndicatorSectionLayoutMode = "compact" | "split";

export interface IndicatorChartBand {
  top: number;
  bottom: number;
}

export interface IndicatorChartSection extends IndicatorChartBand {
  key: string;
  label: string;
}

export interface IndicatorSectionLayout {
  mode: IndicatorSectionLayoutMode;
  viewBoxHeight: number;
  timeAxisY: number;
  signalLaneY: number;
  price: IndicatorChartBand;
  volume: IndicatorChartBand;
  macd: IndicatorChartBand;
  oscillator: IndicatorChartBand;
  advanced: IndicatorChartBand;
  momentum: IndicatorChartBand;
  sections: IndicatorChartSection[];
}

export function buildIndicatorSectionLayout(mode: IndicatorSectionLayoutMode = "compact"): IndicatorSectionLayout {
  const price = mode === "split" ? { top: 42, bottom: 330 } : { top: 42, bottom: 360 };
  const volume = mode === "split" ? { top: 360, bottom: 418 } : { top: 392, bottom: 456 };
  const macd = mode === "split" ? { top: 452, bottom: 522 } : { top: 492, bottom: 572 };
  const oscillator = mode === "split" ? { top: 554, bottom: 624 } : { top: 612, bottom: 684 };
  const advanced = mode === "split" ? { top: 656, bottom: 736 } : oscillator;
  const momentum = mode === "split" ? { top: 768, bottom: 848 } : oscillator;
  const sections: IndicatorChartSection[] = [
    { key: "price", label: "PRICE · MA5 / MA20 / MA60", ...price },
    { key: "volume", label: "VOL", ...volume },
    { key: "macd", label: "MACD", ...macd },
    { key: "oscillator", label: "RSI / KDJ", ...oscillator },
  ];
  if (mode === "split") {
    sections.push(
      { key: "advanced", label: "CR / ARBR / EMV", ...advanced },
      { key: "momentum", label: "DMI / CCI / WR", ...momentum },
    );
  } else {
    sections[3] = { key: "oscillator", label: "RSI / KDJ / CR / DMI / CCI / WR", ...oscillator };
  }

  return {
    mode,
    viewBoxHeight: mode === "split" ? 900 : 720,
    timeAxisY: mode === "split" ? 894 : 716,
    signalLaneY: mode === "split" ? 876 : 704,
    price,
    volume,
    macd,
    oscillator,
    advanced,
    momentum,
    sections,
  };
}

export function buildAdvancedIndicators(
  bars: VolumeProfileBarLike[],
  options: { period?: number; emvPeriod?: number } = {},
): AdvancedIndicatorSnapshot[] {
  const period = clampInteger(options.period ?? 26, 2, 120);
  const emvPeriod = clampInteger(options.emvPeriod ?? 14, 2, 80);
  const normalized = bars.map(normalizeAdvancedBar);
  const emvValues = normalized.map((bar, index) => {
    if (!bar || index === 0) return null;
    const previous = normalized[index - 1];
    if (!previous) return null;
    const midpointMove = (bar.high + bar.low) / 2 - (previous.high + previous.low) / 2;
    const boxRatio = bar.volume > 0 ? bar.volume / Math.max(bar.high - bar.low, 0.000001) : null;
    return boxRatio ? midpointMove / boxRatio : null;
  });

  return normalized.map((bar, index) => {
    if (!bar) return { cr: null, ar: null, br: null, emv: emvValues[index], emvMa: null };
    const windowStart = index - period + 1;
    const isPeriodReady = windowStart >= 1;
    const emvWindow = emvValues.slice(Math.max(0, index - emvPeriod + 1), index + 1).filter(isFiniteNumber);
    if (!isPeriodReady) {
      return {
        cr: null,
        ar: null,
        br: null,
        emv: emvValues[index],
        emvMa: emvWindow.length === emvPeriod ? averageNumbers(emvWindow) : null,
      };
    }

    let crUp = 0;
    let crDown = 0;
    let arUp = 0;
    let arDown = 0;
    let brUp = 0;
    let brDown = 0;
    for (let cursor = windowStart; cursor <= index; cursor += 1) {
      const current = normalized[cursor];
      const previous = normalized[cursor - 1];
      if (!current || !previous) continue;
      const previousMid = (previous.high + previous.low + previous.close) / 3;
      crUp += Math.max(0, current.high - previousMid);
      crDown += Math.max(0, previousMid - current.low);
      arUp += Math.max(0, current.high - current.open);
      arDown += Math.max(0, current.open - current.low);
      brUp += Math.max(0, current.high - previous.close);
      brDown += Math.max(0, previous.close - current.low);
    }

    return {
      cr: ratioPercent(crUp, crDown),
      ar: ratioPercent(arUp, arDown),
      br: ratioPercent(brUp, brDown),
      emv: emvValues[index],
      emvMa: emvWindow.length === emvPeriod ? averageNumbers(emvWindow) : null,
    };
  });
}

export function buildMomentumIndicators(
  bars: VolumeProfileBarLike[],
  options: { period?: number } = {},
): MomentumIndicatorSnapshot[] {
  const period = clampInteger(options.period ?? 14, 2, 80);
  const normalized = bars.map(normalizeAdvancedBar);
  const dmiDrafts = normalized.map((bar, index) => {
    const windowStart = index - period + 1;
    if (!bar || windowStart < 1) return { pdi: null, mdi: null, dx: null };

    let trueRange = 0;
    let plusMovement = 0;
    let minusMovement = 0;
    for (let cursor = windowStart; cursor <= index; cursor += 1) {
      const current = normalized[cursor];
      const previous = normalized[cursor - 1];
      if (!current || !previous) continue;
      trueRange += Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close),
      );
      const upwardMove = current.high - previous.high;
      const downwardMove = previous.low - current.low;
      plusMovement += upwardMove > downwardMove && upwardMove > 0 ? upwardMove : 0;
      minusMovement += downwardMove > upwardMove && downwardMove > 0 ? downwardMove : 0;
    }

    const pdi = ratioPercent(plusMovement, trueRange);
    const mdi = ratioPercent(minusMovement, trueRange);
    const dx = pdi != null && mdi != null && pdi + mdi > 0
      ? (Math.abs(pdi - mdi) / (pdi + mdi)) * 100
      : null;
    return { pdi, mdi, dx };
  });

  return normalized.map((bar, index) => {
    const windowStart = index - period + 1;
    const cciWr = bar && windowStart >= 0
      ? buildCciWrSnapshot(normalized.slice(windowStart, index + 1), period)
      : { cci: null, wr: null };
    const dxWindow = dmiDrafts
      .slice(Math.max(0, index - period + 1), index + 1)
      .map((value) => value.dx)
      .filter(isFiniteNumber);

    return {
      pdi: dmiDrafts[index]?.pdi ?? null,
      mdi: dmiDrafts[index]?.mdi ?? null,
      adx: dxWindow.length === period ? averageNumbers(dxWindow) : null,
      cci: cciWr.cci,
      wr: cciWr.wr,
    };
  });
}

export function buildVolumeProfile(
  bars: VolumeProfileBarLike[],
  options: { binCount?: number; currentPrice?: number | null } = {},
): VolumeProfileModel {
  const usableBars = bars
    .map(normalizeVolumeProfileBar)
    .filter((bar): bar is NonNullable<ReturnType<typeof normalizeVolumeProfileBar>> => Boolean(bar));
  const currentPrice = isFiniteNumber(options.currentPrice) ? Number(options.currentPrice) : usableBars[usableBars.length - 1]?.close ?? null;

  if (usableBars.length === 0) {
    return emptyVolumeProfile(currentPrice);
  }

  const priceMin = Math.min(...usableBars.map((bar) => bar.low));
  const priceMax = Math.max(...usableBars.map((bar) => bar.high));
  const priceSpan = priceMax - priceMin;
  if (!isFiniteNumber(priceMin) || !isFiniteNumber(priceMax) || priceSpan <= 0) {
    return emptyVolumeProfile(currentPrice);
  }

  const binCount = clampInteger(options.binCount ?? 18, 4, 40);
  const binSize = priceSpan / binCount;
  const draftBins = Array.from({ length: binCount }, (_, index) => {
    const low = priceMin + binSize * index;
    const high = index === binCount - 1 ? priceMax : low + binSize;
    return {
      index,
      low,
      high,
      mid: (low + high) / 2,
      volume: 0,
      amount: 0,
      upVolume: 0,
      downVolume: 0,
    };
  });

  usableBars.forEach((bar) => {
    const barSpan = Math.max(bar.high - bar.low, 0.000001);
    draftBins.forEach((bin) => {
      const overlap = Math.max(0, Math.min(bar.high, bin.high) - Math.max(bar.low, bin.low));
      const containsFlatBar = bar.high === bar.low && bar.high >= bin.low && bar.high <= bin.high;
      const weight = containsFlatBar ? 1 : overlap / barSpan;
      if (weight <= 0) return;
      const volume = bar.volume * weight;
      bin.volume += volume;
      bin.amount += bar.amount * weight;
      if (bar.close >= bar.open) bin.upVolume += volume;
      else bin.downVolume += volume;
    });
  });

  const totalVolume = draftBins.reduce((sum, bin) => sum + bin.volume, 0);
  const totalAmount = draftBins.reduce((sum, bin) => sum + bin.amount, 0);
  const maxVolume = Math.max(...draftBins.map((bin) => bin.volume), 0);
  const pointOfControlIndex = draftBins.reduce(
    (winner, bin, index) => (bin.volume > draftBins[winner].volume ? index : winner),
    0,
  );

  const bins: VolumeProfileBin[] = draftBins.map((bin, index) => ({
    ...bin,
    percent: totalVolume > 0 ? bin.volume / totalVolume : 0,
    widthPercent: maxVolume > 0 ? (bin.volume / maxVolume) * 100 : 0,
    side: currentPrice == null ? "below" : currentPrice >= bin.low && currentPrice <= bin.high ? "current" : bin.high < currentPrice ? "below" : "above",
    isPointOfControl: index === pointOfControlIndex && maxVolume > 0,
  }));

  const currentBin = currentPrice == null ? null : bins.find((bin) => currentPrice >= bin.low && currentPrice <= bin.high) || null;
  const pointOfControl = maxVolume > 0 ? bins[pointOfControlIndex] : null;
  const supportBin = currentPrice == null
    ? null
    : bins.filter((bin) => bin.high < currentPrice).sort((left, right) => right.volume - left.volume)[0] || null;
  const resistanceBin = currentPrice == null
    ? null
    : bins.filter((bin) => bin.low > currentPrice).sort((left, right) => right.volume - left.volume)[0] || null;

  return {
    bins,
    totalVolume,
    totalAmount,
    maxVolume,
    priceMin,
    priceMax,
    weightedAveragePrice: totalVolume > 0 ? totalAmount / totalVolume : null,
    currentPrice,
    currentBin,
    pointOfControl,
    supportBin,
    resistanceBin,
  };
}

function normalizeVolumeProfileBar(bar: VolumeProfileBarLike) {
  const close = Number(bar.close ?? bar.open ?? bar.high ?? bar.low);
  const open = Number(bar.open ?? close);
  const high = Number(bar.high ?? Math.max(open, close));
  const low = Number(bar.low ?? Math.min(open, close));
  const volume = Number(bar.volume ?? 0);
  if (![open, high, low, close, volume].every(isFiniteNumber) || volume <= 0) return null;
  const normalizedHigh = Math.max(high, low, open, close);
  const normalizedLow = Math.min(high, low, open, close);
  const amount = isFiniteNumber(bar.amount) && Number(bar.amount) > 0
    ? Number(bar.amount)
    : ((normalizedHigh + normalizedLow + close) / 3) * volume;
  return {
    open,
    high: normalizedHigh,
    low: normalizedLow,
    close,
    volume,
    amount,
  };
}

function normalizeAdvancedBar(bar: VolumeProfileBarLike) {
  const close = Number(bar.close ?? bar.open ?? bar.high ?? bar.low);
  const open = Number(bar.open ?? close);
  const high = Number(bar.high ?? Math.max(open, close));
  const low = Number(bar.low ?? Math.min(open, close));
  const volume = Number(bar.volume ?? 0);
  if (![open, high, low, close, volume].every(isFiniteNumber)) return null;
  return {
    open,
    high: Math.max(high, low, open, close),
    low: Math.min(high, low, open, close),
    close,
    volume: Math.max(volume, 0),
  };
}

function buildCciWrSnapshot(
  bars: Array<ReturnType<typeof normalizeAdvancedBar>>,
  period: number,
) {
  if (bars.length !== period || bars.some((bar) => !bar)) return { cci: null, wr: null };
  const usableBars = bars.filter((bar): bar is NonNullable<typeof bar> => Boolean(bar));
  const typicalPrices = usableBars.map((bar) => (bar.high + bar.low + bar.close) / 3);
  const currentTypicalPrice = typicalPrices[typicalPrices.length - 1];
  const typicalAverage = averageNumbers(typicalPrices);
  const meanDeviation = typicalAverage == null
    ? null
    : averageNumbers(typicalPrices.map((value) => Math.abs(value - typicalAverage)));
  const high = Math.max(...usableBars.map((bar) => bar.high));
  const low = Math.min(...usableBars.map((bar) => bar.low));
  return {
    cci: typicalAverage != null && meanDeviation && meanDeviation > 0
      ? (currentTypicalPrice - typicalAverage) / (0.015 * meanDeviation)
      : null,
    wr: high > low ? ((high - usableBars[usableBars.length - 1].close) / (high - low)) * -100 : null,
  };
}

function emptyVolumeProfile(currentPrice: number | null): VolumeProfileModel {
  return {
    bins: [],
    totalVolume: 0,
    totalAmount: 0,
    maxVolume: 0,
    priceMin: null,
    priceMax: null,
    weightedAveragePrice: null,
    currentPrice,
    currentBin: null,
    pointOfControl: null,
    supportBin: null,
    resistanceBin: null,
  };
}

function ratioPercent(numerator: number, denominator: number) {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function averageNumbers(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampInteger(value: number, min: number, max: number) {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next)) return min;
  return Math.min(max, Math.max(min, next));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
