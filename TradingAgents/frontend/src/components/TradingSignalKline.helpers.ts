export type VolumeProfileSide = "below" | "current" | "above";

export interface VolumeProfileBarLike {
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
  amount?: number | null;
}

export interface PriceExtremaBarLike extends VolumeProfileBarLike {
  date?: string | null;
  period_label?: string | null;
}

export type PriceGapDirection = "up" | "down";

export interface PriceGapAnnotation {
  key: string;
  direction: PriceGapDirection;
  startIndex: number;
  endIndex: number;
  startDate: string;
  endDate: string;
  startLabel: string;
  endLabel: string;
  lowPrice: number;
  highPrice: number;
  gapPct: number | null;
}

export interface VisiblePriceExtremaSnapshot {
  high: number;
  highDate: string;
  highLabel: string;
  highIndex: number;
  low: number;
  lowDate: string;
  lowLabel: string;
  lowIndex: number;
  rangePct: number | null;
}

export interface FibonacciRetracementLevel {
  key: string;
  ratio: number;
  label: string;
  price: number;
  high: number;
  low: number;
}

export type SupportResistanceLevelType = "support" | "resistance";

export interface SupportResistanceLevel {
  key: string;
  type: SupportResistanceLevelType;
  label: string;
  price: number;
  touches: number;
  strength: number;
  startIndex: number;
  lastIndex: number;
  startLabel: string;
  lastLabel: string;
  distancePct: number | null;
  volume: number;
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

export type VolumeProfileLevelKey = "poc" | "support" | "resistance";

export interface VolumeProfileLevelAnnotation {
  key: VolumeProfileLevelKey;
  label: string;
  price: number;
  low: number;
  high: number;
  percent: number;
  volume: number;
  amount: number;
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

export interface TrendOverlayIndicatorSnapshot {
  sar: number | null;
  bbi: number | null;
  bias: number | null;
  dma: number | null;
  ama: number | null;
}

export interface VolumeMomentumIndicatorSnapshot {
  vr: number | null;
  mfi: number | null;
  roc: number | null;
  trix: number | null;
  trma: number | null;
}

export interface VolatilityVolumeIndicatorSnapshot {
  atr: number | null;
  obv: number | null;
}

export type IndicatorSectionLayoutMode = "compact" | "split";

export interface IndicatorPanelReadoutSnapshot {
  close?: number | null;
  ma20?: number | null;
  ma60?: number | null;
  bollMid?: number | null;
  vwap?: number | null;
  volume?: number | null;
  volumeRatio?: number | null;
  dif?: number | null;
  dea?: number | null;
  macd?: number | null;
  rsi14?: number | null;
  kdjK?: number | null;
  kdjD?: number | null;
  kdjJ?: number | null;
  cr?: number | null;
  br?: number | null;
  emv?: number | null;
  mfi?: number | null;
  vr?: number | null;
  pdi?: number | null;
  mdi?: number | null;
  adx?: number | null;
  cci?: number | null;
  wr?: number | null;
  bias?: number | null;
  dma?: number | null;
  trix?: number | null;
  atr?: number | null;
  obv?: number | null;
}

export interface IndicatorPanelReadoutItem {
  label: string;
  value: number;
  precision: number;
  signed?: boolean;
  compact?: boolean;
}

export interface IndicatorPanelReadoutGroup {
  key: string;
  items: IndicatorPanelReadoutItem[];
}

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
  volatility: IndicatorChartBand;
  sections: IndicatorChartSection[];
}

export function buildIndicatorSectionLayout(mode: IndicatorSectionLayoutMode = "compact"): IndicatorSectionLayout {
  const price = mode === "split" ? { top: 42, bottom: 330 } : { top: 42, bottom: 360 };
  const volume = mode === "split" ? { top: 360, bottom: 418 } : { top: 392, bottom: 456 };
  const macd = mode === "split" ? { top: 452, bottom: 522 } : { top: 492, bottom: 572 };
  const oscillator = mode === "split" ? { top: 554, bottom: 624 } : { top: 612, bottom: 684 };
  const advanced = mode === "split" ? { top: 656, bottom: 736 } : oscillator;
  const momentum = mode === "split" ? { top: 768, bottom: 848 } : oscillator;
  const volatility = mode === "split" ? { top: 880, bottom: 960 } : oscillator;
  const sections: IndicatorChartSection[] = [
    { key: "price", label: "PRICE · MA5 / MA20 / MA60", ...price },
    { key: "volume", label: "VOL", ...volume },
    { key: "macd", label: "MACD", ...macd },
    { key: "oscillator", label: "RSI / KDJ", ...oscillator },
  ];
  if (mode === "split") {
    sections.push(
      { key: "advanced", label: "CR / ARBR / EMV / VR / MFI", ...advanced },
      { key: "momentum", label: "DMI / CCI / WR / BIAS / DMA / TRIX", ...momentum },
      { key: "volatility", label: "ATR / OBV", ...volatility },
    );
  } else {
    sections[3] = { key: "oscillator", label: "RSI / KDJ / CR / DMI / BIAS / TRIX / ATR", ...oscillator };
  }

  return {
    mode,
    viewBoxHeight: mode === "split" ? 1012 : 720,
    timeAxisY: mode === "split" ? 1006 : 716,
    signalLaneY: mode === "split" ? 988 : 704,
    price,
    volume,
    macd,
    oscillator,
    advanced,
    momentum,
    volatility,
    sections,
  };
}

export function buildIndicatorPanelReadouts(
  snapshot?: IndicatorPanelReadoutSnapshot | null,
  options: { mode?: IndicatorSectionLayoutMode } = {},
): IndicatorPanelReadoutGroup[] {
  if (!snapshot) return [];
  const mode = options.mode ?? "split";
  const item = (
    label: string,
    value: number | null | undefined,
    precision = 2,
    extra: Pick<IndicatorPanelReadoutItem, "signed" | "compact"> = {},
  ): IndicatorPanelReadoutItem | null =>
    isFiniteNumber(value)
      ? { label, value: Number(value), precision, ...extra }
      : null;
  const group = (key: string, items: Array<IndicatorPanelReadoutItem | null>): IndicatorPanelReadoutGroup | null => {
    const visibleItems = items.filter((value): value is IndicatorPanelReadoutItem => Boolean(value));
    return visibleItems.length > 0 ? { key, items: visibleItems } : null;
  };

  const oscillatorItems = [
    item("RSI", snapshot.rsi14, 1),
    item("K", snapshot.kdjK, 1),
    item("D", snapshot.kdjD, 1),
    item("J", snapshot.kdjJ, 1),
  ];
  const advancedItems = [
    item("CR", snapshot.cr, 1),
    item("BR", snapshot.br, 1),
    item("EMV", snapshot.emv, 4, { signed: true }),
    item("MFI", snapshot.mfi, 1),
    item("VR", snapshot.vr, 1),
  ];
  const momentumItems = [
    item("+DI", snapshot.pdi, 1),
    item("-DI", snapshot.mdi, 1),
    item("ADX", snapshot.adx, 1),
    item("CCI", snapshot.cci, 1, { signed: true }),
    item("WR", snapshot.wr, 1, { signed: true }),
    item("BIAS", snapshot.bias, 2, { signed: true }),
    item("DMA", snapshot.dma, 2, { signed: true }),
    item("TRIX", snapshot.trix, 2, { signed: true }),
  ];
  const volatilityItems = [
    item("ATR", snapshot.atr, 2),
    item("OBV", snapshot.obv, 0, { compact: true, signed: true }),
  ];

  const groups = [
    group("price", [
      item("C", snapshot.close, 2),
      item("MA20", snapshot.ma20, 2),
      item("MA60", snapshot.ma60, 2),
      item("BOLL", snapshot.bollMid, 2),
      item("VWAP", snapshot.vwap, 2),
    ]),
    group("volume", [
      item("VOL", snapshot.volume, 0, { compact: true }),
      item("量比", snapshot.volumeRatio, 2),
    ]),
    group("macd", [
      item("DIF", snapshot.dif, 2, { signed: true }),
      item("DEA", snapshot.dea, 2, { signed: true }),
      item("MACD", snapshot.macd, 2, { signed: true }),
    ]),
    group("oscillator", mode === "split"
      ? oscillatorItems
      : [...oscillatorItems, ...advancedItems, ...momentumItems, ...volatilityItems]),
    ...(mode === "split"
      ? [
          group("advanced", advancedItems),
          group("momentum", momentumItems),
          group("volatility", volatilityItems),
        ]
      : []),
  ];

  return groups.filter((value): value is IndicatorPanelReadoutGroup => Boolean(value));
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

export function buildTrendOverlayIndicators(
  bars: VolumeProfileBarLike[],
  options: {
    sarStep?: number;
    sarMaxStep?: number;
    bbiPeriods?: number[];
    biasPeriod?: number;
    dmaFast?: number;
    dmaSlow?: number;
    dmaSignal?: number;
  } = {},
): TrendOverlayIndicatorSnapshot[] {
  const normalized = bars.map(normalizeAdvancedBar);
  const closeValues = normalized.map((bar) => bar?.close ?? null);
  const sarValues = buildSarValues(normalized, {
    step: clampNumber(options.sarStep ?? 0.02, 0.005, 0.08),
    maxStep: clampNumber(options.sarMaxStep ?? 0.2, 0.02, 0.4),
  });
  const bbiPeriods = normalizeBbiPeriods(options.bbiPeriods);
  const biasPeriod = clampInteger(options.biasPeriod ?? 6, 2, 80);
  const dmaFast = clampInteger(options.dmaFast ?? 10, 2, 80);
  const dmaSlow = Math.max(clampInteger(options.dmaSlow ?? 50, 3, 160), dmaFast + 1);
  const dmaSignal = clampInteger(options.dmaSignal ?? 10, 2, 80);
  const dmaValues: Array<number | null> = [];

  return normalized.map((bar, index) => {
    const bbiParts = bbiPeriods.map((period) => movingAverageAt(closeValues, period, index));
    const biasMa = movingAverageAt(closeValues, biasPeriod, index);
    const fastMa = movingAverageAt(closeValues, dmaFast, index);
    const slowMa = movingAverageAt(closeValues, dmaSlow, index);
    const dma = fastMa != null && slowMa != null ? fastMa - slowMa : null;
    dmaValues.push(dma);
    return {
      sar: sarValues[index] ?? null,
      bbi: bbiParts.every(isFiniteNumber) ? averageNumbers(bbiParts) : null,
      bias: bar && biasMa ? ((bar.close - biasMa) / biasMa) * 100 : null,
      dma,
      ama: movingAverageAt(dmaValues, dmaSignal, index),
    };
  });
}

export function buildVolumeMomentumIndicators(
  bars: VolumeProfileBarLike[],
  options: {
    period?: number;
    rocPeriod?: number;
    trixPeriod?: number;
    trixSignal?: number;
  } = {},
): VolumeMomentumIndicatorSnapshot[] {
  const normalized = bars.map(normalizeAdvancedBar);
  const period = clampInteger(options.period ?? 26, 2, 120);
  const rocPeriod = clampInteger(options.rocPeriod ?? 12, 2, 120);
  const trixPeriod = clampInteger(options.trixPeriod ?? 12, 2, 80);
  const trixSignal = clampInteger(options.trixSignal ?? 9, 2, 80);
  const closeValues = normalized.map((bar) => bar?.close ?? null);
  const trixValues = buildTrixValues(closeValues, trixPeriod);

  return normalized.map((bar, index) => ({
    vr: bar ? buildVolumeRatioAt(normalized, period, index) : null,
    mfi: bar ? buildMoneyFlowIndexAt(normalized, period, index) : null,
    roc: buildRateOfChangeAt(closeValues, rocPeriod, index),
    trix: trixValues[index] ?? null,
    trma: movingAverageAt(trixValues, trixSignal, index),
  }));
}

export function buildVolatilityVolumeIndicators(
  bars: VolumeProfileBarLike[],
  options: { atrPeriod?: number } = {},
): VolatilityVolumeIndicatorSnapshot[] {
  const normalized = bars.map(normalizeAdvancedBar);
  const atrPeriod = clampInteger(options.atrPeriod ?? 14, 2, 80);
  const trueRanges = normalized.map((bar, index) => {
    if (!bar) return null;
    const previous = normalized[index - 1];
    if (!previous) return bar.high - bar.low;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previous.close),
      Math.abs(bar.low - previous.close),
    );
  });
  let obv = 0;

  return normalized.map((bar, index) => {
    const previous = normalized[index - 1];
    if (!bar) return { atr: null, obv: null };
    if (index > 0 && previous) {
      if (bar.close > previous.close) obv += bar.volume;
      else if (bar.close < previous.close) obv -= bar.volume;
    }

    const rangeWindow = trueRanges.slice(index - atrPeriod + 1, index + 1);
    return {
      atr: rangeWindow.length === atrPeriod && rangeWindow.every(isFiniteNumber)
        ? averageNumbers(rangeWindow)
        : null,
      obv,
    };
  });
}

export function buildVisiblePriceExtrema(bars: PriceExtremaBarLike[]): VisiblePriceExtremaSnapshot | null {
  const usableBars = bars
    .map(normalizePriceExtremaBar)
    .filter((bar): bar is NonNullable<ReturnType<typeof normalizePriceExtremaBar>> => Boolean(bar));
  if (usableBars.length === 0) return null;

  const highBar = usableBars.reduce((winner, bar) => (bar.high > winner.high ? bar : winner), usableBars[0]);
  const lowBar = usableBars.reduce((winner, bar) => (bar.low < winner.low ? bar : winner), usableBars[0]);

  return {
    high: highBar.high,
    highDate: highBar.date,
    highLabel: highBar.label,
    highIndex: highBar.index,
    low: lowBar.low,
    lowDate: lowBar.date,
    lowLabel: lowBar.label,
    lowIndex: lowBar.index,
    rangePct: lowBar.low > 0 ? ((highBar.high - lowBar.low) / lowBar.low) * 100 : null,
  };
}

export function buildFibonacciRetracementLevels(
  extrema: VisiblePriceExtremaSnapshot | null | undefined,
  ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
): FibonacciRetracementLevel[] {
  if (!extrema || !isFiniteNumber(extrema.high) || !isFiniteNumber(extrema.low) || extrema.high <= extrema.low) {
    return [];
  }

  const span = extrema.high - extrema.low;
  return ratios
    .filter((ratio) => isFiniteNumber(ratio) && ratio >= 0 && ratio <= 1)
    .map((ratio) => ({
      key: `fib-${ratio}`,
      ratio,
      label: formatFibonacciRatioLabel(ratio),
      price: extrema.high - span * ratio,
      high: extrema.high,
      low: extrema.low,
    }));
}

export function buildSupportResistanceLevels(
  bars: PriceExtremaBarLike[],
  options: {
    currentPrice?: number | null;
    maxPerSide?: number;
    minDistancePct?: number;
    swingWindow?: number;
  } = {},
): SupportResistanceLevel[] {
  const normalized = bars
    .map(normalizeSupportResistanceBar)
    .filter((bar): bar is NonNullable<ReturnType<typeof normalizeSupportResistanceBar>> => Boolean(bar));
  if (normalized.length === 0) return [];

  const swingWindow = clampInteger(options.swingWindow ?? 2, 1, 8);
  if (normalized.length < swingWindow * 2 + 1) return [];

  const minDistancePct = Math.max(0.1, Number(options.minDistancePct ?? 1.2));
  const maxPerSide = clampInteger(options.maxPerSide ?? 3, 1, 6);
  const currentPrice = isFiniteNumber(options.currentPrice)
    ? Number(options.currentPrice)
    : normalized[normalized.length - 1]?.close ?? null;
  const pivots: Array<{
    pivotType: "high" | "low";
    price: number;
    index: number;
    label: string;
    volume: number;
  }> = [];

  normalized.forEach((bar, index) => {
    if (index < swingWindow || index > normalized.length - swingWindow - 1) return;
    const left = normalized.slice(index - swingWindow, index);
    const right = normalized.slice(index + 1, index + swingWindow + 1);
    const neighbours = [...left, ...right];
    if (neighbours.length !== swingWindow * 2) return;
    const isSwingHigh = neighbours.every((item) => bar.high > item.high);
    const isSwingLow = neighbours.every((item) => bar.low < item.low);
    if (isSwingHigh) {
      pivots.push({ pivotType: "high", price: bar.high, index: bar.index, label: bar.label, volume: bar.volume });
    }
    if (isSwingLow) {
      pivots.push({ pivotType: "low", price: bar.low, index: bar.index, label: bar.label, volume: bar.volume });
    }
  });

  if (pivots.length === 0) return [];

  const clusters = pivots
    .sort((left, right) => left.price - right.price)
    .reduce<Array<{
      price: number;
      priceSum: number;
      touches: number;
      startIndex: number;
      lastIndex: number;
      startLabel: string;
      lastLabel: string;
      volume: number;
    }>>((acc, pivot) => {
      const existing = acc.find((cluster) =>
        Math.abs(pivot.price - cluster.price) / Math.max(currentPrice ?? cluster.price, 0.000001) * 100 <= minDistancePct,
      );
      if (!existing) {
        acc.push({
          price: pivot.price,
          priceSum: pivot.price,
          touches: 1,
          startIndex: pivot.index,
          lastIndex: pivot.index,
          startLabel: pivot.label,
          lastLabel: pivot.label,
          volume: pivot.volume,
        });
        return acc;
      }

      existing.priceSum += pivot.price;
      existing.touches += 1;
      existing.price = existing.priceSum / existing.touches;
      existing.volume += pivot.volume;
      if (pivot.index < existing.startIndex) {
        existing.startIndex = pivot.index;
        existing.startLabel = pivot.label;
      }
      if (pivot.index > existing.lastIndex) {
        existing.lastIndex = pivot.index;
        existing.lastLabel = pivot.label;
      }
      return acc;
    }, []);

  const levels = clusters.map((cluster): SupportResistanceLevel => {
    const distancePct = currentPrice && currentPrice > 0 ? ((cluster.price - currentPrice) / currentPrice) * 100 : null;
    const type: SupportResistanceLevelType = currentPrice == null || cluster.price <= currentPrice ? "support" : "resistance";
    return {
      key: `${type}-${cluster.price.toFixed(4)}-${cluster.startIndex}-${cluster.lastIndex}`,
      type,
      label: type === "support" ? "自动支撑" : "自动压力",
      price: cluster.price,
      touches: cluster.touches,
      strength: cluster.touches * 100 + cluster.volume / 1000 + cluster.lastIndex / normalized.length,
      startIndex: cluster.startIndex,
      lastIndex: cluster.lastIndex,
      startLabel: cluster.startLabel,
      lastLabel: cluster.lastLabel,
      distancePct,
      volume: cluster.volume,
    };
  });

  const supports = levels
    .filter((level) => level.type === "support")
    .sort((left, right) => right.price - left.price || right.strength - left.strength)
    .slice(0, maxPerSide);
  const resistances = levels
    .filter((level) => level.type === "resistance")
    .sort((left, right) => left.price - right.price || right.strength - left.strength)
    .slice(0, maxPerSide);

  return [...supports, ...resistances];
}

export function buildVolumeProfileLevelAnnotations(profile: VolumeProfileModel): VolumeProfileLevelAnnotation[] {
  const candidates: Array<{ key: VolumeProfileLevelKey; label: string; bin: VolumeProfileBin | null }> = [
    { key: "poc", label: "峰值筹码", bin: profile.pointOfControl },
    { key: "support", label: "筹码支撑", bin: profile.supportBin },
    { key: "resistance", label: "筹码压力", bin: profile.resistanceBin },
  ];

  return candidates.flatMap(({ key, label, bin }) => {
    if (!bin || !isFiniteNumber(bin.mid) || bin.volume <= 0) return [];
    return [{
      key,
      label,
      price: bin.mid,
      low: bin.low,
      high: bin.high,
      percent: bin.percent,
      volume: bin.volume,
      amount: bin.amount,
    }];
  });
}

export function buildPriceGapAnnotations(
  bars: PriceExtremaBarLike[],
  options: { minGapPct?: number } = {},
): PriceGapAnnotation[] {
  const normalized = bars.map(normalizePriceGapBar);
  const minGapPct = Math.max(0, Number(options.minGapPct ?? 0));
  return normalized.flatMap((bar, index) => {
    if (!bar || index === 0) return [];
    const previous = normalized[index - 1];
    if (!previous) return [];

    const gap =
      bar.low > previous.high
        ? { direction: "up" as const, lowPrice: previous.high, highPrice: bar.low }
        : bar.high < previous.low
          ? { direction: "down" as const, lowPrice: bar.high, highPrice: previous.low }
          : null;
    if (!gap) return [];

    const gapPct = previous.close > 0 ? ((gap.highPrice - gap.lowPrice) / previous.close) * 100 : null;
    if (gapPct != null && Math.abs(gapPct) < minGapPct) return [];

    return [{
      key: `${gap.direction}-${index}`,
      direction: gap.direction,
      startIndex: previous.index,
      endIndex: bar.index,
      startDate: previous.date,
      endDate: bar.date,
      startLabel: previous.label,
      endLabel: bar.label,
      lowPrice: gap.lowPrice,
      highPrice: gap.highPrice,
      gapPct,
    }];
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

function normalizePriceExtremaBar(bar: PriceExtremaBarLike, index: number) {
  const close = Number(bar.close ?? bar.open ?? bar.high ?? bar.low);
  const open = Number(bar.open ?? close);
  const high = Number(bar.high ?? Math.max(open, close));
  const low = Number(bar.low ?? Math.min(open, close));
  if (![open, high, low, close].every(isFiniteNumber)) return null;
  const date = String(bar.date || index);
  return {
    index,
    date,
    label: String(bar.period_label || bar.date || index),
    high: Math.max(high, low, open, close),
    low: Math.min(high, low, open, close),
  };
}

function normalizePriceGapBar(bar: PriceExtremaBarLike, index: number) {
  const close = Number(bar.close ?? bar.open ?? bar.high ?? bar.low);
  const open = Number(bar.open ?? close);
  const high = Number(bar.high ?? Math.max(open, close));
  const low = Number(bar.low ?? Math.min(open, close));
  if (![open, high, low, close].every(isFiniteNumber)) return null;
  const date = String(bar.date || index);
  return {
    index,
    date,
    label: String(bar.period_label || bar.date || index),
    high: Math.max(high, low, open, close),
    low: Math.min(high, low, open, close),
    close,
  };
}

function normalizeSupportResistanceBar(bar: PriceExtremaBarLike, index: number) {
  const close = Number(bar.close ?? bar.open ?? bar.high ?? bar.low);
  const open = Number(bar.open ?? close);
  const high = Number(bar.high ?? Math.max(open, close));
  const low = Number(bar.low ?? Math.min(open, close));
  const volume = Number(bar.volume ?? 0);
  if (![open, high, low, close, volume].every(isFiniteNumber)) return null;
  const date = String(bar.date || index);
  return {
    index,
    date,
    label: String(bar.period_label || bar.date || index),
    high: Math.max(high, low, open, close),
    low: Math.min(high, low, open, close),
    close,
    volume: Math.max(volume, 0),
  };
}

function formatFibonacciRatioLabel(ratio: number) {
  if (ratio === 0 || ratio === 0.5 || ratio === 1) return `${(ratio * 100).toFixed(0)}%`;
  return `${(ratio * 100).toFixed(1)}%`;
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

function buildSarValues(
  bars: Array<ReturnType<typeof normalizeAdvancedBar>>,
  options: { step: number; maxStep: number },
) {
  if (bars.length === 0) return [];
  const first = bars[0];
  if (!first) return bars.map(() => null);

  const values: Array<number | null> = [first.close >= first.open ? first.low : first.high];
  let rising = first.close >= first.open;
  let extreme = rising ? first.high : first.low;
  let acceleration = options.step;

  for (let index = 1; index < bars.length; index += 1) {
    const current = bars[index];
    const previous = bars[index - 1];
    const previousSar = values[index - 1];
    if (!current || !previous || previousSar == null) {
      values.push(null);
      continue;
    }

    let nextSar = previousSar + acceleration * (extreme - previousSar);
    if (rising) {
      nextSar = Math.min(nextSar, previous.low);
      if (current.low < nextSar) {
        rising = false;
        nextSar = extreme;
        extreme = current.low;
        acceleration = options.step;
      } else if (current.high > extreme) {
        extreme = current.high;
        acceleration = Math.min(options.maxStep, acceleration + options.step);
      }
    } else {
      nextSar = Math.max(nextSar, previous.high);
      if (current.high > nextSar) {
        rising = true;
        nextSar = extreme;
        extreme = current.high;
        acceleration = options.step;
      } else if (current.low < extreme) {
        extreme = current.low;
        acceleration = Math.min(options.maxStep, acceleration + options.step);
      }
    }

    values.push(nextSar);
  }

  return values;
}

function normalizeBbiPeriods(value: number[] | undefined) {
  const periods = Array.isArray(value) && value.length >= 4 ? value.slice(0, 4) : [3, 6, 12, 24];
  return periods.map((period, index) => clampInteger(period, index === 0 ? 2 : 3, 160));
}

function buildVolumeRatioAt(
  bars: Array<ReturnType<typeof normalizeAdvancedBar>>,
  period: number,
  index: number,
) {
  const start = index - period + 1;
  if (start < 1) return null;
  let upVolume = 0;
  let downVolume = 0;
  let flatVolume = 0;
  for (let cursor = start; cursor <= index; cursor += 1) {
    const current = bars[cursor];
    const previous = bars[cursor - 1];
    if (!current || !previous) return null;
    if (current.close > previous.close) upVolume += current.volume;
    else if (current.close < previous.close) downVolume += current.volume;
    else flatVolume += current.volume;
  }
  const denominator = downVolume + flatVolume / 2;
  return denominator > 0 ? ((upVolume + flatVolume / 2) / denominator) * 100 : null;
}

function buildMoneyFlowIndexAt(
  bars: Array<ReturnType<typeof normalizeAdvancedBar>>,
  period: number,
  index: number,
) {
  const start = index - period + 1;
  if (start < 1) return null;
  let positiveFlow = 0;
  let negativeFlow = 0;
  for (let cursor = start; cursor <= index; cursor += 1) {
    const current = bars[cursor];
    const previous = bars[cursor - 1];
    if (!current || !previous) return null;
    const typicalPrice = (current.high + current.low + current.close) / 3;
    const previousTypicalPrice = (previous.high + previous.low + previous.close) / 3;
    const moneyFlow = typicalPrice * current.volume;
    if (typicalPrice > previousTypicalPrice) positiveFlow += moneyFlow;
    else if (typicalPrice < previousTypicalPrice) negativeFlow += moneyFlow;
  }
  if (negativeFlow === 0 && positiveFlow === 0) return 50;
  if (negativeFlow === 0) return 100;
  const moneyRatio = positiveFlow / negativeFlow;
  return 100 - 100 / (1 + moneyRatio);
}

function buildRateOfChangeAt(values: Array<number | null>, period: number, index: number) {
  const previous = values[index - period];
  const current = values[index];
  return isFiniteNumber(current) && isFiniteNumber(previous) && previous !== 0
    ? ((current - previous) / previous) * 100
    : null;
}

function buildTrixValues(values: Array<number | null>, period: number) {
  const firstEma = emaNullableValues(values, period);
  const secondEma = emaNullableValues(firstEma, period);
  const thirdEma = emaNullableValues(secondEma, period);
  return thirdEma.map((value, index) => {
    const previous = thirdEma[index - 1];
    return isFiniteNumber(value) && isFiniteNumber(previous) && previous !== 0
      ? ((value - previous) / previous) * 100
      : null;
  });
}

function emaNullableValues(values: Array<number | null>, period: number) {
  const multiplier = 2 / (period + 1);
  let previousEma: number | null = null;
  return values.map((value) => {
    if (!isFiniteNumber(value)) return null;
    previousEma = previousEma == null ? value : value * multiplier + previousEma * (1 - multiplier);
    return previousEma;
  });
}

function movingAverageAt(values: Array<number | null>, period: number, index: number) {
  const start = index - period + 1;
  if (start < 0) return null;
  const window = values.slice(start, index + 1).filter(isFiniteNumber);
  return window.length === period ? averageNumbers(window) : null;
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

function clampNumber(value: number, min: number, max: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return min;
  return Math.min(max, Math.max(min, next));
}

function clampInteger(value: number, min: number, max: number) {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next)) return min;
  return Math.min(max, Math.max(min, next));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
