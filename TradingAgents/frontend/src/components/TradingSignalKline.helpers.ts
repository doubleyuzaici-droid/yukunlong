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

function clampInteger(value: number, min: number, max: number) {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next)) return min;
  return Math.min(max, Math.max(min, next));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
