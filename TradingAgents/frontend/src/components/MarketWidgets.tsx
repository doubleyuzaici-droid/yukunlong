import { type ChangeEvent, type KeyboardEvent, type MouseEvent, type WheelEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  FactorSnapshot,
  FundFlowSnapshot,
  IntradayPayload,
  IntradayPoint,
  MarketHistoryBar,
  MarketQuote,
  RealtimeQuote,
  RealtimeQuotePayload,
} from "../types/market";
import {
  CHART_PARAMETER_PRESETS,
  CHART_PREFERENCE_PRESETS,
  applyChartParameterPreset,
  applyChartPreferencePreset,
  buildManualDrawingStorageKey,
  buildAdvancedIndicators,
  buildCandlestickPatternAnnotations,
  buildFibonacciRetracementLevels,
  buildFundFlowOverlayGeometry,
  buildIndicatorBandAreaPath,
  buildIndicatorPanelReadouts,
  buildIndicatorAxisTicks,
  buildIndicatorSectionLayout,
  buildIndicatorThresholdGuides,
  buildIndicatorThresholdZones,
  buildIntradayMinuteBars,
  buildIndicatorValueLabels,
  buildChartLayerSummary,
  buildIndicatorStateSummary,
  buildIchimokuIndicators,
  buildEnvelopeIndicators,
  buildPsychologicalLineIndicators,
  buildOscillatorIndicators,
  buildKlineEventDensity,
  buildCompactAnnotationDisplay,
  buildKlineEventBacktestSummary,
  buildKlineEventSummary,
  buildKlineRangeNavigator,
  buildKlineHoverMetrics,
  buildHeikinAshiBars,
  buildLatestPriceLine,
  buildLimitPriceLines,
  buildManualDrawingGeometry,
  buildOverlayPriceLabels,
  buildPriceAdjustedBars,
  buildPriceAxisScale,
  buildRelativeStrengthOverlaySeries,
  buildMeasuredRangeStats,
  buildMomentumIndicators,
  buildPriceGapAnnotations,
  buildPriceStructureTrendLines,
  buildReadableStrategyDecisionCopy,
  buildReadableStrategyGateText,
  buildSupportResistanceLevels,
  buildTdsSequentialAnnotations,
  buildTechnicalDivergenceAnnotations,
  buildTechnicalIndicatorAnnotations,
  buildTrendOverlayIndicators,
  buildTrendRibbonAreaSegments,
  buildTrendRegimeBands,
  buildVisiblePriceExtrema,
  buildVolumeProfileLevelAnnotations,
  buildVolumeSignalAnnotations,
  buildVolumeMovingAverageValues,
  buildVolumeMomentumIndicators,
  buildVolatilityVolumeIndicators,
  buildVolumeProfile,
  DEFAULT_DENSE_CHART_LAYER_SELECTION,
  buildMikeIndicators,
  matchChartParameterPreset,
  matchChartPreferencePreset,
  mapClientPointToChartViewBox,
  normalizeManualDrawings,
  normalizeKlineRenderMode,
  normalizePriceAdjustmentMode,
  normalizePriceAxisMode,
  priceAdjustmentPriceByFactor,
  priceAxisPriceFromValue,
  priceAxisPriceFromY,
  priceAxisValueFromPrice,
  priceAxisYOf,
  rightOffsetFromKlineNavigatorX,
  resolveLimitCandleState,
  selectIndicatorReadoutSnapshot,
  shouldRenderDenseChartLayer,
  type CompactAnnotationEvent,
  type DenseChartLayerSelection,
  type IndicatorAxisTick,
  type IndicatorPanelReadoutItem,
  type IndicatorValueLabel,
  type IndicatorValueLabelDefinition,
  type KlineRenderMode,
  type ManualDrawing,
  type ManualDrawingAnchor,
  type ManualDrawingType,
  type OverlayPriceLabelDefinition,
  type PriceAdjustedBarsResult,
  type PriceAdjustmentMode,
  type PriceAxisMode,
  type VolumeProfileModel,
} from "./TradingSignalKline.helpers";
import { buildMarketMicrostructureModel, type MarketMicrostructureModel } from "../pages/SymbolWorkspacePage.helpers";
import {
  isTickerRealtimeQuote,
  mergeRealtimeTickerQuotes,
  type TickerQuote,
} from "./MarketTicker.helpers";
import {
  formatCompactNumber,
  formatMoney,
  formatNumber,
  formatPercent,
  formatSignedNumber,
  formatSignedPercent,
  freshnessTone,
  quoteTone,
} from "../utils/formatters";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
}

interface QuotePayload {
  requested_count: number;
  loaded_count: number;
  missing_count: number;
  quotes: MarketQuote[];
}

interface PulseLite {
  quotes: MarketQuote[];
}

export interface ChartSignalMarker {
  signal_id: string;
  date: string;
  original_date?: string;
  signal_name: string;
  signal_level?: string;
  direction?: string;
  entry_date?: string | null;
  original_entry_date?: string | null;
  entry_price?: number | null;
  score?: number | null;
  review_count?: number;
  ret_5d?: number | null;
  ret_20d?: number | null;
  ret_60d?: number | null;
  max_adverse_20d?: number | null;
}

export interface ChartEvidenceEvent {
  id: string;
  date: string;
  original_date?: string;
  kind: "evidence" | "risk" | "invalid" | "review" | "readiness" | "strategy" | "market";
  tone: "good" | "warn" | "risk" | "neutral";
  label: string;
  title: string;
  detail: string;
  signal_id?: string | null;
}

type QuoteSortKey = "symbol" | "price" | "change_pct" | "volume" | "freshness";
type SortDirection = "asc" | "desc";
type CandleRange = "60" | "120" | "260" | "520" | "780" | "all";
type CandlePeriod = "minute1" | "minute5" | "minute15" | "minute30" | "hourly" | "daily" | "weekly" | "monthly";
type AnnotationLabelMode = "compact" | "all";
type DecisionTone = "opportunity" | "risk" | "neutral";
type StrategyWorkbenchTone = "good" | "warn" | "bad" | "neutral";

type PeriodMarketBar = MarketHistoryBar & {
  period_start?: string;
  period_end?: string;
  period_label?: string;
};

interface TradingIndicatorSnapshot {
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  prevClose?: number | null;
  change?: number | null;
  changePct?: number | null;
  amplitudePct?: number | null;
  volume?: number | null;
  amount?: number | null;
  ma5?: number | null;
  ma20?: number | null;
  ma60?: number | null;
  ma120?: number | null;
  emaFast?: number | null;
  emaSlow?: number | null;
  vwap?: number | null;
  dif?: number | null;
  dea?: number | null;
  macd?: number | null;
  rsi14?: number | null;
  psy?: number | null;
  psyMa?: number | null;
  kdjK?: number | null;
  kdjD?: number | null;
  kdjJ?: number | null;
  bollUpper?: number | null;
  bollMid?: number | null;
  bollLower?: number | null;
  sar?: number | null;
  bbi?: number | null;
  mikeWeakResistance?: number | null;
  mikeMediumResistance?: number | null;
  mikeStrongResistance?: number | null;
  mikeWeakSupport?: number | null;
  mikeMediumSupport?: number | null;
  mikeStrongSupport?: number | null;
  bias?: number | null;
  dma?: number | null;
  ama?: number | null;
  vr?: number | null;
  mfi?: number | null;
  roc?: number | null;
  trix?: number | null;
  trma?: number | null;
  osc?: number | null;
  oscEma?: number | null;
  cr?: number | null;
  ar?: number | null;
  br?: number | null;
  emv?: number | null;
  emvMa?: number | null;
  pdi?: number | null;
  mdi?: number | null;
  adx?: number | null;
  cci?: number | null;
  wr?: number | null;
  volumeRatio?: number | null;
  atr?: number | null;
  obv?: number | null;
  bollPercentB?: number | null;
  bollBandwidth?: number | null;
}

interface DecisionCheck {
  label: string;
  value: string;
  active: boolean;
}

interface StrategyDecisionStep {
  key: string;
  label: string;
  status: string;
  detail: string;
  tone: StrategyWorkbenchTone;
}

interface StrategySnapshotItem {
  label: string;
  value: string;
  detail?: string;
  tone?: StrategyWorkbenchTone;
}

interface StrategyFactorRow {
  label: string;
  buy?: number;
  sell?: number;
}

interface TradingChartPreferences {
  ma: boolean;
  ema: boolean;
  boll: boolean;
  ene: boolean;
  mike: boolean;
  vwap: boolean;
  levels: boolean;
  limitLines: boolean;
  signals: boolean;
  events: boolean;
  relative: boolean;
  profile: boolean;
  fundFlow: boolean;
  ichimoku: boolean;
  fibonacci: boolean;
  supportResistance: boolean;
  trendLines: boolean;
  patterns: boolean;
  tds9: boolean;
  indicatorSignals: boolean;
  divergences: boolean;
  volumeSignals: boolean;
  trendRegime: boolean;
  sar: boolean;
  bbi: boolean;
  volume: boolean;
  macd: boolean;
  rsi: boolean;
  kdj: boolean;
  advanced: boolean;
  momentum: boolean;
  biasDma: boolean;
  volumeMomentum: boolean;
  volatility: boolean;
  subCharts: boolean;
  measure: boolean;
}

interface TradingChartParameters {
  maFast: number;
  maMid: number;
  maSlow: number;
  emaFast: number;
  emaSlow: number;
  bollPeriod: number;
  bollMultiplier: number;
  enePeriod: number;
  enePercent: number;
  mikePeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  rsiPeriod: number;
  psyPeriod: number;
  psyMaPeriod: number;
  kdjPeriod: number;
  crPeriod: number;
  emvPeriod: number;
  momentumPeriod: number;
  biasPeriod: number;
  dmaFast: number;
  dmaSlow: number;
  dmaSignal: number;
  volumeMomentumPeriod: number;
  rocPeriod: number;
  oscPeriod: number;
  oscEmaPeriod: number;
  trixPeriod: number;
  trixSignal: number;
  atrPeriod: number;
}

type TradingChartDrawingTool = "none" | ManualDrawingType;

export interface StrategyKlineAnalysis {
  strategy_name: string;
  symbol: string;
  mode: "conservative" | "aggressive";
  latest_bar?: {
    date?: string;
    close?: number | null;
  };
  decision: {
    action: string;
    label: string;
    tone: string;
  };
  trend_state?: {
    label?: string;
    strength?: number | null;
    action?: string;
    sample_count?: number;
  };
  market_filter?: {
    benchmark_symbol?: string;
    status?: string;
    passed?: boolean;
    trend_label?: string;
  };
  buy_signal?: {
    score?: number | null;
    threshold?: number;
    mode_signal?: boolean;
    conservative_entry?: boolean;
    aggressive_entry?: boolean;
    factors?: Record<string, number>;
  };
  sell_signal?: {
    score?: number | null;
    threshold?: number;
    regular_exit?: boolean;
    emergency?: boolean;
    warning_level?: {
      level: number;
      label: string;
      action: string;
    };
    components?: Record<string, number>;
  };
  price_channels?: Record<string, number>;
  position_plan?: {
    suggested_shares?: number;
    suggested_notional?: number;
    suggested_position_pct?: number;
    stop_distance?: number;
    risk_pct?: number;
  };
  checklist?: {
    label: string;
    passed: boolean;
    detail: string;
  }[];
  data_quality?: {
    warnings?: string[];
    blocking_reasons?: string[];
    bar_count?: number;
    has_benchmark?: boolean;
    has_fund_flow?: boolean;
  };
  disclaimer?: string;
}

export interface StrategyKlineBacktest {
  backtest_id: string;
  start: string;
  end: string;
  result: {
    strategy_version: string;
    zero_trade_reasons?: string[];
    metrics: {
      final_equity?: number;
      total_return?: number;
      max_drawdown?: number;
      trade_count?: number;
      round_trip_count?: number;
      order_count?: number;
      win_rate?: number;
      signal_count?: number;
      benchmark_symbol?: string;
      excess_return?: number;
      benchmark_coverage?: number;
    };
    data_quality?: {
      no_trade_reasons?: string[];
      action_counts?: Record<string, number>;
      benchmark_status?: string;
      bar_count?: number;
    };
    equity_curve?: { date: string; equity: number; drawdown?: number }[];
    trades?: { date: string; side: string; price: number; quantity: number; reason?: string }[];
  };
}

export interface StrategyKlineControls {
  mode: "conservative" | "aggressive";
  loading: boolean;
  actionMessage?: string;
  backtest?: StrategyKlineBacktest | null;
  onModeChange: (mode: "conservative" | "aggressive") => void;
  onCreateSignal: () => void;
  onRunBacktest: () => void;
}

const CANDLE_RANGES: { key: CandleRange; baseLabel?: string; label?: string }[] = [
  { key: "60", baseLabel: "60" },
  { key: "120", baseLabel: "120" },
  { key: "260", baseLabel: "260" },
  { key: "520", baseLabel: "520" },
  { key: "780", baseLabel: "780" },
  { key: "all", label: "全部" },
];

const CANDLE_PERIODS: { key: CandlePeriod; label: string; unit: string; shortUnit: string }[] = [
  { key: "minute1", label: "1分", unit: "1分钟", shortUnit: "分" },
  { key: "minute5", label: "5分", unit: "5分钟", shortUnit: "分" },
  { key: "minute15", label: "15分", unit: "15分钟", shortUnit: "分" },
  { key: "minute30", label: "30分", unit: "30分钟", shortUnit: "分" },
  { key: "hourly", label: "60分", unit: "60分钟", shortUnit: "时" },
  { key: "daily", label: "日线", unit: "日线", shortUnit: "日" },
  { key: "weekly", label: "周线", unit: "周线", shortUnit: "周" },
  { key: "monthly", label: "月线", unit: "月线", shortUnit: "月" },
];

const HISTORICAL_CANDLE_PERIODS = CANDLE_PERIODS.filter((item) => !isIntradayPeriod(item.key));

const PRICE_ADJUSTMENT_MODES: { key: PriceAdjustmentMode; label: string }[] = [
  { key: "none", label: "不复权" },
  { key: "forward", label: "前复权" },
  { key: "backward", label: "后复权" },
];

const KLINE_RENDER_MODES: { key: KlineRenderMode; label: string }[] = [
  { key: "candle", label: "蜡烛" },
  { key: "line", label: "收盘线" },
  { key: "ohlc", label: "OHLC" },
  { key: "heikinAshi", label: "平均K" },
];

const DEFAULT_TRADING_CHART_PREFS: TradingChartPreferences = {
  ma: true,
  ema: false,
  boll: true,
  ene: false,
  mike: false,
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
  measure: false,
};

const DEFAULT_TRADING_CHART_PARAMS: TradingChartParameters = {
  maFast: 5,
  maMid: 20,
  maSlow: 60,
  emaFast: 12,
  emaSlow: 26,
  bollPeriod: 20,
  bollMultiplier: 2,
  enePeriod: 25,
  enePercent: 6,
  mikePeriod: 12,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  rsiPeriod: 14,
  psyPeriod: 12,
  psyMaPeriod: 6,
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
  oscPeriod: 10,
  oscEmaPeriod: 6,
  trixPeriod: 12,
  trixSignal: 9,
  atrPeriod: 14,
};

function isCandleRange(value: unknown): value is CandleRange {
  return CANDLE_RANGES.some((item) => item.key === value);
}

function isCandlePeriod(value: unknown): value is CandlePeriod {
  return CANDLE_PERIODS.some((item) => item.key === value);
}

function isIntradayPeriod(period: CandlePeriod) {
  return period === "minute1" || period === "minute5" || period === "minute15" || period === "minute30" || period === "hourly";
}

function normalizeAnnotationLabelMode(value: unknown): AnnotationLabelMode {
  return value === "all" ? "all" : "compact";
}

type DenseLayerControlKey = keyof DenseChartLayerSelection;

const DENSE_CHART_LAYER_CONTROLS: { key: DenseLayerControlKey; label: string; title: string }[] = [
  { key: "signals", label: "信号点", title: "显示 TDS9、技术信号、背离、形态和量价异动点" },
  { key: "structure", label: "结构线", title: "显示缺口、支撑压力、趋势线、斐波、ENE/MIKE/一目结构" },
  { key: "profile", label: "筹码", title: "显示筹码分布和成本区域" },
  { key: "secondaryIndicators", label: "高级副图", title: "显示 KDJ、DMI、CCI、WR、MFI、VR、ATR、OBV 等复杂指标" },
  { key: "trendRegime", label: "背景", title: "显示趋势状态背景和阶段标签" },
];

function normalizeDenseChartLayerSelection(value: unknown): DenseChartLayerSelection {
  if (!value || typeof value !== "object") return { ...DEFAULT_DENSE_CHART_LAYER_SELECTION };
  const next = value as Partial<Record<DenseLayerControlKey, unknown>>;
  return {
    profile: typeof next.profile === "boolean" ? next.profile : DEFAULT_DENSE_CHART_LAYER_SELECTION.profile,
    secondaryIndicators:
      typeof next.secondaryIndicators === "boolean"
        ? next.secondaryIndicators
        : DEFAULT_DENSE_CHART_LAYER_SELECTION.secondaryIndicators,
    signals: typeof next.signals === "boolean" ? next.signals : DEFAULT_DENSE_CHART_LAYER_SELECTION.signals,
    structure: typeof next.structure === "boolean" ? next.structure : DEFAULT_DENSE_CHART_LAYER_SELECTION.structure,
    trendRegime: typeof next.trendRegime === "boolean" ? next.trendRegime : DEFAULT_DENSE_CHART_LAYER_SELECTION.trendRegime,
  };
}

function hasSelectedDenseChartLayers(selection: DenseChartLayerSelection) {
  return DENSE_CHART_LAYER_CONTROLS.some((item) => selection[item.key]);
}

function normalizeTradingChartPrefs(value: unknown): TradingChartPreferences {
  if (!value || typeof value !== "object") return DEFAULT_TRADING_CHART_PREFS;
  const next = value as Partial<Record<keyof TradingChartPreferences, unknown>>;
  return {
    ma: typeof next.ma === "boolean" ? next.ma : DEFAULT_TRADING_CHART_PREFS.ma,
    ema: typeof next.ema === "boolean" ? next.ema : DEFAULT_TRADING_CHART_PREFS.ema,
    boll: typeof next.boll === "boolean" ? next.boll : DEFAULT_TRADING_CHART_PREFS.boll,
    ene: typeof next.ene === "boolean" ? next.ene : DEFAULT_TRADING_CHART_PREFS.ene,
    mike: typeof next.mike === "boolean" ? next.mike : DEFAULT_TRADING_CHART_PREFS.mike,
    vwap: typeof next.vwap === "boolean" ? next.vwap : DEFAULT_TRADING_CHART_PREFS.vwap,
    levels: typeof next.levels === "boolean" ? next.levels : DEFAULT_TRADING_CHART_PREFS.levels,
    limitLines: typeof next.limitLines === "boolean" ? next.limitLines : DEFAULT_TRADING_CHART_PREFS.limitLines,
    signals: typeof next.signals === "boolean" ? next.signals : DEFAULT_TRADING_CHART_PREFS.signals,
    events: typeof next.events === "boolean" ? next.events : DEFAULT_TRADING_CHART_PREFS.events,
    relative: typeof next.relative === "boolean" ? next.relative : DEFAULT_TRADING_CHART_PREFS.relative,
    profile: typeof next.profile === "boolean" ? next.profile : DEFAULT_TRADING_CHART_PREFS.profile,
    fundFlow: typeof next.fundFlow === "boolean" ? next.fundFlow : DEFAULT_TRADING_CHART_PREFS.fundFlow,
    ichimoku: typeof next.ichimoku === "boolean" ? next.ichimoku : DEFAULT_TRADING_CHART_PREFS.ichimoku,
    fibonacci: typeof next.fibonacci === "boolean" ? next.fibonacci : DEFAULT_TRADING_CHART_PREFS.fibonacci,
    supportResistance: typeof next.supportResistance === "boolean" ? next.supportResistance : DEFAULT_TRADING_CHART_PREFS.supportResistance,
    trendLines: typeof next.trendLines === "boolean" ? next.trendLines : DEFAULT_TRADING_CHART_PREFS.trendLines,
    patterns: typeof next.patterns === "boolean" ? next.patterns : DEFAULT_TRADING_CHART_PREFS.patterns,
    tds9: typeof next.tds9 === "boolean" ? next.tds9 : DEFAULT_TRADING_CHART_PREFS.tds9,
    indicatorSignals: typeof next.indicatorSignals === "boolean" ? next.indicatorSignals : DEFAULT_TRADING_CHART_PREFS.indicatorSignals,
    divergences: typeof next.divergences === "boolean" ? next.divergences : DEFAULT_TRADING_CHART_PREFS.divergences,
    volumeSignals: typeof next.volumeSignals === "boolean" ? next.volumeSignals : DEFAULT_TRADING_CHART_PREFS.volumeSignals,
    trendRegime: typeof next.trendRegime === "boolean" ? next.trendRegime : DEFAULT_TRADING_CHART_PREFS.trendRegime,
    sar: typeof next.sar === "boolean" ? next.sar : DEFAULT_TRADING_CHART_PREFS.sar,
    bbi: typeof next.bbi === "boolean" ? next.bbi : DEFAULT_TRADING_CHART_PREFS.bbi,
    volume: typeof next.volume === "boolean" ? next.volume : DEFAULT_TRADING_CHART_PREFS.volume,
    macd: typeof next.macd === "boolean" ? next.macd : DEFAULT_TRADING_CHART_PREFS.macd,
    rsi: typeof next.rsi === "boolean" ? next.rsi : DEFAULT_TRADING_CHART_PREFS.rsi,
    kdj: typeof next.kdj === "boolean" ? next.kdj : DEFAULT_TRADING_CHART_PREFS.kdj,
    advanced: typeof next.advanced === "boolean" ? next.advanced : DEFAULT_TRADING_CHART_PREFS.advanced,
    momentum: typeof next.momentum === "boolean" ? next.momentum : DEFAULT_TRADING_CHART_PREFS.momentum,
    biasDma: typeof next.biasDma === "boolean" ? next.biasDma : DEFAULT_TRADING_CHART_PREFS.biasDma,
    volumeMomentum: typeof next.volumeMomentum === "boolean" ? next.volumeMomentum : DEFAULT_TRADING_CHART_PREFS.volumeMomentum,
    volatility: typeof next.volatility === "boolean" ? next.volatility : DEFAULT_TRADING_CHART_PREFS.volatility,
    subCharts: typeof next.subCharts === "boolean" ? next.subCharts : DEFAULT_TRADING_CHART_PREFS.subCharts,
    measure: typeof next.measure === "boolean" ? next.measure : DEFAULT_TRADING_CHART_PREFS.measure,
  };
}

function normalizeTradingChartParams(value: unknown): TradingChartParameters {
  if (!value || typeof value !== "object") return DEFAULT_TRADING_CHART_PARAMS;
  const next = value as Partial<Record<keyof TradingChartParameters, unknown>>;
  return {
    maFast: boundedInteger(next.maFast, 3, 20, DEFAULT_TRADING_CHART_PARAMS.maFast),
    maMid: boundedInteger(next.maMid, 5, 80, DEFAULT_TRADING_CHART_PARAMS.maMid),
    maSlow: boundedInteger(next.maSlow, 20, 250, DEFAULT_TRADING_CHART_PARAMS.maSlow),
    emaFast: boundedInteger(next.emaFast, 3, 80, DEFAULT_TRADING_CHART_PARAMS.emaFast),
    emaSlow: boundedInteger(next.emaSlow, 5, 250, DEFAULT_TRADING_CHART_PARAMS.emaSlow),
    bollPeriod: boundedInteger(next.bollPeriod, 10, 80, DEFAULT_TRADING_CHART_PARAMS.bollPeriod),
    bollMultiplier: boundedNumber(next.bollMultiplier, 1, 4, DEFAULT_TRADING_CHART_PARAMS.bollMultiplier),
    enePeriod: boundedInteger(next.enePeriod, 5, 160, DEFAULT_TRADING_CHART_PARAMS.enePeriod),
    enePercent: boundedNumber(next.enePercent, 0.5, 30, DEFAULT_TRADING_CHART_PARAMS.enePercent),
    mikePeriod: boundedInteger(next.mikePeriod, 3, 120, DEFAULT_TRADING_CHART_PARAMS.mikePeriod),
    macdFast: boundedInteger(next.macdFast, 5, 24, DEFAULT_TRADING_CHART_PARAMS.macdFast),
    macdSlow: boundedInteger(next.macdSlow, 18, 60, DEFAULT_TRADING_CHART_PARAMS.macdSlow),
    macdSignal: boundedInteger(next.macdSignal, 4, 20, DEFAULT_TRADING_CHART_PARAMS.macdSignal),
    rsiPeriod: boundedInteger(next.rsiPeriod, 5, 40, DEFAULT_TRADING_CHART_PARAMS.rsiPeriod),
    psyPeriod: boundedInteger(next.psyPeriod, 3, 80, DEFAULT_TRADING_CHART_PARAMS.psyPeriod),
    psyMaPeriod: boundedInteger(next.psyMaPeriod, 2, 40, DEFAULT_TRADING_CHART_PARAMS.psyMaPeriod),
    kdjPeriod: boundedInteger(next.kdjPeriod, 5, 40, DEFAULT_TRADING_CHART_PARAMS.kdjPeriod),
    crPeriod: boundedInteger(next.crPeriod, 5, 80, DEFAULT_TRADING_CHART_PARAMS.crPeriod),
    emvPeriod: boundedInteger(next.emvPeriod, 5, 60, DEFAULT_TRADING_CHART_PARAMS.emvPeriod),
    momentumPeriod: boundedInteger(next.momentumPeriod, 5, 60, DEFAULT_TRADING_CHART_PARAMS.momentumPeriod),
    biasPeriod: boundedInteger(next.biasPeriod, 3, 40, DEFAULT_TRADING_CHART_PARAMS.biasPeriod),
    dmaFast: boundedInteger(next.dmaFast, 3, 40, DEFAULT_TRADING_CHART_PARAMS.dmaFast),
    dmaSlow: boundedInteger(next.dmaSlow, 8, 160, DEFAULT_TRADING_CHART_PARAMS.dmaSlow),
    dmaSignal: boundedInteger(next.dmaSignal, 3, 40, DEFAULT_TRADING_CHART_PARAMS.dmaSignal),
    volumeMomentumPeriod: boundedInteger(next.volumeMomentumPeriod, 5, 80, DEFAULT_TRADING_CHART_PARAMS.volumeMomentumPeriod),
    rocPeriod: boundedInteger(next.rocPeriod, 3, 80, DEFAULT_TRADING_CHART_PARAMS.rocPeriod),
    oscPeriod: boundedInteger(next.oscPeriod, 3, 80, DEFAULT_TRADING_CHART_PARAMS.oscPeriod),
    oscEmaPeriod: boundedInteger(next.oscEmaPeriod, 2, 40, DEFAULT_TRADING_CHART_PARAMS.oscEmaPeriod),
    trixPeriod: boundedInteger(next.trixPeriod, 3, 40, DEFAULT_TRADING_CHART_PARAMS.trixPeriod),
    trixSignal: boundedInteger(next.trixSignal, 3, 40, DEFAULT_TRADING_CHART_PARAMS.trixSignal),
    atrPeriod: boundedInteger(next.atrPeriod, 5, 40, DEFAULT_TRADING_CHART_PARAMS.atrPeriod),
  };
}

function boundedInteger(value: unknown, min: number, max: number, fallback: number) {
  const next = Math.round(Number(value));
  return Number.isFinite(next) ? clampNumber(next, min, max) : fallback;
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? clampNumber(next, min, max) : fallback;
}

function usePersistentChartValue<T>(
  key: string,
  fallback: T,
  normalize: (value: unknown) => T,
) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? normalize(JSON.parse(stored)) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

export function MarketTickerStrip({
  onSelect,
}: {
  onSelect?: (symbol: string) => void;
}) {
  const [quotes, setQuotes] = useState<TickerQuote[]>([]);
  const [message, setMessage] = useState("读取中");

  const load = async () => {
    try {
      const response = await fetch("/api/market/pulse");
      const payload = (await response.json()) as ApiResponse<PulseLite>;
      if (payload.success) {
        const pulseQuotes = payload.data.quotes.filter((quote) => quote.status === "ok").slice(0, 10);
        const symbols = pulseQuotes.map((quote) => quote.symbol).filter(Boolean).join(",");
        let displayQuotes: TickerQuote[] = pulseQuotes;
        if (symbols) {
          try {
            const realtimeResponse = await fetch(`/api/market/realtime/quotes?${new URLSearchParams({ symbols }).toString()}`);
            const realtimePayload = (await realtimeResponse.json()) as ApiResponse<RealtimeQuotePayload>;
            if (realtimePayload.success) {
              displayQuotes = mergeRealtimeTickerQuotes(pulseQuotes, realtimePayload.data.quotes);
            }
          } catch {
            displayQuotes = pulseQuotes;
          }
        }
        setQuotes(displayQuotes);
        setMessage(pulseQuotes.length ? "" : "暂无行情");
      } else {
        setMessage("行情不可用");
      }
    } catch {
      setMessage("行情服务未连接");
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="market-strip" aria-label="顶部行情条">
      {quotes.map((quote) => (
        <button
          className="market-strip-item"
          key={quote.symbol}
          onClick={() => onSelect?.(quote.symbol)}
          title={`查看 ${quote.symbol} 个股工作台`}
        >
          <span className="strip-market">{quote.market}</span>
          <strong>{quote.symbol}</strong>
          <i className={quoteTone(quote.change_pct)}>{directionMark(quote.change_pct)}</i>
          <span>{formatNumber(quote.price, 2)}</span>
          <b className={quoteTone(quote.change_pct)}>{formatSignedPercent(quote.change_pct)}</b>
          <em className={`freshness-dot ${freshnessTone(isTickerRealtimeQuote(quote) ? "fresh" : quote.freshness_status)}`} />
        </button>
      ))}
      {quotes.length === 0 && <span className="market-strip-empty">{message}</span>}
    </div>
  );
}

export function QuoteCard({ quote }: { quote?: MarketQuote | null }) {
  if (!quote) {
    return <div className="quote-card empty-quote">选择标的后查看本地行情。</div>;
  }
  const tone = quoteTone(quote.change_pct);
  return (
    <div className={`quote-card ${tone}`}>
      <div className="quote-card-head">
        <div>
          <span className="eyebrow">{quote.market || "MARKET"}</span>
          <h2>{quote.symbol}</h2>
          <p>{quote.trade_date || quote.status_text || "暂无交易日"}</p>
        </div>
        <div className="quote-price-block">
          <strong>{formatNumber(quote.price, 2)}</strong>
          <span className={tone}>
            {formatSignedNumber(quote.change)} / {formatSignedPercent(quote.change_pct)}
          </span>
        </div>
      </div>
      <div className="trust-strip">
        <span className={`status-badge freshness-${freshnessTone(quote.freshness_status)}`}>
          {quote.freshness_text || "无行情"}
        </span>
        <span>{quote.source || "unknown source"}</span>
        <span>{quote.delay_policy || "本地日线缓存，非实时行情"}</span>
      </div>
      <Sparkline points={quote.sparkline} tone={tone} />
      <div className="quote-stat-grid">
        <QuoteStat label="开盘" value={formatNumber(quote.open, 2)} />
        <QuoteStat label="昨收" value={formatNumber(quote.prev_close, 2)} />
        <QuoteStat label="最高" value={formatNumber(quote.high, 2)} />
        <QuoteStat label="最低" value={formatNumber(quote.low, 2)} />
        <QuoteStat label="成交量" value={formatCompactNumber(quote.volume)} />
        <QuoteStat label="成交额" value={formatMoney(quote.amount)} />
      </div>
    </div>
  );
}

function QuoteStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function RealtimeMarketPanel({
  symbol,
  onDataChange,
}: {
  symbol: string;
  onDataChange?: (payload: { quote: RealtimeQuote | null; intraday: IntradayPayload | null }) => void;
}) {
  const [quote, setQuote] = useState<RealtimeQuote | null>(null);
  const [intraday, setIntraday] = useState<IntradayPayload | null>(null);
  const [message, setMessage] = useState("连接准实时行情");
  const [loading, setLoading] = useState(false);

  const loadRealtime = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    const quoteParams = new URLSearchParams({ symbols: symbol });
    const intradayParams = new URLSearchParams({ symbol });
    try {
      const [quoteResponse, intradayResponse] = await Promise.all([
        fetch(`/api/market/realtime/quotes?${quoteParams.toString()}`),
        fetch(`/api/market/realtime/intraday?${intradayParams.toString()}`),
      ]);
      const quotePayload = (await quoteResponse.json()) as ApiResponse<RealtimeQuotePayload>;
      const intradayPayload = (await intradayResponse.json()) as ApiResponse<IntradayPayload>;
      const nextQuote = quotePayload.success ? quotePayload.data.quotes[0] || null : null;
      const nextIntraday = intradayPayload.success ? intradayPayload.data : null;
      setQuote(nextQuote);
      setIntraday(nextIntraday);
      onDataChange?.({ quote: nextQuote, intraday: nextIntraday });
      setMessage(nextQuote?.status_text || nextIntraday?.status_text || "准实时行情已更新");
    } catch {
      setQuote(null);
      setIntraday(null);
      onDataChange?.({ quote: null, intraday: null });
      setMessage("准实时行情服务未连接");
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadRealtime();
    const timer = window.setInterval(() => {
      void loadRealtime();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [symbol]);

  const effectiveQuote = intraday?.quote || quote;
  const chart = useMemo(
    () => buildIntradayGeometry(intraday?.points || [], effectiveQuote?.prev_close),
    [effectiveQuote?.prev_close, intraday?.points],
  );
  const tone = quoteTone(effectiveQuote?.change_pct);
  const statusTone = effectiveQuote?.status === "live" || intraday?.status === "live"
    ? "live"
    : effectiveQuote?.status === "fallback"
      ? "fallback"
      : "unavailable";
  const timestamp = effectiveQuote?.timestamp || intraday?.generated_at || "-";
  const microstructure = useMemo(
    () => buildMarketMicrostructureModel({ quote: effectiveQuote, intraday }),
    [effectiveQuote, intraday],
  );

  return (
    <div className={`realtime-market-panel ${statusTone}`}>
      <div className="realtime-head">
        <div>
          <span className="eyebrow">P0 / P1 Realtime</span>
          <h2>{effectiveQuote?.name || symbol}</h2>
          <p>
            {effectiveQuote?.source || intraday?.source || "-"} · {effectiveQuote?.delay_policy || intraday?.delay_policy || "-"}
          </p>
        </div>
        <div className="realtime-actions">
          <span className={`realtime-status ${statusTone}`}>{realtimeStatusLabel(statusTone)}</span>
          <button className="mini" onClick={loadRealtime} disabled={loading} type="button">
            {loading ? "刷新中" : "刷新"}
          </button>
        </div>
      </div>

      <div className="realtime-grid">
        <div className="realtime-quote-card">
          <span>{effectiveQuote?.symbol || symbol}</span>
          <strong className={tone}>{formatNumber(effectiveQuote?.price, 2)}</strong>
          <em className={tone}>
            {formatSignedNumber(effectiveQuote?.change)} / {formatSignedPercent(effectiveQuote?.change_pct)}
          </em>
          <small>
            {effectiveQuote?.trade_date || "-"} {effectiveQuote?.trade_time || ""}
          </small>
        </div>
        <RealtimeStat label="今开 / 昨收" value={`${formatNumber(effectiveQuote?.open, 2)} / ${formatNumber(effectiveQuote?.prev_close, 2)}`} />
        <RealtimeStat label="最高 / 最低" value={`${formatNumber(effectiveQuote?.high, 2)} / ${formatNumber(effectiveQuote?.low, 2)}`} />
        <RealtimeStat label="成交量" value={formatCompactNumber(effectiveQuote?.volume)} />
        <RealtimeStat label="成交额" value={formatMoney(effectiveQuote?.amount)} />
        <RealtimeStat label="更新时间" value={formatRealtimeClock(timestamp)} />
      </div>

      <div className="intraday-chart-wrap">
        <div className="intraday-chart-title">
          <strong>实时分时</strong>
          <span>
            {intraday?.date || "-"} · {intraday?.point_count || 0} 个1分钟点 · {message}
          </span>
        </div>
        <svg className="intraday-chart" viewBox="0 0 1000 360" preserveAspectRatio="none">
          {chart.priceTicks.map((tick) => (
            <g className="intraday-price-tick" key={tick.label}>
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={tick.y} y2={tick.y} />
              <text x={chart.axisX} y={tick.y - 4}>{formatNumber(tick.value, 2)}</text>
            </g>
          ))}
          {chart.prevCloseY != null && (
            <g className="intraday-prev-close">
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={chart.prevCloseY} y2={chart.prevCloseY} />
              <text x={chart.plotLeft} y={Math.max(18, chart.prevCloseY - 6)}>昨收 {formatNumber(effectiveQuote?.prev_close, 2)}</text>
            </g>
          )}
          {chart.volumeBars.map((bar) => (
            <rect
              className={`intraday-volume-bar ${bar.tone}`}
              height={bar.height}
              key={`${bar.time}-${bar.x}`}
              width={bar.width}
              x={bar.x}
              y={bar.y}
            />
          ))}
          {chart.priceLine && <polyline className={`intraday-price-line ${tone}`} points={chart.priceLine} />}
          {chart.latest && (
            <g className="intraday-latest-dot">
              <circle cx={chart.latest.x} cy={chart.latest.y} r="4.5" />
              <text x={Math.max(chart.plotLeft + 8, chart.latest.x - 78)} y={Math.max(18, chart.latest.y - 12)}>
                {chart.latest.time} {formatNumber(chart.latest.price, 2)}
              </text>
            </g>
          )}
          {chart.points.length === 0 && <text className="intraday-empty-text" x="48" y="168">分时数据暂不可用</text>}
        </svg>
      </div>

      <MarketMicrostructurePanel model={microstructure} />
    </div>
  );
}

function MarketMicrostructurePanel({ model }: { model: MarketMicrostructureModel }) {
  return (
    <div className="microstructure-panel">
      <div className="microstructure-head">
        <div>
          <strong>交易型行情深度</strong>
          <span>
            快照 {model.quoteSource} · 分时 {model.intradaySource} · {model.sameSource ? "同源" : "异源/待校验"}
          </span>
        </div>
        <span className={`realtime-status ${model.statusTone}`}>{model.providerLabel}</span>
      </div>
      <div className="microstructure-grid">
        <div className="microstructure-block">
          <span className="microstructure-block-title">盘口</span>
          {model.depthRows.map((row) => (
            <div className={`microstructure-row ${row.tone}`} key={row.key}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <em>{row.detail}</em>
            </div>
          ))}
        </div>
        <div className="microstructure-block">
          <span className="microstructure-block-title">逐笔</span>
          <div className="microstructure-tape">
            <div className="microstructure-tape-head">
              <span>时间</span>
              <span>价</span>
              <span>量</span>
              <span>额</span>
            </div>
            {model.tapeRows.map((row) => (
              <div className={`microstructure-tape-row ${row.tone}`} key={row.key}>
                <span>{row.time}</span>
                <strong>{row.price}</strong>
                <span>{row.volume}</span>
                <span>{row.amount}</span>
              </div>
            ))}
            {model.tapeRows.length === 0 && <p className="microstructure-empty">暂无分时点</p>}
          </div>
        </div>
        <div className="microstructure-block">
          <span className="microstructure-block-title">经纪商</span>
          {model.brokerRows.map((row) => (
            <div className={`microstructure-row ${row.tone}`} key={row.key}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <em>{row.detail}</em>
            </div>
          ))}
        </div>
      </div>
      <div className="microstructure-warnings">
        {model.warnings.map((warning) => (
          <span key={warning}>{warning}</span>
        ))}
      </div>
    </div>
  );
}

function RealtimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="realtime-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Sparkline({
  points,
  tone = "flat",
}: {
  points?: { date: string; close: number }[];
  tone?: string;
}) {
  const pathPoints = useMemo(() => {
    const closes = (points || [])
      .map((point) => point.close)
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    if (closes.length < 2) return "";
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    return closes
      .map((close, index) => {
        const x = (index / Math.max(closes.length - 1, 1)) * 100;
        const y = 42 - ((close - min) / span) * 34;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points]);

  return (
    <svg className={`sparkline ${tone}`} viewBox="0 0 100 48" preserveAspectRatio="none">
      <line x1="0" x2="100" y1="42" y2="42" />
      {pathPoints ? <polyline points={pathPoints} /> : <text x="4" y="28">暂无走势</text>}
    </svg>
  );
}

export function QuoteTable({
  quotes,
  onOpenSymbol,
  onSelect,
}: {
  quotes: MarketQuote[];
  onOpenSymbol?: (symbol: string, date?: string) => void;
  onSelect?: (symbol: string) => void;
}) {
  const [sortKey, setSortKey] = useState<QuoteSortKey>("change_pct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [compact, setCompact] = useState(
    window.localStorage.getItem("tradingagents.tableDensity") === "compact",
  );

  const sortedQuotes = useMemo(() => {
    const valueOf = (quote: MarketQuote) => {
      if (sortKey === "symbol") return quote.symbol;
      if (sortKey === "price") return quote.price ?? Number.NEGATIVE_INFINITY;
      if (sortKey === "volume") return quote.volume ?? Number.NEGATIVE_INFINITY;
      if (sortKey === "freshness") return quote.data_age_days ?? Number.POSITIVE_INFINITY;
      return quote.change_pct ?? Number.NEGATIVE_INFINITY;
    };
    return [...quotes].sort((a, b) => {
      const aValue = valueOf(a);
      const bValue = valueOf(b);
      const result =
        typeof aValue === "string" && typeof bValue === "string"
          ? aValue.localeCompare(bValue)
          : Number(aValue) - Number(bValue);
      return sortDirection === "asc" ? result : -result;
    });
  }, [quotes, sortDirection, sortKey]);

  const toggleSort = (key: QuoteSortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "freshness" || key === "symbol" ? "asc" : "desc");
  };

  const toggleDensity = () => {
    setCompact((value) => {
      window.localStorage.setItem("tradingagents.tableDensity", value ? "comfortable" : "compact");
      return !value;
    });
  };

  return (
    <div>
      <div className="table-toolbar">
        <span className="muted">排序：{SORT_LABELS[sortKey]} {sortDirection === "asc" ? "↑" : "↓"}</span>
        <button className="mini" onClick={toggleDensity}>
          {compact ? "舒适密度" : "紧凑密度"}
        </button>
      </div>
      <div className="data-table-wrap quote-table-wrap">
      <table className={`data-table quote-table ${compact ? "dense-table" : ""}`}>
        <thead>
          <tr>
            <th><button className="table-sort" onClick={() => toggleSort("symbol")}>股票</button></th>
            <th><button className="table-sort" onClick={() => toggleSort("price")}>价格</button></th>
            <th><button className="table-sort" onClick={() => toggleSort("change_pct")}>涨跌</button></th>
            <th>高 / 低</th>
            <th><button className="table-sort" onClick={() => toggleSort("volume")}>成交量</button></th>
            <th><button className="table-sort" onClick={() => toggleSort("freshness")}>状态</button></th>
            <th>工作台</th>
          </tr>
        </thead>
        <tbody>
          {sortedQuotes.map((quote) => {
            const tone = quoteTone(quote.change_pct);
            return (
              <tr key={quote.symbol} onClick={() => onSelect?.(quote.symbol)}>
                <td>
                  <strong>{quote.symbol}</strong>
                  <br />
                  <span className="muted">{quote.market}</span>
                </td>
                <td>{formatNumber(quote.price, 2)}</td>
                <td className={tone}>
                  {formatSignedNumber(quote.change)} / {formatSignedPercent(quote.change_pct)}
                </td>
                <td>
                  {formatNumber(quote.high, 2)} / {formatNumber(quote.low, 2)}
                </td>
                <td>{formatCompactNumber(quote.volume)}</td>
                <td>
                  <span className={`status-badge ${quote.status === "ok" ? "" : "muted-badge"}`}>
                    {quote.status === "ok" ? quote.freshness_text || quote.trade_date || "已加载" : "缺行情"}
                  </span>
                </td>
                <td>
                  <button
                    className="mini table-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenSymbol?.(quote.symbol, quote.trade_date || undefined);
                    }}
                    type="button"
                  >
                    打开
                  </button>
                </td>
              </tr>
            );
          })}
          {quotes.length === 0 && (
            <tr>
              <td colSpan={7}>暂无行情</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

const SORT_LABELS: Record<QuoteSortKey, string> = {
  symbol: "股票",
  price: "价格",
  change_pct: "涨跌",
  volume: "成交量",
  freshness: "新鲜度",
};

function directionMark(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value > 0) return "↑";
  if (value < 0) return "↓";
  return "-";
}

export function PriceHistoryChart({
  bars,
  signals = [],
}: {
  bars: MarketHistoryBar[];
  signals?: ChartSignalMarker[];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [range, setRange] = useState<CandleRange>("120");
  const [period, setPeriod] = useState<CandlePeriod>("daily");
  const [expanded, setExpanded] = useState(false);
  const [rightOffset, setRightOffset] = useState(0);
  const dragStart = useRef<{ x: number; offset: number } | null>(null);
  const safeBars = Array.isArray(bars) ? bars : [];
  const safeSignals = Array.isArray(signals) ? signals : [];
  const periodData = useMemo(() => preparePeriodChartData(safeBars, safeSignals, period), [safeBars, period, safeSignals]);
  const chart = useMemo(
    () => buildCandleGeometry(periodData.bars, periodData.signals, range, rightOffset),
    [periodData, range, rightOffset],
  );
  const chartMarkers = chart.markers || [];
  const change = chart.visibleChange;
  const hovered = hoverIndex == null ? null : chart.candles[hoverIndex] || null;

  useEffect(() => {
    setRightOffset((value) => Math.min(value, maxRightOffsetForRange(periodData.bars.length, range)));
  }, [periodData.bars.length, range]);

  const setRangeFromControl = (nextRange: CandleRange) => {
    setRange(nextRange);
    setRightOffset((value) => Math.min(value, maxRightOffsetForRange(periodData.bars.length, nextRange)));
    setHoverIndex(null);
  };

  const panByPixels = (event: MouseEvent<SVGSVGElement>) => {
    if (!dragStart.current || chart.visibleCount <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const barPixels = rect.width / Math.max(chart.visibleCount, 1);
    const deltaBars = Math.round((event.clientX - dragStart.current.x) / Math.max(barPixels, 1));
    const maxOffset = maxRightOffsetForRange(periodData.bars.length, range);
    setRightOffset(clampNumber(dragStart.current.offset + deltaBars, 0, maxOffset));
  };

  const handleWheelZoom = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const nextRange = nextCandleRange(range, event.deltaY < 0 ? "in" : "out");
    setRangeFromControl(nextRange);
  };

  const handleHover = (event: MouseEvent<SVGSVGElement>) => {
    if (chart.candles.length === 0) return;
    panByPixels(event);
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    chart.candles.forEach((candle, index) => {
      const distance = Math.abs(candle.x - x);
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });
    setHoverIndex(nearestIndex);
  };

  return (
    <div className={`chart-panel terminal-chart ${expanded ? "expanded" : ""}`}>
      <div className="chart-title terminal-chart-title">
        <div>
          <strong>K线与事件</strong>
          <span>
            {chart.visibleCount || periodData.bars.length} / {periodData.bars.length} 根{periodData.unit} ·{" "}
            {period === "daily" ? `${safeBars.length} 根日线` : `由 ${safeBars.length} 根日线聚合`} · {safeSignals.length} 个信号 · 区间收益{" "}
            {formatSignedPercent(change)} · {rightOffset > 0 ? `向前平移 ${rightOffset} 根` : "最新区间"}
          </span>
        </div>
        <div className="chart-control-strip">
          <div className="chart-control-cluster period-control-cluster">
            <span className="chart-control-label">周期</span>
            <div className="chart-range-toggle chart-period-toggle" role="group" aria-label="K线周期">
              {HISTORICAL_CANDLE_PERIODS.map((item) => (
                <button
                  className={period === item.key ? "active" : ""}
                  key={item.key}
                  onClick={() => {
                    setPeriod(item.key);
                    setRightOffset(0);
                    setHoverIndex(null);
                  }}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-control-cluster">
            <span className="chart-control-label">区间</span>
            <div className="chart-range-toggle" role="group" aria-label="K线区间">
              {CANDLE_RANGES.map((item) => (
                <button
                  className={range === item.key ? "active" : ""}
                  key={item.key}
                  onClick={() => setRangeFromControl(item.key)}
                  type="button"
                >
                  {candleRangeLabel(item, period)}
                </button>
              ))}
            </div>
          </div>
          <button className="chart-zoom-button" onClick={() => setExpanded((value) => !value)} type="button">
            {expanded ? "还原" : "放大"}
          </button>
          {rightOffset > 0 && (
            <button className="chart-zoom-button" onClick={() => setRightOffset(0)} type="button">
              最新
            </button>
          )}
        </div>
      </div>
      <div className="chart-canvas-frame">
        <svg
          className={`price-history-chart candle-chart ${dragStart.current ? "dragging" : ""}`}
          viewBox="0 0 100 260"
          preserveAspectRatio="none"
          onMouseDown={(event) => {
            dragStart.current = { x: event.clientX, offset: rightOffset };
          }}
          onMouseMove={handleHover}
          onMouseUp={() => {
            dragStart.current = null;
          }}
          onMouseLeave={() => {
            dragStart.current = null;
            setHoverIndex(null);
          }}
          onWheel={handleWheelZoom}
        >
          <line x1="0" x2="100" y1="180" y2="180" />
          <line x1="0" x2="100" y1="92" y2="92" />
          <line x1="0" x2="100" y1="30" y2="30" />
          <line x1="0" x2="100" y1="206" y2="206" />
          {chart.candles.length > 0 ? (
            <>
              {chart.priceTicks.map((tick) => (
                <g className="price-tick" key={tick.label}>
                  <line x1="0" x2="100" y1={tick.y} y2={tick.y} />
                  <text x="1.2" y={Math.max(12, tick.y - 3)}>
                    {tick.label} {formatNumber(tick.value, 2)}
                  </text>
                </g>
              ))}
              {chart.ma20 && <polyline className="ma-line ma20" points={chart.ma20} />}
              {chart.ma60 && <polyline className="ma-line ma60" points={chart.ma60} />}
              {chart.timeTicks.map((tick) => (
                <text className="time-axis-label compact" key={`${tick.label}-${tick.x}`} x={tick.x} y="258">
                  {tick.label}
                </text>
              ))}
              {chart.candles.map((candle) => (
                <g className={`candle ${candle.tone}`} key={candle.date}>
                  <line x1={candle.x} x2={candle.x} y1={candle.highY} y2={candle.lowY} />
                  <rect
                    x={candle.x - candle.width / 2}
                    y={candle.bodyY}
                    width={candle.width}
                    height={Math.max(candle.bodyHeight, 1.2)}
                    rx="0.35"
                  />
                  <rect
                    className="volume-bar"
                    x={candle.x - candle.width / 2}
                    y={candle.volumeY}
                    width={candle.width}
                    height={250 - candle.volumeY}
                  />
                </g>
              ))}
              {chartMarkers.map((marker) => (
                <g className={`chart-marker ${marker.direction || "neutral"}`} key={marker.id}>
                  <polygon points={`${marker.x},${marker.y} ${marker.x - 1.5},${marker.y + 5} ${marker.x + 1.5},${marker.y + 5}`} />
                  <circle cx={marker.x} cy={marker.entryY} r="1.6" />
                  <title>{marker.title}</title>
                </g>
              ))}
              {hovered && (
                <g className="chart-crosshair">
                  <line x1={hovered.x} x2={hovered.x} y1="18" y2="250" />
                  <line x1="0" x2="100" y1={hovered.closeY} y2={hovered.closeY} />
                  <circle cx={hovered.x} cy={hovered.closeY} r="1.6" />
                </g>
              )}
            </>
          ) : (
            <text x="3" y="104">暂无历史行情</text>
          )}
        </svg>
        {chart.priceTicks.length > 0 && (
          <div className="chart-price-axis-overlay" aria-hidden="true">
            {chart.priceTicks.map((tick) => (
              <span
                className={`chart-price-axis-label ${tick.label.toLowerCase()}`}
                key={tick.label}
                style={{ top: `${(tick.y / 260) * 100}%` }}
              >
                <em>{tick.label}</em>
                {formatNumber(tick.value, 2)}
              </span>
            ))}
          </div>
        )}
      </div>
      {hovered && (
        <div
          className="chart-hover-card"
          style={{ left: `${Math.min(76, Math.max(4, hovered.x))}%` }}
        >
          <strong>{hovered.periodLabel || hovered.date}</strong>
          <span>开 {formatNumber(hovered.open, 2)} / 收 {formatNumber(hovered.close, 2)}</span>
          <span>高 {formatNumber(hovered.high, 2)} / 低 {formatNumber(hovered.low, 2)}</span>
          <span>量 {formatCompactNumber(hovered.volume)}</span>
          <span>MA20 {formatNumber(hovered.ma20, 2)} / MA60 {formatNumber(hovered.ma60, 2)}</span>
        </div>
      )}
      <div className="chart-legend">
        <span><i className="legend-candle up" />上涨K线</span>
        <span><i className="legend-candle down" />下跌K线</span>
        <span><i className="legend-line ma20" />MA20</span>
        <span><i className="legend-line ma60" />MA60</span>
        <span><i className="legend-marker" />信号点 / 入场点</span>
      </div>
    </div>
  );
}

export function TradingSignalKlinePanel({
  bars,
  signals = [],
  evidenceEvents = [],
  fundFlowRows = [],
  factorRows = [],
  intradayPoints = [],
  realtimeQuote = null,
  intradaySource = null,
  strategyAnalysis,
  strategyControls,
  selectedSignalId,
  drawingScope,
  onSelectSignal,
}: {
  bars: MarketHistoryBar[];
  signals?: ChartSignalMarker[];
  evidenceEvents?: ChartEvidenceEvent[];
  fundFlowRows?: FundFlowSnapshot[];
  factorRows?: FactorSnapshot[];
  intradayPoints?: IntradayPoint[];
  realtimeQuote?: RealtimeQuote | null;
  intradaySource?: string | null;
  strategyAnalysis?: StrategyKlineAnalysis | null;
  strategyControls?: StrategyKlineControls;
  selectedSignalId?: string | null;
  drawingScope?: string | null;
  onSelectSignal?: (signalId: string) => void;
}) {
  const [range, setRange] = usePersistentChartValue<CandleRange>(
    "tradingagents.tradeSignalKline.range",
    "120",
    (value) => (isCandleRange(value) ? value : "120"),
  );
  const [period, setPeriod] = usePersistentChartValue<CandlePeriod>(
    "tradingagents.tradeSignalKline.period",
    "daily",
    (value) => (isCandlePeriod(value) ? value : "daily"),
  );
  const [chartPrefs, setChartPrefs] = usePersistentChartValue<TradingChartPreferences>(
    "tradingagents.tradeSignalKline.preferences",
    DEFAULT_TRADING_CHART_PREFS,
    normalizeTradingChartPrefs,
  );
  const [chartParams, setChartParams] = usePersistentChartValue<TradingChartParameters>(
    "tradingagents.tradeSignalKline.parameters",
    DEFAULT_TRADING_CHART_PARAMS,
    normalizeTradingChartParams,
  );
  const [priceAxisMode, setPriceAxisMode] = usePersistentChartValue<PriceAxisMode>(
    "tradingagents.tradeSignalKline.priceAxisMode",
    "price",
    normalizePriceAxisMode,
  );
  const [priceAdjustmentMode, setPriceAdjustmentMode] = usePersistentChartValue<PriceAdjustmentMode>(
    "tradingagents.tradeSignalKline.priceAdjustmentMode",
    "none",
    normalizePriceAdjustmentMode,
  );
  const [klineRenderMode, setKlineRenderMode] = usePersistentChartValue<KlineRenderMode>(
    "tradingagents.tradeSignalKline.renderMode",
    "candle",
    normalizeKlineRenderMode,
  );
  const [annotationLabelMode, setAnnotationLabelMode] = usePersistentChartValue<AnnotationLabelMode>(
    "tradingagents.tradeSignalKline.annotationLabelMode",
    "compact",
    normalizeAnnotationLabelMode,
  );
  const [denseLayerSelection, setDenseLayerSelection] = usePersistentChartValue<DenseChartLayerSelection>(
    "tradingagents.tradeSignalKline.denseLayerSelection",
    DEFAULT_DENSE_CHART_LAYER_SELECTION,
    normalizeDenseChartLayerSelection,
  );
  const [expanded, setExpanded] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [advancedToolsOpen, setAdvancedToolsOpen] = useState(false);
  const [hoveredSignalId, setHoveredSignalId] = useState<string | null>(null);
  const [hoveredEvidenceEventId, setHoveredEvidenceEventId] = useState<string | null>(null);
  const [hoveredAnnotationKey, setHoveredAnnotationKey] = useState<string | null>(null);
  const [hoveredTradePlanLevelKey, setHoveredTradePlanLevelKey] = useState<string | null>(null);
  const [rightOffset, setRightOffset] = useState(0);
  const [measureStartIndex, setMeasureStartIndex] = useState<number | null>(null);
  const [measureEndIndex, setMeasureEndIndex] = useState<number | null>(null);
  const [drawingTool, setDrawingTool] = useState<TradingChartDrawingTool>("none");
  const [manualDrawings, setManualDrawings] = useState<ManualDrawing[]>([]);
  const [pendingTrendAnchor, setPendingTrendAnchor] = useState<ManualDrawingAnchor | null>(null);
  const drawingStorageKey = useMemo(() => buildManualDrawingStorageKey(drawingScope), [drawingScope]);
  const skipNextDrawingSave = useRef(false);
  const dragStart = useRef<{ x: number; offset: number } | null>(null);
  const [crosshair, setCrosshair] = useState<{
    x: number;
    y: number;
    labelX: number;
    price: number | null;
    candle: Record<string, any>;
  } | null>(null);
  const safeBars = Array.isArray(bars) ? bars : [];
  const safeSignals = Array.isArray(signals) ? signals : [];
  const safeEvidenceEvents = Array.isArray(evidenceEvents) ? evidenceEvents : [];
  const safeIntradayPoints = Array.isArray(intradayPoints) ? intradayPoints : [];
  const usingIntradayPeriod = isIntradayPeriod(period);
  const intradayBars = useMemo<MarketHistoryBar[]>(
    () =>
      buildIntradayMinuteBars(safeIntradayPoints, {
        symbol: drawingScope || realtimeQuote?.symbol || safeBars[safeBars.length - 1]?.symbol,
        market: realtimeQuote?.market || safeBars[safeBars.length - 1]?.market,
        prevClose: realtimeQuote?.prev_close,
        source: intradaySource || undefined,
      }) as MarketHistoryBar[],
    [drawingScope, intradaySource, realtimeQuote?.market, realtimeQuote?.prev_close, realtimeQuote?.symbol, safeBars, safeIntradayPoints],
  );
  const priceAdjustedHistory = useMemo<PriceAdjustedBarsResult<MarketHistoryBar>>(
    () => {
      if (usingIntradayPeriod) {
        return {
          bars: intradayBars,
          mode: "none",
          baseFactor: null,
          firstFactor: null,
          latestFactor: null,
          hasAdjustment: false,
        };
      }
      return buildPriceAdjustedBars(safeBars, priceAdjustmentMode);
    },
    [intradayBars, priceAdjustmentMode, safeBars, usingIntradayPeriod],
  );
  const strategySignal = useMemo(
    () => (usingIntradayPeriod ? null : buildStrategyChartSignal(strategyAnalysis, safeBars)),
    [safeBars, strategyAnalysis, usingIntradayPeriod],
  );
  const rawMergedSignals = useMemo(
    () => (usingIntradayPeriod ? [] : mergeStrategySignals(safeSignals, strategySignal)),
    [safeSignals, strategySignal, usingIntradayPeriod],
  );
  const mergedSignals = useMemo(
    () => (usingIntradayPeriod ? [] : adjustChartSignalsForPriceAdjustment(rawMergedSignals, safeBars, priceAdjustedHistory)),
    [priceAdjustedHistory, rawMergedSignals, safeBars, usingIntradayPeriod],
  );
  const periodData = useMemo(
    () => preparePeriodChartData(priceAdjustedHistory.bars, mergedSignals, period, usingIntradayPeriod ? [] : safeEvidenceEvents),
    [priceAdjustedHistory.bars, mergedSignals, period, safeEvidenceEvents, usingIntradayPeriod],
  );
  const strategyLevelPrices = useMemo(
    () =>
      usingIntradayPeriod
        ? []
        : adjustLatestPricesForPriceAdjustment(extractStrategyLevelPrices(strategyAnalysis), priceAdjustedHistory),
    [priceAdjustedHistory, strategyAnalysis, usingIntradayPeriod],
  );
  const chartFundFlowRows = useMemo(() => (usingIntradayPeriod ? [] : fundFlowRows), [fundFlowRows, usingIntradayPeriod]);
  const chartFactorRows = useMemo(() => (usingIntradayPeriod ? [] : factorRows), [factorRows, usingIntradayPeriod]);
  const hasCustomDenseLayers = hasSelectedDenseChartLayers(denseLayerSelection);
  const cleanChartLayersActive = annotationLabelMode === "compact" && !hasCustomDenseLayers;
  const allChartLayersActive = annotationLabelMode === "all";
  const effectiveSplitSubCharts =
    chartPrefs.subCharts &&
    (allChartLayersActive || denseLayerSelection.secondaryIndicators);
  const chart = useMemo(
    () => buildTradingSignalGeometry(
      periodData.bars,
      periodData.signals,
      range,
      rightOffset,
      chartParams,
      strategyLevelPrices,
      effectiveSplitSubCharts,
      periodData.events,
      chartFundFlowRows,
      chartFactorRows,
      priceAxisMode,
    ),
    [chartFactorRows, chartFundFlowRows, chartParams, effectiveSplitSubCharts, periodData, priceAxisMode, range, rightOffset, strategyLevelPrices],
  );
  const chartMarkers = chart.markers || [];
  const evidenceEventMarkers = chart.eventMarkers || [];
  const showDenseAnnotations = shouldRenderDenseChartLayer(annotationLabelMode, "annotations", denseLayerSelection);
  const showDenseProfile = shouldRenderDenseChartLayer(annotationLabelMode, "profile", denseLayerSelection);
  const showDenseAutoLevels = shouldRenderDenseChartLayer(annotationLabelMode, "autoLevels", denseLayerSelection);
  const showDenseTrendRegime = shouldRenderDenseChartLayer(annotationLabelMode, "trendRegime", denseLayerSelection);
  const showDenseSecondaryIndicators = shouldRenderDenseChartLayer(annotationLabelMode, "secondaryIndicators", denseLayerSelection);
  const showDenseClusterBadges = shouldRenderDenseChartLayer(annotationLabelMode, "clusterBadges", denseLayerSelection);
  const indicatorPanelReadoutLimit = annotationLabelMode === "compact" ? 3 : effectiveSplitSubCharts ? 8 : 10;
  const compactAnnotationEvents = useMemo<CompactAnnotationEvent[]>(() => [
    ...(chartPrefs.patterns
      ? chart.candlestickPatterns.map((event) => ({
          key: event.key,
          layer: `price-${event.tone}`,
          label: event.label,
          tone: event.tone,
          x: event.x,
          y: event.markerY,
        }))
      : []),
    ...(chartPrefs.tds9
      ? chart.tdsSequentialEvents.map((event) => ({
          key: event.key,
          layer: `price-${event.tone}`,
          label: `TDS${event.count}`,
          tone: event.tone,
          x: event.x,
          y: event.markerY,
        }))
      : []),
    ...(chartPrefs.indicatorSignals
      ? chart.technicalIndicatorEvents.map((event) => ({
          key: event.key,
          layer: `price-${event.tone}`,
          label: event.label,
          tone: event.tone,
          x: event.x,
          y: event.markerY,
        }))
      : []),
    ...(chartPrefs.divergences
      ? chart.technicalDivergenceEvents.map((event) => ({
          key: event.key,
          layer: `price-${event.tone}`,
          label: event.label,
          tone: event.tone,
          x: event.x,
          y: event.markerY,
        }))
      : []),
    ...(chartPrefs.volume && chartPrefs.volumeSignals
      ? chart.volumeSignalEvents.map((event) => ({
          key: event.key,
          layer: `volume-${event.tone}`,
          label: event.label,
          tone: event.tone,
          x: event.x,
          y: event.markerY,
        }))
      : []),
  ], [
    chart.candlestickPatterns,
    chart.tdsSequentialEvents,
    chart.technicalDivergenceEvents,
    chart.technicalIndicatorEvents,
    chart.volumeSignalEvents,
    chartPrefs.divergences,
    chartPrefs.indicatorSignals,
    chartPrefs.patterns,
    chartPrefs.tds9,
    chartPrefs.volume,
    chartPrefs.volumeSignals,
  ]);
  const compactAnnotationDisplay = useMemo(
    () =>
      buildCompactAnnotationDisplay(compactAnnotationEvents, {
        activeKey: hoveredAnnotationKey,
        minClusterGap: chart.visibleCount <= 80 ? 14 : 22,
        mode: annotationLabelMode,
      }),
    [annotationLabelMode, chart.visibleCount, compactAnnotationEvents, hoveredAnnotationKey],
  );
  const visibleAnnotationLabelKeys = useMemo(
    () => new Set(compactAnnotationDisplay.labelKeys),
    [compactAnnotationDisplay.labelKeys],
  );
  const activeChartPreset = useMemo(() => matchChartPreferencePreset(chartPrefs), [chartPrefs]);
  const chartLayerSummary = useMemo(() => buildChartLayerSummary(chartPrefs), [chartPrefs]);
  const activeChartParameterPreset = useMemo(() => matchChartParameterPreset(chartParams), [chartParams]);
  const tradePlanLevels = useMemo(
    () => buildTradePlanLevels(strategyAnalysis, chart),
    [chart, strategyAnalysis],
  );
  const chartDiagnostics = useMemo(
    () => buildChartDiagnostics(strategyAnalysis, strategyControls?.backtest),
    [strategyAnalysis, strategyControls?.backtest],
  );
  const indicatorReadoutSnapshot = selectIndicatorReadoutSnapshot(
    chart.latestIndicators,
    crosshair?.candle?.indicators,
  );
  const indicatorReadoutLabel = crosshair?.candle
    ? `游标 ${shortDateLabel(crosshair.candle.periodLabel || crosshair.candle.date)}`
    : "最新";
  const indicatorPanelReadouts = useMemo(
    () => buildIndicatorPanelReadouts(indicatorReadoutSnapshot, { mode: effectiveSplitSubCharts ? "split" : "compact" }),
    [effectiveSplitSubCharts, indicatorReadoutSnapshot],
  );
  const indicatorPanelReadoutMap = useMemo(
    () => new Map(indicatorPanelReadouts.map((group) => [group.key, group])),
    [indicatorPanelReadouts],
  );
  const hoveredMarker =
    chartMarkers.find((marker) => marker.signal.signal_id === hoveredSignalId) ||
    null;
  const selectedMarker =
    chartMarkers.find((marker) => marker.signal.signal_id === selectedSignalId) ||
    null;
  const hoveredTradePlanLevel =
    tradePlanLevels.find((level) => level.key === hoveredTradePlanLevelKey) ||
    null;
  const hoveredEvidenceEvent =
    evidenceEventMarkers.find((marker) => marker.event.id === hoveredEvidenceEventId) ||
    null;
  const activeMarker =
    hoveredMarker ||
    selectedMarker ||
    chartMarkers.find((marker) => marker.signal.signal_id === strategySignal?.signal_id) ||
    chartMarkers[0] ||
    null;
  const tooltipMarker = hoveredMarker;
  const hoverSignalTooltip = tooltipMarker ? buildSignalHoverTooltip(tooltipMarker, period, chart) : null;
  const tradePlanTooltip = hoveredTradePlanLevel
    ? buildTradePlanLevelTooltip(hoveredTradePlanLevel, chart, strategyAnalysis)
    : null;
  const evidenceEventTooltip = hoveredEvidenceEvent
    ? buildEvidenceEventTooltip(hoveredEvidenceEvent, chart)
    : null;
  const activeSignal =
    activeMarker?.signal ||
    strategySignal ||
    mergedSignals[0] ||
    null;
  const activeIndicators = activeMarker?.indicators || chart.latestIndicators;
  const readoutIndicators = indicatorReadoutSnapshot;
  const indicatorStateSummary = useMemo(
    () => buildIndicatorStateSummary(readoutIndicators),
    [readoutIndicators],
  );
  const readoutFundFlow = crosshair?.candle?.fundFlow || chart.fundFlowOverlay.latest;
  const klineEventSummary = buildKlineEventSummary({
    divergenceEvents: chart.technicalDivergenceEvents,
    gaps: chart.priceGaps,
    patterns: chart.candlestickPatterns,
    tdsEvents: chart.tdsSequentialEvents,
    technicalEvents: chart.technicalIndicatorEvents,
    trendBands: chart.trendRegimeBands,
    volumeEvents: chart.volumeSignalEvents,
  });
  const klineEventBacktests = buildKlineEventBacktestSummary({
    bars: chart.candles,
    divergenceEvents: chart.technicalDivergenceEvents,
    gaps: chart.priceGaps,
    horizon: 1,
    patterns: chart.candlestickPatterns,
    tdsEvents: chart.tdsSequentialEvents,
    technicalEvents: chart.technicalIndicatorEvents,
    volumeEvents: chart.volumeSignalEvents,
  });
  const visibleIndicatorThresholdGuides = chart.indicatorThresholdGuides.filter((guide) => {
    if (!showDenseSecondaryIndicators) return false;
    if (!effectiveSplitSubCharts && guide.section !== "oscillator") return false;
    if (guide.section === "oscillator") return chartPrefs.rsi || chartPrefs.kdj;
    if (guide.section === "advanced") return chartPrefs.advanced || chartPrefs.volumeMomentum;
    if (guide.section === "momentum") return chartPrefs.momentum || chartPrefs.biasDma || chartPrefs.volumeMomentum;
    return true;
  });
  const visibleIndicatorThresholdZones = chart.indicatorThresholdZones.filter((zone) => {
    if (!showDenseSecondaryIndicators) return false;
    if (!effectiveSplitSubCharts && zone.section !== "oscillator") return false;
    if (zone.section === "oscillator") return chartPrefs.rsi || chartPrefs.kdj;
    if (zone.section === "advanced") return chartPrefs.advanced || chartPrefs.volumeMomentum;
    if (zone.section === "momentum") return chartPrefs.momentum || chartPrefs.biasDma || chartPrefs.volumeMomentum;
    return true;
  });
  const visibleOverlayPriceLabels = buildOverlayPriceLabels(
    (chart.overlayPriceLabels || []).filter((label: OverlayPriceLabelDefinition) => {
      if (label.group === "latest") return chartPrefs.levels;
      if (label.group === "ma") return chartPrefs.ma;
      if (label.group === "ema") return chartPrefs.ema;
      if (label.group === "boll") return chartPrefs.boll;
      if (!showDenseAutoLevels && (label.group === "ene" || label.group === "mike" || label.group === "ichimoku")) return false;
      if (label.group === "ene") return chartPrefs.ene;
      if (label.group === "mike") return chartPrefs.mike;
      if (label.group === "vwap") return chartPrefs.vwap;
      if (label.group === "sar") return chartPrefs.sar;
      if (label.group === "bbi") return chartPrefs.bbi;
      if (label.group === "ichimoku") return chartPrefs.ichimoku;
      return true;
    }),
    { bottom: chart.priceBottom, minGap: 19, top: chart.priceTop },
  );
  const visibleIndicatorValueLabels = buildIndicatorValueLabels(
    (chart.indicatorValueLabels || []).filter((label: IndicatorValueLabelDefinition) => {
      if (label.group === "volume") return chartPrefs.volume;
      if (label.group === "macd") return chartPrefs.macd;
      if (!showDenseSecondaryIndicators && label.group === "rsi") return chartPrefs.rsi && label.key === "rsi";
      if (label.group === "rsi") return chartPrefs.rsi;
      if (!showDenseSecondaryIndicators && label.group === "kdj") return false;
      if (label.group === "kdj") return chartPrefs.kdj;
      if (!showDenseSecondaryIndicators && (
        label.group === "advanced" ||
        label.group === "momentum" ||
        label.group === "biasDma" ||
        label.group === "volumeMomentum" ||
        label.group === "volatility"
      )) return false;
      if (label.group === "advanced") return chartPrefs.advanced;
      if (label.group === "momentum") return chartPrefs.momentum;
      if (label.group === "biasDma") return chartPrefs.biasDma;
      if (label.group === "volumeMomentum") return chartPrefs.volumeMomentum;
      if (label.group === "volatility") return chartPrefs.volatility;
      return true;
    }),
    {
      maxPerSection: annotationLabelMode === "compact" ? (effectiveSplitSubCharts ? 4 : 5) : effectiveSplitSubCharts ? 7 : 10,
      minGap: 13,
      sections: Object.fromEntries(chart.sections.map((section: { key: string; top: number; bottom: number }) => [
        section.key,
        { top: section.top, bottom: section.bottom },
      ])),
    },
  );
  const measuredRange = useMemo(
    () => buildMeasureRange(
      chart.candles,
      measureStartIndex,
      measureEndIndex ?? crosshair?.candle?.index ?? null,
    ),
    [chart.candles, crosshair?.candle?.index, measureEndIndex, measureStartIndex],
  );
  const manualDrawingGeometry = useMemo(
    () => buildManualDrawingGeometry(manualDrawings, chart.candles, chart),
    [chart, manualDrawings],
  );
  const pendingDrawingMarker = useMemo(() => {
    if (!pendingTrendAnchor) return null;
    const candle = chart.candles.find((item) => item.date === pendingTrendAnchor.date);
    const y = chartPriceToY(chart, pendingTrendAnchor.price);
    if (!candle || y == null) return null;
    return {
      x: candle.x,
      y,
      label: pendingTrendAnchor.label || candle.periodLabel || candle.date,
      price: pendingTrendAnchor.price,
    };
  }, [chart, pendingTrendAnchor]);
  const technicalDecision = useMemo(
    () => buildTradeDecision(activeSignal, activeIndicators),
    [activeSignal, activeIndicators],
  );
  const activeDecision = useMemo(
    () => strategyAnalysis ? buildStrategyTradeDecision(strategyAnalysis, technicalDecision) : technicalDecision,
    [strategyAnalysis, technicalDecision],
  );
  const summary = useMemo(() => summarizeSignals(mergedSignals), [mergedSignals]);
  const crosshairSignalCount = crosshair?.candle
    ? periodData.signals.filter((signal) => signal.date === crosshair.candle.date).length
    : 0;

  useEffect(() => {
    setRightOffset((value) => Math.min(value, maxRightOffsetForRange(periodData.bars.length, range)));
  }, [periodData.bars.length, range]);

  useEffect(() => {
    if (!chartPrefs.measure) {
      setMeasureStartIndex(null);
      setMeasureEndIndex(null);
    }
    if (chartPrefs.measure) {
      setDrawingTool("none");
      setPendingTrendAnchor(null);
    }
  }, [chartPrefs.measure]);

  useEffect(() => {
    if (drawingTool !== "trend") setPendingTrendAnchor(null);
  }, [drawingTool]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let nextDrawings: ManualDrawing[] = [];
    try {
      const stored = window.localStorage.getItem(drawingStorageKey);
      nextDrawings = stored ? normalizeManualDrawings(JSON.parse(stored)) : [];
    } catch {
      nextDrawings = [];
    }
    skipNextDrawingSave.current = true;
    setManualDrawings(nextDrawings);
    setPendingTrendAnchor(null);
    setDrawingTool("none");
  }, [drawingStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (skipNextDrawingSave.current) {
      skipNextDrawingSave.current = false;
      return;
    }
    try {
      window.localStorage.setItem(drawingStorageKey, JSON.stringify(normalizeManualDrawings(manualDrawings)));
    } catch {
      // localStorage can be unavailable in private or embedded contexts; drawing remains usable in memory.
    }
  }, [drawingStorageKey, manualDrawings]);

  const setRangeFromControl = (nextRange: CandleRange) => {
    setRange(nextRange);
    setRightOffset((value) => Math.min(value, maxRightOffsetForRange(periodData.bars.length, nextRange)));
    setHoveredAnnotationKey(null);
    setCrosshair(null);
  };

  const panByPixels = (event: MouseEvent<SVGSVGElement>) => {
    if (!dragStart.current || chart.visibleCount <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const barPixels = rect.width / Math.max(chart.visibleCount, 1);
    const deltaBars = Math.round((event.clientX - dragStart.current.x) / Math.max(barPixels, 1));
    const maxOffset = maxRightOffsetForRange(periodData.bars.length, range);
    setRightOffset(clampNumber(dragStart.current.offset + deltaBars, 0, maxOffset));
  };

  const handleWheelZoom = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const nextRange = nextCandleRange(range, event.deltaY < 0 ? "in" : "out");
    setRangeFromControl(nextRange);
  };

  const jumpToRangeNavigator = (event: MouseEvent<SVGRectElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg || !chart.rangeNavigator) return;
    const point = mapClientPointToChartViewBox({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: svg.getBoundingClientRect(),
      viewBoxHeight: chart.viewBoxHeight,
      viewBoxWidth: 1000,
    });
    setRightOffset(rightOffsetFromKlineNavigatorX({
      x: point.x,
      total: chart.rangeNavigator.total,
      visibleCount: chart.rangeNavigator.visibleCount,
      plotLeft: chart.plotLeft,
      plotRight: chart.plotRight,
    }));
    setCrosshair(null);
  };

  const toggleChartPref = (key: keyof TradingChartPreferences) => {
    setChartPrefs((value) => ({
      ...value,
      [key]: !value[key],
    }));
  };

  const applyChartPreset = (key: string) => {
    setChartPrefs((value) => applyChartPreferencePreset(value, key));
  };

  const applyChartParameterPresetValue = (key: string) => {
    setChartParams((value) => applyChartParameterPreset(value, key));
  };

  const showCleanChartLayers = () => {
    setAnnotationLabelMode("compact");
    setDenseLayerSelection({ ...DEFAULT_DENSE_CHART_LAYER_SELECTION });
    setHoveredAnnotationKey(null);
  };

  const showAllChartLayers = () => {
    setAnnotationLabelMode("all");
    setHoveredAnnotationKey(null);
  };

  const toggleDenseChartLayer = (key: DenseLayerControlKey) => {
    setAnnotationLabelMode("compact");
    setDenseLayerSelection((value) => ({
      ...value,
      [key]: !value[key],
    }));
    setHoveredAnnotationKey(null);
  };

  const selectDrawingTool = (tool: ManualDrawingType) => {
    const nextTool = drawingTool === tool ? "none" : tool;
    setDrawingTool(nextTool);
    setPendingTrendAnchor(null);
    if (nextTool !== "none") {
      setChartPrefs((value) => value.measure ? { ...value, measure: false } : value);
      setMeasureStartIndex(null);
      setMeasureEndIndex(null);
    }
  };

  const clearManualDrawings = () => {
    setManualDrawings([]);
    setPendingTrendAnchor(null);
    setDrawingTool("none");
  };

  const resetChartPrefs = () => {
    setChartPrefs(DEFAULT_TRADING_CHART_PREFS);
    setChartParams(DEFAULT_TRADING_CHART_PARAMS);
    setPriceAxisMode("price");
    setPriceAdjustmentMode("none");
    setKlineRenderMode("candle");
    setAnnotationLabelMode("compact");
    setDenseLayerSelection({ ...DEFAULT_DENSE_CHART_LAYER_SELECTION });
    setHoveredAnnotationKey(null);
    setMeasureStartIndex(null);
    setMeasureEndIndex(null);
  };

  const updateChartParam = (key: keyof TradingChartParameters) => (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.currentTarget.value;
    setChartParams((value) => normalizeTradingChartParams({
      ...value,
      [key]: rawValue === "" ? value[key] : Number(rawValue),
    }));
  };

  const chooseSignal = (signalId: string) => {
    onSelectSignal?.(signalId);
  };
  const showAnnotationLabel = (key: string) => visibleAnnotationLabelKeys.has(key);
  const showAnnotation = (key: string) => setHoveredAnnotationKey(key);
  const hideAnnotation = () => setHoveredAnnotationKey(null);

  const handleMarkerKey = (event: KeyboardEvent<SVGGElement>, signalId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseSignal(signalId);
    }
  };
  const handleEvidenceEventKey = (event: KeyboardEvent<SVGGElement>, item: ChartEvidenceEvent) => {
    if (!item.signal_id) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseSignal(item.signal_id);
    }
  };
  const nearestChartPoint = (event: MouseEvent<SVGSVGElement>) => {
    if (chart.candles.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const { x, y } = mapClientPointToChartViewBox({
      clientX: event.clientX,
      clientY: event.clientY,
      rect,
      viewBoxHeight: chart.viewBoxHeight,
      viewBoxWidth: 1000,
    });
    if (x < chart.plotLeft || x > chart.plotRight || y < chart.sections[0].top || y > chart.signalLaneY) {
      return null;
    }
    const candle = chart.candles.reduce((closest, item) =>
      Math.abs(item.x - x) < Math.abs(closest.x - x) ? item : closest,
    );
    return { candle, x, y };
  };

  const buildManualDrawingAnchor = (point: NonNullable<ReturnType<typeof nearestChartPoint>>): ManualDrawingAnchor | null => {
    const price = chartPriceFromY(chart, point.y);
    if (price == null) return null;
    return {
      date: point.candle.date,
      label: point.candle.periodLabel || point.candle.date,
      price,
    };
  };

  const handleChartPointer = (event: MouseEvent<SVGSVGElement>) => {
    if (chart.candles.length === 0) return;
    panByPixels(event);
    const point = nearestChartPoint(event);
    if (!point) {
      setCrosshair(null);
      return;
    }
    setCrosshair({
      x: point.candle.x,
      y: point.y,
      labelX: clampNumber(
        point.candle.x + (point.candle.x > chart.plotRight - 330 ? -316 : 14),
        chart.plotLeft + 6,
        chart.plotRight - 314,
      ),
      price: chartPriceFromY(chart, point.y),
      candle: point.candle,
    });
  };

  const handleChartClick = (event: MouseEvent<SVGSVGElement>) => {
    const point = nearestChartPoint(event);
    if (!point) return;
    if (drawingTool !== "none") {
      if (point.y < chart.priceTop || point.y > chart.priceBottom) return;
      const anchor = buildManualDrawingAnchor(point);
      if (!anchor) return;
      if (drawingTool === "horizontal") {
        setManualDrawings((value) => [
          ...value,
          {
            id: `manual-horizontal-${Date.now()}-${value.length}`,
            type: "horizontal",
            start: anchor,
          },
        ]);
        return;
      }
      if (!pendingTrendAnchor) {
        setPendingTrendAnchor(anchor);
        return;
      }
      setManualDrawings((value) => [
        ...value,
        {
          id: `manual-trend-${Date.now()}-${value.length}`,
          type: "trend",
          start: pendingTrendAnchor,
          end: anchor,
        },
      ]);
      setPendingTrendAnchor(null);
      return;
    }
    if (!chartPrefs.measure) return;
    setMeasureStartIndex((currentStart) => {
      if (currentStart == null || measureEndIndex != null) {
        setMeasureEndIndex(null);
        return point.candle.index;
      }
      setMeasureEndIndex(point.candle.index);
      return currentStart;
    });
  };
  const dataScopeText = usingIntradayPeriod
    ? `${safeIntradayPoints.length} 个分时点`
    : period === "daily"
      ? `${safeBars.length} 根日线`
      : `由 ${safeBars.length} 根日线聚合`;
  const strategyScopeText = usingIntradayPeriod ? "分时复核" : "策略口径 周线趋势 + 日线执行";
  const priceAdjustmentText = usingIntradayPeriod
    ? "分时不复权"
    : priceAdjustmentStatusLabel(priceAdjustmentMode, priceAdjustedHistory.mode);

  return (
    <div className={`chart-panel trade-signal-panel ${expanded ? "expanded" : ""}`}>
      <div className="chart-title terminal-chart-title">
        <div>
          <strong>V2策略信号K线</strong>
          <span>
            {chart.visibleCount || periodData.bars.length} / {periodData.bars.length} 根{periodData.unit} ·{" "}
            {dataScopeText} ·{" "}
            {strategyScopeText} ·{" "}
            V2主信号 {strategySignal ? "已接入" : "未生成"} · 历史信号 {safeSignals.length} ·{" "}
            机会 {summary.opportunity} / 风险 {summary.risk} · 复权 {priceAdjustmentText} ·{" "}
            图形 {KLINE_RENDER_MODES.find((item) => item.key === klineRenderMode)?.label || "蜡烛"} ·{" "}
            坐标 {priceAxisMode === "percent" ? "涨跌幅" : "价格"} ·{" "}
            {rightOffset > 0 ? `向前平移 ${rightOffset} 根` : "最新区间"}
          </span>
        </div>
        <div className="chart-control-strip">
          <div className="chart-control-cluster period-control-cluster">
            <span className="chart-control-label">周期</span>
            <div className="chart-range-toggle chart-period-toggle" role="group" aria-label="交易信号K线周期">
              {CANDLE_PERIODS.map((item) => (
                <button
                  className={period === item.key ? "active" : ""}
                  key={item.key}
                  onClick={() => {
                    setPeriod(item.key);
                    setRightOffset(0);
                    setHoveredSignalId(null);
                    setHoveredEvidenceEventId(null);
                    setHoveredAnnotationKey(null);
                    setHoveredTradePlanLevelKey(null);
                    setCrosshair(null);
                  }}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-control-cluster">
            <span className="chart-control-label">区间</span>
            <div className="chart-range-toggle" role="group" aria-label="交易信号K线区间">
              {CANDLE_RANGES.map((item) => (
                <button
                  className={range === item.key ? "active" : ""}
                  key={item.key}
                  onClick={() => setRangeFromControl(item.key)}
                  type="button"
                >
                  {candleRangeLabel(item, period)}
                </button>
              ))}
            </div>
          </div>
          <button className="chart-zoom-button" onClick={() => setExpanded((value) => !value)} type="button">
            {expanded ? "还原" : "放大"}
          </button>
          {rightOffset > 0 && (
            <button className="chart-zoom-button" onClick={() => setRightOffset(0)} type="button">
              最新
            </button>
          )}
        </div>
      </div>

      <div className="trade-signal-readout" aria-label="交易信号K线核心指标">
        <MarketReadoutStat
          label={crosshair?.candle ? crosshair.candle.date : "最新收盘"}
          value={formatNumber(readoutIndicators?.close, 2)}
          sub={`${formatSignedNumber(readoutIndicators?.change, 2)} / ${formatSignedPercent(readoutIndicators?.changePct)}`}
          tone={quoteTone(readoutIndicators?.changePct)}
        />
        <MarketReadoutStat
          label="高低区间"
          value={`${formatNumber(readoutIndicators?.high, 2)} / ${formatNumber(readoutIndicators?.low, 2)}`}
          sub={`振幅 ${formatSignedPercent(readoutIndicators?.amplitudePct)}`}
        />
        <MarketReadoutStat
          label="窗口高低"
          value={`${formatNumber(chart.rangeExtrema?.high, 2)} / ${formatNumber(chart.rangeExtrema?.low, 2)}`}
          sub={
            chart.rangeExtrema
              ? `高 ${shortDateLabel(chart.rangeExtrema.highLabel)} / 低 ${shortDateLabel(chart.rangeExtrema.lowLabel)} · 振幅 ${formatNumber(chart.rangeExtrema.rangePct, 2)}%`
              : "当前窗口暂无可用K线"
          }
        />
        <MarketReadoutStat
          label="成交量 / 均量"
          value={formatCompactNumber(readoutIndicators?.volume)}
          sub={[
            `额 ${formatMoney(readoutIndicators?.amount)}`,
            `MA5 ${formatCompactNumber(readoutIndicators?.volumeMa5)}`,
            `MA10 ${formatCompactNumber(readoutIndicators?.volumeMa10)}`,
            `MA20 ${formatCompactNumber(readoutIndicators?.volumeMa20)}`,
          ].join(" · ")}
        />
        <MarketReadoutStat
          label="资金净流"
          value={formatCompactNumber(readoutFundFlow?.main_net_inflow)}
          sub={`大单 ${formatCompactNumber(readoutFundFlow?.large_net_inflow)} · 北向 ${formatCompactNumber(readoutFundFlow?.northbound_net_inflow)}`}
          tone={quoteTone(readoutFundFlow?.main_net_inflow)}
        />
        <MarketReadoutStat
          label={`均线 ${chartParams.maFast}/${chartParams.maMid}`}
          value={`${formatNumber(readoutIndicators?.ma5, 2)} / ${formatNumber(readoutIndicators?.ma20, 2)}`}
          sub={`MA${chartParams.maSlow} ${formatNumber(readoutIndicators?.ma60, 2)} · MA120 ${formatNumber(readoutIndicators?.ma120, 2)}`}
        />
        <MarketReadoutStat
          label={`EMA ${chartParams.emaFast}/${chartParams.emaSlow}`}
          value={`${formatNumber(readoutIndicators?.emaFast, 2)} / ${formatNumber(readoutIndicators?.emaSlow, 2)}`}
          sub={`VWAP ${formatNumber(readoutIndicators?.vwap, 2)}`}
        />
        <MarketReadoutStat
          label={`MACD ${chartParams.macdFast}/${chartParams.macdSlow}/${chartParams.macdSignal}`}
          value={`${formatNumber(readoutIndicators?.dif, 2)} / ${formatNumber(readoutIndicators?.dea, 2)}`}
          sub={`柱 ${formatNumber(readoutIndicators?.macd, 2)}`}
          tone={quoteTone(readoutIndicators?.macd)}
        />
        <MarketReadoutStat
          label={`RSI${chartParams.rsiPeriod} / PSY${chartParams.psyPeriod}`}
          value={`${formatNumber(readoutIndicators?.rsi14, 1)} / ${formatNumber(readoutIndicators?.psy, 1)}`}
          sub={`PSYMA${chartParams.psyMaPeriod} ${formatNumber(readoutIndicators?.psyMa, 1)} · ${rsiStateLabel(readoutIndicators?.rsi14)}`}
        />
        <MarketReadoutStat
          label="BOLL"
          value={formatNumber(readoutIndicators?.bollMid, 2)}
          sub={`上 ${formatNumber(readoutIndicators?.bollUpper, 2)} / 下 ${formatNumber(readoutIndicators?.bollLower, 2)}`}
        />
        <MarketReadoutStat
          label={`MIKE${chartParams.mikePeriod}`}
          value={`WR ${formatNumber(readoutIndicators?.mikeWeakResistance, 2)} / WS ${formatNumber(readoutIndicators?.mikeWeakSupport, 2)}`}
          sub={`SR ${formatNumber(readoutIndicators?.mikeStrongResistance, 2)} / SS ${formatNumber(readoutIndicators?.mikeStrongSupport, 2)}`}
        />
        <MarketReadoutStat
          label="SAR / BBI"
          value={`${formatNumber(readoutIndicators?.sar, 2)} / ${formatNumber(readoutIndicators?.bbi, 2)}`}
          sub="主图趋势与多空均衡线"
          tone={quoteTone((readoutIndicators?.close || 0) - (readoutIndicators?.sar || 0))}
        />
        <MarketReadoutStat
          label="KDJ"
          value={`${formatNumber(readoutIndicators?.kdjK, 1)} / ${formatNumber(readoutIndicators?.kdjD, 1)}`}
          sub={`J ${formatNumber(readoutIndicators?.kdjJ, 1)}`}
          tone={quoteTone((readoutIndicators?.kdjJ || 50) - 50)}
        />
        <MarketReadoutStat
          label={`CR / ARBR ${chartParams.crPeriod}`}
          value={formatNumber(readoutIndicators?.cr, 1)}
          sub={`AR ${formatNumber(readoutIndicators?.ar, 1)} · BR ${formatNumber(readoutIndicators?.br, 1)}`}
          tone={quoteTone((readoutIndicators?.br || 100) - (readoutIndicators?.ar || 100))}
        />
        <MarketReadoutStat
          label={`EMV / MA${chartParams.emvPeriod}`}
          value={formatNumber(readoutIndicators?.emv, 4)}
          sub={`EMVMA ${formatNumber(readoutIndicators?.emvMa, 4)}`}
          tone={quoteTone(readoutIndicators?.emv)}
        />
        <MarketReadoutStat
          label={`DMI / ADX ${chartParams.momentumPeriod}`}
          value={`${formatNumber(readoutIndicators?.pdi, 1)} / ${formatNumber(readoutIndicators?.mdi, 1)}`}
          sub={`ADX ${formatNumber(readoutIndicators?.adx, 1)}`}
          tone={quoteTone((readoutIndicators?.pdi || 0) - (readoutIndicators?.mdi || 0))}
        />
        <MarketReadoutStat
          label={`CCI / WR ${chartParams.momentumPeriod}`}
          value={formatNumber(readoutIndicators?.cci, 1)}
          sub={`WR ${formatNumber(readoutIndicators?.wr, 1)}`}
          tone={quoteTone(readoutIndicators?.cci)}
        />
        <MarketReadoutStat
          label={`BIAS${chartParams.biasPeriod} / DMA`}
          value={formatNumber(readoutIndicators?.bias, 2)}
          sub={`DMA ${formatNumber(readoutIndicators?.dma, 2)} · AMA ${formatNumber(readoutIndicators?.ama, 2)}`}
          tone={quoteTone(readoutIndicators?.bias)}
        />
        <MarketReadoutStat
          label={`MFI / VR ${chartParams.volumeMomentumPeriod}`}
          value={`${formatNumber(readoutIndicators?.mfi, 1)} / ${formatNumber(readoutIndicators?.vr, 1)}`}
          sub="量价资金流强弱"
          tone={quoteTone((readoutIndicators?.mfi || 50) - 50)}
        />
        <MarketReadoutStat
          label={`ROC${chartParams.rocPeriod} / OSC${chartParams.oscPeriod}`}
          value={formatSignedNumber(readoutIndicators?.roc, 2)}
          sub={`OSC ${formatSignedNumber(readoutIndicators?.osc, 2)} · EMA ${formatSignedNumber(readoutIndicators?.oscEma, 2)}`}
          tone={quoteTone(readoutIndicators?.roc)}
        />
        <MarketReadoutStat
          label={`TRIX${chartParams.trixPeriod} / TRMA${chartParams.trixSignal}`}
          value={formatSignedNumber(readoutIndicators?.trix, 2)}
          sub={`TRMA ${formatSignedNumber(readoutIndicators?.trma, 2)}`}
          tone={quoteTone(readoutIndicators?.trix)}
        />
        <MarketReadoutStat
          label={`ATR${chartParams.atrPeriod} / OBV`}
          value={`${formatNumber(readoutIndicators?.atr, 2)} / ${formatCompactNumber(readoutIndicators?.obv)}`}
          sub={`%B ${formatNumber(readoutIndicators?.bollPercentB, 1)} · BBW ${formatRawPercentNumber(readoutIndicators?.bollBandwidth, 1)}`}
        />
        <MarketReadoutStat
          label="相对起点"
          value={formatSignedPercent(chart.relativeLatest)}
          sub={`${chart.visibleCount || 0} 根窗口收益`}
          tone={quoteTone(chart.relativeLatest)}
        />
      </div>

      {strategyAnalysis && <StrategyKlineTrace analysis={strategyAnalysis} />}
      {chartPrefs.profile && <VolumeProfileSummary profile={chart.volumeProfile} />}
      {indicatorStateSummary.length > 0 && (
        <div className="indicator-state-radar" aria-label="K线指标状态总览">
          <span className="indicator-state-radar-title">指标状态</span>
          {indicatorStateSummary.map((item) => (
            <div className={`indicator-state-card ${item.tone}`} key={item.key} title={item.detail}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <em>{item.detail}</em>
            </div>
          ))}
        </div>
      )}
      {klineEventSummary.length > 0 && (
        <div className="kline-event-radar" aria-label="K线异动雷达">
          <span className="kline-event-radar-title">异动雷达</span>
          {klineEventSummary.map((item) => (
            <div className={`kline-event-card ${item.tone}`} key={item.key}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <em>{item.detail}</em>
            </div>
          ))}
        </div>
      )}
      {klineEventBacktests.length > 0 && (
        <div className="kline-event-backtest" aria-label="K线信号回测">
          <span className="kline-event-backtest-title">信号回测</span>
          {klineEventBacktests.map((item) => (
            <div className={`kline-backtest-card ${item.tone}`} key={item.key} title={item.detail}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <em>{item.detail}</em>
            </div>
          ))}
        </div>
      )}
      {chartDiagnostics.length > 0 && <ChartDiagnosticsStrip diagnostics={chartDiagnostics} />}
      {strategyAnalysis && strategyControls && (
        <StrategyWorkbenchControls analysis={strategyAnalysis} controls={strategyControls} />
      )}

      <div className="trade-signal-stage">
        <div className="trade-signal-chart-frame">
          <div className="trade-signal-chart-controls" aria-label="交易信号K线图层选择">
            <div className="chart-tool-strip chart-preset-strip" aria-label="交易信号K线指标预设">
              <span>预设</span>
              {CHART_PREFERENCE_PRESETS.map((preset) => (
                <button
                  aria-pressed={activeChartPreset === preset.key}
                  className={activeChartPreset === preset.key ? "active" : ""}
                  key={preset.key}
                  onClick={() => applyChartPreset(preset.key)}
                  title={preset.description}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
              <span>{activeChartPreset ? "当前组合" : "自定义组合"}</span>
            </div>

            <div className="chart-layer-summary" aria-label="交易信号K线图层摘要">
              <span className="chart-layer-summary-label">图层摘要</span>
              {chartLayerSummary.map((item) => (
                <div className={`chart-layer-summary-card ${item.key}`} key={item.key} title={item.detail}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <em>{item.detail}</em>
                </div>
              ))}
            </div>

            <div className="chart-tool-strip chart-primary-tool-strip" aria-label="交易信号K线常用指标与工具">
              <span>指标·主图</span>
              <button className={chartPrefs.ma ? "active" : ""} onClick={() => toggleChartPref("ma")} type="button">MA</button>
              <button className={chartPrefs.ema ? "active" : ""} onClick={() => toggleChartPref("ema")} type="button">EMA</button>
              <button className={chartPrefs.boll ? "active" : ""} onClick={() => toggleChartPref("boll")} type="button">BOLL</button>
              <button className={chartPrefs.vwap ? "active" : ""} onClick={() => toggleChartPref("vwap")} type="button">VWAP</button>
              <button className={chartPrefs.levels ? "active" : ""} onClick={() => toggleChartPref("levels")} type="button">价位线</button>
              <button className={chartPrefs.signals ? "active" : ""} onClick={() => toggleChartPref("signals")} type="button">信号</button>
              <button className={chartPrefs.events ? "active" : ""} onClick={() => toggleChartPref("events")} type="button">事件</button>
              <span>图层</span>
              <button
                className={cleanChartLayersActive ? "active" : ""}
                onClick={showCleanChartLayers}
                title="只显示价格、核心均线、BOLL、价位线、VOL、MACD、RSI"
                type="button"
              >
                清爽
              </button>
              <button
                className={allChartLayersActive ? "active" : ""}
                onClick={showAllChartLayers}
                title="显示全部覆盖层，适合排查和深挖，不建议默认阅读"
                type="button"
              >
                全量
              </button>
              {DENSE_CHART_LAYER_CONTROLS.map((item) => (
                <button
                  className={allChartLayersActive || denseLayerSelection[item.key] ? "active" : ""}
                  key={item.key}
                  onClick={() => toggleDenseChartLayer(item.key)}
                  title={item.title}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
              <button className={chartPrefs.relative ? "active" : ""} onClick={() => toggleChartPref("relative")} type="button">相对</button>
              <button className={chartPrefs.fundFlow ? "active" : ""} onClick={() => toggleChartPref("fundFlow")} type="button">资金流</button>
              <span>指标·副图</span>
              <button className={chartPrefs.volume ? "active" : ""} onClick={() => toggleChartPref("volume")} type="button">VOL</button>
              <button className={chartPrefs.macd ? "active" : ""} onClick={() => toggleChartPref("macd")} type="button">MACD</button>
              <button className={chartPrefs.rsi ? "active" : ""} onClick={() => toggleChartPref("rsi")} type="button">RSI/PSY</button>
              <button className={chartPrefs.kdj ? "active" : ""} onClick={() => toggleChartPref("kdj")} type="button">KDJ</button>
              <button className={chartPrefs.subCharts ? "active" : ""} onClick={() => toggleChartPref("subCharts")} type="button">分屏</button>
              <button className={chartPrefs.measure ? "active measure" : "measure"} onClick={() => toggleChartPref("measure")} type="button">测距</button>
              <span>图形</span>
              {KLINE_RENDER_MODES.map((item) => (
                <button className={klineRenderMode === item.key ? "active" : ""} key={item.key} onClick={() => setKlineRenderMode(item.key)} type="button">
                  {item.label}
                </button>
              ))}
              <span>复权</span>
              {PRICE_ADJUSTMENT_MODES.map((item) => (
                <button className={priceAdjustmentMode === item.key ? "active" : ""} key={item.key} onClick={() => setPriceAdjustmentMode(item.key)} type="button">
                  {item.label}
                </button>
              ))}
              <span>坐标</span>
              <button className={priceAxisMode === "price" ? "active" : ""} onClick={() => setPriceAxisMode("price")} type="button">价格</button>
              <button className={priceAxisMode === "percent" ? "active" : ""} onClick={() => setPriceAxisMode("percent")} type="button">涨跌幅</button>
              <span>画线</span>
              <button className={drawingTool === "horizontal" ? "active drawing" : "drawing"} onClick={() => selectDrawingTool("horizontal")} type="button">水平线</button>
              <button className={drawingTool === "trend" ? "active drawing" : "drawing"} onClick={() => selectDrawingTool("trend")} type="button">趋势线</button>
              <button disabled={manualDrawings.length === 0 && !pendingTrendAnchor} onClick={clearManualDrawings} type="button">清空画线</button>
              <span>{drawingTool === "trend" && pendingTrendAnchor ? "选第二点" : manualDrawings.length ? `已画 ${manualDrawings.length}` : "未画线"}</span>
              <button className={paramsOpen ? "active" : ""} onClick={() => setParamsOpen((value) => !value)} type="button">参数</button>
              <button
                aria-expanded={advancedToolsOpen}
                className={advancedToolsOpen ? "active" : ""}
                onClick={() => setAdvancedToolsOpen((value) => !value)}
                type="button"
              >
                高级{advancedToolsOpen ? "收起" : "展开"}
              </button>
              <button onClick={resetChartPrefs} type="button">重置</button>
            </div>

            {advancedToolsOpen && (
              <div className="chart-tool-strip chart-advanced-tool-strip" aria-label="交易信号K线高级指标">
                <span>高级·主图</span>
                <button className={chartPrefs.ene ? "active" : ""} onClick={() => toggleChartPref("ene")} type="button">ENE</button>
                <button className={chartPrefs.mike ? "active" : ""} onClick={() => toggleChartPref("mike")} type="button">MIKE</button>
                <button className={chartPrefs.limitLines ? "active" : ""} onClick={() => toggleChartPref("limitLines")} type="button">涨跌停</button>
                <button className={chartPrefs.trendRegime ? "active" : ""} onClick={() => toggleChartPref("trendRegime")} type="button">趋势带</button>
                <button className={chartPrefs.profile ? "active" : ""} onClick={() => toggleChartPref("profile")} type="button">筹码</button>
                <button className={chartPrefs.fibonacci ? "active" : ""} onClick={() => toggleChartPref("fibonacci")} type="button">斐波</button>
                <button className={chartPrefs.supportResistance ? "active" : ""} onClick={() => toggleChartPref("supportResistance")} type="button">支阻</button>
                <button className={chartPrefs.trendLines ? "active" : ""} onClick={() => toggleChartPref("trendLines")} type="button">趋势线</button>
                <button className={chartPrefs.patterns ? "active" : ""} onClick={() => toggleChartPref("patterns")} type="button">形态</button>
                <button className={chartPrefs.tds9 ? "active" : ""} onClick={() => toggleChartPref("tds9")} type="button">TDS9</button>
                <button className={chartPrefs.indicatorSignals ? "active" : ""} onClick={() => toggleChartPref("indicatorSignals")} type="button">技信</button>
                <button className={chartPrefs.divergences ? "active" : ""} onClick={() => toggleChartPref("divergences")} type="button">背离</button>
                <button className={chartPrefs.sar ? "active" : ""} onClick={() => toggleChartPref("sar")} type="button">SAR</button>
                <button className={chartPrefs.bbi ? "active" : ""} onClick={() => toggleChartPref("bbi")} type="button">BBI</button>
                <button className={chartPrefs.ichimoku ? "active" : ""} onClick={() => toggleChartPref("ichimoku")} type="button">一目</button>
                <span>高级·副图</span>
                <button className={chartPrefs.volumeSignals ? "active" : ""} onClick={() => toggleChartPref("volumeSignals")} type="button">量信</button>
                <button className={chartPrefs.advanced ? "active" : ""} onClick={() => toggleChartPref("advanced")} type="button">CR/ARBR/EMV</button>
                <button className={chartPrefs.momentum ? "active" : ""} onClick={() => toggleChartPref("momentum")} type="button">DMI/CCI/WR</button>
                <button className={chartPrefs.biasDma ? "active" : ""} onClick={() => toggleChartPref("biasDma")} type="button">BIAS/DMA</button>
                <button className={chartPrefs.volumeMomentum ? "active" : ""} onClick={() => toggleChartPref("volumeMomentum")} type="button">VR/MFI/TRIX/OSC</button>
                <button className={chartPrefs.volatility ? "active" : ""} onClick={() => toggleChartPref("volatility")} type="button">ATR/OBV</button>
              </div>
            )}

            {paramsOpen && (
              <div className="chart-param-panel" aria-label="交易信号K线指标参数">
                <div className="chart-param-preset-strip" aria-label="交易信号K线指标参数预设">
                  <span>参数预设</span>
                  {CHART_PARAMETER_PRESETS.map((preset) => (
                    <button
                      aria-pressed={activeChartParameterPreset === preset.key}
                      className={activeChartParameterPreset === preset.key ? "active" : ""}
                      key={preset.key}
                      onClick={() => applyChartParameterPresetValue(preset.key)}
                      title={preset.description}
                      type="button"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <span>{activeChartParameterPreset ? "当前参数" : "自定义参数"}</span>
                </div>
                <ChartParamInput label="MA快" value={chartParams.maFast} onChange={updateChartParam("maFast")} />
                <ChartParamInput label="MA中" value={chartParams.maMid} onChange={updateChartParam("maMid")} />
                <ChartParamInput label="MA慢" value={chartParams.maSlow} onChange={updateChartParam("maSlow")} />
                <ChartParamInput label="EMA快" value={chartParams.emaFast} onChange={updateChartParam("emaFast")} />
                <ChartParamInput label="EMA慢" value={chartParams.emaSlow} onChange={updateChartParam("emaSlow")} />
                <ChartParamInput label="BOLL周期" value={chartParams.bollPeriod} onChange={updateChartParam("bollPeriod")} />
                <ChartParamInput label="BOLL倍数" value={chartParams.bollMultiplier} step="0.1" onChange={updateChartParam("bollMultiplier")} />
                <ChartParamInput label="ENE周期" value={chartParams.enePeriod} onChange={updateChartParam("enePeriod")} />
                <ChartParamInput label="ENE幅度" value={chartParams.enePercent} step="0.1" onChange={updateChartParam("enePercent")} />
                <ChartParamInput label="MIKE周期" value={chartParams.mikePeriod} onChange={updateChartParam("mikePeriod")} />
                <ChartParamInput label="MACD快" value={chartParams.macdFast} onChange={updateChartParam("macdFast")} />
                <ChartParamInput label="MACD慢" value={chartParams.macdSlow} onChange={updateChartParam("macdSlow")} />
                <ChartParamInput label="MACD信号" value={chartParams.macdSignal} onChange={updateChartParam("macdSignal")} />
                <ChartParamInput label="RSI" value={chartParams.rsiPeriod} onChange={updateChartParam("rsiPeriod")} />
                <ChartParamInput label="PSY" value={chartParams.psyPeriod} onChange={updateChartParam("psyPeriod")} />
                <ChartParamInput label="PSYMA" value={chartParams.psyMaPeriod} onChange={updateChartParam("psyMaPeriod")} />
                <ChartParamInput label="KDJ" value={chartParams.kdjPeriod} onChange={updateChartParam("kdjPeriod")} />
                <ChartParamInput label="CR/ARBR" value={chartParams.crPeriod} onChange={updateChartParam("crPeriod")} />
                <ChartParamInput label="EMV均线" value={chartParams.emvPeriod} onChange={updateChartParam("emvPeriod")} />
                <ChartParamInput label="DMI/CCI/WR" value={chartParams.momentumPeriod} onChange={updateChartParam("momentumPeriod")} />
                <ChartParamInput label="BIAS" value={chartParams.biasPeriod} onChange={updateChartParam("biasPeriod")} />
                <ChartParamInput label="DMA快" value={chartParams.dmaFast} onChange={updateChartParam("dmaFast")} />
                <ChartParamInput label="DMA慢" value={chartParams.dmaSlow} onChange={updateChartParam("dmaSlow")} />
                <ChartParamInput label="AMA" value={chartParams.dmaSignal} onChange={updateChartParam("dmaSignal")} />
                <ChartParamInput label="VR/MFI" value={chartParams.volumeMomentumPeriod} onChange={updateChartParam("volumeMomentumPeriod")} />
                <ChartParamInput label="ROC" value={chartParams.rocPeriod} onChange={updateChartParam("rocPeriod")} />
                <ChartParamInput label="OSC" value={chartParams.oscPeriod} onChange={updateChartParam("oscPeriod")} />
                <ChartParamInput label="OSCEMA" value={chartParams.oscEmaPeriod} onChange={updateChartParam("oscEmaPeriod")} />
                <ChartParamInput label="TRIX" value={chartParams.trixPeriod} onChange={updateChartParam("trixPeriod")} />
                <ChartParamInput label="TRMA" value={chartParams.trixSignal} onChange={updateChartParam("trixSignal")} />
                <ChartParamInput label="ATR" value={chartParams.atrPeriod} onChange={updateChartParam("atrPeriod")} />
              </div>
            )}
          </div>

        <svg
            className={`price-history-chart trade-signal-chart ${effectiveSplitSubCharts ? "split-indicators" : "compact-indicators"} ${annotationLabelMode === "compact" ? "compact-annotations" : "full-annotations"} ${dragStart.current ? "dragging" : ""} ${chartPrefs.measure ? "measuring" : ""} ${drawingTool !== "none" ? "drawing" : ""}`}
          onMouseDown={(event) => {
            if (chartPrefs.measure || drawingTool !== "none") return;
            dragStart.current = { x: event.clientX, offset: rightOffset };
          }}
          onClick={handleChartClick}
          onMouseLeave={() => {
            dragStart.current = null;
            setCrosshair(null);
            setHoveredSignalId(null);
            setHoveredEvidenceEventId(null);
            setHoveredTradePlanLevelKey(null);
          }}
          onMouseMove={handleChartPointer}
          onMouseUp={() => {
            dragStart.current = null;
          }}
          onWheel={handleWheelZoom}
          preserveAspectRatio="none"
          viewBox={`0 0 1000 ${chart.viewBoxHeight}`}
        >
          {chartPrefs.trendRegime && showDenseTrendRegime && chart.trendRegimeBands.map((band) => (
            <g className={`trend-regime-band ${band.tone}`} key={band.key}>
              <rect height={chart.priceBottom - chart.priceTop} width={band.width} x={band.x} y={chart.priceTop} />
              {band.showLabel && (
                <text x={band.labelX} y={band.labelY}>{band.label}</text>
              )}
              <title>
                {band.startLabel}→{band.endLabel} {band.label} · {band.bars}根
              </title>
            </g>
          ))}
          {chart.sections.map((section) => (
            <g key={section.key}>
              <line className="indicator-section-line" x1={chart.plotLeft} x2={chart.plotRight} y1={section.bottom} y2={section.bottom} />
              <text className="indicator-label" x={chart.plotLeft} y={section.top + 16}>{section.label}</text>
              {chartIndicatorAxisTicks(chart, section.key).map((tick) => (
                <g className="indicator-axis-tick" key={`${section.key}-${tick.label}-${tick.y.toFixed(1)}`}>
                  <line x1={chart.plotRight + 4} x2={chart.plotRight + 11} y1={tick.y} y2={tick.y} />
                  <text x={chart.axisX + 23} y={tick.y + 4}>{tick.label}</text>
                </g>
              ))}
              {indicatorPanelReadoutMap.get(section.key) && (
                <text className="indicator-section-readout" x={chart.plotLeft + 170} y={section.top + 16}>
                  <tspan>{indicatorReadoutLabel}</tspan>
                  {indicatorPanelReadoutMap.get(section.key)?.items.slice(0, indicatorPanelReadoutLimit).map((item, index) => (
                    <tspan className={item.signed ? quoteTone(item.value) : ""} dx={index === 0 ? 12 : 10} key={item.label}>
                      {item.label} {formatIndicatorPanelReadout(item)}
                    </tspan>
                  ))}
                </text>
              )}
            </g>
          ))}
          <rect
            className="price-axis-panel"
            x={chart.plotRight + 8}
            y={chart.sections[0].top - 12}
            width="64"
            height={chart.signalLaneY - chart.sections[0].top + 24}
            rx="6"
          />
          {chart.priceTicks.map((tick) => (
            <g className="price-tick" key={tick.label}>
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={tick.y} y2={tick.y} />
              <rect className="axis-price-label-bg" x={chart.axisX - 6} y={tick.y - 18} width="58" height="21" rx="4" />
              <text className="axis-price-label" x={chart.axisX + 23} y={tick.y - 4}>
                {formatChartAxisValue(chart, tick.value)}
              </text>
            </g>
          ))}
          {visibleOverlayPriceLabels.map((label) => (
            <g className={`overlay-price-label ${label.group || "overlay"} ${label.tone}`} key={label.key}>
              <line x1={chart.plotRight - 5} x2={chart.plotRight + 8} y1={label.y} y2={label.labelY} />
              <rect height="18" rx="4" width="64" x={chart.plotRight + 8} y={label.labelY - 9} />
              <text x={chart.plotRight + 40} y={label.labelY + 3.5}>
                {label.label} {formatChartAxisPrice(chart, label.price)}
              </text>
              <title>{label.label} {formatChartAxisPrice(chart, label.price)}</title>
            </g>
          ))}
          {visibleIndicatorValueLabels.map((label) => (
            <g className={`indicator-value-label ${label.section} ${label.group || "indicator"} ${label.tone}`} key={label.key}>
              <line x1={chart.plotRight + 1} x2={chart.plotRight + 9} y1={label.y} y2={label.labelY} />
              <rect height="16" rx="4" width="64" x={chart.plotRight + 8} y={label.labelY - 8} />
              <text x={chart.plotRight + 12} y={label.labelY + 3}>
                {label.label} {formatIndicatorValueLabel(label)}
              </text>
              <title>{label.label} {formatIndicatorValueLabel(label)}</title>
            </g>
          ))}
          {visibleIndicatorThresholdZones.map((zone) => (
            <g className={`indicator-threshold-zone ${zone.section} ${zone.tone}`} key={zone.key}>
              <rect height={zone.height} width={chart.plotRight - chart.plotLeft} x={chart.plotLeft} y={zone.y} />
              <title>{zone.label}</title>
            </g>
          ))}
          {visibleIndicatorThresholdGuides.map((guide) => (
            <g className={`indicator-threshold-guide ${guide.section} ${guide.tone}`} key={guide.key}>
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={guide.y} y2={guide.y} />
              <text x={chart.plotRight - 58} y={guide.labelY}>{guide.label}</text>
            </g>
          ))}
          <line className="macd-zero-line" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.macdZeroY} y2={chart.macdZeroY} />
          <line className="signal-lane" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.signalLaneY} y2={chart.signalLaneY} />
          {chart.eventDensityBars.map((bar) => (
            <g className={`kline-event-density-bar ${bar.tone}`} key={bar.key}>
              <rect height={bar.height} rx="1.6" width={bar.width} x={bar.x - bar.width / 2} y={bar.y} />
              {bar.count > 1 && <text x={bar.x} y={bar.y - 3}>{bar.count}</text>}
              <title>{bar.label} · {bar.detail}</title>
            </g>
          ))}
          {chartPrefs.levels && chart.latestPriceLine && (
            <g className={`latest-price-line ${chart.latestPriceLine.tone}`}>
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={chart.latestPriceLine.y} y2={chart.latestPriceLine.y} />
              <circle cx={chart.plotRight - 3} cy={chart.latestPriceLine.y} r="3.6" />
              <title>
                {chart.latestPriceLine.label} {formatChartAxisPrice(chart, chart.latestPriceLine.price)} · {formatSignedPercent(chart.latestPriceLine.changePct)}
              </title>
            </g>
          )}
          {chartPrefs.levels && chart.prevCloseY != null && (
            <g className="prev-close-level">
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={chart.prevCloseY} y2={chart.prevCloseY} />
              <text x={chart.plotLeft + 8} y={Math.max(chart.sections[0].top + 14, chart.prevCloseY - 7)}>
                昨收 {formatNumber(chart.latestIndicators?.prevClose, 2)}
              </text>
            </g>
          )}
          {chartPrefs.limitLines && chart.limitPriceLines.upLine && (
            <g className="limit-price-layer up">
              <polyline className="limit-price-line up" points={chart.limitPriceLines.upLine} />
              {chart.limitPriceLines.latestUp && (
                <text
                  className="limit-price-label up"
                  x={chart.plotRight - 82}
                  y={clampNumber(chart.limitPriceLines.latestUp.y - 7, chart.priceTop + 16, chart.priceBottom - 8)}
                >
                  涨停 {formatNumber(chart.limitPriceLines.latestUp.price, 2)}
                </text>
              )}
              <title>涨停价参考线</title>
            </g>
          )}
          {chartPrefs.limitLines && chart.limitPriceLines.downLine && (
            <g className="limit-price-layer down">
              <polyline className="limit-price-line down" points={chart.limitPriceLines.downLine} />
              {chart.limitPriceLines.latestDown && (
                <text
                  className="limit-price-label down"
                  x={chart.plotRight - 82}
                  y={clampNumber(chart.limitPriceLines.latestDown.y + 13, chart.priceTop + 18, chart.priceBottom - 6)}
                >
                  跌停 {formatNumber(chart.limitPriceLines.latestDown.price, 2)}
                </text>
              )}
              <title>跌停价参考线</title>
            </g>
          )}
          {chartPrefs.levels && tradePlanLevels.map((level) => (
            <g
              aria-label={`策略价位 ${level.label} ${formatNumber(level.price, 2)}`}
              className={`trade-plan-level ${level.tone} ${level.emphasis ? "emphasis" : ""} ${hoveredTradePlanLevelKey === level.key ? "active" : ""}`}
              key={level.key}
              onBlur={() => setHoveredTradePlanLevelKey(null)}
              onFocus={() => setHoveredTradePlanLevelKey(level.key)}
              onMouseEnter={() => setHoveredTradePlanLevelKey(level.key)}
              onMouseLeave={() => setHoveredTradePlanLevelKey(null)}
              role="button"
              tabIndex={0}
            >
              <line className="trade-plan-hit-target" x1={chart.plotLeft} x2={chart.plotRight} y1={level.y} y2={level.y} />
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={level.y} y2={level.y} />
              <circle className="trade-plan-dot" cx={chart.plotRight - 3} cy={level.y} r={level.emphasis ? "4.8" : "3.8"} />
              <title>{level.label} {formatNumber(level.price, 2)}</title>
            </g>
          ))}
          {chartPrefs.relative && chart.relativeLine && (
            <g className="relative-return-layer">
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={chart.relativeZeroY} y2={chart.relativeZeroY} />
              <polyline className="relative-stock-line" points={chart.relativeLine} />
              {chart.relativeStrengthIndexLine && (
                <polyline className="relative-index-line" points={chart.relativeStrengthIndexLine} />
              )}
              {chart.relativeStrengthIndustryLine && (
                <polyline className="relative-industry-line" points={chart.relativeStrengthIndustryLine} />
              )}
              <text x={clampNumber(chart.plotRight - 268, chart.plotLeft + 8, chart.plotRight - 112)} y={Math.max(chart.sections[0].top + 16, chart.relativeZeroY - 8)}>
                {[
                  `本股 ${formatSignedPercent(chart.relativeLatest)}`,
                  isFiniteNumber(chart.relativeStrengthLatestIndex) ? `指数 ${formatSignedPercent(chart.relativeStrengthLatestIndex)}` : null,
                  isFiniteNumber(chart.relativeStrengthLatestIndustry) ? `行业 ${formatSignedPercent(chart.relativeStrengthLatestIndustry)}` : null,
                ].filter(Boolean).join(" · ")}
              </text>
              <title>相对收益叠加：本股、相对指数、相对行业</title>
            </g>
          )}
          {chartPrefs.profile && showDenseProfile && chart.volumeProfile.bins.length > 0 && (
            <VolumeProfileLayer chart={chart} profile={chart.volumeProfile} />
          )}
          {chartPrefs.fibonacci && showDenseAutoLevels && chart.fibonacciLevels.map((level) => (
            <g className={`fibonacci-level ${level.ratio === 0 || level.ratio === 1 ? "edge" : ""}`} key={level.key}>
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={level.y} y2={level.y} />
              <text x={level.labelX} y={level.labelY}>
                {level.label} {formatNumber(level.price, 2)}
              </text>
              <title>斐波回撤 {level.label} {formatNumber(level.price, 2)}</title>
            </g>
          ))}
          {chartPrefs.supportResistance && showDenseAutoLevels && chart.supportResistanceLevels.map((level) => (
            <g className={`support-resistance-level ${level.type}`} key={level.key}>
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={level.y} y2={level.y} />
              <circle cx={level.type === "support" ? chart.plotLeft + 4 : chart.plotRight - 4} cy={level.y} r="3" />
              <text x={level.labelX} y={level.labelY}>
                {level.type === "support" ? "支撑" : "压力"} {formatNumber(level.price, 2)} · {level.touches}触
              </text>
              <title>
                {level.label} {formatNumber(level.price, 2)} · 最近触达 {level.lastLabel} · 距现价 {formatSignedNumber(level.distancePct, 2)}%
              </title>
            </g>
          ))}
          {chartPrefs.trendLines && showDenseAutoLevels && chart.priceStructureTrendLines.map((line) => (
            <g className={`price-structure-trend-line ${line.tone}`} key={line.key}>
              <line x1={line.x1} x2={line.x2} y1={line.y1} y2={line.y2} />
              <circle cx={line.anchorStartX} cy={line.anchorStartY} r="3" />
              <circle cx={line.anchorEndX} cy={line.anchorEndY} r="3" />
              <text x={line.labelX} y={line.labelY}>
                {line.label}
              </text>
              <title>
                {line.label} {line.anchorStartLabel}→{line.anchorEndLabel} · {formatNumber(line.anchorStartPrice, 2)}→{formatNumber(line.anchorEndPrice, 2)}
              </title>
            </g>
          ))}
          {showDenseAutoLevels && chart.priceGaps.map((gap) => (
            <g className={`price-gap-layer ${gap.direction}`} key={gap.key}>
              <rect height={gap.height} width={gap.width} x={gap.x} y={gap.y} />
              <line x1={gap.x} x2={chart.plotRight} y1={gap.y} y2={gap.y} />
              <line x1={gap.x} x2={chart.plotRight} y1={gap.y + gap.height} y2={gap.y + gap.height} />
              <text x={gap.labelX} y={gap.labelY}>
                {gap.direction === "up" ? "向上缺口" : "向下缺口"} {formatNumber(gap.gapPct, 2)}%
              </text>
              <title>
                {gap.startLabel}→{gap.endLabel} {gap.direction === "up" ? "向上缺口" : "向下缺口"}{" "}
                {formatNumber(gap.lowPrice, 2)}-{formatNumber(gap.highPrice, 2)}
              </title>
            </g>
          ))}
          {chart.timeTicks.map((tick) => (
            <text className="time-axis-label" key={`${tick.label}-${tick.x}`} x={tick.x} y={chart.timeAxisY}>
              {tick.label}
            </text>
          ))}
          {chart.rangeNavigator && (
            <g className="kline-range-navigator">
              <rect
                className="navigator-hit-target"
                height="20"
                onClick={jumpToRangeNavigator}
                onMouseDown={jumpToRangeNavigator}
                rx="4"
                width={chart.rangeNavigator.trackWidth}
                x={chart.rangeNavigator.trackX}
                y={chart.timeAxisY - 15}
              />
              <line
                className="navigator-track"
                x1={chart.rangeNavigator.trackX}
                x2={chart.rangeNavigator.trackX + chart.rangeNavigator.trackWidth}
                y1={chart.timeAxisY - 4}
                y2={chart.timeAxisY - 4}
              />
              <rect
                className="navigator-window"
                height="6"
                rx="3"
                width={chart.rangeNavigator.selectionWidth}
                x={chart.rangeNavigator.selectionX}
                y={chart.timeAxisY - 7}
              />
              <text x={chart.plotRight - 92} y={chart.timeAxisY - 10}>{chart.rangeNavigator.label}</text>
              <title>当前窗口 {chart.rangeNavigator.label}</title>
            </g>
          )}
          {chartPrefs.boll && chart.bollBandArea && (
            <path className="boll-band-area" d={chart.bollBandArea} />
          )}
          {chartPrefs.ma && chart.maTrendRibbons.map((ribbon) => (
            <path className={`ma-trend-ribbon ${ribbon.tone}`} d={ribbon.path} key={ribbon.key} />
          ))}
          {chartPrefs.ichimoku && showDenseAutoLevels && chart.ichimokuCloudSegments.map((segment) => (
            <path className={`ichimoku-cloud ${segment.tone}`} d={segment.path} key={segment.key} />
          ))}
          {chartPrefs.macd && chart.macdBars.map((bar) => (
            <rect
              className={`macd-bar ${bar.value >= 0 ? "positive" : "negative"}`}
              height={Math.max(0.8, bar.height)}
              key={bar.date}
              width={bar.width}
              x={bar.x - bar.width / 2}
              y={bar.y}
            />
          ))}
          {chartPrefs.macd && chart.difLine && <polyline className="indicator-line dif" points={chart.difLine} />}
          {chartPrefs.macd && chart.deaLine && <polyline className="indicator-line dea" points={chart.deaLine} />}
          {chartPrefs.rsi && chart.rsiLine && <polyline className="indicator-line rsi" points={chart.rsiLine} />}
          {chartPrefs.rsi && showDenseSecondaryIndicators && chart.psyLine && <polyline className="indicator-line psy" points={chart.psyLine} />}
          {chartPrefs.rsi && showDenseSecondaryIndicators && chart.psyMaLine && <polyline className="indicator-line psy-ma" points={chart.psyMaLine} />}
          {chartPrefs.kdj && showDenseSecondaryIndicators && chart.kdjKLine && <polyline className="indicator-line kdj-k" points={chart.kdjKLine} />}
          {chartPrefs.kdj && showDenseSecondaryIndicators && chart.kdjDLine && <polyline className="indicator-line kdj-d" points={chart.kdjDLine} />}
          {chartPrefs.kdj && showDenseSecondaryIndicators && chart.kdjJLine && <polyline className="indicator-line kdj-j" points={chart.kdjJLine} />}
          {chartPrefs.advanced && showDenseSecondaryIndicators && (
            <>
              <line className="advanced-indicator-baseline" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.advanced100Y} y2={chart.advanced100Y} />
              <line className="advanced-emv-zero-line" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.emvZeroY} y2={chart.emvZeroY} />
            </>
          )}
          {chartPrefs.advanced && showDenseSecondaryIndicators && chart.crLine && <polyline className="indicator-line cr" points={chart.crLine} />}
          {chartPrefs.advanced && showDenseSecondaryIndicators && chart.arLine && <polyline className="indicator-line ar" points={chart.arLine} />}
          {chartPrefs.advanced && showDenseSecondaryIndicators && chart.brLine && <polyline className="indicator-line br" points={chart.brLine} />}
          {chartPrefs.advanced && showDenseSecondaryIndicators && chart.emvLine && <polyline className="indicator-line emv" points={chart.emvLine} />}
          {chartPrefs.advanced && showDenseSecondaryIndicators && chart.emvMaLine && <polyline className="indicator-line emv-ma" points={chart.emvMaLine} />}
          {chartPrefs.momentum && showDenseSecondaryIndicators && <line className="momentum-zero-line" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.momentumZeroY} y2={chart.momentumZeroY} />}
          {chartPrefs.momentum && showDenseSecondaryIndicators && chart.pdiLine && <polyline className="indicator-line pdi" points={chart.pdiLine} />}
          {chartPrefs.momentum && showDenseSecondaryIndicators && chart.mdiLine && <polyline className="indicator-line mdi" points={chart.mdiLine} />}
          {chartPrefs.momentum && showDenseSecondaryIndicators && chart.adxLine && <polyline className="indicator-line adx" points={chart.adxLine} />}
          {chartPrefs.momentum && showDenseSecondaryIndicators && chart.cciLine && <polyline className="indicator-line cci" points={chart.cciLine} />}
          {chartPrefs.momentum && showDenseSecondaryIndicators && chart.wrLine && <polyline className="indicator-line wr" points={chart.wrLine} />}
          {chartPrefs.biasDma && showDenseSecondaryIndicators && chart.biasLine && <polyline className="indicator-line bias" points={chart.biasLine} />}
          {chartPrefs.biasDma && showDenseSecondaryIndicators && chart.dmaLine && <polyline className="indicator-line dma" points={chart.dmaLine} />}
          {chartPrefs.biasDma && showDenseSecondaryIndicators && chart.amaLine && <polyline className="indicator-line ama" points={chart.amaLine} />}
          {chartPrefs.volumeMomentum && showDenseSecondaryIndicators && (
            <>
              <line className="advanced-indicator-baseline" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.moneyFlow100Y} y2={chart.moneyFlow100Y} />
              <line className="volume-momentum-zero-line" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.volumeMomentumZeroY} y2={chart.volumeMomentumZeroY} />
            </>
          )}
          {chartPrefs.volumeMomentum && showDenseSecondaryIndicators && chart.mfiLine && <polyline className="indicator-line mfi" points={chart.mfiLine} />}
          {chartPrefs.volumeMomentum && showDenseSecondaryIndicators && chart.vrLine && <polyline className="indicator-line vr" points={chart.vrLine} />}
          {chartPrefs.volumeMomentum && showDenseSecondaryIndicators && chart.rocLine && <polyline className="indicator-line roc" points={chart.rocLine} />}
          {chartPrefs.volumeMomentum && showDenseSecondaryIndicators && chart.trixLine && <polyline className="indicator-line trix" points={chart.trixLine} />}
          {chartPrefs.volumeMomentum && showDenseSecondaryIndicators && chart.trmaLine && <polyline className="indicator-line trma" points={chart.trmaLine} />}
          {chartPrefs.volumeMomentum && showDenseSecondaryIndicators && chart.oscLine && <polyline className="indicator-line osc" points={chart.oscLine} />}
          {chartPrefs.volumeMomentum && showDenseSecondaryIndicators && chart.oscEmaLine && <polyline className="indicator-line osc-ema" points={chart.oscEmaLine} />}
          {chartPrefs.volatility && showDenseSecondaryIndicators && <line className="obv-zero-line" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.obvZeroY} y2={chart.obvZeroY} />}
          {chartPrefs.volatility && showDenseSecondaryIndicators && chart.atrLine && <polyline className="indicator-line atr" points={chart.atrLine} />}
          {chartPrefs.volatility && showDenseSecondaryIndicators && chart.obvLine && <polyline className="indicator-line obv" points={chart.obvLine} />}
          {chartPrefs.volatility && showDenseSecondaryIndicators && chart.bollPercentBLine && <polyline className="indicator-line boll-percent-b" points={chart.bollPercentBLine} />}
          {chartPrefs.volatility && showDenseSecondaryIndicators && chart.bollBandwidthLine && <polyline className="indicator-line boll-bandwidth" points={chart.bollBandwidthLine} />}
          {chartPrefs.boll && chart.bollUpper && <polyline className="boll-line upper" points={chart.bollUpper} />}
          {chartPrefs.boll && chart.bollMid && <polyline className="boll-line mid" points={chart.bollMid} />}
          {chartPrefs.boll && chart.bollLower && <polyline className="boll-line lower" points={chart.bollLower} />}
          {chartPrefs.ene && showDenseAutoLevels && chart.eneUpper && <polyline className="ene-line upper" points={chart.eneUpper} />}
          {chartPrefs.ene && showDenseAutoLevels && chart.eneMid && <polyline className="ene-line mid" points={chart.eneMid} />}
          {chartPrefs.ene && showDenseAutoLevels && chart.eneLower && <polyline className="ene-line lower" points={chart.eneLower} />}
          {chartPrefs.mike && showDenseAutoLevels && chart.mikeWeakResistanceLine && <polyline className="mike-line weak-resistance" points={chart.mikeWeakResistanceLine} />}
          {chartPrefs.mike && showDenseAutoLevels && chart.mikeMediumResistanceLine && <polyline className="mike-line medium-resistance" points={chart.mikeMediumResistanceLine} />}
          {chartPrefs.mike && showDenseAutoLevels && chart.mikeStrongResistanceLine && <polyline className="mike-line strong-resistance" points={chart.mikeStrongResistanceLine} />}
          {chartPrefs.mike && showDenseAutoLevels && chart.mikeWeakSupportLine && <polyline className="mike-line weak-support" points={chart.mikeWeakSupportLine} />}
          {chartPrefs.mike && showDenseAutoLevels && chart.mikeMediumSupportLine && <polyline className="mike-line medium-support" points={chart.mikeMediumSupportLine} />}
          {chartPrefs.mike && showDenseAutoLevels && chart.mikeStrongSupportLine && <polyline className="mike-line strong-support" points={chart.mikeStrongSupportLine} />}
          {chartPrefs.vwap && chart.vwapLine && <polyline className="vwap-line" points={chart.vwapLine} />}
          {chartPrefs.ema && chart.emaFastLine && <polyline className="ema-line fast" points={chart.emaFastLine} />}
          {chartPrefs.ema && chart.emaSlowLine && <polyline className="ema-line slow" points={chart.emaSlowLine} />}
          {chartPrefs.sar && chart.sarLine && <polyline className="sar-line" points={chart.sarLine} />}
          {chartPrefs.bbi && chart.bbiLine && <polyline className="bbi-line" points={chart.bbiLine} />}
          {chartPrefs.ichimoku && showDenseAutoLevels && chart.ichimokuConversionLine && <polyline className="ichimoku-line conversion" points={chart.ichimokuConversionLine} />}
          {chartPrefs.ichimoku && showDenseAutoLevels && chart.ichimokuBaseLine && <polyline className="ichimoku-line base" points={chart.ichimokuBaseLine} />}
          {chartPrefs.ichimoku && showDenseAutoLevels && chart.ichimokuSpanALine && <polyline className="ichimoku-line span-a" points={chart.ichimokuSpanALine} />}
          {chartPrefs.ichimoku && showDenseAutoLevels && chart.ichimokuSpanBLine && <polyline className="ichimoku-line span-b" points={chart.ichimokuSpanBLine} />}
          {chartPrefs.ichimoku && showDenseAutoLevels && chart.ichimokuLaggingLine && <polyline className="ichimoku-line lagging" points={chart.ichimokuLaggingLine} />}
          {chartPrefs.ma && chart.ma5 && <polyline className="ma-line ma5" points={chart.ma5} />}
          {chartPrefs.ma && chart.ma20 && <polyline className="ma-line ma20" points={chart.ma20} />}
          {chartPrefs.ma && chart.ma60 && <polyline className="ma-line ma60" points={chart.ma60} />}
          {chartPrefs.ma && chart.ma120 && <polyline className="ma-line ma120" points={chart.ma120} />}
          {klineRenderMode === "line" && chart.closeLine && <polyline className="kline-close-line" points={chart.closeLine} />}
          {chart.candles.map((candle) => {
            const isHeikinAshi = klineRenderMode === "heikinAshi";
            const candleTone = isHeikinAshi ? candle.heikinTone : candle.tone;
            const renderHighY = isHeikinAshi ? candle.heikinHighY : candle.highY;
            const renderLowY = isHeikinAshi ? candle.heikinLowY : candle.lowY;
            const renderBodyY = isHeikinAshi ? candle.heikinBodyY : candle.bodyY;
            const renderBodyHeight = isHeikinAshi ? candle.heikinBodyHeight : candle.bodyHeight;
            return (
              <g className={`candle ${candleTone} ${klineRenderMode}`} key={candle.date}>
                {klineRenderMode === "ohlc" ? (
                  <>
                    <line className="ohlc-stem" x1={candle.x} x2={candle.x} y1={candle.highY} y2={candle.lowY} />
                    <line className="ohlc-open" x1={candle.x - candle.width * 0.48} x2={candle.x} y1={candle.openY} y2={candle.openY} />
                    <line className="ohlc-close" x1={candle.x} x2={candle.x + candle.width * 0.48} y1={candle.closeY} y2={candle.closeY} />
                  </>
                ) : klineRenderMode === "candle" || isHeikinAshi ? (
                  <>
                    <line x1={candle.x} x2={candle.x} y1={renderHighY} y2={renderLowY} />
                    <rect
                      x={candle.x - candle.width / 2}
                      y={renderBodyY}
                      width={candle.width}
                      height={Math.max(renderBodyHeight, 1.2)}
                      rx="0.35"
                    />
                    {isHeikinAshi && (
                      <title>
                        {candle.date} 平均K 开 {formatNumber(candle.heikinOpen, 2)} 高 {formatNumber(candle.heikinHigh, 2)} 低 {formatNumber(candle.heikinLow, 2)} 收 {formatNumber(candle.heikinClose, 2)}
                      </title>
                    )}
                  </>
                ) : null}
                {chartPrefs.volume && (
                  <rect
                    className="volume-bar"
                    x={candle.x - candle.width / 2}
                    y={candle.volumeY}
                    width={candle.width}
                    height={candle.volumeHeight}
                  />
                )}
                {chartPrefs.limitLines && candle.limitState && candle.limitLabel && (
                  <g className={`limit-state-marker ${candle.limitState}`}>
                    <rect x={candle.x - 15} y={candle.limitLabelY - 10} width="30" height="13" rx="4" />
                    <text x={candle.x} y={candle.limitLabelY}>
                      {candle.limitLabel}
                    </text>
                    <title>{candle.date} {candle.limitLabel}</title>
                  </g>
                )}
              </g>
            );
          })}
          {manualDrawingGeometry.map((drawing) => (
            <g className={`manual-drawing-layer ${drawing.type}`} key={drawing.id}>
              <line x1={drawing.x1} x2={drawing.x2} y1={drawing.y1} y2={drawing.y2} />
              {drawing.type === "trend" && (
                <>
                  <circle cx={drawing.x1} cy={drawing.y1} r="3.8" />
                  <circle cx={drawing.x2} cy={drawing.y2} r="3.8" />
                </>
              )}
              <text x={drawing.labelX} y={drawing.labelY}>{drawing.label}</text>
              <title>
                {drawing.startLabel}→{drawing.endLabel} · {formatNumber(drawing.startPrice, 2)}→{formatNumber(drawing.endPrice, 2)}
              </title>
            </g>
          ))}
          {pendingDrawingMarker && (
            <g className="manual-drawing-pending">
              <circle cx={pendingDrawingMarker.x} cy={pendingDrawingMarker.y} r="5" />
              <line x1={pendingDrawingMarker.x} x2={pendingDrawingMarker.x} y1={chart.priceTop} y2={chart.priceBottom} />
              <text x={clampNumber(pendingDrawingMarker.x + 10, chart.plotLeft + 8, chart.plotRight - 112)} y={clampNumber(pendingDrawingMarker.y - 10, chart.priceTop + 14, chart.priceBottom - 6)}>
                起点 {formatNumber(pendingDrawingMarker.price, 2)}
              </text>
              <title>{pendingDrawingMarker.label} 趋势线起点</title>
            </g>
          )}
          {chart.rangeExtrema && (
            <g className="price-extrema-layer">
              <g className="price-extrema-marker high">
                <line
                  x1={chart.rangeExtrema.highX}
                  x2={chart.rangeExtrema.highLabelX}
                  y1={chart.rangeExtrema.highY}
                  y2={chart.rangeExtrema.highY - 12}
                />
                <circle cx={chart.rangeExtrema.highX} cy={chart.rangeExtrema.highY} r="3.2" />
                <text
                  textAnchor={chart.rangeExtrema.highAnchor}
                  x={chart.rangeExtrema.highLabelX}
                  y={Math.max(chart.sections[0].top + 12, chart.rangeExtrema.highY - 16)}
                >
                  高 {formatNumber(chart.rangeExtrema.high, 2)}
                </text>
                <title>{chart.rangeExtrema.highLabel} 高点 {formatNumber(chart.rangeExtrema.high, 2)}</title>
              </g>
              <g className="price-extrema-marker low">
                <line
                  x1={chart.rangeExtrema.lowX}
                  x2={chart.rangeExtrema.lowLabelX}
                  y1={chart.rangeExtrema.lowY}
                  y2={chart.rangeExtrema.lowY + 12}
                />
                <circle cx={chart.rangeExtrema.lowX} cy={chart.rangeExtrema.lowY} r="3.2" />
                <text
                  textAnchor={chart.rangeExtrema.lowAnchor}
                  x={chart.rangeExtrema.lowLabelX}
                  y={Math.min(chart.sections[0].bottom - 6, chart.rangeExtrema.lowY + 24)}
                >
                  低 {formatNumber(chart.rangeExtrema.low, 2)}
                </text>
                <title>{chart.rangeExtrema.lowLabel} 低点 {formatNumber(chart.rangeExtrema.low, 2)}</title>
              </g>
            </g>
          )}
          {chartPrefs.patterns && showDenseAnnotations && chart.candlestickPatterns.map((pattern) => (
            <g
              className={`candlestick-pattern-marker ${pattern.tone} ${hoveredAnnotationKey === pattern.key ? "active" : ""}`}
              key={pattern.key}
              onMouseEnter={() => showAnnotation(pattern.key)}
              onMouseLeave={hideAnnotation}
            >
              <line x1={pattern.x} x2={pattern.x} y1={pattern.priceY} y2={pattern.markerY} />
              <circle cx={pattern.x} cy={pattern.markerY} r="4.2" />
              {showAnnotationLabel(pattern.key) && <text x={pattern.labelX} y={pattern.labelY}>{pattern.label}</text>}
              <title>
                {pattern.dateLabel} {pattern.label} {formatNumber(pattern.price, 2)}
              </title>
            </g>
          ))}
          {chartPrefs.tds9 && showDenseAnnotations && chart.tdsSequentialEvents.map((event) => (
            <g className={`tds9-marker ${event.direction} ${event.tone}`} key={event.key}>
              <rect height="14" rx="3" width="14" x={event.x - 7} y={event.markerY - 7} />
              <text x={event.x} y={event.markerY}>{event.count}</text>
              <title>
                {event.dateLabel} TDS9{event.direction === "sell" ? "上涨" : "下跌"}序列 {event.count} · {formatNumber(event.price, 2)}
              </title>
            </g>
          ))}
          {chartPrefs.indicatorSignals && showDenseAnnotations && chart.technicalIndicatorEvents.map((event) => (
            <g
              className={`technical-indicator-event ${event.tone} ${hoveredAnnotationKey === event.key ? "active" : ""}`}
              key={event.key}
              onMouseEnter={() => showAnnotation(event.key)}
              onMouseLeave={hideAnnotation}
            >
              <line x1={event.x} x2={event.x} y1={event.priceY} y2={event.markerY} />
              <path d={`M ${event.x} ${event.markerY - 4.8} L ${event.x + 4.8} ${event.markerY} L ${event.x} ${event.markerY + 4.8} L ${event.x - 4.8} ${event.markerY} Z`} />
              {showAnnotationLabel(event.key) && <text x={event.labelX} y={event.labelY}>{event.label}</text>}
              <title>
                {event.dateLabel} {event.label} {formatNumber(event.price, 2)}
              </title>
            </g>
          ))}
          {chartPrefs.divergences && showDenseAnnotations && chart.technicalDivergenceEvents.map((event) => (
            <g
              className={`technical-divergence-event ${event.tone} ${hoveredAnnotationKey === event.key ? "active" : ""}`}
              key={event.key}
              onMouseEnter={() => showAnnotation(event.key)}
              onMouseLeave={hideAnnotation}
            >
              <line className="divergence-price-link" x1={event.startX} x2={event.x} y1={event.startPriceY} y2={event.priceY} />
              <line x1={event.x} x2={event.x} y1={event.priceY} y2={event.markerY} />
              <path d={`M ${event.x - 5} ${event.markerY + (event.tone === "risk" ? -4 : 4)} L ${event.x} ${event.markerY + (event.tone === "risk" ? 5 : -5)} L ${event.x + 5} ${event.markerY + (event.tone === "risk" ? -4 : 4)} Z`} />
              {showAnnotationLabel(event.key) && <text x={event.labelX} y={event.labelY}>{event.label}</text>}
              <title>
                {event.startLabel}→{event.dateLabel} {event.label} · 价格 {formatNumber(event.startPrice, 2)}→{formatNumber(event.price, 2)} · 指标 {formatNumber(event.startIndicator, 2)}→{formatNumber(event.endIndicator, 2)}
              </title>
            </g>
          ))}
          {chartPrefs.volume && chartPrefs.volumeSignals && showDenseAnnotations && chart.volumeSignalEvents.map((event) => (
            <g
              className={`volume-signal-event ${event.tone} ${hoveredAnnotationKey === event.key ? "active" : ""}`}
              key={event.key}
              onMouseEnter={() => showAnnotation(event.key)}
              onMouseLeave={hideAnnotation}
            >
              <line x1={event.x} x2={event.x} y1={event.volumeY} y2={event.markerY} />
              <rect height="10" rx="2" width="10" x={event.x - 5} y={event.markerY - 5} />
              {showAnnotationLabel(event.key) && <text x={event.labelX} y={event.labelY}>{event.label}</text>}
              <title>
                {event.dateLabel} {event.label} · 量比 {formatNumber(event.volumeRatio, 2)} · 涨跌 {formatSignedPercent((event.changePct ?? 0) / 100)}
              </title>
            </g>
          ))}
          {showDenseClusterBadges && compactAnnotationDisplay.clusters.map((cluster) => (
            <g className={`annotation-cluster-badge ${cluster.tone}`} key={cluster.key}>
              <circle cx={cluster.x} cy={cluster.y} r="9" />
              <text x={cluster.x} y={cluster.y + 3}>{cluster.label}</text>
              <title>{cluster.detail}</title>
            </g>
          ))}
          {chartPrefs.volume && chartPrefs.fundFlow && chart.fundFlowOverlay.bars.length > 0 && (
            <g className="fund-flow-overlay">
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={chart.fundFlowOverlay.zeroY} y2={chart.fundFlowOverlay.zeroY} />
              {chart.fundFlowOverlay.bars.map((bar) => (
                <rect
                  className={`fund-flow-bar ${bar.type} ${bar.tone}`}
                  height={bar.height}
                  key={bar.key}
                  rx="0.4"
                  width={bar.width}
                  x={bar.x - bar.width / 2}
                  y={bar.y}
                />
              ))}
            </g>
          )}
          {chartPrefs.volume && chart.volumeMa5Line && <polyline className="volume-ma-line ma5" points={chart.volumeMa5Line} />}
          {chartPrefs.volume && chart.volumeMa10Line && <polyline className="volume-ma-line ma10" points={chart.volumeMa10Line} />}
          {chartPrefs.volume && chart.volumeMa20Line && <polyline className="volume-ma-line ma20" points={chart.volumeMa20Line} />}
          {chartPrefs.signals && chart.entryLinks.map((link) => (
            <g className="signal-entry-link" key={link.id}>
              <line x1={link.signalX} x2={link.entryX} y1={link.signalY} y2={link.entryY} />
              <circle cx={link.entryX} cy={link.entryY} r="4" />
            </g>
          ))}
          {chartPrefs.events && evidenceEventMarkers.map((marker) => (
            <g
              aria-label={`${marker.event.title} ${evidenceEventDateLabel(marker.event)}`}
              className={`evidence-event-marker ${marker.tone} ${marker.event.id === hoveredEvidenceEventId ? "active" : ""}`}
              key={marker.event.id}
              onClick={() => {
                if (marker.event.signal_id) chooseSignal(marker.event.signal_id);
              }}
              onKeyDown={(event) => handleEvidenceEventKey(event, marker.event)}
              onMouseEnter={() => setHoveredEvidenceEventId(marker.event.id)}
              onMouseLeave={() => setHoveredEvidenceEventId(null)}
              role={marker.event.signal_id ? "button" : "img"}
              tabIndex={marker.event.signal_id ? 0 : undefined}
            >
              <line className="event-guide" x1={marker.x} x2={marker.x} y1={chart.sections[0].top} y2={chart.signalLaneY} />
              <path d={`M ${marker.x} ${marker.y - 7} L ${marker.x + 7} ${marker.y} L ${marker.x} ${marker.y + 7} L ${marker.x - 7} ${marker.y} Z`} />
              <text x={marker.x} y={marker.y + 3}>{marker.label}</text>
              <title>{marker.event.title} · {marker.event.detail}</title>
            </g>
          ))}
          {chartPrefs.signals && chartMarkers.map((marker) => {
            const hovered = marker.signal.signal_id === hoveredSignalId;
            const active =
              marker.signal.signal_id === selectedSignalId ||
              hovered;
            return (
              <g
                aria-label={`${marker.label} ${marker.signal.signal_name} ${signalDateLabel(marker.signal)}`}
                className={`trade-signal-marker ${marker.tone} ${active ? "active" : ""}`}
                key={marker.signal.signal_id}
                onClick={() => chooseSignal(marker.signal.signal_id)}
                onKeyDown={(event) => handleMarkerKey(event, marker.signal.signal_id)}
                onMouseEnter={() => setHoveredSignalId(marker.signal.signal_id)}
                onMouseLeave={() => setHoveredSignalId(null)}
                role="button"
                tabIndex={0}
              >
                {hovered && (
                  <>
                    <line className="active-signal-guide" x1={marker.x} x2={marker.x} y1={chart.sections[0].top} y2={chart.signalLaneY} />
                    {marker.entryY != null && (
                      <g className="active-entry-level">
                        <line x1={chart.plotLeft} x2={chart.plotRight} y1={marker.entryY} y2={marker.entryY} />
                      </g>
                    )}
                  </>
                )}
                {marker.tone === "risk" ? (
                  <polygon points={`${marker.x},${marker.y} ${marker.x - marker.size},${marker.y - marker.size * 1.45} ${marker.x + marker.size},${marker.y - marker.size * 1.45}`} />
                ) : (
                  <polygon points={`${marker.x},${marker.y} ${marker.x - marker.size},${marker.y + marker.size * 1.45} ${marker.x + marker.size},${marker.y + marker.size * 1.45}`} />
                )}
                <circle cx={marker.x} cy={marker.dotY} r={active ? "6.2" : "4.2"} />
                <circle className="signal-lane-dot" cx={marker.x} cy={chart.signalLaneY} r={active ? "5" : "3.6"} />
                <title>
                  {signalDateLabel(marker.signal)} {marker.signal.signal_name} {marker.signal.signal_level || ""}{" "}
                  {formatNumber(marker.signal.score, 1)}
                </title>
              </g>
            );
          })}
          {hoverSignalTooltip && (
            <g className={`signal-hover-tooltip ${hoverSignalTooltip.tone}`}>
              <rect x={hoverSignalTooltip.x} y={hoverSignalTooltip.y} width={hoverSignalTooltip.width} height={hoverSignalTooltip.height} rx="8" />
              <text className="signal-tooltip-title" x={hoverSignalTooltip.x + 12} y={hoverSignalTooltip.y + 22}>
                {hoverSignalTooltip.title}
              </text>
              <text className="signal-tooltip-subtitle" x={hoverSignalTooltip.x + 12} y={hoverSignalTooltip.y + 42}>
                {hoverSignalTooltip.subtitle}
              </text>
              {hoverSignalTooltip.rows.map((row, index) => (
                <text className="signal-tooltip-row" key={row.label} x={hoverSignalTooltip.x + 12} y={hoverSignalTooltip.y + 66 + index * 18}>
                  <tspan>{row.label}</tspan>
                  <tspan dx="10">{row.value}</tspan>
                </text>
              ))}
            </g>
          )}
          {tradePlanTooltip && (
            <g className={`signal-hover-tooltip trade-plan-tooltip ${tradePlanTooltip.tone}`}>
              <rect x={tradePlanTooltip.x} y={tradePlanTooltip.y} width={tradePlanTooltip.width} height={tradePlanTooltip.height} rx="8" />
              <text className="signal-tooltip-title" x={tradePlanTooltip.x + 12} y={tradePlanTooltip.y + 22}>
                {tradePlanTooltip.title}
              </text>
              <text className="signal-tooltip-subtitle" x={tradePlanTooltip.x + 12} y={tradePlanTooltip.y + 42}>
                {tradePlanTooltip.subtitle}
              </text>
              {tradePlanTooltip.rows.map((row, index) => (
                <text className="signal-tooltip-row" key={row.label} x={tradePlanTooltip.x + 12} y={tradePlanTooltip.y + 66 + index * 18}>
                  <tspan>{row.label}</tspan>
                  <tspan dx="10">{row.value}</tspan>
                </text>
              ))}
            </g>
          )}
          {evidenceEventTooltip && (
            <g className={`signal-hover-tooltip evidence-event-tooltip ${evidenceEventTooltip.tone}`}>
              <rect x={evidenceEventTooltip.x} y={evidenceEventTooltip.y} width={evidenceEventTooltip.width} height={evidenceEventTooltip.height} rx="8" />
              <text className="signal-tooltip-title" x={evidenceEventTooltip.x + 12} y={evidenceEventTooltip.y + 22}>
                {evidenceEventTooltip.title}
              </text>
              <text className="signal-tooltip-subtitle" x={evidenceEventTooltip.x + 12} y={evidenceEventTooltip.y + 42}>
                {evidenceEventTooltip.subtitle}
              </text>
              {evidenceEventTooltip.rows.map((row, index) => (
                <text className="signal-tooltip-row" key={row.label} x={evidenceEventTooltip.x + 12} y={evidenceEventTooltip.y + 66 + index * 18}>
                  <tspan>{row.label}</tspan>
                  <tspan dx="10">{row.value}</tspan>
                </text>
              ))}
            </g>
          )}
          {measuredRange && (
            <g className={`chart-measure ${measuredRange.tone}`}>
              <line x1={measuredRange.start.x} x2={measuredRange.end.x} y1={measuredRange.start.closeY} y2={measuredRange.end.closeY} />
              <line x1={measuredRange.start.x} x2={measuredRange.start.x} y1={chart.sections[0].top} y2={chart.signalLaneY} />
              <line x1={measuredRange.end.x} x2={measuredRange.end.x} y1={chart.sections[0].top} y2={chart.signalLaneY} />
              <circle cx={measuredRange.start.x} cy={measuredRange.start.closeY} r="4" />
              <circle cx={measuredRange.end.x} cy={measuredRange.end.closeY} r="4" />
              <rect x={measuredRange.labelX} y={measuredRange.labelY} width={measuredRange.labelWidth} height={measuredRange.labelHeight} rx="6" />
              <text x={measuredRange.labelX + 10} y={measuredRange.labelY + 18}>
                {measuredRange.bars}根/{measuredRange.barCount}K · {formatSignedPercent(measuredRange.changePct)} · {formatSignedNumber(measuredRange.change, 2)}
              </text>
              <text x={measuredRange.labelX + 10} y={measuredRange.labelY + 38}>
                {formatNumber(measuredRange.start.close, 2)} → {formatNumber(measuredRange.end.close, 2)}
              </text>
              <text x={measuredRange.labelX + 10} y={measuredRange.labelY + 58}>
                高 {formatNumber(measuredRange.high, 2)} / 低 {formatNumber(measuredRange.low, 2)} · 振幅 {formatSignedPercent(measuredRange.amplitudePct)}
              </text>
              <text x={measuredRange.labelX + 10} y={measuredRange.labelY + 78}>
                回撤 {formatSignedPercent(measuredRange.maxDrawdownPct)} · 上行 {formatSignedPercent(measuredRange.maxRunupPct)}
              </text>
              <text x={measuredRange.labelX + 10} y={measuredRange.labelY + 98}>
                量 {formatCompactNumber(measuredRange.totalVolume)} / 额 {formatMoney(measuredRange.totalAmount)}
              </text>
              <title>
                {measuredRange.startLabel}→{measuredRange.endLabel} · 最高 {measuredRange.highLabel} · 最低 {measuredRange.lowLabel}
              </title>
            </g>
          )}
          {crosshair && !hoverSignalTooltip && !tradePlanTooltip && !evidenceEventTooltip && (
            <g className="chart-crosshair">
              <line x1={crosshair.x} x2={crosshair.x} y1={chart.sections[0].top} y2={chart.signalLaneY} />
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={crosshair.y} y2={crosshair.y} />
              <rect className="crosshair-price-tag" x={chart.axisX - 4} y={clampNumber(crosshair.y - 12, chart.sections[0].top + 2, chart.signalLaneY - 24)} width="58" height="22" rx="4" />
              <text className="crosshair-price-text" x={chart.axisX + 4} y={clampNumber(crosshair.y + 4, chart.sections[0].top + 18, chart.signalLaneY - 8)}>
                {formatChartAxisPrice(chart, crosshair.price)}
              </text>
              <rect className="crosshair-date-tag" x={clampNumber(crosshair.x - 38, chart.plotLeft, chart.plotRight - 76)} y={chart.timeAxisY - 20} width="76" height="20" rx="4" />
              <text className="crosshair-date-text" x={clampNumber(crosshair.x, chart.plotLeft + 38, chart.plotRight - 38)} y={chart.timeAxisY - 5}>
                {shortDateLabel(crosshair.candle.periodLabel || crosshair.candle.date)}
              </text>
              <rect className="crosshair-readout-panel" x={crosshair.labelX} y="52" width="304" height="388" rx="6" />
              <text className="crosshair-readout-title" x={crosshair.labelX + 12} y="76">
                {crosshair.candle.periodLabel || crosshair.candle.date}
              </text>
              <text className={`crosshair-readout-status ${crosshair.candle.hoverMetrics.status || "neutral"}`} x={crosshair.labelX + 226} y="76">
                {crosshair.candle.hoverMetrics.statusLabel}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="100">
                周期 {periodData.unit} · 信号 {crosshairSignalCount} · 振幅 {formatSignedPercent(crosshair.candle.indicators.amplitudePct)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="124">
                开 {formatNumber(crosshair.candle.open, 2)} · 高 {formatNumber(crosshair.candle.high, 2)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 162} y="124">
                低 {formatNumber(crosshair.candle.low, 2)} · 收 {formatNumber(crosshair.candle.close, 2)}
              </text>
              <text className="crosshair-readout-row emphasis" x={crosshair.labelX + 12} y="148">
                涨跌 {formatSignedNumber(crosshair.candle.indicators.change, 2)} / {formatSignedPercent(crosshair.candle.indicators.changePct)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 162} y="148">
                均价 {formatNumber(crosshair.candle.hoverMetrics.averagePrice, 2)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="172">
                量 {formatCompactNumber(crosshair.candle.volume)} · 额 {formatMoney(crosshair.candle.amount)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 162} y="172">
                VMA {formatCompactNumber(crosshair.candle.indicators.volumeMa5)} / {formatCompactNumber(crosshair.candle.indicators.volumeMa10)} / {formatCompactNumber(crosshair.candle.indicators.volumeMa20)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="196">
                涨停 {formatNumber(crosshair.candle.limitUp, 2)} ({formatSignedPercent(crosshair.candle.hoverMetrics.limitUpDistancePct)})
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 162} y="196">
                跌停 {formatNumber(crosshair.candle.limitDown, 2)} ({formatSignedPercent(crosshair.candle.hoverMetrics.limitDownDistancePct)})
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="220">
                MA {formatNumber(crosshair.candle.ma5, 2)} / {formatNumber(crosshair.candle.ma20, 2)} / {formatNumber(crosshair.candle.ma60, 2)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="244">
                BOLL {formatNumber(crosshair.candle.indicators.bollMid, 2)} · RSI {formatNumber(crosshair.candle.indicators.rsi14, 1)} · PSY {formatNumber(crosshair.candle.indicators.psy, 1)} / {formatNumber(crosshair.candle.indicators.psyMa, 1)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="268">
                MFI {formatNumber(crosshair.candle.indicators.mfi, 1)} · VR {formatNumber(crosshair.candle.indicators.vr, 1)} · ATR {formatNumber(crosshair.candle.indicators.atr, 2)} · %B {formatNumber(crosshair.candle.indicators.bollPercentB, 1)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="292">
                DMI +DI {formatNumber(crosshair.candle.indicators.pdi, 1)} / -DI {formatNumber(crosshair.candle.indicators.mdi, 1)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 162} y="292">
                ADX {formatNumber(crosshair.candle.indicators.adx, 1)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="316">
                CCI {formatNumber(crosshair.candle.indicators.cci, 1)} · WR {formatNumber(crosshair.candle.indicators.wr, 1)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="340">
                KDJ K {formatNumber(crosshair.candle.indicators.kdjK, 1)} / D {formatNumber(crosshair.candle.indicators.kdjD, 1)} / J {formatNumber(crosshair.candle.indicators.kdjJ, 1)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="364">
                BIAS {formatSignedNumber(crosshair.candle.indicators.bias, 2)} · DMA {formatSignedNumber(crosshair.candle.indicators.dma, 2)} · AMA {formatSignedNumber(crosshair.candle.indicators.ama, 2)}
              </text>
              <text className="crosshair-readout-row" x={crosshair.labelX + 12} y="388">
                ROC {formatSignedNumber(crosshair.candle.indicators.roc, 2)} · TRIX {formatSignedNumber(crosshair.candle.indicators.trix, 2)} · OSC {formatSignedNumber(crosshair.candle.indicators.osc, 2)}
              </text>
              {chartPrefs.fundFlow && crosshair.candle.fundFlow && (
                <text className="crosshair-readout-row fund-flow" x={crosshair.labelX + 12} y="412">
                  资金 主力 {formatCompactNumber(crosshair.candle.fundFlow.main_net_inflow)} · 大单 {formatCompactNumber(crosshair.candle.fundFlow.large_net_inflow)} · 北向 {formatCompactNumber(crosshair.candle.fundFlow.northbound_net_inflow)}
                </text>
              )}
            </g>
          )}
          {chart.candles.length === 0 && <text x="3" y="104">暂无历史行情</text>}
        </svg>
        </div>

        {strategyAnalysis ? (
          <StrategyDecisionWorkbench
            analysis={strategyAnalysis}
            indicators={activeIndicators}
            technicalDecision={technicalDecision}
          />
        ) : (
          <>
            <div className="trade-signal-inspector">
              <div className="signal-headline-card">
                <span className="eyebrow">Unified Signal Source</span>
                <h3>{activeSignal?.signal_name || "暂无交易信号"}</h3>
                <p>
                  {activeSignal
                    ? `${signalDateLabel(activeSignal)} · ${activeSignal.signal_level || "-"} · ${signalDirectionLabel(activeSignal.direction)}`
                    : "写入或导入信号后可在K线上查看买卖点"}
                </p>
              </div>
              <div className={`trade-decision-card ${activeDecision.tone}`}>
                <span className="eyebrow">Decision</span>
                <strong>{activeDecision.label}</strong>
                <p>{activeDecision.summary}</p>
                <div className="decision-score-row">
                  <span>买入确认 <b>{activeDecision.buyScore}/5</b></span>
                  <span>卖出压力 <b>{activeDecision.sellScore}/5</b></span>
                </div>
              </div>
              <div className="signal-inspector-block">
                <span className="inspector-subtitle">信号表现</span>
                <div className="signal-inspector-grid">
                  <MiniChartStat label="评分" value={formatNumber(activeSignal?.score, 1)} />
                  <MiniChartStat label="入场" value={`${activeSignal?.entry_date || "-"} / ${formatNumber(activeSignal?.entry_price, 2)}`} />
                  <MiniChartStat label="20日收益" value={formatSignedPercent(activeSignal?.ret_20d)} />
                  <MiniChartStat label="最大不利" value={formatSignedPercent(activeSignal?.max_adverse_20d)} />
                </div>
              </div>
              <div className="signal-inspector-block">
                <span className="inspector-subtitle">指标读数</span>
                <div className="signal-inspector-grid">
                  <MiniChartStat label="DIF / DEA" value={`${formatNumber(activeIndicators?.dif, 2)} / ${formatNumber(activeIndicators?.dea, 2)}`} />
                  <MiniChartStat label="MACD柱" value={formatNumber(activeIndicators?.macd, 2)} />
                  <MiniChartStat label="RSI / PSY / MA" value={`${formatNumber(activeIndicators?.rsi14, 1)} / ${formatNumber(activeIndicators?.psy, 1)} / ${formatNumber(activeIndicators?.psyMa, 1)}`} />
                  <MiniChartStat label="量比" value={formatNumber(activeIndicators?.volumeRatio, 2)} />
                  <MiniChartStat label="BOLL中轨" value={formatNumber(activeIndicators?.bollMid, 2)} />
                  <MiniChartStat label="KDJ J" value={formatNumber(activeIndicators?.kdjJ, 1)} />
                  <MiniChartStat label="SAR / BBI" value={`${formatNumber(activeIndicators?.sar, 2)} / ${formatNumber(activeIndicators?.bbi, 2)}`} />
                  <MiniChartStat label="DMI+/DMI-" value={`${formatNumber(activeIndicators?.pdi, 1)} / ${formatNumber(activeIndicators?.mdi, 1)}`} />
                  <MiniChartStat label="CCI / WR" value={`${formatNumber(activeIndicators?.cci, 1)} / ${formatNumber(activeIndicators?.wr, 1)}`} />
                  <MiniChartStat label="BIAS / DMA" value={`${formatNumber(activeIndicators?.bias, 2)} / ${formatNumber(activeIndicators?.dma, 2)}`} />
                  <MiniChartStat label="MFI / VR" value={`${formatNumber(activeIndicators?.mfi, 1)} / ${formatNumber(activeIndicators?.vr, 1)}`} />
                  <MiniChartStat label="ROC / OSC" value={`${formatSignedNumber(activeIndicators?.roc, 2)} / ${formatSignedNumber(activeIndicators?.osc, 2)}`} />
                </div>
              </div>
            </div>

            <div className="trade-decision-grid">
              <DecisionChecklist
                title="买入确认指标"
                tone="opportunity"
                checks={technicalDecision.buyChecks}
              />
              <DecisionChecklist
                title="卖出/减仓指标"
                tone="risk"
                checks={technicalDecision.sellChecks}
              />
            </div>
          </>
        )}

        {strategyAnalysis && (
          <StrategyFactorWorkbench analysis={strategyAnalysis} backtest={strategyControls?.backtest || null} />
        )}
      </div>

      <div className="signal-badge-tape" aria-label="交易信号序列">
        {chartMarkers.slice(-12).map((marker) => (
          <button
            className={`signal-tape-pill ${marker.tone} ${marker.signal.signal_id === activeMarker?.signal.signal_id ? "active" : ""}`}
            key={marker.signal.signal_id}
            onClick={() => chooseSignal(marker.signal.signal_id)}
            type="button"
          >
            <span>{signalShortDate(marker.signal)}</span>
            <strong>{marker.label}</strong>
            <em>{formatNumber(marker.signal.score, 0)}</em>
          </button>
        ))}
        {chartMarkers.length === 0 && <span className="empty-state">当前区间暂无可落图信号。</span>}
      </div>

      <div className="chart-legend">
        <span><i className="legend-candle up" />机会/买入</span>
        <span><i className="legend-candle down" />风险/卖出</span>
        <span><i className="legend-line ma5" />MA5</span>
        <span><i className="legend-line ma20" />MA20</span>
        <span><i className="legend-line ma60" />MA60</span>
        <span><i className="legend-line ma120" />MA120</span>
        <span><i className="legend-line vwap" />VWAP/EMA</span>
        <span><i className="legend-trend-regime" />趋势背景</span>
        <span><i className="legend-line trend" />SAR/BBI</span>
        <span><i className="legend-ichimoku" />一目均衡</span>
        <span><i className="legend-line macd" />MACD/RSI/PSY</span>
        <span><i className="legend-line advanced" />CR/ARBR/EMV</span>
        <span><i className="legend-line momentum" />DMI/CCI/WR</span>
        <span><i className="legend-line bias-dma" />BIAS/DMA</span>
        <span><i className="legend-line volume-momentum" />VR/MFI/TRIX/OSC</span>
        <span><i className="legend-line volatility" />ATR/OBV</span>
        <span><i className="legend-line profile" />筹码分布</span>
        <span><i className="legend-line profile-level" />筹码价位</span>
        <span><i className="legend-fund-flow" />资金流</span>
        <span><i className="legend-line fibonacci" />斐波回撤</span>
        <span><i className="legend-limit-price" />涨跌停</span>
        <span><i className="legend-support-resistance" />自动支阻</span>
        <span><i className="legend-trend-line" />结构趋势线</span>
        <span><i className="legend-extrema" />窗口高低</span>
        <span><i className="legend-gap" />跳空缺口</span>
        <span><i className="legend-pattern" />K线形态</span>
        <span><i className="legend-tech-signal" />技术信号</span>
        <span><i className="legend-divergence" />指标背离</span>
        <span><i className="legend-volume-signal" />量价异动</span>
        <span><i className="legend-marker" />信号日至入场日</span>
        <span><i className="legend-event" />证据事件</span>
      </div>
    </div>
  );
}

function StrategyWorkbenchControls({
  analysis,
  controls,
}: {
  analysis: StrategyKlineAnalysis;
  controls: StrategyKlineControls;
}) {
  return (
    <div className="strategy-workbench-controls">
      <div>
        <span className="eyebrow">Strategy Workbench</span>
        <strong>{analysis.strategy_name || "V2 多指标共振策略"}</strong>
        <p>
          {analysis.latest_bar?.date || "-"} · {analysis.symbol} · {strategyModeLabel(controls.mode)} · 周线趋势 + 日线执行
        </p>
      </div>
      <div className="strategy-action-bar">
        <div className="segmented-control">
          <button
            className={controls.mode === "conservative" ? "active" : ""}
            disabled={controls.loading}
            onClick={() => controls.onModeChange("conservative")}
            type="button"
          >
            保守
          </button>
          <button
            className={controls.mode === "aggressive" ? "active" : ""}
            disabled={controls.loading}
            onClick={() => controls.onModeChange("aggressive")}
            type="button"
          >
            激进
          </button>
        </div>
        <button className="mini" disabled={controls.loading} onClick={controls.onCreateSignal} type="button">
          写入信号
        </button>
        <button className="primary compact-action" disabled={controls.loading} onClick={controls.onRunBacktest} type="button">
          V2回测
        </button>
      </div>
      {controls.actionMessage && <p className="strategy-action-note">{controls.actionMessage}</p>}
    </div>
  );
}

function ChartParamInput({
  label,
  value,
  step = "1",
  onChange,
}: {
  label: string;
  value: number;
  step?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input inputMode="decimal" min="1" step={step} type="number" value={value} onChange={onChange} />
    </label>
  );
}

function VolumeProfileSummary({ profile }: { profile: VolumeProfileModel }) {
  if (profile.bins.length === 0) {
    return (
      <div className="volume-profile-summary missing" aria-label="筹码分布摘要">
        <span>筹码分布</span>
        <strong>暂无可用价量样本</strong>
        <em>同步历史 K 线和成交量后展示可视区价量分布。</em>
      </div>
    );
  }
  const rows = [
    {
      key: "poc",
      label: "峰值筹码",
      value: profileRangeLabel(profile.pointOfControl),
      detail: `${formatPercent(profile.pointOfControl?.percent)} · ${formatCompactNumber(profile.pointOfControl?.volume)}`,
    },
    {
      key: "avg",
      label: "平均成本",
      value: formatNumber(profile.weightedAveragePrice, 2),
      detail: `可视区成交 ${formatCompactNumber(profile.totalVolume)}`,
    },
    {
      key: "winner",
      label: "获利/套牢",
      value: formatPercent(profile.winningVolumeRatio),
      detail: `套牢 ${formatPercent(profile.lockedVolumeRatio)} · 现价 ${formatNumber(profile.currentPrice, 2)}`,
    },
    {
      key: "cost70",
      label: "70%成本区",
      value: profileCostRangeLabel(profile.costRange70),
      detail: `集中度 ${formatPercent(profile.costRange70?.concentrationRatio)} · 90% ${profileCostRangeLabel(profile.costRange90)}`,
    },
    {
      key: "support",
      label: "下方支撑",
      value: profileRangeLabel(profile.supportBin),
      detail: profile.supportBin ? `${formatPercent(profile.supportBin.percent)} · ${formatCompactNumber(profile.supportBin.volume)}` : "当前价下方暂无集中筹码",
    },
    {
      key: "resistance",
      label: "上方压力",
      value: profileRangeLabel(profile.resistanceBin),
      detail: profile.resistanceBin ? `${formatPercent(profile.resistanceBin.percent)} · ${formatCompactNumber(profile.resistanceBin.volume)}` : "当前价上方暂无集中筹码",
    },
  ];
  return (
    <div className="volume-profile-summary" aria-label="筹码分布摘要">
      {rows.map((row) => (
        <div key={row.key}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          <em>{row.detail}</em>
        </div>
      ))}
    </div>
  );
}

function VolumeProfileLayer({
  chart,
  profile,
}: {
  chart: Record<string, any>;
  profile: VolumeProfileModel;
}) {
  const panelRight = chart.plotRight - 8;
  const panelWidth = 116;
  const panelLeft = panelRight - panelWidth;
  const averageY = chartPriceToY(chart, profile.weightedAveragePrice);
  const cost70TopY = chartPriceToY(chart, profile.costRange70?.high);
  const cost70BottomY = chartPriceToY(chart, profile.costRange70?.low);
  const profileLevels = buildVolumeProfileLevelAnnotations(profile);
  return (
    <g className="volume-profile-layer">
      {profileLevels.map((level) => {
        const y = chartPriceToY(chart, level.price);
        if (!isFiniteNumber(y)) return null;
        return (
          <g className={`volume-profile-level ${level.key}`} key={level.key}>
            <line x1={chart.plotLeft} x2={panelLeft - 14} y1={y} y2={y} />
            <circle cx={panelLeft - 14} cy={y} r="3.1" />
            <text x={chart.plotLeft + 8} y={clampNumber(y - 5, chart.priceTop + 30, chart.priceBottom - 8)}>
              {level.label} {formatNumber(level.price, 2)}
            </text>
            <title>
              {level.label} {formatNumber(level.price, 2)} · {formatPercent(level.percent)} · {formatCompactNumber(level.volume)}
            </title>
          </g>
        );
      })}
      <rect className="volume-profile-panel" x={panelLeft - 8} y={chart.priceTop + 2} width={panelWidth + 14} height={chart.priceBottom - chart.priceTop - 4} rx="8" />
      <text className="volume-profile-title" x={panelLeft} y={chart.priceTop + 18}>筹码分布</text>
      {isFiniteNumber(cost70TopY) && isFiniteNumber(cost70BottomY) && (
        <g className="volume-profile-cost-range cost70">
          <rect
            height={Math.max(2, Math.abs(cost70BottomY - cost70TopY))}
            width={panelWidth + 6}
            x={panelLeft - 4}
            y={Math.min(cost70TopY, cost70BottomY)}
          />
          <text x={panelLeft} y={clampNumber(Math.min(cost70TopY, cost70BottomY) + 12, chart.priceTop + 32, chart.priceBottom - 8)}>
            70%成本
          </text>
          <title>
            70%成本区 {profileCostRangeLabel(profile.costRange70)} · 集中度 {formatPercent(profile.costRange70?.concentrationRatio)}
          </title>
        </g>
      )}
      {profile.bins.map((bin) => {
        const topY = chartPriceToY(chart, bin.high);
        const bottomY = chartPriceToY(chart, bin.low);
        if (!isFiniteNumber(topY) || !isFiniteNumber(bottomY)) return null;
        const y = Math.min(topY, bottomY);
        const height = Math.max(Math.abs(bottomY - topY) - 1, 1.8);
        const width = Math.max(1.4, (panelWidth - 18) * (bin.widthPercent / 100));
        return (
          <rect
            className={`volume-profile-bar ${bin.side} ${bin.isPointOfControl ? "poc" : ""}`}
            height={height}
            key={`${bin.low}-${bin.high}`}
            width={width}
            x={panelRight - width}
            y={y}
          >
            <title>
              {profileRangeLabel(bin)} · {formatPercent(bin.percent)} · {formatCompactNumber(bin.volume)}
            </title>
          </rect>
        );
      })}
      {isFiniteNumber(averageY) && (
        <g className="volume-profile-average">
          <line x1={panelLeft - 2} x2={panelRight + 4} y1={averageY} y2={averageY} />
          <text x={panelLeft} y={Math.max(chart.priceTop + 34, averageY - 5)}>成本 {formatNumber(profile.weightedAveragePrice, 2)}</text>
        </g>
      )}
    </g>
  );
}

function profileRangeLabel(bin?: { low: number; high: number } | null) {
  if (!bin) return "-";
  return `${formatNumber(bin.low, 2)}-${formatNumber(bin.high, 2)}`;
}

function profileCostRangeLabel(range?: { low: number; high: number } | null) {
  if (!range) return "-";
  return `${formatNumber(range.low, 2)}-${formatNumber(range.high, 2)}`;
}

function ChartDiagnosticsStrip({
  diagnostics,
}: {
  diagnostics: { tone: "good" | "warn" | "bad" | "neutral"; label: string; detail: string }[];
}) {
  return (
    <div className="chart-diagnostics-strip" aria-label="K线交易诊断">
      {diagnostics.map((item) => (
        <div className={`chart-diagnostic ${item.tone}`} key={`${item.label}-${item.detail}`}>
          <span>{item.label}</span>
          <strong>{item.detail}</strong>
        </div>
      ))}
    </div>
  );
}

function StrategyDecisionWorkbench({
  analysis,
  indicators,
  technicalDecision,
}: {
  analysis: StrategyKlineAnalysis;
  indicators?: TradingIndicatorSnapshot | null;
  technicalDecision: ReturnType<typeof buildTradeDecision>;
}) {
  const tone = strategyDecisionTone(analysis);
  const steps = buildStrategyDecisionSteps(analysis);
  const snapshotItems = buildStrategySnapshotItems(analysis, indicators);
  const action = analysis.sell_signal?.warning_level?.action || analysis.trend_state?.action || analysis.decision.action || "-";
  const decisionCopy = buildReadableStrategyDecisionCopy({
    date: analysis.latest_bar?.date,
    symbol: analysis.symbol,
    modeLabel: strategyModeLabel(analysis.mode),
    decisionLabel: analysis.decision.label,
    decisionAction: action,
    steps,
  });
  const reasons = buildStrategyCriticalReasons(analysis, technicalDecision, steps, decisionCopy.reasons);

  return (
    <div className={`strategy-decision-workbench ${tone}`} aria-label="V2策略决策台">
      <section className="strategy-decision-primary">
        <span className="eyebrow">V2 交易判断</span>
        <h3>{decisionCopy.title}</h3>
        <p>{decisionCopy.subtitle}</p>
        <div className="strategy-critical-list">
          {reasons.map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
        <div className="strategy-score-strip">
          <span>买入强度 <b>{formatNumber(analysis.buy_signal?.score, 3)}</b></span>
          <span>卖出压力 <b>{formatNumber(analysis.sell_signal?.score, 2)}</b></span>
          <span>买入确认 <b>{technicalDecision.buyScore}/5</b></span>
          <span>风险确认 <b>{technicalDecision.sellScore}/5</b></span>
        </div>
      </section>

      <section className="strategy-decision-chain" aria-label="M1-M5决策链">
        <div className="section-subhead">
          <h2>五步交易判断</h2>
          <span className="muted">{steps.filter((step) => step.tone === "good").length}/{steps.length} 可继续</span>
        </div>
        {steps.map((step) => (
          <div className={`strategy-chain-step ${step.tone}`} key={step.key}>
            <span>{step.key}</span>
            <div>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
            <b>{step.status}</b>
          </div>
        ))}
      </section>

      <section className="strategy-snapshot-panel" aria-label="指标与风控快照">
        <div className="section-subhead">
          <h2>关键读数</h2>
          <span className="muted">辅助判断</span>
        </div>
        <div className="strategy-snapshot-grid">
          {snapshotItems.map((item) => (
            <div className={`strategy-snapshot-item ${item.tone || "neutral"}`} key={`${item.label}-${item.value}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              {item.detail && <em>{item.detail}</em>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function buildStrategyDecisionSteps(analysis: StrategyKlineAnalysis): StrategyDecisionStep[] {
  const trendLabel = analysis.trend_state?.label || "-";
  const trendBad = /空|弱|bear|down|未通过/i.test(trendLabel);
  const trendGood = !trendBad && /多|bull|up|向上|强势/i.test(trendLabel);
  const marketPassed = Boolean(analysis.market_filter?.passed);
  const buyTriggered = Boolean(analysis.buy_signal?.mode_signal);
  const warningLevel = analysis.sell_signal?.warning_level?.level || 0;
  const shares = analysis.position_plan?.suggested_shares || 0;

  return [
    buildReadableStrategyGateText({
      gate: "M1",
      trendGood,
      trendBad,
      trendLabel,
    }),
    buildReadableStrategyGateText({
      gate: "M2",
      marketPassed,
      marketStatus: analysis.market_filter?.status,
      benchmarkSymbol: analysis.market_filter?.benchmark_symbol,
    }),
    buildReadableStrategyGateText({
      gate: "M3",
      buyTriggered,
      buyScore: analysis.buy_signal?.score,
      buyThreshold: analysis.buy_signal?.threshold,
    }),
    buildReadableStrategyGateText({
      gate: "M4",
      emergency: analysis.sell_signal?.emergency,
      regularExit: analysis.sell_signal?.regular_exit,
      warningLevel,
      warningLabel: analysis.sell_signal?.warning_level?.label,
      sellAction: analysis.sell_signal?.warning_level?.action,
      sellScore: analysis.sell_signal?.score,
    }),
    buildReadableStrategyGateText({
      gate: "M5",
      shares,
      positionPct: analysis.position_plan?.suggested_position_pct,
      riskPct: analysis.position_plan?.risk_pct,
    }),
  ];
}

function buildStrategySnapshotItems(
  analysis: StrategyKlineAnalysis,
  indicators?: TradingIndicatorSnapshot | null,
): StrategySnapshotItem[] {
  const channel = analysis.price_channels || {};
  return [
    {
      label: "MACD方向",
      value: `${formatNumber(indicators?.dif, 2)} / ${formatNumber(indicators?.dea, 2)}`,
      detail: "DIF / DEA",
    },
    { label: "动能强弱", value: formatNumber(indicators?.macd, 2), detail: "MACD柱" },
    { label: "强弱指标", value: `${formatNumber(indicators?.rsi14, 1)} / ${formatNumber(indicators?.psy, 1)}`, detail: "RSI / PSY" },
    { label: "成交活跃", value: `${formatNumber(indicators?.volumeRatio, 2)}x`, detail: "量比" },
    { label: "止损参考", value: formatNumber(channel.stop_price, 2), detail: `距离现价 ${formatNumber(analysis.position_plan?.stop_distance, 2)}`, tone: "bad" },
    { label: "仓位参考", value: formatPercent(analysis.position_plan?.suggested_position_pct), detail: `${formatCompactNumber(analysis.position_plan?.suggested_shares)} 股`, tone: "good" },
    { label: "分层止盈", value: `${formatNumber(channel.target1, 2)} / ${formatNumber(channel.target2, 2)}`, detail: "第一 / 第二目标" },
    { label: "位置确认", value: `${formatNumber(indicators?.bollMid, 2)} / ${formatNumber(indicators?.kdjJ, 1)}`, detail: "BOLL中轨 / KDJ-J" },
  ];
}

function buildStrategyCriticalReasons(
  analysis: StrategyKlineAnalysis,
  technicalDecision: ReturnType<typeof buildTradeDecision>,
  steps: StrategyDecisionStep[],
  readableReasons: string[],
) {
  const reasons = [
    ...(analysis.data_quality?.blocking_reasons || []),
    ...readableReasons,
  ];

  if (analysis.sell_signal?.warning_level?.action) {
    reasons.push(`风控动作：${analysis.sell_signal.warning_level.action}`);
  }
  if (technicalDecision.sellScore > technicalDecision.buyScore) {
    reasons.push(`图表辅助偏防守：风险确认 ${technicalDecision.sellScore}/5，高于买入确认 ${technicalDecision.buyScore}/5。`);
  }
  if (reasons.length === 0) {
    reasons.push(analysis.decision.action || analysis.decision.label || "暂无关键阻断，继续跟踪价格与成交确认。");
  }
  return Array.from(new Set(reasons)).slice(0, 3);
}

function buildStrategyFactorRows(analysis: StrategyKlineAnalysis): StrategyFactorRow[] {
  const buyFactors = analysis.buy_signal?.factors || {};
  const sellComponents = analysis.sell_signal?.components || {};
  return [
    { label: "趋势", buy: buyFactors.trend, sell: sellComponents.trend },
    { label: "动能 / MACD", buy: buyFactors.momentum, sell: sellComponents.macd },
    { label: "超卖 / KDJ", buy: buyFactors.oversold, sell: sellComponents.kdj },
    { label: "量能 / 资金", buy: buyFactors.volume, sell: sellComponents.money },
    { label: "大盘", buy: buyFactors.market, sell: sellComponents.market },
  ];
}

function StrategyFactorWorkbench({
  analysis,
  backtest,
}: {
  analysis: StrategyKlineAnalysis;
  backtest?: StrategyKlineBacktest | null;
}) {
  const warnings = [
    ...(analysis.data_quality?.blocking_reasons || []),
    ...(analysis.data_quality?.warnings || []),
  ];

  return (
    <div className="strategy-factor-workbench">
      <StrategyFactorComparison analysis={analysis} />
      <StrategyTradePlanCard analysis={analysis} />
      <StrategyVerificationCard backtest={backtest} />
      {(warnings.length > 0 || analysis.disclaimer) && (
        <div className="strategy-disclosure-card">
          <strong>数据披露</strong>
          {warnings.slice(0, 4).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
          {analysis.disclaimer && <em>{analysis.disclaimer}</em>}
        </div>
      )}
    </div>
  );
}

function StrategyFactorComparison({ analysis }: { analysis: StrategyKlineAnalysis }) {
  const rows = buildStrategyFactorRows(analysis);
  const maxAbs = Math.max(
    0.01,
    ...rows.flatMap((row) => [Math.abs(row.buy || 0), Math.abs(row.sell || 0)]),
  );

  return (
    <div className="strategy-factor-comparison">
      <div className="section-subhead">
        <h2>因子力量对比</h2>
        <span className="muted">机会 vs 风险</span>
      </div>
      <div className="strategy-factor-head">
        <span>机会因子</span>
        <b>维度</b>
        <span>风险因子</span>
      </div>
      {rows.map((row) => {
        const buyWidth = Math.max(4, Math.abs(row.buy || 0) / maxAbs * 100);
        const sellWidth = Math.max(4, Math.abs(row.sell || 0) / maxAbs * 100);
        return (
          <div className="strategy-factor-row" key={row.label}>
            <div className="factor-bar buy">
              <i style={{ width: `${buyWidth}%` }} />
              <strong>{formatNumber(row.buy, 3)}</strong>
            </div>
            <span>{row.label}</span>
            <div className="factor-bar sell">
              <i style={{ width: `${sellWidth}%` }} />
              <strong>{formatNumber(row.sell, 3)}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StrategyTradePlanCard({ analysis }: { analysis: StrategyKlineAnalysis }) {
  const channels = analysis.price_channels || {};
  const rows = [
    ["建议股数", `${formatCompactNumber(analysis.position_plan?.suggested_shares)} 股`],
    ["建议名义金额", formatMoney(analysis.position_plan?.suggested_notional)],
    ["建议仓位 / 风险", `${formatPercent(analysis.position_plan?.suggested_position_pct)} / ${formatPercent(analysis.position_plan?.risk_pct)}`],
    ["止损价", channels.stop_price],
    ["止损距离", analysis.position_plan?.stop_distance],
    ["目标价1", channels.target1],
    ["目标价2", channels.target2],
    ["预测高1", channels.predict_high_1],
    ["预测低1", channels.predict_low_1],
    ["买回/硬止损线", channels.buy_back_price],
  ];
  return (
    <div className="strategy-trade-plan-card">
      <div className="section-subhead">
        <h2>交易计划</h2>
        <span className="muted">仓位 · 止损 · 目标</span>
      </div>
      {rows.map(([label, value]) => (
        <p key={String(label)}>
          <span>{label}</span>
          <strong>{typeof value === "string" ? value : formatNumber(value as number | undefined, 2)}</strong>
        </p>
      ))}
    </div>
  );
}

function StrategyVerificationCard({ backtest }: { backtest?: StrategyKlineBacktest | null }) {
  if (!backtest) {
    return (
      <div className="strategy-verification-card pending">
        <div className="section-subhead">
          <h2>验证状态</h2>
          <span className="muted">待验证</span>
        </div>
        <p>
          <span>验证状态</span>
          <strong>等待回测</strong>
        </p>
        <p>
          <span>审计口径</span>
          <strong>运行后展示收益、回撤、基准覆盖和交易闭环</strong>
        </p>
      </div>
    );
  }
  const metrics = backtest.result.metrics || {};
  const zeroTradeReason =
    backtest.result.zero_trade_reasons?.[0] ||
    backtest.result.data_quality?.no_trade_reasons?.[0] ||
    null;
  return (
    <div className="strategy-verification-card">
      <div className="section-subhead">
        <h2>验证状态</h2>
        <span className="muted">{backtest.backtest_id.slice(0, 8)}</span>
      </div>
      <p>
        <span>总收益 / 回撤</span>
        <strong>{formatPercent(metrics.total_return)} / {formatPercent(metrics.max_drawdown)}</strong>
      </p>
      <p>
        <span>胜率 / 交易</span>
        <strong>{formatPercent(metrics.win_rate)} / {metrics.trade_count || 0} 闭环</strong>
      </p>
      <p>
        <span>成交腿 / 信号</span>
        <strong>{metrics.order_count || 0} / {metrics.signal_count || 0}</strong>
      </p>
      <p>
        <span>相对基准</span>
        <strong>{metrics.benchmark_symbol || "-"} · {formatPercent(metrics.excess_return)}</strong>
      </p>
      <p>
        <span>覆盖/权益点</span>
        <strong>{formatPercent(metrics.benchmark_coverage)} / {backtest.result.equity_curve?.length || 0}</strong>
      </p>
      {zeroTradeReason && (
        <p>
          <span>0交易解释</span>
          <strong>{zeroTradeReason}</strong>
        </p>
      )}
    </div>
  );
}

function StrategyKlineTrace({ analysis }: { analysis: StrategyKlineAnalysis }) {
  const tone = strategyDecisionTone(analysis);
  const channel = analysis.price_channels || {};
  const steps = buildStrategyDecisionSteps(analysis);
  const copy = buildReadableStrategyDecisionCopy({
    date: analysis.latest_bar?.date,
    symbol: analysis.symbol,
    modeLabel: strategyModeLabel(analysis.mode),
    decisionLabel: analysis.decision.label,
    decisionAction: analysis.sell_signal?.warning_level?.action || analysis.trend_state?.action || analysis.decision.action,
    steps,
  });
  return (
    <div className={`strategy-kline-trace ${tone}`} aria-label="V2策略主信号解释">
      <div className="strategy-trace-decision">
        <span>V2主结论</span>
        <strong>{copy.title}</strong>
        <em>{copy.reasons[0] || "-"}</em>
      </div>
      <div className="strategy-trace-metrics">
        <StrategyTraceMetric
          label="个股趋势"
          value={steps[0]?.status || "-"}
          sub={steps[0]?.detail || "-"}
        />
        <StrategyTraceMetric
          label="市场环境"
          value={steps[1]?.status || "-"}
          sub={steps[1]?.detail || "-"}
        />
        <StrategyTraceMetric
          label="买入强度"
          value={formatNumber(analysis.buy_signal?.score, 3)}
          sub={steps[2]?.status || "-"}
        />
        <StrategyTraceMetric
          label="卖出风险"
          value={formatNumber(analysis.sell_signal?.score, 2)}
          sub={steps[3]?.status || "-"}
        />
        <StrategyTraceMetric
          label="仓位计划"
          value={`${formatCompactNumber(analysis.position_plan?.suggested_shares)}股`}
          sub={`${formatPercent(analysis.position_plan?.suggested_position_pct)} · 风险 ${formatPercent(analysis.position_plan?.risk_pct)}`}
        />
        <StrategyTraceMetric
          label="止损 / 目标"
          value={formatNumber(channel.stop_price, 2)}
          sub={`${formatNumber(channel.target1, 2)} / ${formatNumber(channel.target2, 2)}`}
        />
      </div>
    </div>
  );
}

function StrategyTraceMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="strategy-trace-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{sub}</em>
    </div>
  );
}

function StrategyExecutionChecklist({ analysis }: { analysis: StrategyKlineAnalysis }) {
  const checklist = buildStrategyDecisionSteps(analysis).map((step) => ({
    label: `${step.key} ${step.label}`,
    passed: step.tone === "good",
    detail: `${step.status} · ${step.detail}`,
  }));

  return (
    <div className="strategy-execution-kline">
      <div className="decision-checklist-head">
        <strong>V2执行清单（主策略）</strong>
        <span>{checklist.filter((item) => item.passed).length}/{checklist.length}</span>
      </div>
      <div className="strategy-checklist compact-strategy-checklist">
        {checklist.map((item) => (
          <p key={item.label} className={item.passed ? "passed" : "failed"}>
            <strong>{item.passed ? "通过" : "未过"}</strong>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </p>
        ))}
      </div>
    </div>
  );
}

function buildStrategyChartSignal(
  analysis?: StrategyKlineAnalysis | null,
  bars: MarketHistoryBar[] = [],
): ChartSignalMarker | null {
  if (!analysis) return null;
  const latestBar = [...bars].reverse().find((bar) => bar.date && typeof bar.close === "number");
  const date = analysis.latest_bar?.date || latestBar?.date;
  if (!date) return null;
  const direction = strategySignalDirection(analysis);
  const score = normalizedStrategyScore(
    direction === "risk" ? analysis.sell_signal?.score : analysis.buy_signal?.score,
  );
  const fallbackPrice = analysis.latest_bar?.close ?? latestBar?.close ?? null;
  const entryPrice = direction === "opportunity"
    ? analysis.price_channels?.buy_back_price ?? fallbackPrice
    : fallbackPrice;

  return {
    signal_id: `resonance-v2-${analysis.mode}-${analysis.symbol}-${date}`,
    date,
    signal_name: "V2 多指标共振",
    signal_level: analysis.sell_signal?.warning_level?.label || analysis.decision.label,
    direction,
    entry_date: date,
    entry_price: entryPrice,
    score,
  };
}

function mergeStrategySignals(
  signals: ChartSignalMarker[],
  strategySignal: ChartSignalMarker | null,
) {
  if (!strategySignal) return signals;
  const hasPersistedStrategySignal = signals.some((signal) => {
    const sameDate = signal.date === strategySignal.date || signal.original_date === strategySignal.date;
    return signal.signal_id === strategySignal.signal_id ||
      (sameDate && /v2|共振|resonance/i.test(signal.signal_name));
  });
  if (hasPersistedStrategySignal) return signals;
  return [...signals, strategySignal].sort((left, right) => left.date.localeCompare(right.date));
}

function buildStrategyTradeDecision(
  analysis: StrategyKlineAnalysis,
  technicalDecision: ReturnType<typeof buildTradeDecision>,
) {
  const tone = strategyDecisionTone(analysis);
  const action = analysis.sell_signal?.warning_level?.action || analysis.trend_state?.action || analysis.decision.action || "-";
  const position = `${formatCompactNumber(analysis.position_plan?.suggested_shares)}股 / ${formatPercent(analysis.position_plan?.suggested_position_pct)}`;
  const stop = formatNumber(analysis.price_channels?.stop_price, 2);
  const summary = `${analysis.latest_bar?.date || "-"} · 策略口径：周线趋势 + 日线执行。${action}。仓位 ${position}，止损 ${stop}；图表辅助确认：买入 ${technicalDecision.buyScore}/5，卖出 ${technicalDecision.sellScore}/5。`;
  return {
    ...technicalDecision,
    tone,
    label: analysis.decision.label,
    summary,
  };
}

function strategyModeLabel(mode: StrategyKlineAnalysis["mode"]) {
  return mode === "aggressive" ? "激进权重模式" : "保守确认模式";
}

function strategyDecisionTone(analysis: StrategyKlineAnalysis): DecisionTone {
  const direction = strategySignalDirection(analysis);
  if (direction === "risk") return "risk";
  if (direction === "opportunity") return "opportunity";
  return "neutral";
}

function strategySignalDirection(analysis: StrategyKlineAnalysis) {
  const tone = analysis.decision.tone || "";
  const text = [
    analysis.decision.action,
    analysis.decision.label,
    analysis.sell_signal?.warning_level?.action,
    analysis.sell_signal?.warning_level?.label,
  ].filter(Boolean).join(" ");
  if (
    analysis.sell_signal?.emergency ||
    analysis.sell_signal?.regular_exit ||
    (analysis.sell_signal?.warning_level?.level || 0) > 0 ||
    /danger|warn|risk/i.test(tone) ||
    /卖|减|禁|风险|预警|sell|exit|reduce/i.test(text)
  ) {
    return "risk";
  }
  if (
    analysis.buy_signal?.mode_signal ||
    /positive|opportunity/i.test(tone) ||
    /买|加|机会|buy|entry/i.test(text)
  ) {
    return "opportunity";
  }
  return "neutral";
}

function normalizedStrategyScore(value?: number | null) {
  if (!isFiniteNumber(value)) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function candleRangeLabel(
  item: { key: CandleRange; baseLabel?: string; label?: string },
  period: CandlePeriod,
) {
  if (item.key === "all") return item.label || "全部";
  const unit = CANDLE_PERIODS.find((periodItem) => periodItem.key === period)?.shortUnit || "日";
  return `${item.baseLabel || item.key}${unit}`;
}

function priceAdjustmentLabel(mode: PriceAdjustmentMode) {
  return PRICE_ADJUSTMENT_MODES.find((item) => item.key === mode)?.label || "不复权";
}

function priceAdjustmentStatusLabel(requestedMode: PriceAdjustmentMode, actualMode: PriceAdjustmentMode) {
  if (requestedMode === actualMode) return priceAdjustmentLabel(actualMode);
  if (requestedMode === "none") return priceAdjustmentLabel(actualMode);
  return `${priceAdjustmentLabel(requestedMode)}不可用`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rangeSizeFor(total: number, range: CandleRange) {
  if (range === "all") return total;
  return Math.min(Number(range), total);
}

function maxRightOffsetForRange(total: number, range: CandleRange) {
  return Math.max(0, total - rangeSizeFor(total, range));
}

function sliceVisibleBars<T>(bars: T[], range: CandleRange, rightOffset = 0) {
  const size = rangeSizeFor(bars.length, range);
  const offset = clampNumber(rightOffset, 0, maxRightOffsetForRange(bars.length, range));
  const end = Math.max(size, bars.length - offset);
  return bars.slice(Math.max(0, end - size), end);
}

function nextCandleRange(range: CandleRange, direction: "in" | "out") {
  const keys = CANDLE_RANGES.map((item) => item.key);
  const index = Math.max(0, keys.indexOf(range));
  const nextIndex = clampNumber(index + (direction === "in" ? -1 : 1), 0, keys.length - 1);
  return keys[nextIndex];
}

function shortDateLabel(value?: string) {
  if (!value) return "-";
  const date = value.includes("·") ? value.split("·")[0].trim() : value;
  const timeMatch = date.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})/);
  if (timeMatch) return timeMatch[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(5, 10);
  if (/^\d{4}-\d{2}$/.test(date)) return date.slice(2);
  return date.slice(0, 10);
}

function buildTimeTicks(points: { x: number; label?: string }[]) {
  if (points.length === 0) return [];
  const indexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]));
  return indexes.map((index) => ({
    x: points[index].x,
    label: shortDateLabel(points[index].label),
  }));
}

function buildMeasureRange(
  candles: {
    index: number;
    date?: string;
    periodLabel?: string;
    x: number;
    open?: number;
    high?: number;
    low?: number;
    close: number;
    closeY: number;
    volume?: number;
    amount?: number;
  }[],
  startIndex: number | null,
  endIndex: number | null,
) {
  if (startIndex == null || endIndex == null) return null;
  const start = candles.find((candle) => candle.index === startIndex);
  const end = candles.find((candle) => candle.index === endIndex);
  const stats = buildMeasuredRangeStats(candles.map((candle) => ({
    index: candle.index,
    date: candle.date,
    period_label: candle.periodLabel,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    amount: candle.amount,
  })), startIndex, endIndex);
  if (!start || !end || !stats) return null;
  const labelWidth = 266;
  const labelHeight = 108;
  const labelX = clampNumber((start.x + end.x) / 2 + 12, 56, 930 - labelWidth);
  const labelY = clampNumber(Math.min(start.closeY, end.closeY) - labelHeight - 12, 58, 344);
  return {
    ...stats,
    start,
    end,
    labelX,
    labelY,
    labelWidth,
    labelHeight,
    tone: (stats.changePct || 0) >= 0 ? "positive" : "negative",
  };
}

function parseChartDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodKeyForDate(date: string, period: CandlePeriod) {
  if (period === "daily" || period === "minute1") return date;
  if (isIntradayPeriod(period)) return intradayPeriodKeyForDate(date, period);
  if (period === "monthly") return date.slice(0, 7);
  const parsed = parseChartDate(date);
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - day + 1);
  return isoDate(parsed);
}

function intradayBucketSize(period: CandlePeriod) {
  if (period === "minute5") return 5;
  if (period === "minute15") return 15;
  if (period === "minute30") return 30;
  if (period === "hourly") return 60;
  return 1;
}

function intradayPeriodKeyForDate(date: string, period: CandlePeriod) {
  const match = date.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return date;
  const bucketSize = intradayBucketSize(period);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const totalMinutes = hour * 60 + minute;
  const bucketStart = Math.floor(totalMinutes / bucketSize) * bucketSize;
  const bucketHour = String(Math.floor(bucketStart / 60)).padStart(2, "0");
  const bucketMinute = String(bucketStart % 60).padStart(2, "0");
  return `${match[1]} ${bucketHour}:${bucketMinute}`;
}

function preparePeriodChartData(
  bars: MarketHistoryBar[],
  signals: ChartSignalMarker[],
  period: CandlePeriod,
  evidenceEvents: ChartEvidenceEvent[] = [],
) {
  const unit = CANDLE_PERIODS.find((item) => item.key === period)?.unit || "日线";
  const orderedBars = [...bars]
    .filter((bar) => bar.date && typeof bar.close === "number")
    .sort((left, right) => left.date.localeCompare(right.date));
  if (period === "daily" || period === "minute1") {
    return { bars: orderedBars as PeriodMarketBar[], signals, events: evidenceEvents, unit };
  }

  const buckets = new Map<string, PeriodMarketBar[]>();
  orderedBars.forEach((bar) => {
    const key = periodKeyForDate(bar.date, period);
    const bucket = buckets.get(key) || [];
    bucket.push(bar);
    buckets.set(key, bucket);
  });

  const dailyDateToPeriodDate = new Map<string, string>();
  const periodKeyToPeriodDate = new Map<string, string>();
  const periodBars = Array.from(buckets.entries()).map(([key, bucket]) => {
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const high = Math.max(...bucket.map((bar) => Number(bar.high ?? bar.close ?? 0)));
    const low = Math.min(...bucket.map((bar) => Number(bar.low ?? bar.close ?? 0)));
    const volume = bucket.reduce((sum, bar) => sum + Number(bar.volume || 0), 0);
    const amount = bucket.reduce((sum, bar) => sum + Number(bar.amount || 0), 0);
    const periodLabel = isIntradayPeriod(period)
      ? key
      : period === "monthly"
        ? `${key} · ${first.date}~${last.date}`
        : `${first.date}~${last.date}`;
    bucket.forEach((bar) => dailyDateToPeriodDate.set(bar.date, last.date));
    periodKeyToPeriodDate.set(key, last.date);
    return {
      ...last,
      date: last.date,
      open: first.open ?? first.close,
      high,
      low,
      close: last.close,
      volume,
      amount,
      source: last.source,
      period_start: first.date,
      period_end: last.date,
      period_label: periodLabel,
    };
  });

  const mapSignalDate = (date?: string | null) => {
    if (!date) return date;
    return dailyDateToPeriodDate.get(date) || periodKeyToPeriodDate.get(periodKeyForDate(date, period)) || date;
  };
  const periodSignals = signals.map((signal) => ({
    ...signal,
    original_date: signal.original_date || signal.date,
    original_entry_date: signal.original_entry_date || signal.entry_date,
    date: mapSignalDate(signal.date) || signal.date,
    entry_date: mapSignalDate(signal.entry_date) || signal.entry_date,
  }));
  const periodEvents = evidenceEvents.map((event) => ({
    ...event,
    original_date: event.original_date || event.date,
    date: mapSignalDate(event.date) || event.date,
  }));

  return { bars: periodBars, signals: periodSignals, events: periodEvents, unit };
}

function signalDateLabel(signal: ChartSignalMarker) {
  if (signal.original_date && signal.original_date !== signal.date) {
    return `${signal.original_date}→${signal.date}`;
  }
  return signal.date;
}

function signalShortDate(signal: ChartSignalMarker) {
  return (signal.original_date || signal.date).slice(5);
}

function evidenceEventDateLabel(event: ChartEvidenceEvent) {
  if (event.original_date && event.original_date !== event.date) {
    return `${event.original_date}→${event.date}`;
  }
  return event.date;
}

function buildCandleGeometry(
  bars: PeriodMarketBar[],
  signals: ChartSignalMarker[],
  range: CandleRange,
  rightOffset = 0,
) {
  const visible = sliceVisibleBars(bars, range, rightOffset).filter((bar) => typeof bar.close === "number");
  if (visible.length === 0) {
    return {
      candles: [],
      markers: [],
      ma20: "",
      ma60: "",
      priceTicks: [],
      timeTicks: [],
      visibleCount: 0,
      visibleChange: null as number | null,
    };
  }
  const highValues = visible.map((bar) => Number(bar.high ?? bar.close ?? 0));
  const lowValues = visible.map((bar) => Number(bar.low ?? bar.close ?? 0));
  const volumes = visible.map((bar) => Number(bar.volume || 0));
  const minPrice = Math.min(...lowValues);
  const maxPrice = Math.max(...highValues);
  const priceSpan = maxPrice - minPrice || 1;
  const maxVolume = Math.max(...volumes, 1);
  const candleWidth = Math.max(0.38, Math.min(2.8, 72 / visible.length));
  const dateIndex = new Map(visible.map((bar, index) => [bar.date, index]));
  const xOf = (index: number) => 2 + (index / Math.max(visible.length - 1, 1)) * 96;
  const yOf = (price?: number | null) => 180 - ((Number(price || minPrice) - minPrice) / priceSpan) * 150;
  const priceTicks = [
    { label: "H", value: maxPrice, y: yOf(maxPrice) },
    { label: "M", value: minPrice + priceSpan / 2, y: yOf(minPrice + priceSpan / 2) },
    { label: "L", value: minPrice, y: yOf(minPrice) },
  ];
  const firstClose = Number(visible[0]?.close || 0);
  const lastClose = Number(visible[visible.length - 1]?.close || 0);
  const visibleChange = firstClose > 0 ? lastClose / firstClose - 1 : null;

  const maValue = (index: number, windowSize: number) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = visible.slice(start, index + 1);
    if (slice.length < Math.min(windowSize, 5)) return null;
    return slice.reduce((sum, item) => sum + Number(item.close || 0), 0) / slice.length;
  };
  const candles = visible.map((bar, index) => {
    const open = Number(bar.open ?? bar.close ?? 0);
    const close = Number(bar.close ?? open);
    const high = Number(bar.high ?? Math.max(open, close));
    const low = Number(bar.low ?? Math.min(open, close));
    const openY = yOf(open);
    const closeY = yOf(close);
    const volumeHeight = (Number(bar.volume || 0) / maxVolume) * 42;
    return {
      date: bar.date,
      periodLabel: bar.period_label,
      x: xOf(index),
      index,
      width: candleWidth,
      highY: yOf(high),
      lowY: yOf(low),
      openY,
      bodyY: Math.min(openY, closeY),
      bodyHeight: Math.abs(openY - closeY),
      volumeY: 250 - volumeHeight,
      tone: close >= open ? "positive" : "negative",
      open,
      close,
      high,
      low,
      volume: Number(bar.volume || 0),
      closeY: yOf(close),
      ma20: maValue(index, 20),
      ma60: maValue(index, 60),
    };
  });

  const maPoints = (key: "ma20" | "ma60") =>
    candles
      .filter((candle) => typeof candle[key] === "number")
      .map((candle) => `${candle.x.toFixed(2)},${yOf(candle[key]).toFixed(2)}`)
      .join(" ");

  const markers = signals.flatMap((signal) => {
    const index = dateIndex.get(signal.date);
    if (index == null) return [];
    const bar = visible[index];
    const x = xOf(index);
    const y = yOf(Number(bar.high ?? bar.close ?? maxPrice)) - 7;
    const entryIndex = signal.entry_date ? dateIndex.get(signal.entry_date) : undefined;
    const entryBar = entryIndex == null ? null : visible[entryIndex];
    return [
      {
        id: signal.signal_id,
        x,
        y: Math.max(6, y),
        entryY: entryBar ? yOf(Number(entryBar.close ?? entryBar.open ?? minPrice)) : yOf(Number(bar.close ?? minPrice)),
        direction: signal.direction,
        title: `${signalDateLabel(signal)} ${signal.signal_name}${signal.signal_level ? ` ${signal.signal_level}` : ""}`,
      },
    ];
  });
  const timeTicks = buildTimeTicks(candles.map((candle) => ({
    x: candle.x,
    label: candle.periodLabel || candle.date,
  })));

  return {
    candles,
    markers,
    ma20: maPoints("ma20"),
    ma60: maPoints("ma60"),
    priceTicks,
    timeTicks,
    visibleCount: visible.length,
    visibleChange,
  };
}

function buildTradingSignalGeometry(
  bars: PeriodMarketBar[],
  signals: ChartSignalMarker[],
  range: CandleRange,
  rightOffset = 0,
  params: TradingChartParameters = DEFAULT_TRADING_CHART_PARAMS,
  levelPrices: number[] = [],
  splitSubCharts = DEFAULT_TRADING_CHART_PREFS.subCharts,
  evidenceEvents: ChartEvidenceEvent[] = [],
  fundFlowRows: FundFlowSnapshot[] = [],
  factorRows: FactorSnapshot[] = [],
  priceAxisMode: PriceAxisMode = "price",
) {
  const PLOT_LEFT = 48;
  const PLOT_RIGHT = 925;
  const AXIS_X = 938;
  const layout = buildIndicatorSectionLayout(splitSubCharts ? "split" : "compact");
  const PRICE_TOP = layout.price.top;
  const PRICE_BOTTOM = layout.price.bottom;
  const VOLUME_TOP = layout.volume.top;
  const VOLUME_BOTTOM = layout.volume.bottom;
  const MACD_TOP = layout.macd.top;
  const MACD_BOTTOM = layout.macd.bottom;
  const RSI_TOP = layout.oscillator.top;
  const RSI_BOTTOM = layout.oscillator.bottom;
  const ADVANCED_TOP = layout.advanced.top;
  const ADVANCED_BOTTOM = layout.advanced.bottom;
  const MOMENTUM_TOP = layout.momentum.top;
  const MOMENTUM_BOTTOM = layout.momentum.bottom;
  const VOLATILITY_TOP = layout.volatility.top;
  const VOLATILITY_BOTTOM = layout.volatility.bottom;
  const SIGNAL_LANE_Y = layout.signalLaneY;
  const sections = layout.sections;
  const usableBarCount = bars.filter((bar) => typeof bar.close === "number").length;
  const visible = sliceVisibleBars(bars, range, rightOffset).filter((bar) => typeof bar.close === "number");
  if (visible.length === 0) {
    return {
      candles: [],
      markers: [],
      eventMarkers: [],
      entryLinks: [],
      priceGaps: [],
      candlestickPatterns: [],
      tdsSequentialEvents: [],
      technicalIndicatorEvents: [],
      technicalDivergenceEvents: [],
      volumeSignalEvents: [],
      eventDensityBars: [],
      fundFlowOverlay: buildFundFlowOverlayGeometry([], [], { top: VOLUME_TOP, bottom: VOLUME_BOTTOM }),
      indicatorThresholdGuides: [],
      indicatorThresholdZones: [],
      overlayPriceLabels: [],
      indicatorValueLabels: [],
      rangeNavigator: null,
      bollBandArea: "",
      maTrendRibbons: [],
      ichimokuCloudSegments: [],
      eneUpper: "",
      eneMid: "",
      eneLower: "",
      ichimokuConversionLine: "",
      ichimokuBaseLine: "",
      ichimokuSpanALine: "",
      ichimokuSpanBLine: "",
      ichimokuLaggingLine: "",
      trendRegimeBands: [],
      fibonacciLevels: [],
      supportResistanceLevels: [],
      priceStructureTrendLines: [],
      limitPriceLines: buildLimitPriceLines([], () => null),
      ma5: "",
      ma20: "",
      ma60: "",
      ma120: "",
      closeLine: "",
      emaFastLine: "",
      emaSlowLine: "",
      vwapLine: "",
      sarLine: "",
      bbiLine: "",
      bollUpper: "",
      bollMid: "",
      bollLower: "",
      mikeWeakResistanceLine: "",
      mikeMediumResistanceLine: "",
      mikeStrongResistanceLine: "",
      mikeWeakSupportLine: "",
      mikeMediumSupportLine: "",
      mikeStrongSupportLine: "",
      volumeMa5Line: "",
      volumeMa10Line: "",
      volumeMa20Line: "",
      macdBars: [],
      difLine: "",
      deaLine: "",
      rsiLine: "",
      psyLine: "",
      psyMaLine: "",
      kdjKLine: "",
      kdjDLine: "",
      kdjJLine: "",
      crLine: "",
      arLine: "",
      brLine: "",
      emvLine: "",
      emvMaLine: "",
      pdiLine: "",
      mdiLine: "",
      adxLine: "",
      cciLine: "",
      wrLine: "",
      biasLine: "",
      dmaLine: "",
      amaLine: "",
      mfiLine: "",
      vrLine: "",
      rocLine: "",
      trixLine: "",
      trmaLine: "",
      oscLine: "",
      oscEmaLine: "",
      atrLine: "",
      obvLine: "",
      bollPercentBLine: "",
      bollBandwidthLine: "",
      relativeLine: "",
      relativeStrengthIndexLine: "",
      relativeStrengthIndustryLine: "",
      relativeZeroY: (PRICE_TOP + PRICE_BOTTOM) / 2,
      relativeLatest: null as number | null,
      relativeStrengthLatestIndex: null as number | null,
      relativeStrengthLatestIndustry: null as number | null,
      volumeProfile: buildVolumeProfile([], { currentPrice: null }),
      rangeExtrema: null,
      priceTicks: [],
      indicatorAxisTicks: {},
      timeTicks: [],
      latestIndicators: null,
      latestPriceLine: null,
      prevCloseY: null as number | null,
      macdZeroY: (MACD_TOP + MACD_BOTTOM) / 2,
      advanced100Y: ADVANCED_BOTTOM - 0.5 * (ADVANCED_BOTTOM - ADVANCED_TOP),
      emvZeroY: ADVANCED_BOTTOM - 0.5 * (ADVANCED_BOTTOM - ADVANCED_TOP),
      momentumZeroY: MOMENTUM_BOTTOM - 0.5 * (MOMENTUM_BOTTOM - MOMENTUM_TOP),
      moneyFlow100Y: ADVANCED_BOTTOM - 0.5 * (ADVANCED_BOTTOM - ADVANCED_TOP),
      volumeMomentumZeroY: MOMENTUM_BOTTOM - 0.5 * (MOMENTUM_BOTTOM - MOMENTUM_TOP),
      obvZeroY: VOLATILITY_BOTTOM - 0.5 * (VOLATILITY_BOTTOM - VOLATILITY_TOP),
      rsi70Y: RSI_BOTTOM - 0.7 * (RSI_BOTTOM - RSI_TOP),
      rsi30Y: RSI_BOTTOM - 0.3 * (RSI_BOTTOM - RSI_TOP),
      signalLaneY: SIGNAL_LANE_Y,
      viewBoxHeight: layout.viewBoxHeight,
      timeAxisY: layout.timeAxisY,
      plotLeft: PLOT_LEFT,
      plotRight: PLOT_RIGHT,
      axisX: AXIS_X,
      priceMin: null as number | null,
      priceMax: null as number | null,
      priceAxisMode: "price" as PriceAxisMode,
      priceAxisBase: null as number | null,
      priceAxisMin: null as number | null,
      priceAxisMax: null as number | null,
      priceTop: PRICE_TOP,
      priceBottom: PRICE_BOTTOM,
      sections,
      visibleCount: 0,
    };
  }

  const highValues = visible.map((bar) => Number(bar.high ?? bar.close ?? 0));
  const lowValues = visible.map((bar) => Number(bar.low ?? bar.close ?? 0));
  const closeValues = visible.map((bar) => Number(bar.close || 0));
  const volumes = visible.map((bar) => Number(bar.volume || 0));
  const fastPeriod = Math.min(params.maFast, params.maMid, params.maSlow);
  const midPeriod = [params.maFast, params.maMid, params.maSlow].sort((left, right) => left - right)[1];
  const slowPeriod = Math.max(params.maFast, params.maMid, params.maSlow);
  const emaFastPeriod = Math.min(params.emaFast, params.emaSlow - 1);
  const emaSlowPeriod = Math.max(params.emaSlow, emaFastPeriod + 1);
  const macdFast = Math.min(params.macdFast, params.macdSlow - 1);
  const macdSlow = Math.max(params.macdSlow, macdFast + 1);
  const bollValues = bollNumberValues(closeValues, params.bollPeriod, params.bollMultiplier);
  const eneValues = buildEnvelopeIndicators(visible, {
    percent: params.enePercent,
    period: params.enePeriod,
  });
  const mikeValues = buildMikeIndicators(visible, { period: params.mikePeriod });
  const emaFastValues = emaNumberValues(closeValues, emaFastPeriod);
  const emaSlowValues = emaNumberValues(closeValues, emaSlowPeriod);
  const macdFastValues = emaNumberValues(closeValues, macdFast);
  const macdSlowValues = emaNumberValues(closeValues, macdSlow);
  const vwapValues = vwapNumberValues(visible);
  const trendOverlayValues = buildTrendOverlayIndicators(visible, {
    biasPeriod: params.biasPeriod,
    dmaFast: params.dmaFast,
    dmaSlow: params.dmaSlow,
    dmaSignal: params.dmaSignal,
  });
  const ichimokuValues = buildIchimokuIndicators(visible);
  const volumeMomentumValues = buildVolumeMomentumIndicators(visible, {
    period: params.volumeMomentumPeriod,
    rocPeriod: params.rocPeriod,
    trixPeriod: params.trixPeriod,
    trixSignal: params.trixSignal,
  });
  const oscillatorValues = buildOscillatorIndicators(visible, {
    emaPeriod: params.oscEmaPeriod,
    period: params.oscPeriod,
  });
  const volatilityValues = buildVolatilityVolumeIndicators(visible, {
    atrPeriod: params.atrPeriod,
    bollMultiplier: params.bollMultiplier,
    bollPeriod: params.bollPeriod,
  });
  const sarValues = trendOverlayValues.map((value) => value.sar);
  const bbiValues = trendOverlayValues.map((value) => value.bbi);
  const ichimokuConversionValues = ichimokuValues.map((value) => value.conversion);
  const ichimokuBaseValues = ichimokuValues.map((value) => value.base);
  const ichimokuSpanAValues = ichimokuValues.map((value) => value.spanA);
  const ichimokuSpanBValues = ichimokuValues.map((value) => value.spanB);
  const ichimokuLaggingValues = ichimokuValues.map((value) => value.lagging);
  const biasValues = trendOverlayValues.map((value) => value.bias);
  const dmaValues = trendOverlayValues.map((value) => value.dma);
  const amaValues = trendOverlayValues.map((value) => value.ama);
  const vrValues = volumeMomentumValues.map((value) => value.vr);
  const mfiValues = volumeMomentumValues.map((value) => value.mfi);
  const rocValues = volumeMomentumValues.map((value) => value.roc);
  const trixValues = volumeMomentumValues.map((value) => value.trix);
  const trmaValues = volumeMomentumValues.map((value) => value.trma);
  const oscValues = oscillatorValues.map((value) => value.osc);
  const oscEmaValues = oscillatorValues.map((value) => value.oscEma);
  const atrValues = volatilityValues.map((value) => value.atr);
  const obvValues = volatilityValues.map((value) => value.obv);
  const bollPercentBValues = volatilityValues.map((value) => value.bollPercentB);
  const bollBandwidthValues = volatilityValues.map((value) => value.bollBandwidth);
  const bollDomainValues = bollValues.flatMap((value) =>
    value ? [value.upper, value.lower] : [],
  );
  const eneDomainValues = eneValues.flatMap((value) =>
    [value.upper, value.mid, value.lower].filter(isFiniteNumber),
  );
  const mikeDomainValues = mikeValues.flatMap((value) => [
    value.weakResistance,
    value.mediumResistance,
    value.strongResistance,
    value.weakSupport,
    value.mediumSupport,
    value.strongSupport,
  ].filter(isFiniteNumber));
  const levelDomainValues = levelPrices.filter(isFiniteNumber);
  const limitDomainValues = visible.flatMap((bar) => [bar.limit_up, bar.limit_down]).filter(isFiniteNumber);
  const rawPriceStructureTrendLines = buildPriceStructureTrendLines(visible, {
    swingWindow: 2,
    minSlopePct: 0.12,
    maxLinesPerType: 1,
    extendToLatest: true,
  });
  const trendLineDomainValues = rawPriceStructureTrendLines.flatMap((line) => [
    line.startPrice,
    line.endPrice,
    line.anchorStartPrice,
    line.anchorEndPrice,
  ]);
  const overlayDomainValues = [
    ...bollDomainValues,
    ...eneDomainValues,
    ...mikeDomainValues,
    ...emaFastValues,
    ...emaSlowValues,
    ...vwapValues.filter(isFiniteNumber),
    ...sarValues.filter(isFiniteNumber),
    ...bbiValues.filter(isFiniteNumber),
    ...ichimokuConversionValues.filter(isFiniteNumber),
    ...ichimokuBaseValues.filter(isFiniteNumber),
    ...ichimokuSpanAValues.filter(isFiniteNumber),
    ...ichimokuSpanBValues.filter(isFiniteNumber),
    ...ichimokuLaggingValues.filter(isFiniteNumber),
    ...levelDomainValues,
    ...limitDomainValues,
    ...trendLineDomainValues,
  ];
  const domainPriceValues = [...lowValues, ...highValues, ...overlayDomainValues];
  const minPrice = Math.min(...domainPriceValues);
  const maxPrice = Math.max(...domainPriceValues);
  const priceAxisScale = buildPriceAxisScale(domainPriceValues, {
    basePrice: closeValues[0],
    bottom: PRICE_BOTTOM,
    mode: priceAxisMode,
    top: PRICE_TOP,
  });
  const maxVolume = Math.max(...volumes, 1);
  const volumeY = (value?: number | null) =>
    VOLUME_BOTTOM - ((Number(value || 0) / maxVolume) * (VOLUME_BOTTOM - VOLUME_TOP));
  const candleWidth = Math.max(3.2, Math.min(9.5, 620 / visible.length));
  const dateIndex = new Map(visible.map((bar, index) => [bar.date, index]));
  const fundFlowByDate = new Map(fundFlowRows.map((row) => [row.date, row]));
  const fundFlowForBar = (bar: PeriodMarketBar): FundFlowSnapshot | null => {
    if (!bar.period_start || !bar.period_end || bar.period_start === bar.period_end) {
      return fundFlowByDate.get(bar.date) ?? null;
    }
    const periodRows = fundFlowRows.filter((row) => row.date >= bar.period_start! && row.date <= bar.period_end!);
    if (periodRows.length === 0) return fundFlowByDate.get(bar.date) ?? null;
    const sumKey = (key: "main_net_inflow" | "large_net_inflow" | "northbound_net_inflow") => {
      const values = periodRows.map((row) => row[key]).filter(isFiniteNumber);
      return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
    };
    return {
      date: bar.date,
      symbol: periodRows[periodRows.length - 1]?.symbol || "",
      main_net_inflow: sumKey("main_net_inflow"),
      large_net_inflow: sumKey("large_net_inflow"),
      northbound_net_inflow: sumKey("northbound_net_inflow"),
    };
  };
  const xOf = (index: number) => PLOT_LEFT + (index / Math.max(visible.length - 1, 1)) * (PLOT_RIGHT - PLOT_LEFT);
  const yOf = (price?: number | null) =>
    priceAxisYOf(priceAxisScale, price) ?? PRICE_BOTTOM;
  const limitPriceLines = buildLimitPriceLines(
    visible.map((bar, index) => ({
      x: xOf(index),
      limit_up: bar.limit_up,
      limit_down: bar.limit_down,
    })),
    yOf,
  );
  const visibleExtrema = buildVisiblePriceExtrema(visible);
  const rangeExtrema = visibleExtrema
    ? {
        ...visibleExtrema,
        highX: xOf(visibleExtrema.highIndex),
        highY: yOf(visibleExtrema.high),
        highLabelX: clampNumber(
          xOf(visibleExtrema.highIndex) + (visibleExtrema.highIndex > visible.length / 2 ? -12 : 12),
          PLOT_LEFT + 8,
          PLOT_RIGHT - 8,
        ),
        highAnchor: visibleExtrema.highIndex > visible.length / 2 ? ("end" as const) : ("start" as const),
        lowX: xOf(visibleExtrema.lowIndex),
        lowY: yOf(visibleExtrema.low),
        lowLabelX: clampNumber(
          xOf(visibleExtrema.lowIndex) + (visibleExtrema.lowIndex > visible.length / 2 ? -12 : 12),
          PLOT_LEFT + 8,
          PLOT_RIGHT - 8,
        ),
        lowAnchor: visibleExtrema.lowIndex > visible.length / 2 ? ("end" as const) : ("start" as const),
      }
    : null;
  const fibonacciLevels = buildFibonacciRetracementLevels(visibleExtrema).map((level, index) => {
    const y = yOf(level.price);
    return {
      ...level,
      y,
      labelX: PLOT_RIGHT - 76,
      labelY: clampNumber(y - 5, PRICE_TOP + 22 + index * 2, PRICE_BOTTOM - 8),
    };
  });
  const supportResistanceLevels = buildSupportResistanceLevels(visible, {
    currentPrice: closeValues[closeValues.length - 1],
    maxPerSide: 3,
    minDistancePct: 1.4,
    swingWindow: 2,
  }).map((level, index) => {
    const y = yOf(level.price);
    return {
      ...level,
      y,
      labelX: level.type === "support" ? PLOT_LEFT + 8 : PLOT_RIGHT - 128,
      labelY: clampNumber(y - 6, PRICE_TOP + 22 + index * 2, PRICE_BOTTOM - 8),
    };
  });
  const priceStructureTrendLines = rawPriceStructureTrendLines.map((line, index) => {
    const x1 = clampNumber(xOf(line.startIndex), PLOT_LEFT, PLOT_RIGHT);
    const x2 = clampNumber(xOf(line.endIndex), PLOT_LEFT, PLOT_RIGHT);
    const y1 = clampNumber(yOf(line.startPrice), PRICE_TOP, PRICE_BOTTOM);
    const y2 = clampNumber(yOf(line.endPrice), PRICE_TOP, PRICE_BOTTOM);
    const anchorStartX = clampNumber(xOf(line.anchorStartIndex), PLOT_LEFT, PLOT_RIGHT);
    const anchorEndX = clampNumber(xOf(line.anchorEndIndex), PLOT_LEFT, PLOT_RIGHT);
    const anchorStartY = clampNumber(yOf(line.anchorStartPrice), PRICE_TOP, PRICE_BOTTOM);
    const anchorEndY = clampNumber(yOf(line.anchorEndPrice), PRICE_TOP, PRICE_BOTTOM);
    const labelOnRight = x2 > PLOT_RIGHT - 130;
    const labelX = clampNumber(x2 + (labelOnRight ? -94 : 10), PLOT_LEFT + 8, PLOT_RIGHT - 90);
    const labelBaseY = line.tone === "risk" ? Math.min(y2 - 7, y1 - 7) : Math.max(y2 + 14, y1 + 14);
    return {
      ...line,
      x1,
      x2,
      y1,
      y2,
      anchorStartX,
      anchorStartY,
      anchorEndX,
      anchorEndY,
      labelX,
      labelY: clampNumber(labelBaseY + index * 10, PRICE_TOP + 16, PRICE_BOTTOM - 6),
    };
  });
  const priceGaps = buildPriceGapAnnotations(visible, { minGapPct: 0.5 }).map((gap) => {
    const startX = clampNumber(xOf(gap.endIndex) - candleWidth / 2, PLOT_LEFT, PLOT_RIGHT);
    const endX = PLOT_RIGHT;
    const lowY = yOf(gap.lowPrice);
    const highY = yOf(gap.highPrice);
    const topY = Math.min(lowY, highY);
    const bottomY = Math.max(lowY, highY);
    return {
      ...gap,
      x: startX,
      width: Math.max(10, endX - startX),
      y: topY,
      height: Math.max(2, bottomY - topY),
      labelX: clampNumber(startX + 8, PLOT_LEFT + 8, PLOT_RIGHT - 96),
      labelY: clampNumber(topY - 5, PRICE_TOP + 28, PRICE_BOTTOM - 8),
    };
  });
  const patternRanks = new Map<number, number>();
  const candlestickPatterns = buildCandlestickPatternAnnotations(visible).map((pattern) => {
    const rank = patternRanks.get(pattern.index) || 0;
    patternRanks.set(pattern.index, rank + 1);
    const x = xOf(pattern.index);
    const priceY = yOf(pattern.price);
    const isRisk = pattern.tone === "risk";
    const markerY = isRisk
      ? Math.max(PRICE_TOP + 18, priceY - 18 - rank * 14)
      : Math.min(PRICE_BOTTOM - 16, priceY + 18 + rank * 14);
    return {
      ...pattern,
      x,
      priceY,
      markerY,
      labelX: clampNumber(x + (x > PLOT_RIGHT - 92 ? -58 : 10), PLOT_LEFT + 8, PLOT_RIGHT - 78),
      labelY: clampNumber(markerY - 7, PRICE_TOP + 14, PRICE_BOTTOM - 6),
    };
  });
  const tdsRanks = new Map<number, number>();
  const tdsSequentialEvents = buildTdsSequentialAnnotations(visible).map((event) => {
    const rank = tdsRanks.get(event.index) || 0;
    tdsRanks.set(event.index, rank + 1);
    const x = xOf(event.index);
    const priceY = yOf(event.price);
    const markerY = event.direction === "sell"
      ? Math.max(PRICE_TOP + 15, priceY - 15 - rank * 14)
      : Math.min(PRICE_BOTTOM - 12, priceY + 15 + rank * 14);
    return {
      ...event,
      x,
      priceY,
      markerY,
    };
  });
  const priceTickValues = [
    priceAxisScale.max,
    priceAxisScale.min + (priceAxisScale.max - priceAxisScale.min) / 2,
    priceAxisScale.min,
  ];
  const priceTicks = [
    { label: "high", value: priceTickValues[0], price: priceAxisPriceFromValue(priceAxisScale, priceTickValues[0]), y: PRICE_TOP },
    { label: "mid", value: priceTickValues[1], price: priceAxisPriceFromValue(priceAxisScale, priceTickValues[1]), y: (PRICE_TOP + PRICE_BOTTOM) / 2 },
    { label: "low", value: priceTickValues[2], price: priceAxisPriceFromValue(priceAxisScale, priceTickValues[2]), y: PRICE_BOTTOM },
  ];
  const rangeNavigator = buildKlineRangeNavigator({
    total: usableBarCount,
    visibleCount: visible.length,
    rightOffset,
    plotLeft: PLOT_LEFT,
    plotRight: PLOT_RIGHT,
  });
  const maValue = (index: number, windowSize: number) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = visible.slice(start, index + 1);
    if (slice.length < Math.min(windowSize, 5)) return null;
    return slice.reduce((sum, item) => sum + Number(item.close || 0), 0) / slice.length;
  };
  const difValues = closeValues.map((_, index) => macdFastValues[index] - macdSlowValues[index]);
  const deaValues = emaNumberValues(difValues, params.macdSignal);
  const macdValues = difValues.map((value, index) => (value - deaValues[index]) * 2);
  const rsiValues = rsiNumberValues(closeValues, params.rsiPeriod);
  const psychologicalValues = buildPsychologicalLineIndicators(visible, {
    maPeriod: params.psyMaPeriod,
    period: params.psyPeriod,
  });
  const psyValues = psychologicalValues.map((value) => value.psy);
  const psyMaValues = psychologicalValues.map((value) => value.psyMa);
  const kdjValues = kdjNumberValues(highValues, lowValues, closeValues, params.kdjPeriod);
  const advancedValues = buildAdvancedIndicators(visible, {
    period: params.crPeriod,
    emvPeriod: params.emvPeriod,
  });
  const momentumValues = buildMomentumIndicators(visible, {
    period: params.momentumPeriod,
  });
  const volumeMa5Values = buildVolumeMovingAverageValues(volumes, 5);
  const volumeMa10Values = buildVolumeMovingAverageValues(volumes, 10);
  const volumeMa20Values = buildVolumeMovingAverageValues(volumes, 20);
  const maxMacdAbs = Math.max(
    0.01,
    ...difValues.map(Math.abs),
    ...deaValues.map(Math.abs),
    ...macdValues.map(Math.abs),
  );
  const macdZeroY = (MACD_TOP + MACD_BOTTOM) / 2;
  const macdY = (value: number) =>
    macdZeroY - (value / maxMacdAbs) * ((MACD_BOTTOM - MACD_TOP) / 2 - 3);
  const rsiY = (value?: number | null) =>
    RSI_BOTTOM - ((Number(value ?? 50) / 100) * (RSI_BOTTOM - RSI_TOP));
  const crValues = advancedValues.map((value) => value.cr);
  const arValues = advancedValues.map((value) => value.ar);
  const brValues = advancedValues.map((value) => value.br);
  const emvValues = advancedValues.map((value) => value.emv);
  const emvMaValues = advancedValues.map((value) => value.emvMa);
  const advancedFiniteValues = [0, 100, 200, ...crValues, ...arValues, ...brValues].filter(isFiniteNumber);
  const advancedMin = Math.min(...advancedFiniteValues);
  const advancedMax = Math.max(...advancedFiniteValues);
  const advancedSpan = advancedMax - advancedMin || 1;
  const advancedY = (value?: number | null) =>
    ADVANCED_BOTTOM - ((Number(value ?? advancedMin) - advancedMin) / advancedSpan) * (ADVANCED_BOTTOM - ADVANCED_TOP);
  const emvFiniteValues = emvValues.filter(isFiniteNumber);
  const maxEmvAbs = Math.max(0.000001, ...emvFiniteValues.map((value) => Math.abs(value)));
  const emvZeroY = (ADVANCED_TOP + ADVANCED_BOTTOM) / 2;
  const emvY = (value?: number | null) =>
    emvZeroY - (Number(value ?? 0) / maxEmvAbs) * ((ADVANCED_BOTTOM - ADVANCED_TOP) / 2 - 3);
  const pdiValues = momentumValues.map((value) => value.pdi);
  const mdiValues = momentumValues.map((value) => value.mdi);
  const adxValues = momentumValues.map((value) => value.adx);
  const cciValues = momentumValues.map((value) => value.cci);
  const wrValues = momentumValues.map((value) => value.wr);
  const momentumFiniteValues = [-200, 0, 200, ...cciValues, ...wrValues].filter(isFiniteNumber);
  const momentumMin = Math.min(...momentumFiniteValues);
  const momentumMax = Math.max(...momentumFiniteValues);
  const momentumSpan = momentumMax - momentumMin || 1;
  const dmiY = (value?: number | null) =>
    MOMENTUM_BOTTOM - ((Number(value ?? 50) / 100) * (MOMENTUM_BOTTOM - MOMENTUM_TOP));
  const momentumY = (value?: number | null) =>
    MOMENTUM_BOTTOM - ((Number(value ?? 0) - momentumMin) / momentumSpan) * (MOMENTUM_BOTTOM - MOMENTUM_TOP);
  const biasFiniteValues = [-20, 0, 20, ...biasValues].filter(isFiniteNumber);
  const biasMin = Math.min(...biasFiniteValues);
  const biasMax = Math.max(...biasFiniteValues);
  const biasSpan = biasMax - biasMin || 1;
  const biasY = (value?: number | null) =>
    MOMENTUM_BOTTOM - ((Number(value ?? 0) - biasMin) / biasSpan) * (MOMENTUM_BOTTOM - MOMENTUM_TOP);
  const maxDmaAbs = Math.max(0.000001, ...[...dmaValues, ...amaValues].filter(isFiniteNumber).map((value) => Math.abs(value)));
  const dmaZeroY = (MOMENTUM_TOP + MOMENTUM_BOTTOM) / 2;
  const dmaY = (value?: number | null) =>
    dmaZeroY - (Number(value ?? 0) / maxDmaAbs) * ((MOMENTUM_BOTTOM - MOMENTUM_TOP) / 2 - 3);
  const moneyFlowFiniteValues = [0, 50, 100, 200, ...vrValues, ...mfiValues].filter(isFiniteNumber);
  const moneyFlowMin = Math.min(...moneyFlowFiniteValues);
  const moneyFlowMax = Math.max(...moneyFlowFiniteValues);
  const moneyFlowSpan = moneyFlowMax - moneyFlowMin || 1;
  const moneyFlowY = (value?: number | null) =>
    ADVANCED_BOTTOM - ((Number(value ?? 50) - moneyFlowMin) / moneyFlowSpan) * (ADVANCED_BOTTOM - ADVANCED_TOP);
  const maxRocAbs = Math.max(0.000001, ...[...rocValues, ...trixValues, ...trmaValues, ...oscValues, ...oscEmaValues].filter(isFiniteNumber).map((value) => Math.abs(value)));
  const volumeMomentumZeroY = (MOMENTUM_TOP + MOMENTUM_BOTTOM) / 2;
  const rocY = (value?: number | null) =>
    volumeMomentumZeroY - (Number(value ?? 0) / maxRocAbs) * ((MOMENTUM_BOTTOM - MOMENTUM_TOP) / 2 - 3);
  const atrFiniteValues = [0, ...atrValues].filter(isFiniteNumber);
  const atrMin = Math.min(...atrFiniteValues);
  const atrMax = Math.max(...atrFiniteValues);
  const atrSpan = atrMax - atrMin || 1;
  const atrY = (value?: number | null) =>
    VOLATILITY_BOTTOM - ((Number(value ?? atrMin) - atrMin) / atrSpan) * (VOLATILITY_BOTTOM - VOLATILITY_TOP);
  const obvFiniteValues = [0, ...obvValues].filter(isFiniteNumber);
  const obvMin = Math.min(...obvFiniteValues);
  const obvMax = Math.max(...obvFiniteValues);
  const obvSpan = obvMax - obvMin || 1;
  const obvY = (value?: number | null) =>
    VOLATILITY_BOTTOM - ((Number(value ?? 0) - obvMin) / obvSpan) * (VOLATILITY_BOTTOM - VOLATILITY_TOP);
  const bollVolatilityY = (value?: number | null) => {
    const next = clampNumber(Number(value ?? 50), -20, 120);
    return VOLATILITY_BOTTOM - (((next + 20) / 140) * (VOLATILITY_BOTTOM - VOLATILITY_TOP));
  };
  const relativeValues = closeValues.map((close) => (closeValues[0] ? close / closeValues[0] - 1 : 0));
  const relativeStrengthOverlay = buildRelativeStrengthOverlaySeries(visible, factorRows);
  const relativeStrengthIndexValues: Array<number | null> = Array.from({ length: visible.length }, () => null);
  const relativeStrengthIndustryValues: Array<number | null> = Array.from({ length: visible.length }, () => null);
  relativeStrengthOverlay.points.forEach((point) => {
    if (point.index < 0 || point.index >= visible.length) return;
    relativeStrengthIndexValues[point.index] = point.indexValue;
    relativeStrengthIndustryValues[point.index] = point.industryValue;
  });
  const relativeStrengthValues = [
    ...relativeStrengthIndexValues,
    ...relativeStrengthIndustryValues,
  ].filter(isFiniteNumber);
  const maxRelativeAbs = Math.max(0.01, ...relativeValues.map(Math.abs), ...relativeStrengthValues.map(Math.abs));
  const relativeY = (value: number) =>
    PRICE_BOTTOM - (((value + maxRelativeAbs) / (maxRelativeAbs * 2)) * (PRICE_BOTTOM - PRICE_TOP));
  const volumeProfile = buildVolumeProfile(visible, {
    binCount: 24,
    currentPrice: closeValues[closeValues.length - 1],
  });
  const indicatorAxisTicks = {
    volume: buildIndicatorAxisTicks({
      bottom: VOLUME_BOTTOM,
      compact: true,
      max: maxVolume,
      min: 0,
      top: VOLUME_TOP,
    }),
    macd: buildIndicatorAxisTicks({
      bottom: MACD_BOTTOM,
      max: maxMacdAbs,
      min: -maxMacdAbs,
      precision: 2,
      top: MACD_TOP,
      values: [maxMacdAbs, 0, -maxMacdAbs],
    }),
    oscillator: buildIndicatorAxisTicks({
      bottom: RSI_BOTTOM,
      max: 100,
      min: 0,
      precision: 0,
      top: RSI_TOP,
      values: [80, 50, 20],
    }),
    advanced: buildIndicatorAxisTicks({
      bottom: ADVANCED_BOTTOM,
      max: advancedMax,
      min: advancedMin,
      precision: 0,
      top: ADVANCED_TOP,
    }),
    momentum: buildIndicatorAxisTicks({
      bottom: MOMENTUM_BOTTOM,
      max: momentumMax,
      min: momentumMin,
      precision: 0,
      top: MOMENTUM_TOP,
    }),
    volatility: buildIndicatorAxisTicks({
      bottom: VOLATILITY_BOTTOM,
      max: atrMax,
      min: atrMin,
      precision: 2,
      top: VOLATILITY_TOP,
    }),
  };
  const indicatorThresholdGuides = buildIndicatorThresholdGuides([
    {
      key: "rsi-70",
      section: "oscillator",
      label: "RSI 70",
      value: 70,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "risk",
    },
    {
      key: "rsi-30",
      section: "oscillator",
      label: "RSI 30",
      value: 30,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "good",
    },
    {
      key: "psy-75",
      section: "oscillator",
      label: "PSY 75",
      value: 75,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "risk",
    },
    {
      key: "psy-25",
      section: "oscillator",
      label: "PSY 25",
      value: 25,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "good",
    },
    {
      key: "kdj-80",
      section: "oscillator",
      label: "KDJ 80",
      value: 80,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "risk",
    },
    {
      key: "kdj-20",
      section: "oscillator",
      label: "KDJ 20",
      value: 20,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "good",
    },
    {
      key: "mfi-80",
      section: "advanced",
      label: "MFI 80",
      value: 80,
      min: moneyFlowMin,
      max: moneyFlowMax,
      top: ADVANCED_TOP,
      bottom: ADVANCED_BOTTOM,
      tone: "risk",
    },
    {
      key: "mfi-20",
      section: "advanced",
      label: "MFI 20",
      value: 20,
      min: moneyFlowMin,
      max: moneyFlowMax,
      top: ADVANCED_TOP,
      bottom: ADVANCED_BOTTOM,
      tone: "good",
    },
    {
      key: "cci-100",
      section: "momentum",
      label: "CCI +100",
      value: 100,
      min: momentumMin,
      max: momentumMax,
      top: MOMENTUM_TOP,
      bottom: MOMENTUM_BOTTOM,
      tone: "risk",
    },
    {
      key: "cci--100",
      section: "momentum",
      label: "CCI -100",
      value: -100,
      min: momentumMin,
      max: momentumMax,
      top: MOMENTUM_TOP,
      bottom: MOMENTUM_BOTTOM,
      tone: "good",
    },
    {
      key: "wr--20",
      section: "momentum",
      label: "WR -20",
      value: -20,
      min: momentumMin,
      max: momentumMax,
      top: MOMENTUM_TOP,
      bottom: MOMENTUM_BOTTOM,
      tone: "risk",
    },
    {
      key: "wr--80",
      section: "momentum",
      label: "WR -80",
      value: -80,
      min: momentumMin,
      max: momentumMax,
      top: MOMENTUM_TOP,
      bottom: MOMENTUM_BOTTOM,
      tone: "good",
    },
    {
      key: "adx-25",
      section: "momentum",
      label: "ADX 25",
      value: 25,
      min: 0,
      max: 60,
      top: MOMENTUM_TOP,
      bottom: MOMENTUM_BOTTOM,
      tone: "neutral",
    },
  ]);
  const indicatorThresholdZones = buildIndicatorThresholdZones([
    {
      key: "rsi-overbought-zone",
      section: "oscillator",
      label: "RSI超买区",
      fromValue: 70,
      toValue: 100,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "risk",
    },
    {
      key: "rsi-oversold-zone",
      section: "oscillator",
      label: "RSI超卖区",
      fromValue: 0,
      toValue: 30,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "good",
    },
    {
      key: "kdj-overbought-zone",
      section: "oscillator",
      label: "KDJ超买区",
      fromValue: 80,
      toValue: 100,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "risk",
    },
    {
      key: "kdj-oversold-zone",
      section: "oscillator",
      label: "KDJ超卖区",
      fromValue: 0,
      toValue: 20,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "good",
    },
    {
      key: "psy-overheated-zone",
      section: "oscillator",
      label: "PSY偏热区",
      fromValue: 75,
      toValue: 100,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "risk",
    },
    {
      key: "psy-cooling-zone",
      section: "oscillator",
      label: "PSY偏冷区",
      fromValue: 0,
      toValue: 25,
      min: 0,
      max: 100,
      top: RSI_TOP,
      bottom: RSI_BOTTOM,
      tone: "good",
    },
    {
      key: "mfi-overbought-zone",
      section: "advanced",
      label: "MFI超买区",
      fromValue: 80,
      toValue: moneyFlowMax,
      min: moneyFlowMin,
      max: moneyFlowMax,
      top: ADVANCED_TOP,
      bottom: ADVANCED_BOTTOM,
      tone: "risk",
    },
    {
      key: "mfi-oversold-zone",
      section: "advanced",
      label: "MFI超卖区",
      fromValue: moneyFlowMin,
      toValue: 20,
      min: moneyFlowMin,
      max: moneyFlowMax,
      top: ADVANCED_TOP,
      bottom: ADVANCED_BOTTOM,
      tone: "good",
    },
    {
      key: "cci-overbought-zone",
      section: "momentum",
      label: "CCI强势区",
      fromValue: 100,
      toValue: momentumMax,
      min: momentumMin,
      max: momentumMax,
      top: MOMENTUM_TOP,
      bottom: MOMENTUM_BOTTOM,
      tone: "risk",
    },
    {
      key: "cci-oversold-zone",
      section: "momentum",
      label: "CCI弱势区",
      fromValue: momentumMin,
      toValue: -100,
      min: momentumMin,
      max: momentumMax,
      top: MOMENTUM_TOP,
      bottom: MOMENTUM_BOTTOM,
      tone: "good",
    },
    {
      key: "wr-overbought-zone",
      section: "momentum",
      label: "WR超买区",
      fromValue: -20,
      toValue: momentumMax,
      min: momentumMin,
      max: momentumMax,
      top: MOMENTUM_TOP,
      bottom: MOMENTUM_BOTTOM,
      tone: "risk",
    },
    {
      key: "wr-oversold-zone",
      section: "momentum",
      label: "WR超卖区",
      fromValue: momentumMin,
      toValue: -80,
      min: momentumMin,
      max: momentumMax,
      top: MOMENTUM_TOP,
      bottom: MOMENTUM_BOTTOM,
      tone: "good",
    },
  ]);

  const heikinAshiBars = buildHeikinAshiBars(visible);
  const candles = visible.map((bar, index) => {
    const open = Number(bar.open ?? bar.close ?? 0);
    const close = Number(bar.close ?? open);
    const high = Number(bar.high ?? Math.max(open, close));
    const low = Number(bar.low ?? Math.min(open, close));
    const heikinBar = heikinAshiBars[index];
    const heikinOpen = Number(heikinBar?.open ?? open);
    const heikinClose = Number(heikinBar?.close ?? close);
    const heikinHigh = Number(heikinBar?.high ?? high);
    const heikinLow = Number(heikinBar?.low ?? low);
    const prevClose = index > 0 ? closeValues[index - 1] : null;
    const change = typeof prevClose === "number" ? close - prevClose : null;
    const changePct = prevClose ? close / prevClose - 1 : null;
    const amplitudePct = prevClose ? (high - low) / prevClose : null;
    const openY = yOf(open);
    const closeY = yOf(close);
    const heikinOpenY = yOf(heikinOpen);
    const heikinCloseY = yOf(heikinClose);
    const volumeHeight = Math.max(1, (Number(bar.volume || 0) / maxVolume) * (VOLUME_BOTTOM - VOLUME_TOP));
    const limitState = resolveLimitCandleState(bar);
    const hoverMetrics = buildKlineHoverMetrics(bar);
    const limitLabel = limitState === "limit-up"
      ? "涨停"
      : limitState === "limit-down"
        ? "跌停"
        : limitState === "suspended"
          ? "停牌"
          : null;
    const ma5 = maValue(index, fastPeriod);
    const ma20 = maValue(index, midPeriod);
    const ma60 = maValue(index, slowPeriod);
    const ma120 = maValue(index, 120);
    const averageVolume20 = averageNumberValues(volumes.slice(Math.max(0, index - 19), index + 1));
    const volumeRatio = averageVolume20 ? Number(bar.volume || 0) / averageVolume20 : null;
    const advanced = advancedValues[index];
    const momentum = momentumValues[index];
    const trendOverlay = trendOverlayValues[index];
    const volumeMomentum = volumeMomentumValues[index];
    return {
      date: bar.date,
      periodLabel: bar.period_label,
      x: xOf(index),
      index,
      width: candleWidth,
      highY: yOf(high),
      lowY: yOf(low),
      openY,
      bodyY: Math.min(openY, closeY),
      bodyHeight: Math.abs(openY - closeY),
      closeY: yOf(close),
      heikinOpen,
      heikinHigh,
      heikinLow,
      heikinClose,
      heikinHighY: yOf(heikinHigh),
      heikinLowY: yOf(heikinLow),
      heikinOpenY,
      heikinCloseY,
      heikinBodyY: Math.min(heikinOpenY, heikinCloseY),
      heikinBodyHeight: Math.abs(heikinOpenY - heikinCloseY),
      heikinTone: heikinClose >= heikinOpen ? "positive" : "negative",
      volumeY: VOLUME_BOTTOM - volumeHeight,
      volumeHeight,
      tone: close >= open ? "positive" : "negative",
      limitState,
      limitLabel,
      hoverMetrics,
      limitUp: bar.limit_up ?? null,
      limitDown: bar.limit_down ?? null,
      limitLabelY: limitState === "limit-down"
        ? clampNumber(yOf(low) + 16, PRICE_TOP + 14, PRICE_BOTTOM - 8)
        : clampNumber(yOf(high) - 10, PRICE_TOP + 14, PRICE_BOTTOM - 8),
      high,
      low,
      close,
      open,
      prevClose,
      volume: Number(bar.volume || 0),
      amount: Number(bar.amount || 0),
      fundFlow: fundFlowForBar(bar),
      ma5,
      ma20,
      ma60,
      ma120,
      indicators: {
        open,
        high,
        low,
        close,
        prevClose,
        change,
        changePct,
        amplitudePct,
        volume: Number(bar.volume || 0),
        amount: Number(bar.amount || 0),
        ma5,
        ma20,
        ma60,
        ma120,
        volumeMa5: volumeMa5Values[index],
        volumeMa10: volumeMa10Values[index],
        volumeMa20: volumeMa20Values[index],
        emaFast: emaFastValues[index],
        emaSlow: emaSlowValues[index],
        vwap: vwapValues[index],
        dif: difValues[index],
        dea: deaValues[index],
        macd: macdValues[index],
        rsi14: rsiValues[index],
        psy: psyValues[index],
        psyMa: psyMaValues[index],
        kdjK: kdjValues[index]?.k ?? null,
        kdjD: kdjValues[index]?.d ?? null,
        kdjJ: kdjValues[index]?.j ?? null,
        bollUpper: bollValues[index]?.upper ?? null,
        bollMid: bollValues[index]?.mid ?? null,
        bollLower: bollValues[index]?.lower ?? null,
        mikeWeakResistance: mikeValues[index]?.weakResistance ?? null,
        mikeMediumResistance: mikeValues[index]?.mediumResistance ?? null,
        mikeStrongResistance: mikeValues[index]?.strongResistance ?? null,
        mikeWeakSupport: mikeValues[index]?.weakSupport ?? null,
        mikeMediumSupport: mikeValues[index]?.mediumSupport ?? null,
        mikeStrongSupport: mikeValues[index]?.strongSupport ?? null,
        eneUpper: eneValues[index]?.upper ?? null,
        eneMid: eneValues[index]?.mid ?? null,
        eneLower: eneValues[index]?.lower ?? null,
        sar: trendOverlay?.sar ?? null,
        bbi: trendOverlay?.bbi ?? null,
        ichimokuConversion: ichimokuValues[index]?.conversion ?? null,
        ichimokuBase: ichimokuValues[index]?.base ?? null,
        ichimokuSpanA: ichimokuValues[index]?.spanA ?? null,
        ichimokuSpanB: ichimokuValues[index]?.spanB ?? null,
        ichimokuLagging: ichimokuValues[index]?.lagging ?? null,
        bias: trendOverlay?.bias ?? null,
        dma: trendOverlay?.dma ?? null,
        ama: trendOverlay?.ama ?? null,
        vr: volumeMomentum?.vr ?? null,
        mfi: volumeMomentum?.mfi ?? null,
        roc: volumeMomentum?.roc ?? null,
        trix: volumeMomentum?.trix ?? null,
        trma: volumeMomentum?.trma ?? null,
        osc: oscillatorValues[index]?.osc ?? null,
        oscEma: oscillatorValues[index]?.oscEma ?? null,
        cr: advanced?.cr ?? null,
        ar: advanced?.ar ?? null,
        br: advanced?.br ?? null,
        emv: advanced?.emv ?? null,
        emvMa: advanced?.emvMa ?? null,
        pdi: momentum?.pdi ?? null,
        mdi: momentum?.mdi ?? null,
        adx: momentum?.adx ?? null,
        cci: momentum?.cci ?? null,
        wr: momentum?.wr ?? null,
        volumeRatio,
        atr: atrValues[index],
        obv: obvValues[index],
        bollPercentB: bollPercentBValues[index],
        bollBandwidth: bollBandwidthValues[index],
      },
    };
  });
  const technicalEventRanks = new Map<number, number>();
  const technicalIndicatorEvents = buildTechnicalIndicatorAnnotations(candles.map((candle) => ({
    date: candle.date,
    period_label: candle.periodLabel,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    maFast: candle.ma5,
    maSlow: candle.ma20,
    dif: candle.indicators.dif,
    dea: candle.indicators.dea,
    bollUpper: candle.indicators.bollUpper,
    bollLower: candle.indicators.bollLower,
    rsi14: candle.indicators.rsi14,
    kdjK: candle.indicators.kdjK,
    kdjD: candle.indicators.kdjD,
    pdi: candle.indicators.pdi,
    mdi: candle.indicators.mdi,
    cci: candle.indicators.cci,
    wr: candle.indicators.wr,
  }))).map((event) => {
    const rank = technicalEventRanks.get(event.index) || 0;
    technicalEventRanks.set(event.index, rank + 1);
    const x = xOf(event.index);
    const priceY = yOf(event.price);
    const isRisk = event.tone === "risk";
    const markerY = isRisk
      ? Math.max(PRICE_TOP + 14, priceY - 24 - rank * 14)
      : Math.min(PRICE_BOTTOM - 12, priceY + 24 + rank * 14);
    return {
      ...event,
      x,
      priceY,
      markerY,
      labelX: clampNumber(x + (x > PLOT_RIGHT - 116 ? -78 : 12), PLOT_LEFT + 8, PLOT_RIGHT - 92),
      labelY: clampNumber(markerY - 7, PRICE_TOP + 14, PRICE_BOTTOM - 6),
    };
  });
  const technicalDivergenceRanks = new Map<number, number>();
  const technicalDivergenceEvents = buildTechnicalDivergenceAnnotations(candles.map((candle) => ({
    date: candle.date,
    period_label: candle.periodLabel,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    rsi14: candle.indicators.rsi14,
    macd: candle.indicators.macd,
  })), {
    swingWindow: 2,
    minPriceMovePct: 0.6,
    minIndicatorMove: 0.4,
    maxPerType: 1,
  }).map((event) => {
    const rank = technicalDivergenceRanks.get(event.index) || 0;
    technicalDivergenceRanks.set(event.index, rank + 1);
    const x = xOf(event.index);
    const startX = xOf(event.startIndex);
    const priceY = yOf(event.price);
    const startPriceY = yOf(event.startPrice);
    const isRisk = event.tone === "risk";
    const markerY = isRisk
      ? Math.max(PRICE_TOP + 20, priceY - 34 - rank * 16)
      : Math.min(PRICE_BOTTOM - 16, priceY + 34 + rank * 16);
    return {
      ...event,
      x,
      startX,
      priceY,
      startPriceY,
      markerY,
      labelX: clampNumber(x + (x > PLOT_RIGHT - 116 ? -86 : 12), PLOT_LEFT + 8, PLOT_RIGHT - 96),
      labelY: clampNumber(markerY - 7, PRICE_TOP + 14, PRICE_BOTTOM - 6),
    };
  });
  const volumeSignalRanks = new Map<number, number>();
  const volumeSignalEvents = buildVolumeSignalAnnotations(candles, {
    period: Math.min(20, Math.max(3, Math.floor(visible.length / 6))),
    surgeRatio: 1.8,
    dryUpRatio: 0.42,
    minMovePct: 1,
    quietMovePct: 0.8,
  }).map((event) => {
    const rank = volumeSignalRanks.get(event.index) || 0;
    volumeSignalRanks.set(event.index, rank + 1);
    const candle = candles[event.index];
    const x = xOf(event.index);
    const volumeAnchorY = candle?.volumeY ?? volumeY(event.volume);
    const markerY = clampNumber(volumeAnchorY - 11 - rank * 13, VOLUME_TOP + 12, VOLUME_BOTTOM - 10);
    return {
      ...event,
      x,
      volumeY: volumeAnchorY,
      markerY,
      labelX: clampNumber(x + (x > PLOT_RIGHT - 112 ? -76 : 12), PLOT_LEFT + 8, PLOT_RIGHT - 90),
      labelY: clampNumber(markerY - 7, VOLUME_TOP + 10, VOLUME_BOTTOM - 6),
    };
  });
  const visibleFundFlowRows = candles.flatMap((candle) => candle.fundFlow ? [{ ...candle.fundFlow, date: candle.date }] : []);
  const fundFlowOverlay = buildFundFlowOverlayGeometry(candles, visibleFundFlowRows, {
    top: VOLUME_TOP,
    bottom: VOLUME_BOTTOM,
  });
  const trendRegimeBands = buildTrendRegimeBands(candles.map((candle) => ({
    date: candle.date,
    period_label: candle.periodLabel,
    close: candle.close,
    maFast: candle.ma5,
    maMid: candle.ma20,
    maSlow: candle.ma60,
  }))).map((band) => {
    const startX = clampNumber(xOf(band.startIndex) - candleWidth / 2, PLOT_LEFT, PLOT_RIGHT);
    const endX = clampNumber(xOf(band.endIndex) + candleWidth / 2, PLOT_LEFT, PLOT_RIGHT);
    const width = Math.max(2, endX - startX);
    return {
      ...band,
      x: startX,
      width,
      labelX: clampNumber(startX + 10, PLOT_LEFT + 8, PLOT_RIGHT - 74),
      labelY: PRICE_TOP + 28,
      showLabel: width >= 78,
    };
  });
  const maPoints = (key: "ma5" | "ma20" | "ma60" | "ma120") =>
    candles
      .filter((candle) => typeof candle[key] === "number")
      .map((candle) => `${candle.x.toFixed(2)},${yOf(candle[key]).toFixed(2)}`)
      .join(" ");
  const indicatorPoints = (values: (number | null)[], yFn: (value: number) => number) =>
    values
      .map((value, index) => (typeof value === "number" ? `${xOf(index).toFixed(2)},${yFn(value).toFixed(2)}` : ""))
      .filter(Boolean)
      .join(" ");
  const closeLine = indicatorPoints(closeValues, yOf);
  const bollLine = (key: "upper" | "mid" | "lower") =>
    indicatorPoints(bollValues.map((value) => value?.[key] ?? null), yOf);
  const eneLine = (key: "upper" | "mid" | "lower") =>
    indicatorPoints(eneValues.map((value) => value?.[key] ?? null), yOf);
  const mikeLine = (key: keyof ReturnType<typeof buildMikeIndicators>[number]) =>
    indicatorPoints(mikeValues.map((value) => value?.[key] ?? null), yOf);
  const kdjLine = (key: "k" | "d" | "j") =>
    indicatorPoints(kdjValues.map((value) => value?.[key] ?? null), rsiY);
  const relativeLine = indicatorPoints(relativeValues, relativeY);
  const relativeStrengthIndexLine = indicatorPoints(relativeStrengthIndexValues, relativeY);
  const relativeStrengthIndustryLine = indicatorPoints(relativeStrengthIndustryValues, relativeY);
  const volumeMa5Line = indicatorPoints(volumeMa5Values, volumeY);
  const volumeMa10Line = indicatorPoints(volumeMa10Values, volumeY);
  const volumeMa20Line = indicatorPoints(volumeMa20Values, volumeY);
  const bollBandArea = buildIndicatorBandAreaPath(candles.map((candle, index) => ({
    x: candle.x,
    upperY: isFiniteNumber(bollValues[index]?.upper) ? yOf(bollValues[index]?.upper) : null,
    lowerY: isFiniteNumber(bollValues[index]?.lower) ? yOf(bollValues[index]?.lower) : null,
  })));
  const maTrendRibbons = buildTrendRibbonAreaSegments(candles.map((candle) => ({
    x: candle.x,
    fastY: isFiniteNumber(candle.ma20) ? yOf(candle.ma20) : null,
    slowY: isFiniteNumber(candle.ma60) ? yOf(candle.ma60) : null,
    fastValue: candle.ma20,
    slowValue: candle.ma60,
  })));
  const ichimokuCloudSegments = buildTrendRibbonAreaSegments(candles.map((candle, index) => ({
    x: candle.x,
    fastY: isFiniteNumber(ichimokuSpanAValues[index]) ? yOf(ichimokuSpanAValues[index]) : null,
    slowY: isFiniteNumber(ichimokuSpanBValues[index]) ? yOf(ichimokuSpanBValues[index]) : null,
    fastValue: ichimokuSpanAValues[index],
    slowValue: ichimokuSpanBValues[index],
  })));
  const latestIndicator = candles[candles.length - 1]?.indicators;
  const latestPriceLine = buildLatestPriceLine({
    price: latestIndicator?.close,
    prevClose: latestIndicator?.prevClose,
    y: latestIndicator ? yOf(latestIndicator.close) : null,
    top: PRICE_TOP,
    bottom: PRICE_BOTTOM,
  });
  const latestPriceTone = latestPriceLine?.tone ?? "neutral";
  const overlayPriceLabel = (
    key: string,
    group: string,
    label: string,
    price: number | null | undefined,
    tone: "good" | "risk" | "neutral" | "info",
    priority: number,
  ) => ({
    key,
    group,
    label,
    price,
    y: isFiniteNumber(price) ? yOf(price) : null,
    tone,
    priority,
  });
  const overlayPriceLabels = buildOverlayPriceLabels([
    overlayPriceLabel("latest-price", "latest", latestPriceLine?.label || "现价", latestPriceLine?.price, latestPriceTone, 1),
    overlayPriceLabel("ma-fast", "ma", `MA${fastPeriod}`, latestIndicator?.ma5, "info", 10),
    overlayPriceLabel("ma-mid", "ma", `MA${midPeriod}`, latestIndicator?.ma20, "info", 11),
    overlayPriceLabel("ma-slow", "ma", `MA${slowPeriod}`, latestIndicator?.ma60, "info", 12),
    overlayPriceLabel("ma-120", "ma", "MA120", latestIndicator?.ma120, "info", 13),
    overlayPriceLabel("boll-upper", "boll", "BUP", latestIndicator?.bollUpper, "good", 20),
    overlayPriceLabel("boll-mid", "boll", "BMID", latestIndicator?.bollMid, "good", 21),
    overlayPriceLabel("boll-lower", "boll", "BDN", latestIndicator?.bollLower, "good", 22),
    overlayPriceLabel("ene-upper", "ene", "EUP", latestIndicator?.eneUpper, "neutral", 24),
    overlayPriceLabel("ene-mid", "ene", "ENE", latestIndicator?.eneMid, "neutral", 25),
    overlayPriceLabel("ene-lower", "ene", "EDN", latestIndicator?.eneLower, "neutral", 26),
    overlayPriceLabel("mike-wr", "mike", "M-WR", latestIndicator?.mikeWeakResistance, "risk", 27),
    overlayPriceLabel("mike-ws", "mike", "M-WS", latestIndicator?.mikeWeakSupport, "good", 28),
    overlayPriceLabel("vwap", "vwap", "VWAP", latestIndicator?.vwap, "neutral", 30),
    overlayPriceLabel("ema-fast", "ema", `E${emaFastPeriod}`, latestIndicator?.emaFast, "info", 40),
    overlayPriceLabel("ema-slow", "ema", `E${emaSlowPeriod}`, latestIndicator?.emaSlow, "info", 41),
    overlayPriceLabel("sar", "sar", "SAR", latestIndicator?.sar, "risk", 50),
    overlayPriceLabel("bbi", "bbi", "BBI", latestIndicator?.bbi, "info", 51),
    overlayPriceLabel("ichimoku-conversion", "ichimoku", "转", latestIndicator?.ichimokuConversion, "info", 60),
    overlayPriceLabel("ichimoku-base", "ichimoku", "基", latestIndicator?.ichimokuBase, "info", 61),
    overlayPriceLabel("ichimoku-span-a", "ichimoku", "云A", latestIndicator?.ichimokuSpanA, "neutral", 62),
    overlayPriceLabel("ichimoku-span-b", "ichimoku", "云B", latestIndicator?.ichimokuSpanB, "neutral", 63),
  ], {
    bottom: PRICE_BOTTOM,
    minGap: 19,
    top: PRICE_TOP,
  });
  const extraIndicatorSection = (section: "advanced" | "momentum" | "volatility") =>
    splitSubCharts ? section : "oscillator";
  const indicatorValueLabel = (
    key: string,
    section: string,
    group: string,
    label: string,
    value: number | null | undefined,
    y: number | null,
    tone: "good" | "risk" | "neutral" | "info",
    priority: number,
    options: { precision?: number; signed?: boolean; compact?: boolean } = {},
  ) => ({
    key,
    section,
    group,
    label,
    value,
    y,
    tone,
    priority,
    ...options,
  });
  const indicatorValueLabelSections = Object.fromEntries(sections.map((section) => [
    section.key,
    { top: section.top, bottom: section.bottom },
  ]));
  const indicatorValueLabels = buildIndicatorValueLabels([
    indicatorValueLabel("vol", "volume", "volume", "VOL", latestIndicator?.volume, latestIndicator ? volumeY(latestIndicator.volume) : null, "neutral", 10, { compact: true }),
    indicatorValueLabel("vma5", "volume", "volume", "VMA5", latestIndicator?.volumeMa5, latestIndicator ? volumeY(latestIndicator.volumeMa5) : null, "info", 11, { compact: true }),
    indicatorValueLabel("vma10", "volume", "volume", "VMA10", latestIndicator?.volumeMa10, latestIndicator ? volumeY(latestIndicator.volumeMa10) : null, "info", 12, { compact: true }),
    indicatorValueLabel("vma20", "volume", "volume", "VMA20", latestIndicator?.volumeMa20, latestIndicator ? volumeY(latestIndicator.volumeMa20) : null, "info", 13, { compact: true }),
    indicatorValueLabel("dif", "macd", "macd", "DIF", latestIndicator?.dif, latestIndicator ? macdY(latestIndicator.dif ?? 0) : null, "info", 20, { precision: 2, signed: true }),
    indicatorValueLabel("dea", "macd", "macd", "DEA", latestIndicator?.dea, latestIndicator ? macdY(latestIndicator.dea ?? 0) : null, "info", 21, { precision: 2, signed: true }),
    indicatorValueLabel("macd", "macd", "macd", "MACD", latestIndicator?.macd, latestIndicator ? macdY(latestIndicator.macd ?? 0) : null, (latestIndicator?.macd ?? 0) >= 0 ? "good" : "risk", 22, { precision: 2, signed: true }),
    indicatorValueLabel("rsi", "oscillator", "rsi", "RSI", latestIndicator?.rsi14, latestIndicator ? rsiY(latestIndicator.rsi14) : null, (latestIndicator?.rsi14 ?? 50) >= 70 ? "risk" : (latestIndicator?.rsi14 ?? 50) <= 30 ? "good" : "neutral", 30, { precision: 1 }),
    indicatorValueLabel("psy", "oscillator", "rsi", "PSY", latestIndicator?.psy, latestIndicator ? rsiY(latestIndicator.psy) : null, (latestIndicator?.psy ?? 50) >= 75 ? "risk" : (latestIndicator?.psy ?? 50) <= 25 ? "good" : "neutral", 31, { precision: 1 }),
    indicatorValueLabel("psy-ma", "oscillator", "rsi", "PSYMA", latestIndicator?.psyMa, latestIndicator ? rsiY(latestIndicator.psyMa) : null, "info", 32, { precision: 1 }),
    indicatorValueLabel("kdj-k", "oscillator", "kdj", "K", latestIndicator?.kdjK, latestIndicator ? rsiY(latestIndicator.kdjK) : null, "info", 33, { precision: 1 }),
    indicatorValueLabel("kdj-d", "oscillator", "kdj", "D", latestIndicator?.kdjD, latestIndicator ? rsiY(latestIndicator.kdjD) : null, "info", 34, { precision: 1 }),
    indicatorValueLabel("kdj-j", "oscillator", "kdj", "J", latestIndicator?.kdjJ, latestIndicator ? rsiY(latestIndicator.kdjJ) : null, "info", 35, { precision: 1 }),
    indicatorValueLabel("cr", extraIndicatorSection("advanced"), "advanced", "CR", latestIndicator?.cr, latestIndicator ? advancedY(latestIndicator.cr) : null, "info", 40, { precision: 1 }),
    indicatorValueLabel("ar", extraIndicatorSection("advanced"), "advanced", "AR", latestIndicator?.ar, latestIndicator ? advancedY(latestIndicator.ar) : null, "info", 41, { precision: 1 }),
    indicatorValueLabel("br", extraIndicatorSection("advanced"), "advanced", "BR", latestIndicator?.br, latestIndicator ? advancedY(latestIndicator.br) : null, "info", 42, { precision: 1 }),
    indicatorValueLabel("emv", extraIndicatorSection("advanced"), "advanced", "EMV", latestIndicator?.emv, latestIndicator ? emvY(latestIndicator.emv) : null, "neutral", 43, { precision: 4, signed: true }),
    indicatorValueLabel("mfi", extraIndicatorSection("advanced"), "volumeMomentum", "MFI", latestIndicator?.mfi, latestIndicator ? moneyFlowY(latestIndicator.mfi) : null, (latestIndicator?.mfi ?? 50) >= 80 ? "risk" : (latestIndicator?.mfi ?? 50) <= 20 ? "good" : "neutral", 50, { precision: 1 }),
    indicatorValueLabel("vr", extraIndicatorSection("advanced"), "volumeMomentum", "VR", latestIndicator?.vr, latestIndicator ? moneyFlowY(latestIndicator.vr) : null, "info", 51, { precision: 1 }),
    indicatorValueLabel("pdi", extraIndicatorSection("momentum"), "momentum", "+DI", latestIndicator?.pdi, latestIndicator ? dmiY(latestIndicator.pdi) : null, "good", 60, { precision: 1 }),
    indicatorValueLabel("mdi", extraIndicatorSection("momentum"), "momentum", "-DI", latestIndicator?.mdi, latestIndicator ? dmiY(latestIndicator.mdi) : null, "risk", 61, { precision: 1 }),
    indicatorValueLabel("adx", extraIndicatorSection("momentum"), "momentum", "ADX", latestIndicator?.adx, latestIndicator ? dmiY(latestIndicator.adx) : null, "info", 62, { precision: 1 }),
    indicatorValueLabel("cci", extraIndicatorSection("momentum"), "momentum", "CCI", latestIndicator?.cci, latestIndicator ? momentumY(latestIndicator.cci) : null, (latestIndicator?.cci ?? 0) >= 100 ? "risk" : (latestIndicator?.cci ?? 0) <= -100 ? "good" : "neutral", 63, { precision: 1, signed: true }),
    indicatorValueLabel("wr", extraIndicatorSection("momentum"), "momentum", "WR", latestIndicator?.wr, latestIndicator ? momentumY(latestIndicator.wr) : null, (latestIndicator?.wr ?? -50) >= -20 ? "risk" : (latestIndicator?.wr ?? -50) <= -80 ? "good" : "neutral", 64, { precision: 1, signed: true }),
    indicatorValueLabel("bias", extraIndicatorSection("momentum"), "biasDma", "BIAS", latestIndicator?.bias, latestIndicator ? biasY(latestIndicator.bias) : null, "neutral", 70, { precision: 2, signed: true }),
    indicatorValueLabel("dma", extraIndicatorSection("momentum"), "biasDma", "DMA", latestIndicator?.dma, latestIndicator ? dmaY(latestIndicator.dma) : null, "info", 71, { precision: 2, signed: true }),
    indicatorValueLabel("roc", extraIndicatorSection("momentum"), "volumeMomentum", "ROC", latestIndicator?.roc, latestIndicator ? rocY(latestIndicator.roc) : null, (latestIndicator?.roc ?? 0) >= 0 ? "good" : "risk", 80, { precision: 2, signed: true }),
    indicatorValueLabel("trix", extraIndicatorSection("momentum"), "volumeMomentum", "TRIX", latestIndicator?.trix, latestIndicator ? rocY(latestIndicator.trix) : null, "info", 81, { precision: 2, signed: true }),
    indicatorValueLabel("osc", extraIndicatorSection("momentum"), "volumeMomentum", "OSC", latestIndicator?.osc, latestIndicator ? rocY(latestIndicator.osc) : null, (latestIndicator?.osc ?? 0) >= 0 ? "good" : "risk", 82, { precision: 2, signed: true }),
    indicatorValueLabel("osc-ema", extraIndicatorSection("momentum"), "volumeMomentum", "OSCEMA", latestIndicator?.oscEma, latestIndicator ? rocY(latestIndicator.oscEma) : null, "info", 83, { precision: 2, signed: true }),
    indicatorValueLabel("atr", extraIndicatorSection("volatility"), "volatility", "ATR", latestIndicator?.atr, latestIndicator ? atrY(latestIndicator.atr) : null, "neutral", 90, { precision: 2 }),
    indicatorValueLabel("obv", extraIndicatorSection("volatility"), "volatility", "OBV", latestIndicator?.obv, latestIndicator ? obvY(latestIndicator.obv) : null, "info", 91, { compact: true, signed: true }),
    indicatorValueLabel("boll-percent-b", extraIndicatorSection("volatility"), "volatility", "%B", latestIndicator?.bollPercentB, latestIndicator ? bollVolatilityY(latestIndicator.bollPercentB) : null, "info", 92, { precision: 1 }),
    indicatorValueLabel("boll-bandwidth", extraIndicatorSection("volatility"), "volatility", "BBW", latestIndicator?.bollBandwidth, latestIndicator ? bollVolatilityY(latestIndicator.bollBandwidth) : null, "neutral", 93, { precision: 1 }),
  ], {
    maxPerSection: splitSubCharts ? 7 : 10,
    minGap: 13,
    sections: indicatorValueLabelSections,
  });
  const macdBars = macdValues.map((value, index) => {
    const y = macdY(value);
    return {
      date: visible[index].date,
      value,
      x: xOf(index),
      width: Math.max(0.32, candleWidth * 0.78),
      y: Math.min(y, macdZeroY),
      height: Math.abs(macdZeroY - y),
    };
  });
  const signalDateRanks = new Map<string, number>();
  const markers = signals.flatMap((signal) => {
    const index = dateIndex.get(signal.date);
    if (index == null) return [];
    const bar = visible[index];
    const candle = candles[index];
    const rank = signalDateRanks.get(signal.date) || 0;
    signalDateRanks.set(signal.date, rank + 1);
    const tone = signalTone(signal);
    const x = xOf(index);
    const offset = Math.min(rank, 3) * 6;
    const y = tone === "risk"
      ? Math.max(PRICE_TOP + 16, yOf(bar.high) - 14 - offset)
      : Math.min(PRICE_BOTTOM - 16, yOf(bar.low) + 14 + offset);
    const dotY = tone === "risk" ? yOf(bar.high) : yOf(bar.low);
    const entryIndex = signal.entry_date ? dateIndex.get(signal.entry_date) : undefined;
    const entryBar = entryIndex == null ? null : visible[entryIndex];
    const entryY = entryBar ? yOf(signal.entry_price ?? entryBar.close) : null;
    return [
      {
        signal,
        tone,
        indicators: candle.indicators,
        label: signalMarkerLabel(signal),
        size: 8.5,
        x,
        y,
        dotY,
        entryY,
        labelX: Math.min(PLOT_RIGHT - 24, Math.max(PLOT_LEFT + 10, x + (x > PLOT_RIGHT - 80 ? -24 : 12))),
        labelY: tone === "risk" ? Math.max(PRICE_TOP + 18, y - 18) : Math.min(PRICE_BOTTOM - 6, y + 26),
        labelWidth: signalMarkerLabel(signal).length > 1 ? 34 : 24,
      },
    ];
  });

  const entryLinks = markers.flatMap((marker) => {
    if (!marker.signal.entry_date || marker.signal.entry_date === marker.signal.date) return [];
    const entryIndex = dateIndex.get(marker.signal.entry_date);
    if (entryIndex == null) return [];
    const entryBar = visible[entryIndex];
    return [
      {
        id: `${marker.signal.signal_id}-entry`,
        signalX: marker.x,
        signalY: marker.dotY,
        entryX: xOf(entryIndex),
        entryY: yOf(marker.signal.entry_price ?? entryBar.close),
      },
    ];
  });
  const eventDateRanks = new Map<string, number>();
  const eventMarkers = evidenceEvents.flatMap((event) => {
    const index = dateIndex.get(event.date);
    if (index == null) return [];
    const rank = eventDateRanks.get(event.date) || 0;
    eventDateRanks.set(event.date, rank + 1);
    return [
      {
        event,
        x: xOf(index),
        y: SIGNAL_LANE_Y - 18 - Math.min(rank, 3) * 16,
        tone: event.tone,
        label: event.label,
      },
    ];
  });
  const timeTicks = buildTimeTicks(candles.map((candle) => ({
    x: candle.x,
    label: candle.periodLabel || candle.date,
  })));
  const eventDensityBars = buildKlineEventDensity({
    baselineY: SIGNAL_LANE_Y - 4,
    divergenceEvents: technicalDivergenceEvents,
    gaps: priceGaps,
    maxBarWidth: Math.max(3, candleWidth * 0.72),
    maxHeight: 22,
    patterns: candlestickPatterns,
    plotLeft: PLOT_LEFT,
    plotRight: PLOT_RIGHT,
    tdsEvents: tdsSequentialEvents,
    technicalEvents: technicalIndicatorEvents,
    visibleCount: visible.length,
    volumeEvents: volumeSignalEvents,
  });

  return {
    candles,
    markers,
    eventMarkers,
    entryLinks,
    priceGaps,
    candlestickPatterns,
    tdsSequentialEvents,
    technicalIndicatorEvents,
    technicalDivergenceEvents,
    volumeSignalEvents,
    eventDensityBars,
    fundFlowOverlay,
    trendRegimeBands,
    fibonacciLevels,
    supportResistanceLevels,
    priceStructureTrendLines,
    limitPriceLines,
    ma5: maPoints("ma5"),
    ma20: maPoints("ma20"),
    ma60: maPoints("ma60"),
    ma120: maPoints("ma120"),
    closeLine,
    emaFastLine: indicatorPoints(emaFastValues, yOf),
    emaSlowLine: indicatorPoints(emaSlowValues, yOf),
    vwapLine: indicatorPoints(vwapValues, yOf),
    sarLine: indicatorPoints(sarValues, yOf),
    bbiLine: indicatorPoints(bbiValues, yOf),
    bollBandArea,
    maTrendRibbons,
    ichimokuCloudSegments,
    ichimokuConversionLine: indicatorPoints(ichimokuConversionValues, yOf),
    ichimokuBaseLine: indicatorPoints(ichimokuBaseValues, yOf),
    ichimokuSpanALine: indicatorPoints(ichimokuSpanAValues, yOf),
    ichimokuSpanBLine: indicatorPoints(ichimokuSpanBValues, yOf),
    ichimokuLaggingLine: indicatorPoints(ichimokuLaggingValues, yOf),
    bollUpper: bollLine("upper"),
    bollMid: bollLine("mid"),
    bollLower: bollLine("lower"),
    eneUpper: eneLine("upper"),
    eneMid: eneLine("mid"),
    eneLower: eneLine("lower"),
    mikeWeakResistanceLine: mikeLine("weakResistance"),
    mikeMediumResistanceLine: mikeLine("mediumResistance"),
    mikeStrongResistanceLine: mikeLine("strongResistance"),
    mikeWeakSupportLine: mikeLine("weakSupport"),
    mikeMediumSupportLine: mikeLine("mediumSupport"),
    mikeStrongSupportLine: mikeLine("strongSupport"),
    volumeMa5Line,
    volumeMa10Line,
    volumeMa20Line,
    macdBars,
    difLine: indicatorPoints(difValues, macdY),
    deaLine: indicatorPoints(deaValues, macdY),
    rsiLine: indicatorPoints(rsiValues, rsiY),
    psyLine: indicatorPoints(psyValues, rsiY),
    psyMaLine: indicatorPoints(psyMaValues, rsiY),
    kdjKLine: kdjLine("k"),
    kdjDLine: kdjLine("d"),
    kdjJLine: kdjLine("j"),
    crLine: indicatorPoints(crValues, advancedY),
    arLine: indicatorPoints(arValues, advancedY),
    brLine: indicatorPoints(brValues, advancedY),
    emvLine: indicatorPoints(emvValues, emvY),
    emvMaLine: indicatorPoints(emvMaValues, emvY),
    pdiLine: indicatorPoints(pdiValues, dmiY),
    mdiLine: indicatorPoints(mdiValues, dmiY),
    adxLine: indicatorPoints(adxValues, dmiY),
    cciLine: indicatorPoints(cciValues, momentumY),
    wrLine: indicatorPoints(wrValues, momentumY),
    biasLine: indicatorPoints(biasValues, biasY),
    dmaLine: indicatorPoints(dmaValues, dmaY),
    amaLine: indicatorPoints(amaValues, dmaY),
    mfiLine: indicatorPoints(mfiValues, moneyFlowY),
    vrLine: indicatorPoints(vrValues, moneyFlowY),
    rocLine: indicatorPoints(rocValues, rocY),
    trixLine: indicatorPoints(trixValues, rocY),
    trmaLine: indicatorPoints(trmaValues, rocY),
    oscLine: indicatorPoints(oscValues, rocY),
    oscEmaLine: indicatorPoints(oscEmaValues, rocY),
    atrLine: indicatorPoints(atrValues, atrY),
    obvLine: indicatorPoints(obvValues, obvY),
    bollPercentBLine: indicatorPoints(bollPercentBValues, bollVolatilityY),
    bollBandwidthLine: indicatorPoints(bollBandwidthValues, bollVolatilityY),
    relativeLine,
    relativeStrengthIndexLine,
    relativeStrengthIndustryLine,
    relativeZeroY: relativeY(0),
    relativeLatest: relativeValues[relativeValues.length - 1] ?? null,
    relativeStrengthLatestIndex: relativeStrengthOverlay.latestIndex,
    relativeStrengthLatestIndustry: relativeStrengthOverlay.latestIndustry,
    volumeProfile,
    rangeExtrema,
    priceTicks,
    indicatorAxisTicks,
    indicatorThresholdGuides,
    indicatorThresholdZones,
    overlayPriceLabels,
    indicatorValueLabels,
    rangeNavigator,
    timeTicks,
    latestIndicators: candles[candles.length - 1]?.indicators || null,
    latestPriceLine,
    prevCloseY: isFiniteNumber(candles[candles.length - 1]?.prevClose)
      ? yOf(candles[candles.length - 1].prevClose)
      : null,
    macdZeroY,
    advanced100Y: advancedY(100),
    emvZeroY,
    momentumZeroY: momentumY(0),
    moneyFlow100Y: moneyFlowY(100),
    volumeMomentumZeroY,
    obvZeroY: obvY(0),
    rsi70Y: rsiY(70),
    rsi30Y: rsiY(30),
    signalLaneY: SIGNAL_LANE_Y,
    viewBoxHeight: layout.viewBoxHeight,
    timeAxisY: layout.timeAxisY,
    plotLeft: PLOT_LEFT,
    plotRight: PLOT_RIGHT,
    axisX: AXIS_X,
    priceMin: minPrice,
    priceMax: maxPrice,
    priceAxisMode: priceAxisScale.mode,
    priceAxisBase: priceAxisScale.basePrice,
    priceAxisMin: priceAxisScale.min,
    priceAxisMax: priceAxisScale.max,
    priceTop: PRICE_TOP,
    priceBottom: PRICE_BOTTOM,
    sections,
    visibleCount: visible.length,
  };
}

function emaNumberValues(values: number[], period: number) {
  if (values.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const result = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result.push(values[index] * multiplier + result[index - 1] * (1 - multiplier));
  }
  return result;
}

function rsiNumberValues(values: number[], period: number) {
  return values.map((_, index) => {
    if (index < period) return null;
    let gain = 0;
    let loss = 0;
    for (let offset = index - period + 1; offset <= index; offset += 1) {
      const delta = values[offset] - values[offset - 1];
      if (delta >= 0) gain += delta;
      else loss += Math.abs(delta);
    }
    if (loss === 0 && gain === 0) return 50;
    if (loss === 0) return 100;
    const rs = gain / loss;
    return 100 - 100 / (1 + rs);
  });
}

function bollNumberValues(values: number[], period: number, multiplier: number) {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const slice = values.slice(index - period + 1, index + 1);
    const mid = averageNumberValues(slice);
    if (!isFiniteNumber(mid)) return null;
    const variance = slice.reduce((sum, value) => sum + (value - mid) ** 2, 0) / slice.length;
    const width = Math.sqrt(variance) * multiplier;
    return {
      upper: mid + width,
      mid,
      lower: mid - width,
    };
  });
}

function kdjNumberValues(highs: number[], lows: number[], closes: number[], period: number) {
  let k = 50;
  let d = 50;
  return closes.map((close, index) => {
    const start = Math.max(0, index - period + 1);
    const high = Math.max(...highs.slice(start, index + 1));
    const low = Math.min(...lows.slice(start, index + 1));
    const rsv = high === low ? 50 : ((close - low) / (high - low)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    const j = 3 * k - 2 * d;
    return { k, d, j };
  });
}

function vwapNumberValues(bars: PeriodMarketBar[]) {
  let cumulativeAmount = 0;
  let cumulativeVolume = 0;
  return bars.map((bar) => {
    const volume = Number(bar.volume || 0);
    const typicalPrice = (Number(bar.high ?? bar.close ?? 0) + Number(bar.low ?? bar.close ?? 0) + Number(bar.close || 0)) / 3;
    const amount = Number(bar.amount || 0) || typicalPrice * volume;
    cumulativeAmount += amount;
    cumulativeVolume += volume;
    return cumulativeVolume > 0 ? cumulativeAmount / cumulativeVolume : null;
  });
}

function averageNumberValues(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function extractStrategyLevelPrices(analysis?: StrategyKlineAnalysis | null) {
  const channels = analysis?.price_channels || {};
  return [
    analysis?.latest_bar?.close,
    channels.stop_price,
    channels.buy_back_price,
    channels.target1,
    channels.target2,
    channels.predict_high_1,
    channels.predict_low_1,
  ].filter(isFiniteNumber);
}

function adjustChartSignalsForPriceAdjustment(
  signals: ChartSignalMarker[],
  bars: MarketHistoryBar[],
  adjustment: PriceAdjustedBarsResult<MarketHistoryBar>,
) {
  if (adjustment.mode === "none") return signals;
  const factorByDate = new Map(
    bars
      .filter((bar) => bar.date && isFiniteNumber(bar.adj_factor) && bar.adj_factor > 0)
      .map((bar) => [bar.date, bar.adj_factor]),
  );
  return signals.map((signal) => {
    const factor = factorByDate.get(signal.entry_date || signal.date);
    const entryPrice = priceAdjustmentPriceByFactor(signal.entry_price, factor, adjustment);
    return {
      ...signal,
      entry_price: entryPrice ?? signal.entry_price,
    };
  });
}

function adjustLatestPricesForPriceAdjustment(
  prices: number[],
  adjustment: PriceAdjustedBarsResult<MarketHistoryBar>,
) {
  if (adjustment.mode === "none") return prices;
  return prices.map((price) =>
    priceAdjustmentPriceByFactor(price, adjustment.latestFactor, adjustment) ?? price,
  );
}

function chartPriceToY(chart: Record<string, any>, price?: number | null) {
  const scale = chartPriceAxisScale(chart);
  return scale ? priceAxisYOf(scale, price) : null;
}

function chartPriceFromY(chart: Record<string, any>, y: number) {
  const scale = chartPriceAxisScale(chart);
  return scale ? priceAxisPriceFromY(scale, y) : null;
}

function chartPriceAxisScale(chart: Record<string, any>) {
  const requestedMode = normalizePriceAxisMode(chart.priceAxisMode);
  const min = isFiniteNumber(chart.priceAxisMin) ? chart.priceAxisMin : chart.priceMin;
  const max = isFiniteNumber(chart.priceAxisMax) ? chart.priceAxisMax : chart.priceMax;
  if (!isFiniteNumber(min) || !isFiniteNumber(max) || !isFiniteNumber(chart.priceTop) || !isFiniteNumber(chart.priceBottom)) {
    return null;
  }
  const mode: PriceAxisMode = requestedMode === "percent" && isFiniteNumber(chart.priceAxisBase) && chart.priceAxisBase > 0
    ? "percent"
    : "price";
  return {
    mode,
    basePrice: mode === "percent" && isFiniteNumber(chart.priceAxisBase) ? chart.priceAxisBase : null,
    min,
    max: max === min ? min + 1 : max,
    top: chart.priceTop,
    bottom: chart.priceBottom,
  };
}

function chartIndicatorAxisTicks(chart: Record<string, any>, key: string): IndicatorAxisTick[] {
  const ticks = chart.indicatorAxisTicks as Record<string, IndicatorAxisTick[] | undefined> | undefined;
  return ticks?.[key] ?? [];
}

function chartAxisValueFromPrice(chart: Record<string, any>, price?: number | null) {
  const scale = chartPriceAxisScale(chart);
  return scale ? priceAxisValueFromPrice(scale, price) : null;
}

function formatChartAxisValue(chart: Record<string, any>, value?: number | null) {
  if (!isFiniteNumber(value)) return "-";
  return chartPriceAxisScale(chart)?.mode === "percent"
    ? formatSignedPercent(value / 100)
    : formatNumber(value, 2);
}

function formatChartAxisPrice(chart: Record<string, any>, price?: number | null) {
  return formatChartAxisValue(chart, chartAxisValueFromPrice(chart, price));
}

function formatIndicatorValueLabel(label: IndicatorValueLabel) {
  if (label.compact) return formatCompactNumber(label.value);
  return label.signed
    ? formatSignedNumber(label.value, label.precision ?? 2)
    : formatNumber(label.value, label.precision ?? 2);
}

function formatIndicatorPanelReadout(item: IndicatorPanelReadoutItem) {
  if (item.compact) return formatCompactNumber(item.value);
  return item.signed
    ? formatSignedNumber(item.value, item.precision)
    : formatNumber(item.value, item.precision);
}

function formatRawPercentNumber(value?: number | null, digits = 1) {
  return isFiniteNumber(value) ? `${formatNumber(value, digits)}%` : "-";
}

function buildTradePlanLevels(analysis: StrategyKlineAnalysis | null | undefined, chart: Record<string, any>) {
  if (!analysis || !chart.candles?.length) return [];
  const channels = analysis.price_channels || {};
  const rows = [
    { key: "latest", label: "现价", price: analysis.latest_bar?.close, tone: "current", emphasis: true },
    { key: "stop", label: "止损", price: channels.stop_price, tone: "risk", emphasis: true },
    { key: "entry", label: "入场", price: channels.buy_back_price, tone: "opportunity", emphasis: true },
    { key: "target1", label: "目标1", price: channels.target1, tone: "target", emphasis: false },
    { key: "target2", label: "目标2", price: channels.target2, tone: "target", emphasis: false },
    { key: "high", label: "预测高", price: channels.predict_high_1, tone: "target", emphasis: false },
    { key: "low", label: "预测低", price: channels.predict_low_1, tone: "risk", emphasis: false },
  ];
  const usedY: number[] = [];
  return rows.flatMap((row) => {
    const y = chartPriceToY(chart, row.price);
    if (!isFiniteNumber(y) || !isFiniteNumber(row.price)) return [];
    const shiftedY = usedY.reduce((nextY, previousY) =>
      Math.abs(nextY - previousY) < 18 ? nextY + 18 : nextY,
    y);
    const boundedY = clampNumber(shiftedY, chart.priceTop + 12, chart.priceBottom - 10);
    usedY.push(boundedY);
    return [{
      ...row,
      price: row.price,
      y: boundedY,
      labelWidth: row.emphasis ? 112 : 96,
    }];
  });
}

function buildSignalHoverTooltip(marker: Record<string, any>, period: CandlePeriod, chart: Record<string, any>) {
  const signal = marker.signal as ChartSignalMarker;
  const indicators = (marker.indicators || {}) as TradingIndicatorSnapshot;
  const periodLabel = CANDLE_PERIODS.find((item) => item.key === period)?.unit || "日线";
  const signalPrice = signal.entry_price ?? indicators.close ?? null;
  const rows = [
    { label: "信号日", value: signalDateLabel(signal) },
    { label: "周期落点", value: `${periodLabel} · ${signal.date}` },
    { label: "方向", value: signalDirectionLabel(signal.direction) },
    { label: "价格/评分", value: `${formatNumber(signalPrice, 2)} / ${formatNumber(signal.score, 1)}` },
    { label: "级别", value: signal.signal_level || "-" },
    { label: "RSI/PSYMA/MACD", value: `${formatNumber(indicators.rsi14, 1)} / ${formatNumber(indicators.psy, 1)} / ${formatNumber(indicators.psyMa, 1)} / ${formatNumber(indicators.macd, 2)}` },
    { label: "20日/回撤", value: `${formatSignedPercent(signal.ret_20d)} / ${formatSignedPercent(signal.max_adverse_20d)}` },
  ];
  const width = 248;
  const height = 58 + rows.length * 18;
  const rightSideX = Number(marker.x || 0) + 18;
  const leftSideX = Number(marker.x || 0) - width - 18;
  const x = clampNumber(
    Number(marker.x || 0) > Number(chart.plotRight || 0) - width - 24 ? leftSideX : rightSideX,
    Number(chart.plotLeft || 0) + 8,
    Number(chart.plotRight || width) - width - 8,
  );
  const preferredY =
    marker.tone === "risk"
      ? Number(marker.y || 0) + 16
      : Number(marker.y || 0) - height - 16;
  const y = clampNumber(
    preferredY,
    Number(chart.priceTop || 0) + 8,
    Number(chart.signalLaneY || height) - height - 10,
  );
  return {
    x,
    y,
    width,
    height,
    title: `${signalMarkerLabel(signal)} · ${signalDirectionLabel(signal.direction)}`,
    subtitle: signal.signal_name || "交易信号",
    rows,
    tone: signalTone(signal),
  };
}

function buildTradePlanLevelTooltip(
  level: Record<string, any>,
  chart: Record<string, any>,
  analysis?: StrategyKlineAnalysis | null,
) {
  const latestClose = analysis?.latest_bar?.close;
  const distance =
    isFiniteNumber(level.price) && isFiniteNumber(latestClose) && Number(latestClose) !== 0
      ? Number(level.price) / Number(latestClose) - 1
      : null;
  const rows = [
    { label: "价格", value: formatNumber(level.price, 2) },
    { label: "类型", value: String(level.label || "-") },
    { label: "策略口径", value: "周线趋势 + 日线执行" },
    { label: "信号日", value: analysis?.latest_bar?.date || "-" },
    { label: "距现价", value: formatSignedPercent(distance) },
    {
      label: level.key === "stop" ? "止损/风险" : "仓位/风险",
      value:
        level.key === "stop"
          ? `${formatNumber(analysis?.position_plan?.stop_distance, 2)} / ${formatPercent(analysis?.position_plan?.risk_pct)}`
          : `${formatPercent(analysis?.position_plan?.suggested_position_pct)} / ${formatPercent(analysis?.position_plan?.risk_pct)}`,
    },
  ];
  const width = 248;
  const height = 58 + rows.length * 18;
  const x = clampNumber(
    Number(chart.plotRight || width) - width - 18,
    Number(chart.plotLeft || 0) + 8,
    Number(chart.plotRight || width) - width - 8,
  );
  const y = clampNumber(
    Number(level.y || 0) - height / 2,
    Number(chart.priceTop || 0) + 8,
    Number(chart.signalLaneY || height) - height - 10,
  );
  const tone =
    level.tone === "risk"
      ? "risk"
      : level.tone === "opportunity"
        ? "opportunity"
        : "neutral";
  return {
    x,
    y,
    width,
    height,
    title: `${level.label || "价位"} · ${formatNumber(level.price, 2)}`,
    subtitle: `V2策略价位 · ${analysis ? strategyModeLabel(analysis.mode) : "-"}`,
    rows,
    tone,
  };
}

function buildEvidenceEventTooltip(marker: Record<string, any>, chart: Record<string, any>) {
  const event = marker.event as ChartEvidenceEvent;
  const rows = [
    { label: "日期", value: event.original_date && event.original_date !== event.date ? `${event.original_date}→${event.date}` : event.date },
    { label: "类型", value: evidenceEventKindLabel(event.kind) },
    { label: "状态", value: evidenceEventToneLabel(event.tone) },
    { label: "详情", value: event.detail },
  ];
  const width = 276;
  const height = 58 + rows.length * 18;
  const x = clampNumber(
    Number(marker.x || 0) > Number(chart.plotRight || 0) - width - 24
      ? Number(marker.x || 0) - width - 18
      : Number(marker.x || 0) + 18,
    Number(chart.plotLeft || 0) + 8,
    Number(chart.plotRight || width) - width - 8,
  );
  const y = clampNumber(
    Number(marker.y || 0) - height - 14,
    Number(chart.priceTop || 0) + 8,
    Number(chart.signalLaneY || height) - height - 10,
  );
  return {
    x,
    y,
    width,
    height,
    title: event.title,
    subtitle: `${evidenceEventKindLabel(event.kind)} · ${event.label}`,
    rows,
    tone: event.tone === "risk" ? "risk" : event.tone === "good" ? "opportunity" : "neutral",
  };
}

function evidenceEventKindLabel(kind: ChartEvidenceEvent["kind"]) {
  if (kind === "evidence") return "信号证据";
  if (kind === "risk") return "风险证据";
  if (kind === "invalid") return "失效条件";
  if (kind === "review") return "Agent审查";
  if (kind === "readiness") return "分析完整度";
  if (kind === "strategy") return "策略数据";
  return "大盘过滤";
}

function evidenceEventToneLabel(tone: ChartEvidenceEvent["tone"]) {
  if (tone === "risk") return "风险";
  if (tone === "warn") return "待确认";
  if (tone === "good") return "已覆盖";
  return "观察";
}

function buildChartDiagnostics(
  analysis?: StrategyKlineAnalysis | null,
  backtest?: StrategyKlineBacktest | null,
) {
  if (!analysis) return [];
  const items: { tone: "good" | "warn" | "bad" | "neutral"; label: string; detail: string }[] = [];
  const blockers = analysis.data_quality?.blocking_reasons || [];
  const warnings = analysis.data_quality?.warnings || [];
  if (blockers.length) {
    items.push({ tone: "bad", label: "数据阻断", detail: blockers[0] });
  } else if (warnings.length) {
    items.push({ tone: "warn", label: "数据提示", detail: warnings[0] });
  } else {
    items.push({ tone: "good", label: "数据口径", detail: "行情与指标可用于图表判断" });
  }
  const steps = buildStrategyDecisionSteps(analysis);
  if (analysis.market_filter && !analysis.market_filter.passed) {
    const marketStep = steps.find((step) => step.key === "M2");
    items.push({
      tone: "warn",
      label: "市场环境",
      detail: marketStep?.detail || "大盘环境未通过过滤，先避免逆势开新仓。",
    });
  }
  if (!analysis.buy_signal?.mode_signal) {
    const buyStep = steps.find((step) => step.key === "M3");
    items.push({
      tone: "neutral",
      label: "买入信号",
      detail: buyStep?.detail || `买入强度 ${formatNumber(analysis.buy_signal?.score, 3)}，尚未触发。`,
    });
  }
  if (analysis.sell_signal?.regular_exit || analysis.sell_signal?.emergency || (analysis.sell_signal?.warning_level?.level || 0) > 0) {
    const sellStep = steps.find((step) => step.key === "M4");
    items.push({
      tone: "bad",
      label: "卖出压力",
      detail: sellStep?.detail || `卖出压力 ${formatNumber(analysis.sell_signal?.score, 2)}，需要防守。`,
    });
  }
  if (backtest && (backtest.result.metrics.trade_count || 0) === 0) {
    const reason =
      backtest.result.zero_trade_reasons?.[0] ||
      backtest.result.data_quality?.no_trade_reasons?.[0] ||
      "当前参数窗口内未形成完整买入-卖出闭环";
    items.push({
      tone: "warn",
      label: "回测0交易",
      detail: reason,
    });
  }
  return items.slice(0, 5);
}

function signalTone(signal: ChartSignalMarker) {
  if (signal.direction === "risk") return "risk";
  if (signal.direction === "opportunity") return "opportunity";
  return "neutral";
}

function signalMarkerLabel(signal: ChartSignalMarker) {
  if (signal.direction === "risk") return "卖";
  if (signal.direction === "opportunity") return "买";
  return "察";
}

function signalDirectionLabel(direction?: string) {
  if (direction === "risk") return "风险/卖出";
  if (direction === "opportunity") return "机会/买入";
  return "观察";
}

function summarizeSignals(signals: ChartSignalMarker[]) {
  return signals.reduce(
    (acc, signal) => {
      if (signal.direction === "risk") acc.risk += 1;
      else if (signal.direction === "opportunity") acc.opportunity += 1;
      else acc.neutral += 1;
      return acc;
    },
    { opportunity: 0, risk: 0, neutral: 0 },
  );
}

function isFiniteNumber(value?: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function rsiStateLabel(value?: number | null) {
  if (!isFiniteNumber(value)) return "RSI缺失";
  if (value >= 80) return "极度超买";
  if (value >= 70) return "超买区";
  if (value >= 55) return "强势区";
  if (value >= 45) return "中性区";
  if (value >= 30) return "弱势区";
  return "超卖区";
}

function relationLabel(left?: number | null, right?: number | null, unit = "") {
  if (!isFiniteNumber(left) || !isFiniteNumber(right)) return "-";
  const prefix = left >= right ? "高于" : "低于";
  return `${prefix} ${formatNumber(Math.abs(left - right), 2)}${unit}`;
}

function makeDecisionCheck(label: string, value: string, active: boolean, available = true): DecisionCheck {
  return {
    label,
    value: available ? value : "-",
    active: available && active,
  };
}

function buildTradeDecision(
  signal: ChartSignalMarker | null,
  indicators?: TradingIndicatorSnapshot | null,
) {
  const close = indicators?.close;
  const ma5 = indicators?.ma5;
  const ma20 = indicators?.ma20;
  const ma60 = indicators?.ma60;
  const dif = indicators?.dif;
  const dea = indicators?.dea;
  const macd = indicators?.macd;
  const rsi14 = indicators?.rsi14;
  const volumeRatio = indicators?.volumeRatio;
  const changePct = indicators?.changePct;

  const hasCloseMa20 = isFiniteNumber(close) && isFiniteNumber(ma20);
  const hasMa5Ma20 = isFiniteNumber(ma5) && isFiniteNumber(ma20);
  const hasMacd = isFiniteNumber(dif) && isFiniteNumber(dea) && isFiniteNumber(macd);
  const hasRsi = isFiniteNumber(rsi14);
  const hasVolumeRatio = isFiniteNumber(volumeRatio);
  const hasDownVolume = hasVolumeRatio && isFiniteNumber(changePct);

  const buyChecks: DecisionCheck[] = [
    makeDecisionCheck("收盘站上MA20", relationLabel(close, ma20), hasCloseMa20 && close > ma20, hasCloseMa20),
    makeDecisionCheck("MA5强于MA20", relationLabel(ma5, ma20), hasMa5Ma20 && ma5 > ma20, hasMa5Ma20),
    makeDecisionCheck(
      "MACD多头扩张",
      hasMacd ? `DIF ${formatNumber(dif, 2)} / DEA ${formatNumber(dea, 2)}` : "-",
      hasMacd && dif > dea && macd > 0,
      hasMacd,
    ),
    makeDecisionCheck(
      "RSI健康强势",
      rsiStateLabel(rsi14),
      hasRsi && rsi14 >= 45 && rsi14 <= 70,
      hasRsi,
    ),
    makeDecisionCheck(
      "量能确认",
      hasVolumeRatio ? `${formatNumber(volumeRatio, 2)}x` : "-",
      hasVolumeRatio && volumeRatio >= 1.1,
      hasVolumeRatio,
    ),
  ];

  const sellChecks: DecisionCheck[] = [
    makeDecisionCheck("收盘跌破MA20", relationLabel(close, ma20), hasCloseMa20 && close < ma20, hasCloseMa20),
    makeDecisionCheck("MA5弱于MA20", relationLabel(ma5, ma20), hasMa5Ma20 && ma5 < ma20, hasMa5Ma20),
    makeDecisionCheck(
      "MACD空头扩张",
      hasMacd ? `DIF ${formatNumber(dif, 2)} / DEA ${formatNumber(dea, 2)}` : "-",
      hasMacd && dif < dea && macd < 0,
      hasMacd,
    ),
    makeDecisionCheck(
      "RSI过热或转弱",
      rsiStateLabel(rsi14),
      hasRsi && (rsi14 >= 75 || rsi14 < 40),
      hasRsi,
    ),
    makeDecisionCheck(
      "放量下跌",
      hasDownVolume ? `${formatSignedPercent(changePct)} / ${formatNumber(volumeRatio, 2)}x` : "-",
      hasDownVolume && changePct < 0 && volumeRatio >= 1.15,
      hasDownVolume,
    ),
  ];

  const buyScore = buyChecks.filter((item) => item.active).length;
  const sellScore = sellChecks.filter((item) => item.active).length;
  let tone: DecisionTone = "neutral";
  let label = "观察 / 等待确认";
  if (signal?.direction === "opportunity") {
    tone = "opportunity";
    label = "买入信号";
  } else if (signal?.direction === "risk") {
    tone = "risk";
    label = "卖出 / 减仓信号";
  } else if (buyScore >= 4 && sellScore <= 1) {
    tone = "opportunity";
    label = "买入条件占优";
  } else if (sellScore >= 3) {
    tone = "risk";
    label = "卖出压力占优";
  }

  const summary =
    signal
      ? `${signalDateLabel(signal)} ${signal.signal_level || "-"}级，评分 ${formatNumber(signal.score, 1)}；当前买入确认 ${buyScore}/5，卖出压力 ${sellScore}/5。`
      : `当前买入确认 ${buyScore}/5，卖出压力 ${sellScore}/5；暂无落图信号。`;

  return { buyChecks, sellChecks, buyScore, sellScore, tone, label, summary };
}

function MarketReadoutStat({
  label,
  value,
  sub,
  tone = "flat",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className={`market-readout-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{sub}</em>
    </div>
  );
}

function DecisionChecklist({
  title,
  tone,
  checks,
}: {
  title: string;
  tone: DecisionTone;
  checks: DecisionCheck[];
}) {
  return (
    <div className={`decision-checklist ${tone}`}>
      <div className="decision-checklist-head">
        <strong>{title}</strong>
        <span>{checks.filter((check) => check.active).length}/{checks.length}</span>
      </div>
      {checks.map((check) => (
        <p className={check.active ? "active" : ""} key={check.label}>
          <span>{check.label}</span>
          <strong>{check.value}</strong>
          <i>{check.active ? "触发" : "未触发"}</i>
        </p>
      ))}
    </div>
  );
}

function realtimeStatusLabel(status: string) {
  if (status === "live") return "准实时";
  if (status === "fallback") return "日线回退";
  return "不可用";
}

function formatRealtimeClock(value?: string | null) {
  if (!value || value === "-") return "-";
  if (value.includes("T")) return value.slice(11, 19);
  return value.slice(0, 19);
}

function buildIntradayGeometry(points: IntradayPoint[], prevClose?: number | null) {
  const PLOT_LEFT = 48;
  const PLOT_RIGHT = 918;
  const AXIS_X = 932;
  const PRICE_TOP = 26;
  const PRICE_BOTTOM = 230;
  const VOLUME_TOP = 266;
  const VOLUME_BOTTOM = 334;
  const validPoints = points.filter((point) => isFiniteNumber(point.price));
  if (validPoints.length === 0) {
    return {
      points: [],
      priceLine: "",
      volumeBars: [],
      priceTicks: [],
      prevCloseY: null as number | null,
      latest: null as { x: number; y: number; price: number; time: string } | null,
      plotLeft: PLOT_LEFT,
      plotRight: PLOT_RIGHT,
      axisX: AXIS_X,
    };
  }
  const prices = validPoints.map((point) => Number(point.price));
  if (isFiniteNumber(prevClose)) prices.push(prevClose);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = Math.max((maxPrice - minPrice) * 0.08, maxPrice * 0.002, 0.01);
  const domainMin = minPrice - padding;
  const domainMax = maxPrice + padding;
  const priceSpan = domainMax - domainMin || 1;
  const maxVolume = Math.max(...validPoints.map((point) => Number(point.volume || 0)), 1);
  const xOf = (index: number) =>
    PLOT_LEFT + (index / Math.max(validPoints.length - 1, 1)) * (PLOT_RIGHT - PLOT_LEFT);
  const yOf = (price: number) =>
    PRICE_BOTTOM - ((price - domainMin) / priceSpan) * (PRICE_BOTTOM - PRICE_TOP);
  const priceTicks = [
    { label: "high", value: domainMax, y: yOf(domainMax) },
    { label: "mid", value: domainMin + priceSpan / 2, y: yOf(domainMin + priceSpan / 2) },
    { label: "low", value: domainMin, y: yOf(domainMin) },
  ];
  const priceLine = validPoints
    .map((point, index) => `${xOf(index).toFixed(2)},${yOf(Number(point.price)).toFixed(2)}`)
    .join(" ");
  const barWidth = Math.max(1.2, Math.min(5, 620 / validPoints.length));
  const volumeBars = validPoints.map((point, index) => {
    const height = Math.max(1, (Number(point.volume || 0) / maxVolume) * (VOLUME_BOTTOM - VOLUME_TOP));
    const previous = index > 0 ? Number(validPoints[index - 1].price || point.price) : Number(point.price);
    return {
      time: point.time,
      x: xOf(index) - barWidth / 2,
      y: VOLUME_BOTTOM - height,
      width: barWidth,
      height,
      tone: Number(point.price) >= previous ? "positive" : "negative",
    };
  });
  const latestPoint = validPoints[validPoints.length - 1];
  const latest = {
    x: xOf(validPoints.length - 1),
    y: yOf(Number(latestPoint.price)),
    price: Number(latestPoint.price),
    time: latestPoint.time,
  };

  return {
    points: validPoints,
    priceLine,
    volumeBars,
    priceTicks,
    prevCloseY: isFiniteNumber(prevClose) ? yOf(prevClose) : null,
    latest,
    plotLeft: PLOT_LEFT,
    plotRight: PLOT_RIGHT,
    axisX: AXIS_X,
  };
}

function MiniChartStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export async function fetchQuotes(symbols: string[]) {
  if (symbols.length === 0) return [];
  const params = new URLSearchParams({ symbols: symbols.join(",") });
  const response = await fetch(`/api/market/quotes?${params.toString()}`);
  const payload = (await response.json()) as ApiResponse<QuotePayload>;
  return payload.success ? payload.data.quotes : [];
}
