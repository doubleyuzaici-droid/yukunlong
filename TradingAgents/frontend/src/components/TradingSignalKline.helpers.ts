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

export interface MeasuredRangeBarLike extends PriceExtremaBarLike {
  index?: number | null;
}

export type PriceGapDirection = "up" | "down";
export type CandlestickPatternTone = "good" | "risk" | "neutral";
export type CandlestickPatternType = "doji" | "hammer" | "bullish-engulfing" | "bearish-engulfing";
export type TechnicalIndicatorEventTone = "good" | "risk";
export type TechnicalIndicatorEventType =
  | "ma-golden-cross"
  | "ma-death-cross"
  | "macd-golden-cross"
  | "macd-death-cross"
  | "boll-breakout-up"
  | "boll-breakout-down";
export type TechnicalDivergenceTone = "good" | "risk";
export type TechnicalDivergenceIndicator = "rsi" | "macd";
export type TechnicalDivergenceType =
  | "rsi-bullish-divergence"
  | "rsi-bearish-divergence"
  | "macd-bullish-divergence"
  | "macd-bearish-divergence";
export type VolumeSignalTone = "good" | "risk" | "neutral";
export type VolumeSignalType = "volume-surge-up" | "volume-surge-down" | "volume-dry-up";
export type TrendRegimeTone = "good" | "risk" | "neutral";
export type TrendRegimeType = "bullish" | "bearish" | "neutral";
export type PriceStructureTrendLineTone = "good" | "risk";
export type PriceStructureTrendLineType = "ascending-support" | "descending-resistance";

export interface TechnicalIndicatorBarLike extends PriceExtremaBarLike {
  maFast?: number | null;
  maSlow?: number | null;
  dif?: number | null;
  dea?: number | null;
  bollUpper?: number | null;
  bollLower?: number | null;
}

export interface TechnicalDivergenceBarLike extends PriceExtremaBarLike {
  rsi14?: number | null;
  macd?: number | null;
}

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

export interface CandlestickPatternAnnotation {
  key: string;
  type: CandlestickPatternType;
  label: string;
  tone: CandlestickPatternTone;
  index: number;
  date: string;
  dateLabel: string;
  price: number;
}

export interface TechnicalIndicatorAnnotation {
  key: string;
  type: TechnicalIndicatorEventType;
  label: string;
  tone: TechnicalIndicatorEventTone;
  index: number;
  date: string;
  dateLabel: string;
  price: number;
}

export interface TechnicalDivergenceAnnotation {
  key: string;
  type: TechnicalDivergenceType;
  indicator: TechnicalDivergenceIndicator;
  label: string;
  tone: TechnicalDivergenceTone;
  startIndex: number;
  index: number;
  date: string;
  dateLabel: string;
  startDate: string;
  startLabel: string;
  startPrice: number;
  price: number;
  startIndicator: number;
  endIndicator: number;
}

export interface VolumeSignalAnnotation {
  key: string;
  type: VolumeSignalType;
  label: string;
  tone: VolumeSignalTone;
  index: number;
  date: string;
  dateLabel: string;
  price: number;
  volume: number;
  averageVolume: number;
  volumeRatio: number;
  changePct: number | null;
}

export interface TrendRegimeBarLike extends PriceExtremaBarLike {
  maFast?: number | null;
  maMid?: number | null;
  maSlow?: number | null;
}

export interface TrendRegimeBand {
  key: string;
  type: TrendRegimeType;
  label: string;
  tone: TrendRegimeTone;
  startIndex: number;
  endIndex: number;
  startDate: string;
  endDate: string;
  startLabel: string;
  endLabel: string;
  bars: number;
}

export type KlineEventSummaryTone = "good" | "risk" | "neutral";
export type KlineEventSummaryKey = "technical" | "divergence" | "volume" | "pattern" | "gap" | "trend";

export interface KlineEventSummaryItem {
  key: KlineEventSummaryKey;
  label: string;
  value: string;
  detail: string;
  tone: KlineEventSummaryTone;
  count: number;
}

export interface KlineEventSummaryInput {
  technicalEvents?: TechnicalIndicatorAnnotation[];
  divergenceEvents?: TechnicalDivergenceAnnotation[];
  volumeEvents?: VolumeSignalAnnotation[];
  patterns?: CandlestickPatternAnnotation[];
  gaps?: PriceGapAnnotation[];
  trendBands?: TrendRegimeBand[];
}

export interface PriceStructureTrendLine {
  key: string;
  type: PriceStructureTrendLineType;
  label: string;
  tone: PriceStructureTrendLineTone;
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
  anchorStartIndex: number;
  anchorEndIndex: number;
  anchorStartPrice: number;
  anchorEndPrice: number;
  anchorStartLabel: string;
  anchorEndLabel: string;
  slopePct: number;
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

export interface MeasuredRangeStats {
  startIndex: number;
  endIndex: number;
  startLabel: string;
  endLabel: string;
  startClose: number;
  endClose: number;
  bars: number;
  barCount: number;
  change: number;
  changePct: number | null;
  high: number;
  highIndex: number;
  highLabel: string;
  low: number;
  lowIndex: number;
  lowLabel: string;
  amplitudePct: number | null;
  maxDrawdownPct: number | null;
  maxRunupPct: number | null;
  totalVolume: number;
  averageVolume: number;
  totalAmount: number;
}

export type ManualDrawingType = "horizontal" | "trend";

export interface ManualDrawingAnchor {
  date: string;
  label?: string | null;
  price: number;
}

export interface ManualDrawing {
  id: string;
  type: ManualDrawingType;
  start: ManualDrawingAnchor;
  end?: ManualDrawingAnchor | null;
}

export interface ManualDrawingCandleLike {
  date?: string | null;
  periodLabel?: string | null;
  period_label?: string | null;
  x?: number | null;
}

export interface ManualDrawingChartBounds {
  plotLeft: number;
  plotRight: number;
  priceTop: number;
  priceBottom: number;
  priceMin: number | null;
  priceMax: number | null;
  priceAxisMode?: PriceAxisMode | null;
  priceAxisBase?: number | null;
  priceAxisMin?: number | null;
  priceAxisMax?: number | null;
}

export interface ManualDrawingGeometry {
  id: string;
  type: ManualDrawingType;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  labelX: number;
  labelY: number;
  label: string;
  startLabel: string;
  endLabel: string;
  startPrice: number;
  endPrice: number;
}

export type PriceAxisMode = "price" | "percent";
export type KlineRenderMode = "candle" | "line" | "ohlc";

export interface PriceAxisScale {
  mode: PriceAxisMode;
  basePrice: number | null;
  min: number;
  max: number;
  top: number;
  bottom: number;
}

export type PriceAdjustmentMode = "none" | "forward" | "backward";

export interface PriceAdjustmentScale {
  mode: PriceAdjustmentMode;
  baseFactor: number | null;
  firstFactor: number | null;
  latestFactor: number | null;
}

export interface PriceAdjustedBarsResult<T> extends PriceAdjustmentScale {
  bars: T[];
  hasAdjustment: boolean;
}

export interface PriceAdjustmentBarLike {
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  adj_factor?: number | null;
}

const MANUAL_DRAWING_STORAGE_PREFIX = "tradingagents.tradeSignalKline.drawings";

export type ChartPreferencePresetKey = "basic" | "trend" | "oscillator" | "volume" | "structure" | "full";
export type ChartPreferenceName =
  | "ma"
  | "ema"
  | "boll"
  | "vwap"
  | "levels"
  | "limitLines"
  | "signals"
  | "events"
  | "relative"
  | "profile"
  | "fundFlow"
  | "ichimoku"
  | "fibonacci"
  | "supportResistance"
  | "trendLines"
  | "patterns"
  | "indicatorSignals"
  | "divergences"
  | "volumeSignals"
  | "trendRegime"
  | "sar"
  | "bbi"
  | "volume"
  | "macd"
  | "rsi"
  | "kdj"
  | "advanced"
  | "momentum"
  | "biasDma"
  | "volumeMomentum"
  | "volatility"
  | "subCharts"
  | "measure";

export interface ChartPreferencePreset {
  key: ChartPreferencePresetKey;
  label: string;
  description: string;
  values: Record<ChartPreferenceName, boolean>;
}

export type ChartParameterPresetKey = "standard" | "short" | "swing" | "long";
export type ChartParameterName =
  | "maFast"
  | "maMid"
  | "maSlow"
  | "bollPeriod"
  | "bollMultiplier"
  | "macdFast"
  | "macdSlow"
  | "macdSignal"
  | "rsiPeriod"
  | "kdjPeriod"
  | "crPeriod"
  | "emvPeriod"
  | "momentumPeriod"
  | "biasPeriod"
  | "dmaFast"
  | "dmaSlow"
  | "dmaSignal"
  | "volumeMomentumPeriod"
  | "rocPeriod"
  | "trixPeriod"
  | "trixSignal"
  | "atrPeriod";

export interface ChartParameterPreset {
  key: ChartParameterPresetKey;
  label: string;
  description: string;
  values: Record<ChartParameterName, number>;
}

const BASE_CHART_PRESET_VALUES: Record<ChartPreferenceName, boolean> = {
  ma: true,
  ema: false,
  boll: true,
  vwap: false,
  levels: true,
  limitLines: true,
  signals: true,
  events: true,
  relative: false,
  profile: true,
  fundFlow: true,
  ichimoku: false,
  fibonacci: false,
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
  measure: false,
};

export const CHART_PREFERENCE_PRESETS: ChartPreferencePreset[] = [
  {
    key: "basic",
    label: "基础",
    description: "保留均线、BOLL、成交量与MACD，适合快速看价量。",
    values: {
      ...BASE_CHART_PRESET_VALUES,
      ema: false,
      vwap: false,
      relative: false,
      profile: false,
      fibonacci: false,
      supportResistance: false,
      trendLines: false,
      patterns: false,
      indicatorSignals: false,
      divergences: false,
      volumeSignals: false,
      trendRegime: false,
      sar: false,
      bbi: false,
      rsi: false,
      kdj: false,
      advanced: false,
      momentum: false,
      biasDma: false,
      volumeMomentum: false,
      volatility: false,
      subCharts: false,
    },
  },
  {
    key: "trend",
    label: "趋势",
    description: "突出均线、EMA、BOLL、SAR/BBI、趋势带与结构趋势线。",
    values: {
      ...BASE_CHART_PRESET_VALUES,
      ema: true,
      ichimoku: true,
      vwap: false,
      relative: false,
      profile: false,
      fibonacci: false,
      patterns: false,
      divergences: false,
      volumeSignals: false,
      rsi: false,
      kdj: false,
      advanced: false,
      momentum: false,
      biasDma: false,
      volumeMomentum: false,
      volatility: false,
      subCharts: true,
    },
  },
  {
    key: "oscillator",
    label: "震荡",
    description: "聚焦MACD、RSI、KDJ、CCI/WR、BIAS/DMA和背离。",
    values: {
      ...BASE_CHART_PRESET_VALUES,
      ema: false,
      vwap: false,
      relative: false,
      profile: false,
      fibonacci: false,
      supportResistance: false,
      trendLines: false,
      patterns: false,
      volumeSignals: false,
      trendRegime: false,
      sar: false,
      bbi: false,
      advanced: false,
      volumeMomentum: false,
      volatility: false,
      subCharts: true,
    },
  },
  {
    key: "volume",
    label: "量价",
    description: "突出成交量、资金流、量价异动、筹码分布、VWAP、VR/MFI/TRIX与OBV。",
    values: {
      ...BASE_CHART_PRESET_VALUES,
      ema: false,
      vwap: true,
      relative: false,
      fibonacci: false,
      supportResistance: false,
      trendLines: false,
      patterns: false,
      divergences: false,
      trendRegime: false,
      sar: false,
      bbi: false,
      rsi: false,
      kdj: false,
      advanced: false,
      momentum: false,
      biasDma: false,
      volatility: true,
      subCharts: true,
    },
  },
  {
    key: "structure",
    label: "结构",
    description: "打开支阻、趋势线、斐波、形态、背离和筹码价位。",
    values: {
      ...BASE_CHART_PRESET_VALUES,
      ema: false,
      vwap: false,
      relative: false,
      fibonacci: true,
      supportResistance: true,
      trendLines: true,
      patterns: true,
      indicatorSignals: true,
      divergences: true,
      volumeSignals: false,
      sar: false,
      bbi: false,
      rsi: false,
      kdj: false,
      advanced: false,
      momentum: false,
      biasDma: false,
      volumeMomentum: false,
      volatility: false,
      subCharts: false,
    },
  },
  {
    key: "full",
    label: "全量",
    description: "打开全部主图与副图层，用于细查或验收。",
    values: {
      ...BASE_CHART_PRESET_VALUES,
      ema: true,
      ichimoku: true,
      vwap: true,
      relative: true,
      fibonacci: true,
      subCharts: true,
    },
  },
];

const STANDARD_CHART_PARAMETER_VALUES: Record<ChartParameterName, number> = {
  maFast: 5,
  maMid: 20,
  maSlow: 60,
  bollPeriod: 20,
  bollMultiplier: 2,
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

export const CHART_PARAMETER_PRESETS: ChartParameterPreset[] = [
  {
    key: "standard",
    label: "默认",
    description: "经典行情软件参数，适合日常技术面复核。",
    values: {
      ...STANDARD_CHART_PARAMETER_VALUES,
    },
  },
  {
    key: "short",
    label: "短线",
    description: "更快的均线、MACD、RSI与量价周期，适合短线节奏。",
    values: {
      ...STANDARD_CHART_PARAMETER_VALUES,
      maFast: 3,
      maMid: 10,
      maSlow: 30,
      bollPeriod: 14,
      macdFast: 6,
      macdSlow: 13,
      macdSignal: 5,
      rsiPeriod: 7,
      crPeriod: 13,
      emvPeriod: 7,
      momentumPeriod: 10,
      biasPeriod: 5,
      dmaFast: 5,
      dmaSlow: 20,
      dmaSignal: 5,
      volumeMomentumPeriod: 13,
      rocPeriod: 6,
      trixPeriod: 6,
      trixSignal: 5,
      atrPeriod: 10,
    },
  },
  {
    key: "swing",
    label: "波段",
    description: "拉长均线与震荡周期，兼顾趋势确认和波段择时。",
    values: {
      ...STANDARD_CHART_PARAMETER_VALUES,
      maFast: 10,
      maMid: 30,
      maSlow: 120,
      bollMultiplier: 2.2,
      kdjPeriod: 14,
      momentumPeriod: 20,
      biasPeriod: 10,
    },
  },
  {
    key: "long",
    label: "长线",
    description: "强调中长期趋势过滤，降低短期噪音。",
    values: {
      ...STANDARD_CHART_PARAMETER_VALUES,
      maFast: 20,
      maMid: 60,
      maSlow: 120,
      bollPeriod: 30,
      macdFast: 19,
      macdSlow: 39,
      rsiPeriod: 21,
      kdjPeriod: 14,
      crPeriod: 42,
      emvPeriod: 21,
      momentumPeriod: 28,
      biasPeriod: 24,
      dmaFast: 20,
      dmaSlow: 100,
      dmaSignal: 20,
      volumeMomentumPeriod: 42,
      rocPeriod: 24,
      trixPeriod: 18,
      trixSignal: 12,
      atrPeriod: 21,
    },
  },
];

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

export interface LimitPriceBarLike {
  x?: number | null;
  limit_up?: number | null;
  limit_down?: number | null;
}

export interface LimitPriceLinePoint {
  x: number;
  y: number;
  price: number;
}

export interface LimitPriceLines {
  upLine: string;
  downLine: string;
  latestUp: LimitPriceLinePoint | null;
  latestDown: LimitPriceLinePoint | null;
  values: number[];
}

export interface ChartClientPointMappingInput {
  clientX: number;
  clientY: number;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  viewBoxWidth: number;
  viewBoxHeight: number;
}

export function mapClientPointToChartViewBox({
  clientX,
  clientY,
  rect,
  viewBoxWidth,
  viewBoxHeight,
}: ChartClientPointMappingInput) {
  const width = isFiniteNumber(rect.width) && rect.width > 0 ? rect.width : 1;
  const height = isFiniteNumber(rect.height) && rect.height > 0 ? rect.height : 1;
  return {
    x: ((clientX - rect.left) / width) * viewBoxWidth,
    y: ((clientY - rect.top) / height) * viewBoxHeight,
  };
}

export type LimitCandleState = "limit-up" | "limit-down" | "suspended";

export interface LimitCandleStateBarLike {
  close?: number | null;
  volume?: number | null;
  amount?: number | null;
  limit_up?: number | null;
  limit_down?: number | null;
  is_suspended?: boolean | number | string | null;
  is_limit_up?: boolean | number | string | null;
  is_limit_down?: boolean | number | string | null;
}

export interface KlineHoverMetrics {
  averagePrice: number | null;
  limitUpDistancePct: number | null;
  limitDownDistancePct: number | null;
  status: LimitCandleState | null;
  statusLabel: string;
}

export type FundFlowOverlaySeriesKey = "main_net_inflow" | "large_net_inflow" | "northbound_net_inflow";

export interface FundFlowOverlayRowLike {
  date: string;
  main_net_inflow?: number | null;
  large_net_inflow?: number | null;
  northbound_net_inflow?: number | null;
}

export interface FundFlowOverlayCandleLike {
  date: string;
  x: number;
  width?: number | null;
}

export interface FundFlowOverlayBar {
  key: string;
  date: string;
  type: FundFlowOverlaySeriesKey;
  value: number;
  tone: "positive" | "negative";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FundFlowOverlayGeometry {
  bars: FundFlowOverlayBar[];
  zeroY: number;
  latest: FundFlowOverlayRowLike | null;
}

export type IndicatorThresholdGuideTone = "good" | "risk" | "neutral";

export interface IndicatorThresholdGuideDefinition {
  key: string;
  section: string;
  label: string;
  value?: number | null;
  min: number;
  max: number;
  top: number;
  bottom: number;
  tone?: IndicatorThresholdGuideTone;
}

export interface IndicatorThresholdGuide {
  key: string;
  section: string;
  label: string;
  value: number;
  y: number;
  labelY: number;
  tone: IndicatorThresholdGuideTone;
}

export type OverlayPriceLabelTone = "good" | "risk" | "neutral" | "info";

export interface OverlayPriceLabelDefinition {
  key: string;
  group?: string;
  label: string;
  price?: number | null;
  y?: number | null;
  tone?: OverlayPriceLabelTone;
  priority?: number;
}

export interface OverlayPriceLabel {
  key: string;
  group?: string;
  label: string;
  price: number;
  y: number;
  labelY: number;
  tone: OverlayPriceLabelTone;
  priority?: number;
}

export type IndicatorValueLabelTone = "good" | "risk" | "neutral" | "info";

export interface IndicatorValueLabelDefinition {
  key: string;
  section: string;
  group?: string;
  label: string;
  value?: number | null;
  y?: number | null;
  tone?: IndicatorValueLabelTone;
  priority?: number;
  precision?: number;
  signed?: boolean;
  compact?: boolean;
}

export interface IndicatorValueLabel {
  key: string;
  section: string;
  group?: string;
  label: string;
  value: number;
  y: number;
  labelY: number;
  tone: IndicatorValueLabelTone;
  priority?: number;
  precision?: number;
  signed?: boolean;
  compact?: boolean;
}

export interface KlineRangeNavigator {
  total: number;
  visibleCount: number;
  startIndex: number;
  endIndex: number;
  trackX: number;
  trackWidth: number;
  selectionX: number;
  selectionWidth: number;
  leftRatio: number;
  rightRatio: number;
  label: string;
}

export interface IndicatorBandAreaPoint {
  x?: number | null;
  upperY?: number | null;
  lowerY?: number | null;
}

export interface TrendRibbonAreaPoint {
  x?: number | null;
  fastY?: number | null;
  slowY?: number | null;
  fastValue?: number | null;
  slowValue?: number | null;
}

export interface TrendRibbonAreaSegment {
  key: string;
  tone: "good" | "risk" | "neutral";
  path: string;
  startIndex: number;
  endIndex: number;
}

export interface IchimokuBarLike {
  high?: number | null;
  low?: number | null;
  close?: number | null;
}

export interface IchimokuIndicatorPoint {
  conversion: number | null;
  base: number | null;
  spanA: number | null;
  spanB: number | null;
  lagging: number | null;
}

export function buildLimitPriceLines(
  bars: LimitPriceBarLike[],
  yOf: (price: number) => number | null | undefined,
): LimitPriceLines {
  const toPoint = (bar: LimitPriceBarLike, key: "limit_up" | "limit_down"): LimitPriceLinePoint[] => {
    if (!isFiniteNumber(bar.x) || !isFiniteNumber(bar[key])) return [];
    const y = yOf(bar[key]);
    if (!isFiniteNumber(y)) return [];
    return [{ x: bar.x, y, price: bar[key] }];
  };
  const upPoints = bars.flatMap((bar) => toPoint(bar, "limit_up"));
  const downPoints = bars.flatMap((bar) => toPoint(bar, "limit_down"));
  const toPolyline = (points: LimitPriceLinePoint[]) =>
    points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

  return {
    upLine: toPolyline(upPoints),
    downLine: toPolyline(downPoints),
    latestUp: upPoints.length ? upPoints[upPoints.length - 1] : null,
    latestDown: downPoints.length ? downPoints[downPoints.length - 1] : null,
    values: [...upPoints.map((point) => point.price), ...downPoints.map((point) => point.price)],
  };
}

export function resolveLimitCandleState(
  bar: LimitCandleStateBarLike,
  tolerancePct = 0.0005,
): LimitCandleState | null {
  if (isTruthyFlag(bar.is_suspended)) return "suspended";
  if (isTruthyFlag(bar.is_limit_up) || isPriceNearLimit(bar.close, bar.limit_up, tolerancePct)) {
    return "limit-up";
  }
  if (isTruthyFlag(bar.is_limit_down) || isPriceNearLimit(bar.close, bar.limit_down, tolerancePct)) {
    return "limit-down";
  }
  return null;
}

export function buildKlineHoverMetrics(bar: LimitCandleStateBarLike): KlineHoverMetrics {
  const averagePrice = isFiniteNumber(bar.amount) && isFiniteNumber(bar.volume) && bar.volume > 0
    ? bar.amount / bar.volume
    : null;
  const limitUpDistancePct = isFiniteNumber(bar.close) && bar.close > 0 && isFiniteNumber(bar.limit_up)
    ? bar.limit_up / bar.close - 1
    : null;
  const limitDownDistancePct = isFiniteNumber(bar.close) && bar.close > 0 && isFiniteNumber(bar.limit_down)
    ? bar.limit_down / bar.close - 1
    : null;
  const status = resolveLimitCandleState(bar);
  const statusLabel = status === "limit-up"
    ? "涨停"
    : status === "limit-down"
      ? "跌停"
      : status === "suspended"
        ? "停牌"
        : "普通";
  return {
    averagePrice,
    limitUpDistancePct,
    limitDownDistancePct,
    status,
    statusLabel,
  };
}

export function buildVolumeMovingAverageValues(
  values: Array<number | null | undefined>,
  period: number,
): Array<number | null> {
  return values.map((_, index) => {
    const start = index - period + 1;
    if (start < 0) return null;
    const window = values.slice(start, index + 1).filter(isFiniteNumber);
    return window.length === period ? averageNumbers(window) : null;
  });
}

export function buildFundFlowOverlayGeometry(
  candles: FundFlowOverlayCandleLike[],
  rows: FundFlowOverlayRowLike[],
  options: { top: number; bottom: number },
): FundFlowOverlayGeometry {
  const flowByDate = new Map(rows.map((row) => [row.date, row]));
  const matched = candles.flatMap((candle) => {
    const row = flowByDate.get(candle.date);
    return row ? [{ candle, row }] : [];
  });
  const seriesKeys: FundFlowOverlaySeriesKey[] = ["main_net_inflow", "large_net_inflow", "northbound_net_inflow"];
  const values = matched.flatMap(({ row }) => seriesKeys.map((key) => row[key]).filter(isFiniteNumber));
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)));
  const zeroY = (options.top + options.bottom) / 2;
  const maxHeight = Math.max(1, (options.bottom - options.top) / 2 - 2);
  const bars = matched.flatMap(({ candle, row }) => {
    const width = Math.max(1, Math.min(3.2, Number(candle.width || 6) / 3));
    return seriesKeys.map((key, offsetIndex): FundFlowOverlayBar => {
      const value = isFiniteNumber(row[key]) ? Number(row[key]) : 0;
      const height = Math.max(1, Math.abs(value) / maxAbs * maxHeight);
      return {
        key: `${candle.date}-${key}`,
        date: candle.date,
        type: key,
        value,
        tone: value >= 0 ? "positive" : "negative",
        x: candle.x + (offsetIndex - 1) * (width + 0.4),
        y: value >= 0 ? zeroY - height : zeroY,
        width,
        height,
      };
    });
  });

  return {
    bars,
    zeroY,
    latest: matched.length ? matched[matched.length - 1].row : null,
  };
}

export function buildIndicatorThresholdGuides(
  definitions: IndicatorThresholdGuideDefinition[],
): IndicatorThresholdGuide[] {
  return definitions.flatMap((definition) => {
    if (
      !isFiniteNumber(definition.value) ||
      !isFiniteNumber(definition.min) ||
      !isFiniteNumber(definition.max) ||
      !isFiniteNumber(definition.top) ||
      !isFiniteNumber(definition.bottom) ||
      definition.max === definition.min ||
      definition.value < definition.min ||
      definition.value > definition.max
    ) {
      return [];
    }
    const y = definition.bottom -
      ((definition.value - definition.min) / (definition.max - definition.min)) *
      (definition.bottom - definition.top);
    const top = Math.min(definition.top, definition.bottom);
    const bottom = Math.max(definition.top, definition.bottom);
    return [{
      key: definition.key,
      section: definition.section,
      label: definition.label,
      value: definition.value,
      y: clampNumber(y, top, bottom),
      labelY: clampNumber(y - 4, top + 12, bottom - 4),
      tone: definition.tone ?? "neutral",
    }];
  });
}

export function buildOverlayPriceLabels(
  definitions: OverlayPriceLabelDefinition[],
  options: { top: number; bottom: number; minGap?: number; maxLabels?: number },
): OverlayPriceLabel[] {
  const maxLabels = isFiniteNumber(options.maxLabels)
    ? Math.max(0, Math.floor(options.maxLabels))
    : definitions.length;
  if (maxLabels === 0) return [];

  const top = Math.min(options.top, options.bottom);
  const bottom = Math.max(options.top, options.bottom);
  const topLimit = top + 9;
  const bottomLimit = Math.max(topLimit, bottom - 9);
  const minGap = Math.max(0, options.minGap ?? 16);
  const candidates = definitions
    .map((definition, sourceIndex) => ({ definition, sourceIndex }))
    .filter(({ definition }) => isFiniteNumber(definition.price) && isFiniteNumber(definition.y))
    .sort((left, right) => {
      const leftPriority = left.definition.priority ?? 1_000;
      const rightPriority = right.definition.priority ?? 1_000;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      if (left.definition.y !== right.definition.y) return Number(left.definition.y) - Number(right.definition.y);
      return left.sourceIndex - right.sourceIndex;
    })
    .slice(0, maxLabels)
    .map(({ definition, sourceIndex }) => ({
      key: definition.key,
      group: definition.group,
      label: definition.label,
      price: Number(definition.price),
      y: Number(definition.y),
      labelY: clampNumber(Number(definition.y), topLimit, bottomLimit),
      tone: definition.tone ?? "neutral",
      priority: definition.priority,
      sourceIndex,
    }))
    .sort((left, right) => left.y - right.y || left.sourceIndex - right.sourceIndex);

  if (candidates.length <= 1) {
    return candidates.map(({ sourceIndex: _sourceIndex, ...label }) => label);
  }

  const availableHeight = Math.max(0, bottomLimit - topLimit);
  const effectiveGap = Math.min(minGap, availableHeight / Math.max(1, candidates.length - 1));
  for (let index = 0; index < candidates.length; index += 1) {
    const previous = candidates[index - 1];
    const candidate = candidates[index];
    if (!candidate) continue;
    candidate.labelY = clampNumber(candidate.labelY, topLimit, bottomLimit);
    if (previous) {
      candidate.labelY = Math.max(candidate.labelY, previous.labelY + effectiveGap);
    }
  }
  const last = candidates[candidates.length - 1];
  if (last) last.labelY = Math.min(last.labelY, bottomLimit);
  for (let index = candidates.length - 2; index >= 0; index -= 1) {
    const current = candidates[index];
    const next = candidates[index + 1];
    if (!current || !next) continue;
    current.labelY = Math.min(current.labelY, next.labelY - effectiveGap);
  }
  const first = candidates[0];
  if (first) first.labelY = Math.max(first.labelY, topLimit);
  for (let index = 1; index < candidates.length; index += 1) {
    const previous = candidates[index - 1];
    const candidate = candidates[index];
    if (!previous || !candidate) continue;
    candidate.labelY = clampNumber(Math.max(candidate.labelY, previous.labelY + effectiveGap), topLimit, bottomLimit);
  }

  return candidates.map(({ sourceIndex: _sourceIndex, ...label }) => label);
}

export function buildIndicatorValueLabels(
  definitions: IndicatorValueLabelDefinition[],
  options: { sections: Record<string, IndicatorChartBand | undefined>; minGap?: number; maxPerSection?: number },
): IndicatorValueLabel[] {
  const sectionOrder = Object.keys(options.sections);
  return sectionOrder.flatMap((section) => {
    const bounds = options.sections[section];
    if (!bounds) return [];
    const sectionDefinitions = definitions.filter((definition) => definition.section === section);
    const overlayLabels = buildOverlayPriceLabels(
      sectionDefinitions.map((definition) => ({
        key: definition.key,
        group: definition.group,
        label: definition.label,
        price: definition.value,
        y: definition.y,
        tone: definition.tone,
        priority: definition.priority,
      })),
      {
        bottom: bounds.bottom,
        maxLabels: options.maxPerSection,
        minGap: options.minGap ?? 14,
        top: bounds.top,
      },
    );
    const byKey = new Map(sectionDefinitions.map((definition) => [definition.key, definition]));
    return overlayLabels.map((label) => {
      const definition = byKey.get(label.key);
      return {
        key: label.key,
        section,
        group: label.group,
        label: label.label,
        value: label.price,
        y: label.y,
        labelY: label.labelY,
        tone: label.tone,
        priority: label.priority,
        precision: definition?.precision,
        signed: definition?.signed,
        compact: definition?.compact,
      };
    });
  });
}

export function buildKlineRangeNavigator(options: {
  total: number;
  visibleCount: number;
  rightOffset?: number;
  plotLeft: number;
  plotRight: number;
}): KlineRangeNavigator | null {
  const total = Math.max(0, Math.floor(Number(options.total)));
  const visibleCount = clampInteger(Number(options.visibleCount), 0, total);
  if (total <= 0 || visibleCount <= 0 || visibleCount >= total) return null;

  const trackX = Math.min(options.plotLeft, options.plotRight);
  const trackWidth = Math.max(1, Math.abs(options.plotRight - options.plotLeft));
  const maxOffset = Math.max(0, total - visibleCount);
  const offset = clampInteger(Number(options.rightOffset ?? 0), 0, maxOffset);
  const endExclusive = total - offset;
  const startIndex = clampInteger(endExclusive - visibleCount, 0, Math.max(0, total - 1));
  const endIndex = clampInteger(endExclusive - 1, startIndex, Math.max(0, total - 1));
  const leftRatio = startIndex / total;
  const rightRatio = (endIndex + 1) / total;
  const selectionX = trackX + leftRatio * trackWidth;
  const selectionWidth = Math.max(4, (rightRatio - leftRatio) * trackWidth);

  return {
    total,
    visibleCount,
    startIndex,
    endIndex,
    trackX,
    trackWidth,
    selectionX,
    selectionWidth,
    leftRatio,
    rightRatio,
    label: `${startIndex + 1}-${endIndex + 1} / ${total}`,
  };
}

export function rightOffsetFromKlineNavigatorX(options: {
  x: number;
  total: number;
  visibleCount: number;
  plotLeft: number;
  plotRight: number;
}) {
  const total = Math.max(0, Math.floor(Number(options.total)));
  const visibleCount = clampInteger(Number(options.visibleCount), 0, total);
  if (total <= 0 || visibleCount <= 0 || visibleCount >= total) return 0;
  const trackX = Math.min(options.plotLeft, options.plotRight);
  const trackWidth = Math.max(1, Math.abs(options.plotRight - options.plotLeft));
  const maxOffset = Math.max(0, total - visibleCount);
  const ratio = clampNumber((Number(options.x) - trackX) / trackWidth, 0, 1);
  const centerIndex = Math.round(ratio * total);
  const startIndex = clampInteger(centerIndex - Math.floor(visibleCount / 2), 0, maxOffset);
  return clampInteger(total - (startIndex + visibleCount), 0, maxOffset);
}

export function buildIndicatorBandAreaPath(points: IndicatorBandAreaPoint[]): string {
  const usable = points.flatMap((point) =>
    isFiniteNumber(point.x) && isFiniteNumber(point.upperY) && isFiniteNumber(point.lowerY)
      ? [{ x: point.x, upperY: point.upperY, lowerY: point.lowerY }]
      : [],
  );
  if (usable.length < 2) return "";
  const upper = usable.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)},${point.upperY.toFixed(2)}`,
  );
  const lower = [...usable].reverse().map((point) =>
    `L ${point.x.toFixed(2)},${point.lowerY.toFixed(2)}`,
  );
  return `${upper.concat(lower).join(" ")} Z`;
}

export function buildTrendRibbonAreaSegments(points: TrendRibbonAreaPoint[]): TrendRibbonAreaSegment[] {
  const segments: Array<{ tone: TrendRibbonAreaSegment["tone"]; startIndex: number; points: IndicatorBandAreaPoint[] }> = [];
  points.forEach((point, index) => {
    if (
      !isFiniteNumber(point.x) ||
      !isFiniteNumber(point.fastY) ||
      !isFiniteNumber(point.slowY) ||
      !isFiniteNumber(point.fastValue) ||
      !isFiniteNumber(point.slowValue)
    ) {
      return;
    }
    const tone = point.fastValue > point.slowValue
      ? "good"
      : point.fastValue < point.slowValue
        ? "risk"
        : "neutral";
    const bandPoint = {
      x: point.x,
      upperY: Math.min(point.fastY, point.slowY),
      lowerY: Math.max(point.fastY, point.slowY),
    };
    const current = segments[segments.length - 1];
    if (!current || current.tone !== tone || current.startIndex + current.points.length !== index) {
      segments.push({ tone, startIndex: index, points: [bandPoint] });
      return;
    }
    current.points.push(bandPoint);
  });

  return segments.flatMap((segment) => {
    const path = buildIndicatorBandAreaPath(segment.points);
    if (!path) return [];
    const endIndex = segment.startIndex + segment.points.length - 1;
    return [{
      key: `ma-ribbon-${segment.startIndex}-${endIndex}-${segment.tone}`,
      tone: segment.tone,
      path,
      startIndex: segment.startIndex,
      endIndex,
    }];
  });
}

export function buildIchimokuIndicators(
  bars: IchimokuBarLike[],
  options: {
    conversionPeriod?: number;
    basePeriod?: number;
    spanBPeriod?: number;
    displacement?: number;
  } = {},
): IchimokuIndicatorPoint[] {
  const conversionPeriod = Math.max(1, Math.floor(options.conversionPeriod ?? 9));
  const basePeriod = Math.max(1, Math.floor(options.basePeriod ?? 26));
  const spanBPeriod = Math.max(1, Math.floor(options.spanBPeriod ?? 52));
  const displacement = Math.max(0, Math.floor(options.displacement ?? 26));
  const midpoint = (period: number, index: number) => {
    const start = index - period + 1;
    if (start < 0) return null;
    const window = bars.slice(start, index + 1);
    const highs = window.map((bar) => bar.high).filter(isFiniteNumber);
    const lows = window.map((bar) => bar.low).filter(isFiniteNumber);
    if (highs.length !== period || lows.length !== period) return null;
    return (Math.max(...highs) + Math.min(...lows)) / 2;
  };

  return bars.map((bar, index) => {
    const conversion = midpoint(conversionPeriod, index);
    const base = midpoint(basePeriod, index);
    const spanB = midpoint(spanBPeriod, index);
    const laggingSource = bars[index + displacement]?.close;
    return {
      conversion,
      base,
      spanA: isFiniteNumber(conversion) && isFiniteNumber(base) ? (conversion + base) / 2 : null,
      spanB,
      lagging: isFiniteNumber(laggingSource) ? laggingSource : null,
    };
  });
}

function isTruthyFlag(value: boolean | number | string | null | undefined) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function isPriceNearLimit(price: number | null | undefined, limitPrice: number | null | undefined, tolerancePct: number) {
  if (!isFiniteNumber(price) || !isFiniteNumber(limitPrice)) return false;
  const tolerance = Math.max(0.01, Math.abs(limitPrice) * Math.max(0, tolerancePct));
  return Math.abs(price - limitPrice) <= tolerance;
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
  volumeMa5?: number | null;
  volumeMa10?: number | null;
  volumeMa20?: number | null;
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

export interface IndicatorAxisTick {
  value: number;
  y: number;
  label: string;
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

export function applyChartPreferencePreset<T extends object>(
  preferences: T,
  presetKey: ChartPreferencePresetKey | string,
): T {
  const preset = CHART_PREFERENCE_PRESETS.find((item) => item.key === presetKey);
  if (!preset) return preferences;
  return {
    ...preferences,
    ...preset.values,
  };
}

export function matchChartPreferencePreset(
  preferences: object | null | undefined,
): ChartPreferencePresetKey | null {
  if (!preferences || typeof preferences !== "object") return null;
  const current = preferences as Record<string, unknown>;
  return CHART_PREFERENCE_PRESETS.find((preset) =>
    (Object.keys(preset.values) as ChartPreferenceName[]).every((key) => current[key] === preset.values[key]),
  )?.key ?? null;
}

export function applyChartParameterPreset<T extends object>(
  parameters: T,
  presetKey: ChartParameterPresetKey | string,
): T {
  const preset = CHART_PARAMETER_PRESETS.find((item) => item.key === presetKey);
  if (!preset) return parameters;
  return {
    ...parameters,
    ...preset.values,
  };
}

export function matchChartParameterPreset(
  parameters: object | null | undefined,
): ChartParameterPresetKey | null {
  if (!parameters || typeof parameters !== "object") return null;
  const current = parameters as Record<string, unknown>;
  return CHART_PARAMETER_PRESETS.find((preset) =>
    (Object.keys(preset.values) as ChartParameterName[]).every((key) => current[key] === preset.values[key]),
  )?.key ?? null;
}

export function buildManualDrawingStorageKey(scope?: string | null): string {
  const normalizedScope = String(scope || "").trim() || "default";
  return `${MANUAL_DRAWING_STORAGE_PREFIX}.${normalizedScope}`;
}

export function normalizeManualDrawings(value: unknown, maxCount = 80): ManualDrawing[] {
  if (!Array.isArray(value)) return [];
  const limit = clampInteger(maxCount, 1, 500);
  return value
    .flatMap((item): ManualDrawing[] => {
      if (!item || typeof item !== "object") return [];
      const source = item as Record<string, unknown>;
      const id = typeof source.id === "string" && source.id.trim() ? source.id.trim() : "";
      const type = source.type === "horizontal" || source.type === "trend" ? source.type : null;
      const start = normalizeManualDrawingAnchor(source.start);
      if (!id || !type || !start) return [];
      if (type === "horizontal") return [{ id, type, start }];
      const end = normalizeManualDrawingAnchor(source.end);
      return end ? [{ id, type, start, end }] : [];
    })
    .slice(-limit);
}

export function normalizePriceAxisMode(value: unknown): PriceAxisMode {
  return value === "percent" ? "percent" : "price";
}

export function normalizeKlineRenderMode(value: unknown): KlineRenderMode {
  if (value === "line" || value === "ohlc") return value;
  return "candle";
}

export function normalizePriceAdjustmentMode(value: unknown): PriceAdjustmentMode {
  if (value === "forward" || value === "backward") return value;
  return "none";
}

export function priceAdjustmentPriceByFactor(
  price: number | null | undefined,
  factor: number | null | undefined,
  scale: PriceAdjustmentScale,
): number | null {
  if (!isFiniteNumber(price)) return null;
  if (scale.mode === "none") return price;
  if (!isFiniteNumber(factor) || factor <= 0 || !isFiniteNumber(scale.baseFactor) || scale.baseFactor <= 0) {
    return price;
  }
  return price * (factor / scale.baseFactor);
}

export function buildPriceAdjustedBars<T extends PriceAdjustmentBarLike>(
  bars: T[],
  requestedMode: PriceAdjustmentMode | string | null | undefined,
): PriceAdjustedBarsResult<T> {
  const mode = normalizePriceAdjustmentMode(requestedMode);
  const rawBars = bars.map((bar) => ({ ...bar }) as T);
  if (mode === "none" || bars.length === 0) {
    return {
      bars: rawBars,
      mode: "none",
      baseFactor: null,
      firstFactor: null,
      latestFactor: null,
      hasAdjustment: false,
    };
  }

  const factors = bars.map((bar) => bar.adj_factor);
  if (factors.some((factor) => !isFiniteNumber(factor) || factor <= 0)) {
    return {
      bars: rawBars,
      mode: "none",
      baseFactor: null,
      firstFactor: null,
      latestFactor: null,
      hasAdjustment: false,
    };
  }

  const firstFactor = Number(factors[0]);
  const latestFactor = Number(factors[factors.length - 1]);
  const baseFactor = mode === "forward" ? latestFactor : firstFactor;
  const scale: PriceAdjustmentScale = {
    mode,
    baseFactor,
    firstFactor,
    latestFactor,
  };
  const adjustField = (value: number | null | undefined, factor: number) =>
    isFiniteNumber(value) ? priceAdjustmentPriceByFactor(value, factor, scale) : value;
  return {
    bars: bars.map((bar, index) => {
      const factor = Number(factors[index]);
      return {
        ...bar,
        open: adjustField(bar.open, factor),
        high: adjustField(bar.high, factor),
        low: adjustField(bar.low, factor),
        close: adjustField(bar.close, factor),
      } as T;
    }),
    ...scale,
    hasAdjustment: true,
  };
}

export function buildPriceAxisScale(
  prices: Array<number | null | undefined>,
  options: {
    mode?: PriceAxisMode | string | null;
    basePrice?: number | null;
    top: number;
    bottom: number;
  },
): PriceAxisScale {
  const finitePrices = prices.filter(isFiniteNumber);
  const rawMin = finitePrices.length ? Math.min(...finitePrices) : 0;
  const rawMax = finitePrices.length ? Math.max(...finitePrices) : 1;
  const requestedMode = normalizePriceAxisMode(options.mode);
  const canUsePercent = requestedMode === "percent" && isFiniteNumber(options.basePrice) && options.basePrice > 0;
  const mode: PriceAxisMode = canUsePercent ? "percent" : "price";
  const basePrice = mode === "percent" ? Number(options.basePrice) : null;
  const axisValues = mode === "percent"
    ? finitePrices.map((price) => ((price / Number(basePrice)) - 1) * 100)
    : finitePrices;
  const min = axisValues.length ? Math.min(...axisValues) : rawMin;
  const max = axisValues.length ? Math.max(...axisValues) : rawMax;
  return {
    mode,
    basePrice,
    min,
    max: max === min ? min + 1 : max,
    top: options.top,
    bottom: options.bottom,
  };
}

export function priceAxisValueFromPrice(scale: PriceAxisScale, price?: number | null): number | null {
  if (!isFiniteNumber(price)) return null;
  if (scale.mode === "percent") {
    if (!isFiniteNumber(scale.basePrice) || scale.basePrice <= 0) return null;
    return ((price / scale.basePrice) - 1) * 100;
  }
  return price;
}

export function priceAxisPriceFromValue(scale: PriceAxisScale, value?: number | null): number | null {
  if (!isFiniteNumber(value)) return null;
  if (scale.mode === "percent") {
    if (!isFiniteNumber(scale.basePrice) || scale.basePrice <= 0) return null;
    return scale.basePrice * (1 + value / 100);
  }
  return value;
}

export function priceAxisYOf(scale: PriceAxisScale, price?: number | null): number | null {
  const value = priceAxisValueFromPrice(scale, price);
  if (!isFiniteNumber(value)) return null;
  const span = scale.max - scale.min || 1;
  return scale.bottom - ((value - scale.min) / span) * (scale.bottom - scale.top);
}

export function priceAxisPriceFromY(scale: PriceAxisScale, y: number): number | null {
  if (!isFiniteNumber(y)) return null;
  const boundedY = clampNumber(y, scale.top, scale.bottom);
  const span = scale.max - scale.min || 1;
  const value = scale.min + ((scale.bottom - boundedY) / (scale.bottom - scale.top)) * span;
  return priceAxisPriceFromValue(scale, value);
}

export function buildManualDrawingGeometry(
  drawings: ManualDrawing[],
  candles: ManualDrawingCandleLike[],
  bounds: ManualDrawingChartBounds,
): ManualDrawingGeometry[] {
  const candleByDate = new Map(
    candles
      .filter((candle) => typeof candle.date === "string" && isFiniteNumber(candle.x))
      .map((candle) => [String(candle.date), candle]),
  );
  const scale = chartBoundsToPriceAxisScale(bounds);
  const yOf = (price: number) => {
    if (!scale) return null;
    const y = priceAxisYOf(scale, price);
    return y != null && y >= bounds.priceTop && y <= bounds.priceBottom ? y : null;
  };
  const labelOf = (anchor: ManualDrawingAnchor, candle?: ManualDrawingCandleLike | null) =>
    anchor.label || candle?.periodLabel || candle?.period_label || anchor.date;

  return drawings.flatMap((drawing): ManualDrawingGeometry[] => {
    if (!drawing?.id || !drawing.start || !isFiniteNumber(drawing.start.price)) return [];
    const startY = yOf(drawing.start.price);
    if (startY == null) return [];
    const startCandle = candleByDate.get(drawing.start.date) || null;
    const startLabel = labelOf(drawing.start, startCandle);

    if (drawing.type === "horizontal") {
      return [{
        id: drawing.id,
        type: drawing.type,
        x1: bounds.plotLeft,
        x2: bounds.plotRight,
        y1: startY,
        y2: startY,
        labelX: clampNumber(bounds.plotRight - 88, bounds.plotLeft + 8, bounds.plotRight - 8),
        labelY: clampNumber(startY - 8, bounds.priceTop + 14, bounds.priceBottom - 6),
        label: `画线 ${drawing.start.price.toFixed(2)}`,
        startLabel,
        endLabel: startLabel,
        startPrice: drawing.start.price,
        endPrice: drawing.start.price,
      }];
    }

    if (drawing.type !== "trend" || !drawing.end || !isFiniteNumber(drawing.end.price)) return [];
    const endCandle = candleByDate.get(drawing.end.date);
    if (!startCandle || !endCandle || !isFiniteNumber(startCandle.x) || !isFiniteNumber(endCandle.x)) return [];
    const endY = yOf(drawing.end.price);
    if (endY == null) return [];
    const labelOnRight = endCandle.x > bounds.plotRight - 120;
    return [{
      id: drawing.id,
      type: drawing.type,
      x1: startCandle.x,
      x2: endCandle.x,
      y1: startY,
      y2: endY,
      labelX: clampNumber(endCandle.x + (labelOnRight ? -72 : 10), bounds.plotLeft + 8, bounds.plotRight - 60),
      labelY: clampNumber(endY - 8, bounds.priceTop + 14, bounds.priceBottom - 6),
      label: "趋势线",
      startLabel,
      endLabel: labelOf(drawing.end, endCandle),
      startPrice: drawing.start.price,
      endPrice: drawing.end.price,
    }];
  });
}

function normalizeManualDrawingAnchor(value: unknown): ManualDrawingAnchor | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const date = typeof source.date === "string" && source.date.trim() ? source.date.trim() : "";
  const price = Number(source.price);
  if (!date || !isFiniteNumber(price)) return null;
  const label = typeof source.label === "string" && source.label.trim() ? source.label.trim() : undefined;
  return label ? { date, label, price } : { date, price };
}

function chartBoundsToPriceAxisScale(bounds: ManualDrawingChartBounds): PriceAxisScale | null {
  const requestedMode = normalizePriceAxisMode(bounds.priceAxisMode);
  const min = isFiniteNumber(bounds.priceAxisMin) ? bounds.priceAxisMin : bounds.priceMin;
  const max = isFiniteNumber(bounds.priceAxisMax) ? bounds.priceAxisMax : bounds.priceMax;
  if (!isFiniteNumber(min) || !isFiniteNumber(max) || !isFiniteNumber(bounds.priceTop) || !isFiniteNumber(bounds.priceBottom)) {
    return null;
  }
  const mode: PriceAxisMode = requestedMode === "percent" && isFiniteNumber(bounds.priceAxisBase) && bounds.priceAxisBase > 0
    ? "percent"
    : "price";
  return {
    mode,
    basePrice: mode === "percent" && isFiniteNumber(bounds.priceAxisBase) ? bounds.priceAxisBase : null,
    min,
    max: max === min ? min + 1 : max,
    top: bounds.priceTop,
    bottom: bounds.priceBottom,
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
      item("VMA5", snapshot.volumeMa5, 0, { compact: true }),
      item("VMA10", snapshot.volumeMa10, 0, { compact: true }),
      item("VMA20", snapshot.volumeMa20, 0, { compact: true }),
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

export function buildIndicatorAxisTicks(options: {
  min: number;
  max: number;
  top: number;
  bottom: number;
  precision?: number;
  compact?: boolean;
  values?: number[];
}): IndicatorAxisTick[] {
  if (
    !isFiniteNumber(options.min) ||
    !isFiniteNumber(options.max) ||
    !isFiniteNumber(options.top) ||
    !isFiniteNumber(options.bottom)
  ) {
    return [];
  }
  const min = options.min;
  const max = options.max === min ? min + 1 : options.max;
  const span = max - min || 1;
  const precision = options.precision ?? 2;
  const values = options.values ?? [max, min + span / 2, min];
  return values
    .filter(isFiniteNumber)
    .map((value) => ({
      value,
      y: options.bottom - ((value - min) / span) * (options.bottom - options.top),
      label: formatIndicatorAxisTickLabel(value, precision, Boolean(options.compact)),
    }));
}

function formatIndicatorAxisTickLabel(value: number, precision: number, compact: boolean) {
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${trimFixed(value / 1_000_000_000, 1)}B`;
    if (abs >= 1_000_000) return `${trimFixed(value / 1_000_000, 1)}M`;
    if (abs >= 1_000) return `${trimFixed(value / 1_000, 1)}K`;
  }
  return trimFixed(value, precision);
}

function trimFixed(value: number, precision: number) {
  return value.toFixed(precision).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function selectIndicatorReadoutSnapshot<T>(
  latest?: T | null,
  cursor?: T | null,
): T | null {
  return cursor ?? latest ?? null;
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

export function buildMeasuredRangeStats(
  bars: MeasuredRangeBarLike[],
  startIndex: number | null,
  endIndex: number | null,
): MeasuredRangeStats | null {
  if (startIndex == null || endIndex == null) return null;
  const usableBars = bars
    .map(normalizeMeasuredRangeBar)
    .filter((bar): bar is NonNullable<ReturnType<typeof normalizeMeasuredRangeBar>> => Boolean(bar));
  const start = usableBars.find((bar) => bar.index === startIndex);
  const end = usableBars.find((bar) => bar.index === endIndex);
  if (!start || !end) return null;

  const rangeStart = Math.min(start.index, end.index);
  const rangeEnd = Math.max(start.index, end.index);
  const rangeBars = usableBars
    .filter((bar) => bar.index >= rangeStart && bar.index <= rangeEnd)
    .sort((left, right) => left.index - right.index);
  if (rangeBars.length === 0) return null;

  const highBar = rangeBars.reduce((winner, bar) => (bar.high > winner.high ? bar : winner), rangeBars[0]);
  const lowBar = rangeBars.reduce((winner, bar) => (bar.low < winner.low ? bar : winner), rangeBars[0]);
  const drawdownPct = calculateRangeDrawdownPct(rangeBars);
  const runupPct = calculateRangeRunupPct(rangeBars);
  const totalVolume = rangeBars.reduce((sum, bar) => sum + bar.volume, 0);
  const totalAmount = rangeBars.reduce((sum, bar) => sum + bar.amount, 0);
  const change = end.close - start.close;
  return {
    startIndex: start.index,
    endIndex: end.index,
    startLabel: start.label,
    endLabel: end.label,
    startClose: start.close,
    endClose: end.close,
    bars: Math.abs(end.index - start.index),
    barCount: rangeBars.length,
    change,
    changePct: start.close ? end.close / start.close - 1 : null,
    high: highBar.high,
    highIndex: highBar.index,
    highLabel: highBar.label,
    low: lowBar.low,
    lowIndex: lowBar.index,
    lowLabel: lowBar.label,
    amplitudePct: start.close ? (highBar.high - lowBar.low) / start.close : null,
    maxDrawdownPct: drawdownPct,
    maxRunupPct: runupPct,
    totalVolume,
    averageVolume: totalVolume / rangeBars.length,
    totalAmount,
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

export function buildCandlestickPatternAnnotations(
  bars: PriceExtremaBarLike[],
  options: { dojiBodyRatio?: number; hammerLowerShadowRatio?: number } = {},
): CandlestickPatternAnnotation[] {
  const normalized = bars
    .map(normalizeCandlestickPatternBar)
    .filter((bar): bar is NonNullable<ReturnType<typeof normalizeCandlestickPatternBar>> => Boolean(bar));
  if (normalized.length === 0) return [];

  const dojiBodyRatio = clampNumber(Number(options.dojiBodyRatio ?? 0.08), 0.01, 0.2);
  const hammerLowerShadowRatio = clampNumber(Number(options.hammerLowerShadowRatio ?? 2), 1.2, 5);

  return normalized.flatMap((bar, cursor) => {
    const range = Math.max(bar.high - bar.low, 0.000001);
    const body = Math.abs(bar.close - bar.open);
    const upperShadow = bar.high - Math.max(bar.open, bar.close);
    const lowerShadow = Math.min(bar.open, bar.close) - bar.low;
    const patterns: CandlestickPatternAnnotation[] = [];

    if (body / range <= dojiBodyRatio) {
      patterns.push({
        key: `doji-${bar.index}`,
        type: "doji",
        label: "十字星",
        tone: "neutral",
        index: bar.index,
        date: bar.date,
        dateLabel: bar.label,
        price: bar.close,
      });
    }

    const previous = normalized[cursor - 1];
    if (previous) {
      const previousRange = Math.max(previous.high - previous.low, 0.000001);
      const previousBody = Math.abs(previous.close - previous.open);
      const hasEngulfingBodies = previousBody / previousRange > dojiBodyRatio && body / range > dojiBodyRatio;
      const previousBearish = previous.close < previous.open;
      const previousBullish = previous.close > previous.open;
      const currentBullish = bar.close > bar.open;
      const currentBearish = bar.close < bar.open;

      if (hasEngulfingBodies && previousBearish && currentBullish && bar.open <= previous.close && bar.close >= previous.open) {
        patterns.push({
          key: `bullish-engulfing-${bar.index}`,
          type: "bullish-engulfing",
          label: "看涨吞没",
          tone: "good",
          index: bar.index,
          date: bar.date,
          dateLabel: bar.label,
          price: bar.low,
        });
      }

      if (hasEngulfingBodies && previousBullish && currentBearish && bar.open >= previous.close && bar.close <= previous.open) {
        patterns.push({
          key: `bearish-engulfing-${bar.index}`,
          type: "bearish-engulfing",
          label: "看跌吞没",
          tone: "risk",
          index: bar.index,
          date: bar.date,
          dateLabel: bar.label,
          price: bar.high,
        });
      }
    }

    const closesNearTop = Math.max(bar.open, bar.close) >= bar.low + range * 0.68;
    if (
      body > 0 &&
      lowerShadow >= body * hammerLowerShadowRatio &&
      upperShadow <= Math.max(body, range * 0.12) &&
      closesNearTop
    ) {
      patterns.push({
        key: `hammer-${bar.index}`,
        type: "hammer",
        label: "锤头线",
        tone: "good",
        index: bar.index,
        date: bar.date,
        dateLabel: bar.label,
        price: bar.low,
      });
    }

    return patterns;
  });
}

export function buildTechnicalIndicatorAnnotations(
  bars: TechnicalIndicatorBarLike[],
): TechnicalIndicatorAnnotation[] {
  const normalized = bars
    .map(normalizeTechnicalIndicatorBar)
    .filter((bar): bar is NonNullable<ReturnType<typeof normalizeTechnicalIndicatorBar>> => Boolean(bar));
  if (normalized.length < 2) return [];

  return normalized.flatMap((bar, cursor) => {
    if (cursor === 0) return [];
    const previous = normalized[cursor - 1];
    if (!previous) return [];

    const events: TechnicalIndicatorAnnotation[] = [];
    const pushEvent = (
      type: TechnicalIndicatorEventType,
      label: string,
      tone: TechnicalIndicatorEventTone,
    ) => {
      events.push({
        key: `${type}-${bar.index}`,
        type,
        label,
        tone,
        index: bar.index,
        date: bar.date,
        dateLabel: bar.label,
        price: tone === "risk" ? bar.high : bar.low,
      });
    };

    if (crossedAbove(previous.maFast, previous.maSlow, bar.maFast, bar.maSlow)) {
      pushEvent("ma-golden-cross", "MA金叉", "good");
    }
    if (crossedBelow(previous.maFast, previous.maSlow, bar.maFast, bar.maSlow)) {
      pushEvent("ma-death-cross", "MA死叉", "risk");
    }
    if (crossedAbove(previous.dif, previous.dea, bar.dif, bar.dea)) {
      pushEvent("macd-golden-cross", "MACD金叉", "good");
    }
    if (crossedBelow(previous.dif, previous.dea, bar.dif, bar.dea)) {
      pushEvent("macd-death-cross", "MACD死叉", "risk");
    }
    if (
      isFiniteNumber(previous.bollUpper) &&
      isFiniteNumber(bar.bollUpper) &&
      previous.close <= previous.bollUpper &&
      bar.close > bar.bollUpper
    ) {
      pushEvent("boll-breakout-up", "上破BOLL", "good");
    }
    if (
      isFiniteNumber(previous.bollLower) &&
      isFiniteNumber(bar.bollLower) &&
      previous.close >= previous.bollLower &&
      bar.close < bar.bollLower
    ) {
      pushEvent("boll-breakout-down", "下破BOLL", "risk");
    }

    return events;
  });
}

export function buildTechnicalDivergenceAnnotations(
  bars: TechnicalDivergenceBarLike[],
  options: {
    swingWindow?: number;
    minPriceMovePct?: number;
    minIndicatorMove?: number;
    maxPerType?: number;
  } = {},
): TechnicalDivergenceAnnotation[] {
  const normalized = bars
    .map(normalizeTechnicalDivergenceBar)
    .filter((bar): bar is NonNullable<ReturnType<typeof normalizeTechnicalDivergenceBar>> => Boolean(bar));
  const swingWindow = clampInteger(options.swingWindow ?? 2, 1, 8);
  if (normalized.length < swingWindow * 2 + 3) return [];

  const minPriceMovePct = Math.max(0, Number(options.minPriceMovePct ?? 0.5));
  const minIndicatorMove = Math.max(0, Number(options.minIndicatorMove ?? 0.5));
  const maxPerType = clampInteger(options.maxPerType ?? 2, 1, 8);
  const pivots = buildTechnicalDivergencePivots(normalized, swingWindow);
  const events = [
    ...buildTechnicalDivergenceCandidates(pivots.lows, "rsi", "bullish", minPriceMovePct, minIndicatorMove, maxPerType),
    ...buildTechnicalDivergenceCandidates(pivots.lows, "macd", "bullish", minPriceMovePct, minIndicatorMove, maxPerType),
    ...buildTechnicalDivergenceCandidates(pivots.highs, "rsi", "bearish", minPriceMovePct, minIndicatorMove, maxPerType),
    ...buildTechnicalDivergenceCandidates(pivots.highs, "macd", "bearish", minPriceMovePct, minIndicatorMove, maxPerType),
  ];

  return events.sort((left, right) =>
    left.index - right.index ||
    technicalDivergenceIndicatorRank(left.indicator) - technicalDivergenceIndicatorRank(right.indicator),
  );
}

export function buildVolumeSignalAnnotations(
  bars: PriceExtremaBarLike[],
  options: {
    period?: number;
    surgeRatio?: number;
    dryUpRatio?: number;
    minMovePct?: number;
    quietMovePct?: number;
  } = {},
): VolumeSignalAnnotation[] {
  const normalized = bars
    .map(normalizeVolumeSignalBar)
    .filter((bar): bar is NonNullable<ReturnType<typeof normalizeVolumeSignalBar>> => Boolean(bar));
  const period = clampInteger(options.period ?? 20, 2, 80);
  if (normalized.length <= period) return [];

  const surgeRatio = clampNumber(Number(options.surgeRatio ?? 1.8), 1.05, 10);
  const dryUpRatio = clampNumber(Number(options.dryUpRatio ?? 0.45), 0.05, 0.95);
  const minMovePct = Math.max(0, Number(options.minMovePct ?? 1));
  const quietMovePct = Math.max(0, Number(options.quietMovePct ?? 0.8));

  return normalized.flatMap<VolumeSignalAnnotation>((bar, index) => {
    if (index < period) return [];
    const previous = normalized[index - 1];
    if (!previous) return [];
    const averageVolume = averageNumbers(
      normalized.slice(index - period, index).map((item) => item.volume),
    );
    if (!averageVolume || averageVolume <= 0) return [];
    const volumeRatio = bar.volume / averageVolume;
    const changePct = previous.close > 0 ? ((bar.close - previous.close) / previous.close) * 100 : null;
    const eventBase = {
      index: bar.index,
      date: bar.date,
      dateLabel: bar.label,
      volume: bar.volume,
      averageVolume,
      volumeRatio,
      changePct,
    };

    if (changePct != null && volumeRatio >= surgeRatio && changePct >= minMovePct && bar.close >= bar.open) {
      return [{
        ...eventBase,
        key: `volume-surge-up-${bar.index}`,
        type: "volume-surge-up" as const,
        label: "放量上涨",
        tone: "good" as const,
        price: bar.low,
      }];
    }

    if (changePct != null && volumeRatio >= surgeRatio && changePct <= -minMovePct && bar.close <= bar.open) {
      return [{
        ...eventBase,
        key: `volume-surge-down-${bar.index}`,
        type: "volume-surge-down" as const,
        label: "放量下跌",
        tone: "risk" as const,
        price: bar.high,
      }];
    }

    if (changePct != null && volumeRatio <= dryUpRatio && Math.abs(changePct) <= quietMovePct) {
      return [{
        ...eventBase,
        key: `volume-dry-up-${bar.index}`,
        type: "volume-dry-up" as const,
        label: "缩量整理",
        tone: "neutral" as const,
        price: bar.close,
      }];
    }

    return [];
  });
}

export function buildTrendRegimeBands(bars: TrendRegimeBarLike[]): TrendRegimeBand[] {
  const normalized = bars
    .map(normalizeTrendRegimeBar)
    .filter((bar): bar is NonNullable<ReturnType<typeof normalizeTrendRegimeBar>> => Boolean(bar));
  if (normalized.length === 0) return [];

  const classified = normalized.map((bar) => ({
    ...bar,
    type: classifyTrendRegime(bar),
  }));
  return classified.reduce<TrendRegimeBand[]>((bands, bar) => {
    const existing = bands[bands.length - 1];
    if (existing && existing.type === bar.type && existing.endIndex === bar.index - 1) {
      existing.endIndex = bar.index;
      existing.endDate = bar.date;
      existing.endLabel = bar.label;
      existing.bars += 1;
      existing.key = `${existing.type}-${existing.startIndex}-${existing.endIndex}`;
      return bands;
    }

    const meta = trendRegimeMeta(bar.type);
    bands.push({
      key: `${bar.type}-${bar.index}-${bar.index}`,
      type: bar.type,
      label: meta.label,
      tone: meta.tone,
      startIndex: bar.index,
      endIndex: bar.index,
      startDate: bar.date,
      endDate: bar.date,
      startLabel: bar.label,
      endLabel: bar.label,
      bars: 1,
    });
    return bands;
  }, []);
}

export function buildKlineEventSummary(input: KlineEventSummaryInput): KlineEventSummaryItem[] {
  const latestTechnical = latestIndexedEvent(input.technicalEvents ?? []);
  const latestDivergence = latestIndexedEvent(input.divergenceEvents ?? []);
  const latestVolume = latestIndexedEvent(input.volumeEvents ?? []);
  const latestPattern = latestIndexedEvent(input.patterns ?? []);
  const latestGap = latestGapEvent(input.gaps ?? []);
  const latestTrend = latestTrendBand(input.trendBands ?? []);
  const items: KlineEventSummaryItem[] = [];

  if (latestTechnical) {
    items.push({
      key: "technical",
      label: "技术信号",
      value: `${input.technicalEvents?.length ?? 0}个`,
      detail: `最近 ${latestTechnical.dateLabel} ${latestTechnical.label}`,
      tone: latestTechnical.tone,
      count: input.technicalEvents?.length ?? 0,
    });
  }
  if (latestDivergence) {
    items.push({
      key: "divergence",
      label: "指标背离",
      value: `${input.divergenceEvents?.length ?? 0}个`,
      detail: `最近 ${latestDivergence.dateLabel} ${latestDivergence.label}`,
      tone: latestDivergence.tone,
      count: input.divergenceEvents?.length ?? 0,
    });
  }
  if (latestVolume) {
    items.push({
      key: "volume",
      label: "量价异动",
      value: `${input.volumeEvents?.length ?? 0}个`,
      detail: `最近 ${latestVolume.dateLabel} ${latestVolume.label}`,
      tone: latestVolume.tone,
      count: input.volumeEvents?.length ?? 0,
    });
  }
  if (latestPattern) {
    items.push({
      key: "pattern",
      label: "K线形态",
      value: `${input.patterns?.length ?? 0}个`,
      detail: `最近 ${latestPattern.dateLabel} ${latestPattern.label}`,
      tone: latestPattern.tone,
      count: input.patterns?.length ?? 0,
    });
  }
  if (latestGap) {
    const label = latestGap.direction === "up" ? "向上缺口" : "向下缺口";
    items.push({
      key: "gap",
      label: "跳空缺口",
      value: `${input.gaps?.length ?? 0}个`,
      detail: `最近 ${latestGap.endLabel} ${label}`,
      tone: latestGap.direction === "up" ? "good" : "risk",
      count: input.gaps?.length ?? 0,
    });
  }
  if (latestTrend) {
    items.push({
      key: "trend",
      label: "趋势状态",
      value: latestTrend.label,
      detail: `${latestTrend.startLabel}→${latestTrend.endLabel} ${latestTrend.bars}根`,
      tone: latestTrend.tone,
      count: latestTrend.bars,
    });
  }

  return items;
}

export function buildPriceStructureTrendLines(
  bars: PriceExtremaBarLike[],
  options: {
    swingWindow?: number;
    minSlopePct?: number;
    maxLinesPerType?: number;
    extendToLatest?: boolean;
  } = {},
): PriceStructureTrendLine[] {
  const normalized = bars
    .map(normalizeSupportResistanceBar)
    .filter((bar): bar is NonNullable<ReturnType<typeof normalizeSupportResistanceBar>> => Boolean(bar));
  const swingWindow = clampInteger(options.swingWindow ?? 2, 1, 8);
  if (normalized.length < swingWindow * 2 + 3) return [];

  const minSlopePct = Math.max(0, Number(options.minSlopePct ?? 0.15));
  const maxLinesPerType = clampInteger(options.maxLinesPerType ?? 1, 1, 3);
  const extendToLatest = options.extendToLatest !== false;
  const latestIndex = normalized[normalized.length - 1]?.index ?? 0;
  const pivots: Array<{
    type: "high" | "low";
    index: number;
    price: number;
    label: string;
  }> = [];

  normalized.forEach((bar, index) => {
    if (index < swingWindow || index > normalized.length - swingWindow - 1) return;
    const neighbours = [
      ...normalized.slice(index - swingWindow, index),
      ...normalized.slice(index + 1, index + swingWindow + 1),
    ];
    if (neighbours.length !== swingWindow * 2) return;
    if (neighbours.every((item) => bar.high > item.high)) {
      pivots.push({ type: "high", index: bar.index, price: bar.high, label: bar.label });
    }
    if (neighbours.every((item) => bar.low < item.low)) {
      pivots.push({ type: "low", index: bar.index, price: bar.low, label: bar.label });
    }
  });

  const supportLines = buildPriceStructureLineCandidates({
    pivots: pivots.filter((pivot) => pivot.type === "low"),
    type: "ascending-support",
    label: "上升趋势线",
    tone: "good",
    minSlopePct,
    latestIndex,
    extendToLatest,
  }).slice(0, maxLinesPerType);
  const resistanceLines = buildPriceStructureLineCandidates({
    pivots: pivots.filter((pivot) => pivot.type === "high"),
    type: "descending-resistance",
    label: "下降压力线",
    tone: "risk",
    minSlopePct,
    latestIndex,
    extendToLatest,
  }).slice(0, maxLinesPerType);

  return [...supportLines, ...resistanceLines];
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

function normalizeMeasuredRangeBar(bar: MeasuredRangeBarLike, fallbackIndex: number) {
  const close = Number(bar.close ?? bar.open ?? bar.high ?? bar.low);
  const open = Number(bar.open ?? close);
  const high = Number(bar.high ?? Math.max(open, close));
  const low = Number(bar.low ?? Math.min(open, close));
  const volume = Number(bar.volume ?? 0);
  if (![open, high, low, close, volume].every(isFiniteNumber)) return null;
  const normalizedHigh = Math.max(high, low, open, close);
  const normalizedLow = Math.min(high, low, open, close);
  const amount = isFiniteNumber(bar.amount) && Number(bar.amount) > 0
    ? Number(bar.amount)
    : ((normalizedHigh + normalizedLow + close) / 3) * Math.max(volume, 0);
  const rawIndex = Number(bar.index ?? fallbackIndex);
  const index = isFiniteNumber(rawIndex) ? rawIndex : fallbackIndex;
  const date = String(bar.date || index);
  return {
    index,
    date,
    label: String(bar.period_label || bar.date || index),
    open,
    high: normalizedHigh,
    low: normalizedLow,
    close,
    volume: Math.max(volume, 0),
    amount,
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

function normalizeCandlestickPatternBar(bar: PriceExtremaBarLike, index: number) {
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
    open,
    high: Math.max(high, low, open, close),
    low: Math.min(high, low, open, close),
    close,
  };
}

function normalizeTechnicalIndicatorBar(bar: TechnicalIndicatorBarLike, index: number) {
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
    open,
    high: Math.max(high, low, open, close),
    low: Math.min(high, low, open, close),
    close,
    maFast: normalizeOptionalNumber(bar.maFast),
    maSlow: normalizeOptionalNumber(bar.maSlow),
    dif: normalizeOptionalNumber(bar.dif),
    dea: normalizeOptionalNumber(bar.dea),
    bollUpper: normalizeOptionalNumber(bar.bollUpper),
    bollLower: normalizeOptionalNumber(bar.bollLower),
  };
}

function normalizeTechnicalDivergenceBar(bar: TechnicalDivergenceBarLike, index: number) {
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
    rsi: normalizeOptionalNumber(bar.rsi14),
    macd: normalizeOptionalNumber(bar.macd),
  };
}

function normalizeVolumeSignalBar(bar: PriceExtremaBarLike, index: number) {
  const close = Number(bar.close ?? bar.open ?? bar.high ?? bar.low);
  const open = Number(bar.open ?? close);
  const high = Number(bar.high ?? Math.max(open, close));
  const low = Number(bar.low ?? Math.min(open, close));
  const volume = Number(bar.volume ?? 0);
  if (![open, high, low, close, volume].every(isFiniteNumber) || volume <= 0) return null;
  const date = String(bar.date || index);
  return {
    index,
    date,
    label: String(bar.period_label || bar.date || index),
    open,
    high: Math.max(high, low, open, close),
    low: Math.min(high, low, open, close),
    close,
    volume,
  };
}

function normalizeTrendRegimeBar(bar: TrendRegimeBarLike, index: number) {
  const close = Number(bar.close ?? bar.open ?? bar.high ?? bar.low);
  const maFast = normalizeOptionalNumber(bar.maFast);
  const maMid = normalizeOptionalNumber(bar.maMid);
  const maSlow = normalizeOptionalNumber(bar.maSlow);
  if (!isFiniteNumber(close) || maFast == null || maMid == null || maSlow == null) return null;
  const date = String(bar.date || index);
  return {
    index,
    date,
    label: String(bar.period_label || bar.date || index),
    close,
    maFast,
    maMid,
    maSlow,
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

function normalizeOptionalNumber(value: unknown) {
  const next = Number(value);
  return isFiniteNumber(next) ? next : null;
}

function crossedAbove(
  previousLeft: number | null,
  previousRight: number | null,
  currentLeft: number | null,
  currentRight: number | null,
) {
  if (
    !isFiniteNumber(previousLeft) ||
    !isFiniteNumber(previousRight) ||
    !isFiniteNumber(currentLeft) ||
    !isFiniteNumber(currentRight)
  ) {
    return false;
  }
  return previousLeft <= previousRight && currentLeft > currentRight;
}

function crossedBelow(
  previousLeft: number | null,
  previousRight: number | null,
  currentLeft: number | null,
  currentRight: number | null,
) {
  if (
    !isFiniteNumber(previousLeft) ||
    !isFiniteNumber(previousRight) ||
    !isFiniteNumber(currentLeft) ||
    !isFiniteNumber(currentRight)
  ) {
    return false;
  }
  return previousLeft >= previousRight && currentLeft < currentRight;
}

function buildTechnicalDivergencePivots(
  bars: Array<NonNullable<ReturnType<typeof normalizeTechnicalDivergenceBar>>>,
  swingWindow: number,
) {
  const lows: Array<NonNullable<ReturnType<typeof normalizeTechnicalDivergenceBar>>> = [];
  const highs: Array<NonNullable<ReturnType<typeof normalizeTechnicalDivergenceBar>>> = [];
  bars.forEach((bar, index) => {
    if (index < swingWindow || index > bars.length - swingWindow - 1) return;
    const neighbours = [
      ...bars.slice(index - swingWindow, index),
      ...bars.slice(index + 1, index + swingWindow + 1),
    ];
    if (neighbours.length !== swingWindow * 2) return;
    if (neighbours.every((item) => bar.low < item.low)) lows.push(bar);
    if (neighbours.every((item) => bar.high > item.high)) highs.push(bar);
  });
  return { lows, highs };
}

function buildTechnicalDivergenceCandidates(
  pivots: Array<NonNullable<ReturnType<typeof normalizeTechnicalDivergenceBar>>>,
  indicator: TechnicalDivergenceIndicator,
  direction: "bullish" | "bearish",
  minPriceMovePct: number,
  minIndicatorMove: number,
  maxPerType: number,
): TechnicalDivergenceAnnotation[] {
  const candidates = pivots.slice(1).flatMap<TechnicalDivergenceAnnotation>((current, cursor) => {
    const previous = pivots[cursor];
    const previousIndicator = technicalDivergenceValue(previous, indicator);
    const currentIndicator = technicalDivergenceValue(current, indicator);
    if (previousIndicator == null || currentIndicator == null) return [];

    const previousPrice = direction === "bullish" ? previous.low : previous.high;
    const currentPrice = direction === "bullish" ? current.low : current.high;
    if (previousPrice <= 0) return [];
    const priceMovePct = Math.abs((currentPrice - previousPrice) / previousPrice) * 100;
    const indicatorMove = Math.abs(currentIndicator - previousIndicator);
    if (priceMovePct < minPriceMovePct || indicatorMove < minIndicatorMove) return [];

    const hasDivergence = direction === "bullish"
      ? currentPrice < previousPrice && currentIndicator > previousIndicator
      : currentPrice > previousPrice && currentIndicator < previousIndicator;
    if (!hasDivergence) return [];

    const type = `${indicator}-${direction}-divergence` as TechnicalDivergenceType;
    return [{
      key: `${type}-${previous.index}-${current.index}`,
      type,
      indicator,
      label: technicalDivergenceLabel(indicator, direction),
      tone: direction === "bullish" ? "good" : "risk",
      startIndex: previous.index,
      index: current.index,
      date: current.date,
      dateLabel: current.label,
      startDate: previous.date,
      startLabel: previous.label,
      startPrice: previousPrice,
      price: currentPrice,
      startIndicator: previousIndicator,
      endIndicator: currentIndicator,
    }];
  });
  return candidates.sort((left, right) => right.index - left.index).slice(0, maxPerType);
}

function technicalDivergenceValue(
  bar: NonNullable<ReturnType<typeof normalizeTechnicalDivergenceBar>>,
  indicator: TechnicalDivergenceIndicator,
) {
  return indicator === "rsi" ? bar.rsi : bar.macd;
}

function technicalDivergenceIndicatorRank(indicator: TechnicalDivergenceIndicator) {
  return indicator === "rsi" ? 0 : 1;
}

function technicalDivergenceLabel(indicator: TechnicalDivergenceIndicator, direction: "bullish" | "bearish") {
  const prefix = indicator === "rsi" ? "RSI" : "MACD";
  return `${prefix}${direction === "bullish" ? "底背离" : "顶背离"}`;
}

function calculateRangeDrawdownPct(
  bars: Array<NonNullable<ReturnType<typeof normalizeMeasuredRangeBar>>>,
) {
  let peak: number | null = null;
  let drawdown = 0;
  bars.forEach((bar) => {
    if (peak && peak > 0) {
      drawdown = Math.min(drawdown, bar.low / peak - 1);
    }
    if (peak == null || bar.high > peak) peak = bar.high;
  });
  return drawdown;
}

function calculateRangeRunupPct(
  bars: Array<NonNullable<ReturnType<typeof normalizeMeasuredRangeBar>>>,
) {
  let trough: number | null = null;
  let runup = 0;
  bars.forEach((bar) => {
    if (trough && trough > 0) {
      runup = Math.max(runup, bar.high / trough - 1);
    }
    if (trough == null || bar.low < trough) trough = bar.low;
  });
  return runup;
}

function classifyTrendRegime(bar: NonNullable<ReturnType<typeof normalizeTrendRegimeBar>>): TrendRegimeType {
  if (bar.maFast > bar.maMid && bar.maMid > bar.maSlow && bar.close >= bar.maMid) return "bullish";
  if (bar.maFast < bar.maMid && bar.maMid < bar.maSlow && bar.close <= bar.maMid) return "bearish";
  return "neutral";
}

function trendRegimeMeta(type: TrendRegimeType) {
  if (type === "bullish") return { label: "多头排列", tone: "good" as const };
  if (type === "bearish") return { label: "空头排列", tone: "risk" as const };
  return { label: "震荡过渡", tone: "neutral" as const };
}

function buildPriceStructureLineCandidates({
  pivots,
  type,
  label,
  tone,
  minSlopePct,
  latestIndex,
  extendToLatest,
}: {
  pivots: Array<{ index: number; price: number; label: string }>;
  type: PriceStructureTrendLineType;
  label: string;
  tone: PriceStructureTrendLineTone;
  minSlopePct: number;
  latestIndex: number;
  extendToLatest: boolean;
}): PriceStructureTrendLine[] {
  const expectsRising = type === "ascending-support";
  return pivots
    .slice(1)
    .flatMap<PriceStructureTrendLine>((pivot, cursor) => {
      const previous = pivots[cursor];
      const span = pivot.index - previous.index;
      if (span <= 0 || previous.price <= 0) return [];
      const priceDelta = pivot.price - previous.price;
      if (expectsRising ? priceDelta <= 0 : priceDelta >= 0) return [];
      const slopePct = Math.abs(priceDelta / previous.price) * 100;
      if (slopePct < minSlopePct) return [];
      const slopePerBar = priceDelta / span;
      const endIndex = extendToLatest ? Math.max(pivot.index, latestIndex) : pivot.index;
      const endPrice = previous.price + slopePerBar * (endIndex - previous.index);
      return [{
        key: `${type}-${previous.index}-${pivot.index}-${endIndex}`,
        type,
        label,
        tone,
        startIndex: previous.index,
        endIndex,
        startPrice: previous.price,
        endPrice,
        anchorStartIndex: previous.index,
        anchorEndIndex: pivot.index,
        anchorStartPrice: previous.price,
        anchorEndPrice: pivot.price,
        anchorStartLabel: previous.label,
        anchorEndLabel: pivot.label,
        slopePct,
      }];
    })
    .sort((left, right) =>
      right.anchorEndIndex - left.anchorEndIndex ||
      right.slopePct - left.slopePct,
    );
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

function latestIndexedEvent<T extends { index: number; label: string; dateLabel: string; tone: KlineEventSummaryTone }>(events: T[]) {
  return [...events].sort((left, right) => right.index - left.index)[0] ?? null;
}

function latestGapEvent(gaps: PriceGapAnnotation[]) {
  return [...gaps].sort((left, right) => right.endIndex - left.endIndex)[0] ?? null;
}

function latestTrendBand(bands: TrendRegimeBand[]) {
  return [...bands].sort((left, right) => right.endIndex - left.endIndex)[0] ?? null;
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
