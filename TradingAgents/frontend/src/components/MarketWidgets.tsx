import { type ChangeEvent, type KeyboardEvent, type MouseEvent, type WheelEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  IntradayPayload,
  IntradayPoint,
  MarketHistoryBar,
  MarketQuote,
  RealtimeQuote,
  RealtimeQuotePayload,
} from "../types/market";
import {
  buildAdvancedIndicators,
  buildIndicatorSectionLayout,
  buildMomentumIndicators,
  buildVolumeProfile,
  type VolumeProfileModel,
} from "./TradingSignalKline.helpers";
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

type QuoteSortKey = "symbol" | "price" | "change_pct" | "volume" | "freshness";
type SortDirection = "asc" | "desc";
type CandleRange = "60" | "120" | "260" | "520" | "780" | "all";
type CandlePeriod = "daily" | "weekly" | "monthly";
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
  kdjK?: number | null;
  kdjD?: number | null;
  kdjJ?: number | null;
  bollUpper?: number | null;
  bollMid?: number | null;
  bollLower?: number | null;
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
  vwap: boolean;
  levels: boolean;
  signals: boolean;
  relative: boolean;
  profile: boolean;
  volume: boolean;
  macd: boolean;
  rsi: boolean;
  kdj: boolean;
  advanced: boolean;
  momentum: boolean;
  subCharts: boolean;
  measure: boolean;
}

interface TradingChartParameters {
  maFast: number;
  maMid: number;
  maSlow: number;
  bollPeriod: number;
  bollMultiplier: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  rsiPeriod: number;
  kdjPeriod: number;
  crPeriod: number;
  emvPeriod: number;
  momentumPeriod: number;
  atrPeriod: number;
}

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
  { key: "daily", label: "日线", unit: "日线", shortUnit: "日" },
  { key: "weekly", label: "周线", unit: "周线", shortUnit: "周" },
  { key: "monthly", label: "月线", unit: "月线", shortUnit: "月" },
];

const DEFAULT_TRADING_CHART_PREFS: TradingChartPreferences = {
  ma: true,
  ema: false,
  boll: true,
  vwap: false,
  levels: true,
  signals: true,
  relative: false,
  profile: true,
  volume: true,
  macd: true,
  rsi: true,
  kdj: true,
  advanced: true,
  momentum: true,
  subCharts: true,
  measure: false,
};

const DEFAULT_TRADING_CHART_PARAMS: TradingChartParameters = {
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
  atrPeriod: 14,
};

function isCandleRange(value: unknown): value is CandleRange {
  return CANDLE_RANGES.some((item) => item.key === value);
}

function isCandlePeriod(value: unknown): value is CandlePeriod {
  return CANDLE_PERIODS.some((item) => item.key === value);
}

function normalizeTradingChartPrefs(value: unknown): TradingChartPreferences {
  if (!value || typeof value !== "object") return DEFAULT_TRADING_CHART_PREFS;
  const next = value as Partial<Record<keyof TradingChartPreferences, unknown>>;
  return {
    ma: typeof next.ma === "boolean" ? next.ma : DEFAULT_TRADING_CHART_PREFS.ma,
    ema: typeof next.ema === "boolean" ? next.ema : DEFAULT_TRADING_CHART_PREFS.ema,
    boll: typeof next.boll === "boolean" ? next.boll : DEFAULT_TRADING_CHART_PREFS.boll,
    vwap: typeof next.vwap === "boolean" ? next.vwap : DEFAULT_TRADING_CHART_PREFS.vwap,
    levels: typeof next.levels === "boolean" ? next.levels : DEFAULT_TRADING_CHART_PREFS.levels,
    signals: typeof next.signals === "boolean" ? next.signals : DEFAULT_TRADING_CHART_PREFS.signals,
    relative: typeof next.relative === "boolean" ? next.relative : DEFAULT_TRADING_CHART_PREFS.relative,
    profile: typeof next.profile === "boolean" ? next.profile : DEFAULT_TRADING_CHART_PREFS.profile,
    volume: typeof next.volume === "boolean" ? next.volume : DEFAULT_TRADING_CHART_PREFS.volume,
    macd: typeof next.macd === "boolean" ? next.macd : DEFAULT_TRADING_CHART_PREFS.macd,
    rsi: typeof next.rsi === "boolean" ? next.rsi : DEFAULT_TRADING_CHART_PREFS.rsi,
    kdj: typeof next.kdj === "boolean" ? next.kdj : DEFAULT_TRADING_CHART_PREFS.kdj,
    advanced: typeof next.advanced === "boolean" ? next.advanced : DEFAULT_TRADING_CHART_PREFS.advanced,
    momentum: typeof next.momentum === "boolean" ? next.momentum : DEFAULT_TRADING_CHART_PREFS.momentum,
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
    bollPeriod: boundedInteger(next.bollPeriod, 10, 80, DEFAULT_TRADING_CHART_PARAMS.bollPeriod),
    bollMultiplier: boundedNumber(next.bollMultiplier, 1, 4, DEFAULT_TRADING_CHART_PARAMS.bollMultiplier),
    macdFast: boundedInteger(next.macdFast, 5, 24, DEFAULT_TRADING_CHART_PARAMS.macdFast),
    macdSlow: boundedInteger(next.macdSlow, 18, 60, DEFAULT_TRADING_CHART_PARAMS.macdSlow),
    macdSignal: boundedInteger(next.macdSignal, 4, 20, DEFAULT_TRADING_CHART_PARAMS.macdSignal),
    rsiPeriod: boundedInteger(next.rsiPeriod, 5, 40, DEFAULT_TRADING_CHART_PARAMS.rsiPeriod),
    kdjPeriod: boundedInteger(next.kdjPeriod, 5, 40, DEFAULT_TRADING_CHART_PARAMS.kdjPeriod),
    crPeriod: boundedInteger(next.crPeriod, 5, 80, DEFAULT_TRADING_CHART_PARAMS.crPeriod),
    emvPeriod: boundedInteger(next.emvPeriod, 5, 60, DEFAULT_TRADING_CHART_PARAMS.emvPeriod),
    momentumPeriod: boundedInteger(next.momentumPeriod, 5, 60, DEFAULT_TRADING_CHART_PARAMS.momentumPeriod),
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
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [message, setMessage] = useState("读取中");

  const load = async () => {
    try {
      const response = await fetch("/api/market/pulse");
      const payload = (await response.json()) as ApiResponse<PulseLite>;
      if (payload.success) {
        setQuotes(payload.data.quotes.filter((quote) => quote.status === "ok").slice(0, 10));
        setMessage(payload.data.quotes.length ? "" : "暂无行情");
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
          <em className={`freshness-dot ${freshnessTone(quote.freshness_status)}`} />
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

export function RealtimeMarketPanel({ symbol }: { symbol: string }) {
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
      setMessage(nextQuote?.status_text || nextIntraday?.status_text || "准实时行情已更新");
    } catch {
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
              {CANDLE_PERIODS.map((item) => (
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
  strategyAnalysis,
  strategyControls,
  selectedSignalId,
  onSelectSignal,
}: {
  bars: MarketHistoryBar[];
  signals?: ChartSignalMarker[];
  strategyAnalysis?: StrategyKlineAnalysis | null;
  strategyControls?: StrategyKlineControls;
  selectedSignalId?: string | null;
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
  const [expanded, setExpanded] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [hoveredSignalId, setHoveredSignalId] = useState<string | null>(null);
  const [hoveredTradePlanLevelKey, setHoveredTradePlanLevelKey] = useState<string | null>(null);
  const [rightOffset, setRightOffset] = useState(0);
  const [measureStartIndex, setMeasureStartIndex] = useState<number | null>(null);
  const [measureEndIndex, setMeasureEndIndex] = useState<number | null>(null);
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
  const strategySignal = useMemo(
    () => buildStrategyChartSignal(strategyAnalysis, safeBars),
    [safeBars, strategyAnalysis],
  );
  const mergedSignals = useMemo(
    () => mergeStrategySignals(safeSignals, strategySignal),
    [safeSignals, strategySignal],
  );
  const periodData = useMemo(() => preparePeriodChartData(safeBars, mergedSignals, period), [safeBars, mergedSignals, period]);
  const strategyLevelPrices = useMemo(() => extractStrategyLevelPrices(strategyAnalysis), [strategyAnalysis]);
  const chart = useMemo(
    () => buildTradingSignalGeometry(
      periodData.bars,
      periodData.signals,
      range,
      rightOffset,
      chartParams,
      strategyLevelPrices,
      chartPrefs.subCharts,
    ),
    [chartParams, chartPrefs.subCharts, periodData, range, rightOffset, strategyLevelPrices],
  );
  const chartMarkers = chart.markers || [];
  const tradePlanLevels = useMemo(
    () => buildTradePlanLevels(strategyAnalysis, chart),
    [chart, strategyAnalysis],
  );
  const chartDiagnostics = useMemo(
    () => buildChartDiagnostics(strategyAnalysis, strategyControls?.backtest),
    [strategyAnalysis, strategyControls?.backtest],
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
  const activeSignal =
    activeMarker?.signal ||
    strategySignal ||
    mergedSignals[0] ||
    null;
  const activeIndicators = activeMarker?.indicators || chart.latestIndicators;
  const readoutIndicators = crosshair?.candle?.indicators || chart.latestIndicators;
  const measuredRange = useMemo(
    () => buildMeasureRange(
      chart.candles,
      measureStartIndex,
      measureEndIndex ?? crosshair?.candle?.index ?? null,
    ),
    [chart.candles, crosshair?.candle?.index, measureEndIndex, measureStartIndex],
  );
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
  }, [chartPrefs.measure]);

  const setRangeFromControl = (nextRange: CandleRange) => {
    setRange(nextRange);
    setRightOffset((value) => Math.min(value, maxRightOffsetForRange(periodData.bars.length, nextRange)));
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

  const toggleChartPref = (key: keyof TradingChartPreferences) => {
    setChartPrefs((value) => ({
      ...value,
      [key]: !value[key],
    }));
  };

  const resetChartPrefs = () => {
    setChartPrefs(DEFAULT_TRADING_CHART_PREFS);
    setChartParams(DEFAULT_TRADING_CHART_PARAMS);
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

  const handleMarkerKey = (event: KeyboardEvent<SVGGElement>, signalId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseSignal(signalId);
    }
  };
  const nearestChartPoint = (event: MouseEvent<SVGSVGElement>) => {
    if (chart.candles.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 1000;
    const y = ((event.clientY - rect.top) / rect.height) * 720;
    if (x < chart.plotLeft || x > chart.plotRight || y < chart.sections[0].top || y > chart.signalLaneY) {
      return null;
    }
    const candle = chart.candles.reduce((closest, item) =>
      Math.abs(item.x - x) < Math.abs(closest.x - x) ? item : closest,
    );
    return { candle, x, y };
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
      labelX: point.candle.x > chart.plotRight - 220 ? point.candle.x - 218 : point.candle.x + 14,
      price: chartPriceFromY(chart, point.y),
      candle: point.candle,
    });
  };

  const handleChartClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!chartPrefs.measure) return;
    const point = nearestChartPoint(event);
    if (!point) return;
    setMeasureStartIndex((currentStart) => {
      if (currentStart == null || measureEndIndex != null) {
        setMeasureEndIndex(null);
        return point.candle.index;
      }
      setMeasureEndIndex(point.candle.index);
      return currentStart;
    });
  };

  return (
    <div className={`chart-panel trade-signal-panel ${expanded ? "expanded" : ""}`}>
      <div className="chart-title terminal-chart-title">
        <div>
          <strong>V2策略信号K线</strong>
          <span>
            {chart.visibleCount || periodData.bars.length} / {periodData.bars.length} 根{periodData.unit} ·{" "}
            {period === "daily" ? `${safeBars.length} 根日线` : `由 ${safeBars.length} 根日线聚合`} ·{" "}
            策略口径 周线趋势 + 日线执行 ·{" "}
            V2主信号 {strategySignal ? "已接入" : "未生成"} · 历史信号 {safeSignals.length} ·{" "}
            机会 {summary.opportunity} / 风险 {summary.risk} · {rightOffset > 0 ? `向前平移 ${rightOffset} 根` : "最新区间"}
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

      <div className="chart-tool-strip" aria-label="交易信号K线指标与工具">
        <span>指标·主图</span>
        <button className={chartPrefs.ma ? "active" : ""} onClick={() => toggleChartPref("ma")} type="button">MA</button>
        <button className={chartPrefs.ema ? "active" : ""} onClick={() => toggleChartPref("ema")} type="button">EMA</button>
        <button className={chartPrefs.boll ? "active" : ""} onClick={() => toggleChartPref("boll")} type="button">BOLL</button>
        <button className={chartPrefs.vwap ? "active" : ""} onClick={() => toggleChartPref("vwap")} type="button">VWAP</button>
        <button className={chartPrefs.levels ? "active" : ""} onClick={() => toggleChartPref("levels")} type="button">价位线</button>
        <button className={chartPrefs.signals ? "active" : ""} onClick={() => toggleChartPref("signals")} type="button">信号</button>
        <button className={chartPrefs.relative ? "active" : ""} onClick={() => toggleChartPref("relative")} type="button">相对</button>
        <button className={chartPrefs.profile ? "active" : ""} onClick={() => toggleChartPref("profile")} type="button">筹码</button>
        <span>指标·副图</span>
        <button className={chartPrefs.volume ? "active" : ""} onClick={() => toggleChartPref("volume")} type="button">VOL</button>
        <button className={chartPrefs.macd ? "active" : ""} onClick={() => toggleChartPref("macd")} type="button">MACD</button>
        <button className={chartPrefs.rsi ? "active" : ""} onClick={() => toggleChartPref("rsi")} type="button">RSI</button>
        <button className={chartPrefs.kdj ? "active" : ""} onClick={() => toggleChartPref("kdj")} type="button">KDJ</button>
        <button className={chartPrefs.advanced ? "active" : ""} onClick={() => toggleChartPref("advanced")} type="button">CR/ARBR/EMV</button>
        <button className={chartPrefs.momentum ? "active" : ""} onClick={() => toggleChartPref("momentum")} type="button">DMI/CCI/WR</button>
        <button className={chartPrefs.subCharts ? "active" : ""} onClick={() => toggleChartPref("subCharts")} type="button">分屏</button>
        <button className={chartPrefs.measure ? "active measure" : "measure"} onClick={() => toggleChartPref("measure")} type="button">测距</button>
        <button className={paramsOpen ? "active" : ""} onClick={() => setParamsOpen((value) => !value)} type="button">参数</button>
        <button onClick={resetChartPrefs} type="button">重置</button>
      </div>

      {paramsOpen && (
        <div className="chart-param-panel" aria-label="交易信号K线指标参数">
          <ChartParamInput label="MA快" value={chartParams.maFast} onChange={updateChartParam("maFast")} />
          <ChartParamInput label="MA中" value={chartParams.maMid} onChange={updateChartParam("maMid")} />
          <ChartParamInput label="MA慢" value={chartParams.maSlow} onChange={updateChartParam("maSlow")} />
          <ChartParamInput label="BOLL周期" value={chartParams.bollPeriod} onChange={updateChartParam("bollPeriod")} />
          <ChartParamInput label="BOLL倍数" value={chartParams.bollMultiplier} step="0.1" onChange={updateChartParam("bollMultiplier")} />
          <ChartParamInput label="MACD快" value={chartParams.macdFast} onChange={updateChartParam("macdFast")} />
          <ChartParamInput label="MACD慢" value={chartParams.macdSlow} onChange={updateChartParam("macdSlow")} />
          <ChartParamInput label="MACD信号" value={chartParams.macdSignal} onChange={updateChartParam("macdSignal")} />
          <ChartParamInput label="RSI" value={chartParams.rsiPeriod} onChange={updateChartParam("rsiPeriod")} />
          <ChartParamInput label="KDJ" value={chartParams.kdjPeriod} onChange={updateChartParam("kdjPeriod")} />
          <ChartParamInput label="CR/ARBR" value={chartParams.crPeriod} onChange={updateChartParam("crPeriod")} />
          <ChartParamInput label="EMV均线" value={chartParams.emvPeriod} onChange={updateChartParam("emvPeriod")} />
          <ChartParamInput label="DMI/CCI/WR" value={chartParams.momentumPeriod} onChange={updateChartParam("momentumPeriod")} />
          <ChartParamInput label="ATR" value={chartParams.atrPeriod} onChange={updateChartParam("atrPeriod")} />
        </div>
      )}

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
          label="成交量 / 额"
          value={formatCompactNumber(readoutIndicators?.volume)}
          sub={formatMoney(readoutIndicators?.amount)}
        />
        <MarketReadoutStat
          label={`均线 ${chartParams.maFast}/${chartParams.maMid}`}
          value={`${formatNumber(readoutIndicators?.ma5, 2)} / ${formatNumber(readoutIndicators?.ma20, 2)}`}
          sub={`MA${chartParams.maSlow} ${formatNumber(readoutIndicators?.ma60, 2)} · MA120 ${formatNumber(readoutIndicators?.ma120, 2)}`}
        />
        <MarketReadoutStat
          label="EMA / VWAP"
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
          label={`RSI${chartParams.rsiPeriod} / 量比`}
          value={`${formatNumber(readoutIndicators?.rsi14, 1)} / ${formatNumber(readoutIndicators?.volumeRatio, 2)}`}
          sub={rsiStateLabel(readoutIndicators?.rsi14)}
        />
        <MarketReadoutStat
          label="BOLL"
          value={formatNumber(readoutIndicators?.bollMid, 2)}
          sub={`上 ${formatNumber(readoutIndicators?.bollUpper, 2)} / 下 ${formatNumber(readoutIndicators?.bollLower, 2)}`}
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
          label={`ATR${chartParams.atrPeriod} / OBV`}
          value={`${formatNumber(readoutIndicators?.atr, 2)} / ${formatCompactNumber(readoutIndicators?.obv)}`}
          sub="波动与量能累积"
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
      {chartDiagnostics.length > 0 && <ChartDiagnosticsStrip diagnostics={chartDiagnostics} />}
      {strategyAnalysis && strategyControls && (
        <StrategyWorkbenchControls analysis={strategyAnalysis} controls={strategyControls} />
      )}

      <div className="trade-signal-stage">
        <svg
          className={`price-history-chart trade-signal-chart ${chartPrefs.subCharts ? "split-indicators" : "compact-indicators"} ${dragStart.current ? "dragging" : ""} ${chartPrefs.measure ? "measuring" : ""}`}
          onMouseDown={(event) => {
            if (chartPrefs.measure) return;
            dragStart.current = { x: event.clientX, offset: rightOffset };
          }}
          onClick={handleChartClick}
          onMouseLeave={() => {
            dragStart.current = null;
            setCrosshair(null);
            setHoveredSignalId(null);
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
          {chart.sections.map((section) => (
            <g key={section.key}>
              <line className="indicator-section-line" x1={chart.plotLeft} x2={chart.plotRight} y1={section.bottom} y2={section.bottom} />
              <text className="indicator-label" x={chart.plotLeft} y={section.top + 16}>{section.label}</text>
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
                {formatNumber(tick.value, 2)}
              </text>
            </g>
          ))}
          <line className="rsi-threshold" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.rsi70Y} y2={chart.rsi70Y} />
          <line className="rsi-threshold" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.rsi30Y} y2={chart.rsi30Y} />
          <line className="macd-zero-line" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.macdZeroY} y2={chart.macdZeroY} />
          <line className="signal-lane" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.signalLaneY} y2={chart.signalLaneY} />
          {chartPrefs.levels && chart.prevCloseY != null && (
            <g className="prev-close-level">
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={chart.prevCloseY} y2={chart.prevCloseY} />
              <text x={chart.plotLeft + 8} y={Math.max(chart.sections[0].top + 14, chart.prevCloseY - 7)}>
                昨收 {formatNumber(chart.latestIndicators?.prevClose, 2)}
              </text>
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
              <polyline points={chart.relativeLine} />
              <text x={chart.plotRight - 112} y={Math.max(chart.sections[0].top + 16, chart.relativeZeroY - 8)}>
                相对 {formatSignedPercent(chart.relativeLatest)}
              </text>
            </g>
          )}
          {chartPrefs.profile && chart.volumeProfile.bins.length > 0 && (
            <VolumeProfileLayer chart={chart} profile={chart.volumeProfile} />
          )}
          {chart.timeTicks.map((tick) => (
            <text className="time-axis-label" key={`${tick.label}-${tick.x}`} x={tick.x} y={chart.timeAxisY}>
              {tick.label}
            </text>
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
          {chartPrefs.kdj && chart.kdjKLine && <polyline className="indicator-line kdj-k" points={chart.kdjKLine} />}
          {chartPrefs.kdj && chart.kdjDLine && <polyline className="indicator-line kdj-d" points={chart.kdjDLine} />}
          {chartPrefs.kdj && chart.kdjJLine && <polyline className="indicator-line kdj-j" points={chart.kdjJLine} />}
          {chartPrefs.advanced && (
            <>
              <line className="advanced-indicator-baseline" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.advanced100Y} y2={chart.advanced100Y} />
              <line className="advanced-emv-zero-line" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.emvZeroY} y2={chart.emvZeroY} />
            </>
          )}
          {chartPrefs.advanced && chart.crLine && <polyline className="indicator-line cr" points={chart.crLine} />}
          {chartPrefs.advanced && chart.arLine && <polyline className="indicator-line ar" points={chart.arLine} />}
          {chartPrefs.advanced && chart.brLine && <polyline className="indicator-line br" points={chart.brLine} />}
          {chartPrefs.advanced && chart.emvLine && <polyline className="indicator-line emv" points={chart.emvLine} />}
          {chartPrefs.advanced && chart.emvMaLine && <polyline className="indicator-line emv-ma" points={chart.emvMaLine} />}
          {chartPrefs.momentum && <line className="momentum-zero-line" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.momentumZeroY} y2={chart.momentumZeroY} />}
          {chartPrefs.momentum && chart.pdiLine && <polyline className="indicator-line pdi" points={chart.pdiLine} />}
          {chartPrefs.momentum && chart.mdiLine && <polyline className="indicator-line mdi" points={chart.mdiLine} />}
          {chartPrefs.momentum && chart.adxLine && <polyline className="indicator-line adx" points={chart.adxLine} />}
          {chartPrefs.momentum && chart.cciLine && <polyline className="indicator-line cci" points={chart.cciLine} />}
          {chartPrefs.momentum && chart.wrLine && <polyline className="indicator-line wr" points={chart.wrLine} />}
          {chartPrefs.boll && chart.bollUpper && <polyline className="boll-line upper" points={chart.bollUpper} />}
          {chartPrefs.boll && chart.bollMid && <polyline className="boll-line mid" points={chart.bollMid} />}
          {chartPrefs.boll && chart.bollLower && <polyline className="boll-line lower" points={chart.bollLower} />}
          {chartPrefs.vwap && chart.vwapLine && <polyline className="vwap-line" points={chart.vwapLine} />}
          {chartPrefs.ema && chart.emaFastLine && <polyline className="ema-line fast" points={chart.emaFastLine} />}
          {chartPrefs.ema && chart.emaSlowLine && <polyline className="ema-line slow" points={chart.emaSlowLine} />}
          {chartPrefs.ma && chart.ma5 && <polyline className="ma-line ma5" points={chart.ma5} />}
          {chartPrefs.ma && chart.ma20 && <polyline className="ma-line ma20" points={chart.ma20} />}
          {chartPrefs.ma && chart.ma60 && <polyline className="ma-line ma60" points={chart.ma60} />}
          {chartPrefs.ma && chart.ma120 && <polyline className="ma-line ma120" points={chart.ma120} />}
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
              {chartPrefs.volume && (
                <rect
                  className="volume-bar"
                  x={candle.x - candle.width / 2}
                  y={candle.volumeY}
                  width={candle.width}
                  height={candle.volumeHeight}
                />
              )}
            </g>
          ))}
          {chartPrefs.volume && chart.volumeMa20Line && <polyline className="volume-ma-line" points={chart.volumeMa20Line} />}
          {chartPrefs.signals && chart.entryLinks.map((link) => (
            <g className="signal-entry-link" key={link.id}>
              <line x1={link.signalX} x2={link.entryX} y1={link.signalY} y2={link.entryY} />
              <circle cx={link.entryX} cy={link.entryY} r="4" />
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
          {measuredRange && (
            <g className={`chart-measure ${measuredRange.tone}`}>
              <line x1={measuredRange.start.x} x2={measuredRange.end.x} y1={measuredRange.start.closeY} y2={measuredRange.end.closeY} />
              <line x1={measuredRange.start.x} x2={measuredRange.start.x} y1={chart.sections[0].top} y2={chart.signalLaneY} />
              <line x1={measuredRange.end.x} x2={measuredRange.end.x} y1={chart.sections[0].top} y2={chart.signalLaneY} />
              <circle cx={measuredRange.start.x} cy={measuredRange.start.closeY} r="4" />
              <circle cx={measuredRange.end.x} cy={measuredRange.end.closeY} r="4" />
              <rect x={measuredRange.labelX} y={measuredRange.labelY - 28} width="184" height="48" rx="6" />
              <text x={measuredRange.labelX + 10} y={measuredRange.labelY - 9}>
                {measuredRange.bars}根 · {formatSignedPercent(measuredRange.changePct)}
              </text>
              <text x={measuredRange.labelX + 10} y={measuredRange.labelY + 10}>
                {formatNumber(measuredRange.start.close, 2)} → {formatNumber(measuredRange.end.close, 2)}
              </text>
            </g>
          )}
          {crosshair && !hoverSignalTooltip && !tradePlanTooltip && (
            <g className="chart-crosshair">
              <line x1={crosshair.x} x2={crosshair.x} y1={chart.sections[0].top} y2={chart.signalLaneY} />
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={crosshair.y} y2={crosshair.y} />
              <rect className="crosshair-price-tag" x={chart.axisX - 4} y={clampNumber(crosshair.y - 12, chart.sections[0].top + 2, chart.signalLaneY - 24)} width="58" height="22" rx="4" />
              <text className="crosshair-price-text" x={chart.axisX + 4} y={clampNumber(crosshair.y + 4, chart.sections[0].top + 18, chart.signalLaneY - 8)}>
                {formatNumber(crosshair.price, 2)}
              </text>
              <rect className="crosshair-date-tag" x={clampNumber(crosshair.x - 38, chart.plotLeft, chart.plotRight - 76)} y={chart.timeAxisY - 20} width="76" height="20" rx="4" />
              <text className="crosshair-date-text" x={clampNumber(crosshair.x, chart.plotLeft + 38, chart.plotRight - 38)} y={chart.timeAxisY - 5}>
                {shortDateLabel(crosshair.candle.periodLabel || crosshair.candle.date)}
              </text>
              <rect x={crosshair.labelX} y="52" width="254" height="174" rx="4" />
              <text x={crosshair.labelX + 12} y="76">{crosshair.candle.periodLabel || crosshair.candle.date}</text>
              <text x={crosshair.labelX + 12} y="98">周期 {periodData.unit} · 信号 {crosshairSignalCount}</text>
              <text x={crosshair.labelX + 12} y="120">O {formatNumber(crosshair.candle.open, 2)} H {formatNumber(crosshair.candle.high, 2)}</text>
              <text x={crosshair.labelX + 12} y="142">L {formatNumber(crosshair.candle.low, 2)} C {formatNumber(crosshair.candle.close, 2)}</text>
              <text x={crosshair.labelX + 12} y="164">
                涨跌 {formatSignedNumber(crosshair.candle.indicators.change, 2)} / {formatSignedPercent(crosshair.candle.indicators.changePct)}
              </text>
              <text x={crosshair.labelX + 12} y="186">量 {formatCompactNumber(crosshair.candle.volume)} · 额 {formatMoney(crosshair.candle.amount)}</text>
              <text x={crosshair.labelX + 12} y="208">RSI {formatNumber(crosshair.candle.indicators.rsi14, 1)} · MACD {formatNumber(crosshair.candle.indicators.macd, 2)} · ATR {formatNumber(crosshair.candle.indicators.atr, 2)}</text>
            </g>
          )}
          {chart.candles.length === 0 && <text x="3" y="104">暂无历史行情</text>}
        </svg>

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
                  <MiniChartStat label="RSI14" value={formatNumber(activeIndicators?.rsi14, 1)} />
                  <MiniChartStat label="量比" value={formatNumber(activeIndicators?.volumeRatio, 2)} />
                  <MiniChartStat label="BOLL中轨" value={formatNumber(activeIndicators?.bollMid, 2)} />
                  <MiniChartStat label="KDJ J" value={formatNumber(activeIndicators?.kdjJ, 1)} />
                  <MiniChartStat label="DMI+/DMI-" value={`${formatNumber(activeIndicators?.pdi, 1)} / ${formatNumber(activeIndicators?.mdi, 1)}`} />
                  <MiniChartStat label="CCI / WR" value={`${formatNumber(activeIndicators?.cci, 1)} / ${formatNumber(activeIndicators?.wr, 1)}`} />
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
        <span><i className="legend-line macd" />MACD/RSI</span>
        <span><i className="legend-line advanced" />CR/ARBR/EMV</span>
        <span><i className="legend-line momentum" />DMI/CCI/WR</span>
        <span><i className="legend-line profile" />筹码分布</span>
        <span><i className="legend-marker" />信号日至入场日</span>
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
  return (
    <g className="volume-profile-layer">
      <rect className="volume-profile-panel" x={panelLeft - 8} y={chart.priceTop + 2} width={panelWidth + 14} height={chart.priceBottom - chart.priceTop - 4} rx="8" />
      <text className="volume-profile-title" x={panelLeft} y={chart.priceTop + 18}>筹码分布</text>
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
  const reasons = buildStrategyCriticalReasons(analysis, technicalDecision, steps);
  const action = analysis.sell_signal?.warning_level?.action || analysis.trend_state?.action || analysis.decision.action || "-";

  return (
    <div className={`strategy-decision-workbench ${tone}`} aria-label="V2策略决策台">
      <section className="strategy-decision-primary">
        <span className="eyebrow">V2 Decision</span>
        <h3>{analysis.decision.label}</h3>
        <p>
          {analysis.latest_bar?.date || "-"} · {analysis.symbol} · {strategyModeLabel(analysis.mode)} · {action}
        </p>
        <div className="strategy-critical-list">
          {reasons.map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
        <div className="strategy-score-strip">
          <span>S_buy <b>{formatNumber(analysis.buy_signal?.score, 3)}</b></span>
          <span>S_sell <b>{formatNumber(analysis.sell_signal?.score, 2)}</b></span>
          <span>买入确认 <b>{technicalDecision.buyScore}/5</b></span>
          <span>卖出压力 <b>{technicalDecision.sellScore}/5</b></span>
        </div>
      </section>

      <section className="strategy-decision-chain" aria-label="M1-M5决策链">
        <div className="section-subhead">
          <h2>M1-M5 决策链</h2>
          <span className="muted">{steps.filter((step) => step.tone === "good").length}/{steps.length}</span>
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
          <h2>指标与风控快照</h2>
          <span className="muted">辅助读数</span>
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
  const trendStrength = analysis.trend_state?.strength;
  const trendText = `${trendLabel} · 强度 ${formatNumber(trendStrength, 2)} · ${analysis.trend_state?.sample_count || 0}周`;
  const trendGood = /多|强|bull|up/i.test(trendLabel);
  const trendBad = /空|弱|bear|down/i.test(trendLabel);
  const marketPassed = Boolean(analysis.market_filter?.passed);
  const buyTriggered = Boolean(analysis.buy_signal?.mode_signal);
  const warningLevel = analysis.sell_signal?.warning_level?.level || 0;
  const riskTriggered = Boolean(analysis.sell_signal?.emergency || analysis.sell_signal?.regular_exit || warningLevel > 0);
  const shares = analysis.position_plan?.suggested_shares || 0;

  return [
    {
      key: "M1",
      label: "周线趋势",
      status: trendGood ? "通过" : trendBad ? "阻断" : "观察",
      detail: analysis.trend_state?.action || trendText,
      tone: trendGood ? "good" : trendBad ? "bad" : "neutral",
    },
    {
      key: "M2",
      label: "大盘过滤",
      status: marketPassed ? "通过" : "未过",
      detail: `${analysis.market_filter?.status || "-"} · ${analysis.market_filter?.benchmark_symbol || "-"}`,
      tone: marketPassed ? "good" : "bad",
    },
    {
      key: "M3",
      label: "买入触发",
      status: buyTriggered ? "触发" : "未触发",
      detail: `S_buy=${formatNumber(analysis.buy_signal?.score, 3)} / 阈值 ${formatNumber(analysis.buy_signal?.threshold, 3)}`,
      tone: buyTriggered ? "good" : "bad",
    },
    {
      key: "M4",
      label: "卖出风险",
      status: riskTriggered ? analysis.sell_signal?.warning_level?.label || "风险触发" : "无预警",
      detail: `${analysis.sell_signal?.warning_level?.action || "暂无减仓信号"} · S_sell=${formatNumber(analysis.sell_signal?.score, 2)}`,
      tone: analysis.sell_signal?.emergency || analysis.sell_signal?.regular_exit ? "bad" : warningLevel > 0 ? "warn" : "good",
    },
    {
      key: "M5",
      label: "仓位约束",
      status: shares > 0 ? "可执行" : "0仓位",
      detail: `${formatCompactNumber(shares)} 股 · ${formatPercent(analysis.position_plan?.suggested_position_pct)} · 风险 ${formatPercent(analysis.position_plan?.risk_pct)}`,
      tone: shares > 0 ? "good" : "warn",
    },
  ];
}

function buildStrategySnapshotItems(
  analysis: StrategyKlineAnalysis,
  indicators?: TradingIndicatorSnapshot | null,
): StrategySnapshotItem[] {
  const channel = analysis.price_channels || {};
  return [
    {
      label: "DIF / DEA",
      value: `${formatNumber(indicators?.dif, 2)} / ${formatNumber(indicators?.dea, 2)}`,
      detail: "MACD 方向",
    },
    { label: "MACD柱", value: formatNumber(indicators?.macd, 2), detail: "动能扩散" },
    { label: "RSI14", value: formatNumber(indicators?.rsi14, 1), detail: "强弱区" },
    { label: "量比", value: formatNumber(indicators?.volumeRatio, 2), detail: "成交活跃度" },
    { label: "止损价", value: formatNumber(channel.stop_price, 2), detail: `距离 ${formatNumber(analysis.position_plan?.stop_distance, 2)}`, tone: "bad" },
    { label: "建议仓位", value: formatPercent(analysis.position_plan?.suggested_position_pct), detail: `${formatCompactNumber(analysis.position_plan?.suggested_shares)} 股`, tone: "good" },
    { label: "目标价", value: `${formatNumber(channel.target1, 2)} / ${formatNumber(channel.target2, 2)}`, detail: "分层止盈" },
    { label: "BOLL / KDJ", value: `${formatNumber(indicators?.bollMid, 2)} / ${formatNumber(indicators?.kdjJ, 1)}`, detail: "位置确认" },
  ];
}

function buildStrategyCriticalReasons(
  analysis: StrategyKlineAnalysis,
  technicalDecision: ReturnType<typeof buildTradeDecision>,
  steps: StrategyDecisionStep[],
) {
  const reasons = [
    ...(analysis.data_quality?.blocking_reasons || []),
    ...steps
      .filter((step) => step.tone === "bad" || step.tone === "warn")
      .map((step) => `${step.key} ${step.label}：${step.status}，${step.detail}`),
  ];

  if (analysis.sell_signal?.warning_level?.action) {
    reasons.push(`风险动作：${analysis.sell_signal.warning_level.action}`);
  }
  if (technicalDecision.sellScore > technicalDecision.buyScore) {
    reasons.push(`图表辅助偏风险：卖出压力 ${technicalDecision.sellScore}/5，高于买入确认 ${technicalDecision.buyScore}/5`);
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
  return (
    <div className={`strategy-kline-trace ${tone}`} aria-label="V2策略主信号解释">
      <div className="strategy-trace-decision">
        <span>V2主结论</span>
        <strong>{analysis.decision.label}</strong>
        <em>{analysis.sell_signal?.warning_level?.action || analysis.trend_state?.action || analysis.decision.action || "-"}</em>
      </div>
      <div className="strategy-trace-metrics">
        <StrategyTraceMetric
          label="M1 周线趋势"
          value={analysis.trend_state?.label || "-"}
          sub={`${formatNumber(analysis.trend_state?.strength, 2)} · ${analysis.trend_state?.sample_count || 0}周`}
        />
        <StrategyTraceMetric
          label="M2 大盘过滤"
          value={analysis.market_filter?.status || "-"}
          sub={`${analysis.market_filter?.benchmark_symbol || "-"} · ${analysis.market_filter?.passed ? "通过" : "未过"}`}
        />
        <StrategyTraceMetric
          label="M3 S_buy"
          value={formatNumber(analysis.buy_signal?.score, 3)}
          sub={analysis.buy_signal?.mode_signal ? "入场触发" : "未触发"}
        />
        <StrategyTraceMetric
          label="M4 S_sell"
          value={formatNumber(analysis.sell_signal?.score, 2)}
          sub={analysis.sell_signal?.warning_level?.label || "无预警"}
        />
        <StrategyTraceMetric
          label="M5 仓位约束"
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
  const checklist = analysis.checklist?.length
    ? analysis.checklist
    : [
      {
        label: "M1 趋势",
        passed: analysis.trend_state?.label?.includes("多") || analysis.trend_state?.label?.includes("强") || false,
        detail: analysis.trend_state?.action || analysis.trend_state?.label || "-",
      },
      {
        label: "M2 大盘",
        passed: Boolean(analysis.market_filter?.passed),
        detail: `${analysis.market_filter?.status || "-"} · ${analysis.market_filter?.benchmark_symbol || "-"}`,
      },
      {
        label: "M3 入场",
        passed: Boolean(analysis.buy_signal?.mode_signal),
        detail: `S_buy=${formatNumber(analysis.buy_signal?.score, 3)}`,
      },
      {
        label: "M4 出场",
        passed: Boolean(analysis.sell_signal?.regular_exit || analysis.sell_signal?.emergency),
        detail: `${analysis.sell_signal?.warning_level?.label || "-"} · S_sell=${formatNumber(analysis.sell_signal?.score, 2)}`,
      },
      {
        label: "M5 仓位",
        passed: Boolean((analysis.position_plan?.suggested_shares || 0) > 0),
        detail: `${formatCompactNumber(analysis.position_plan?.suggested_shares)} 股 · ${formatMoney(analysis.position_plan?.suggested_notional)}`,
      },
    ];

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
  return mode === "aggressive" ? "激进加权 S_buy" : "保守硬 AND";
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
  candles: { index: number; x: number; close: number; closeY: number }[],
  startIndex: number | null,
  endIndex: number | null,
) {
  if (startIndex == null || endIndex == null) return null;
  const start = candles.find((candle) => candle.index === startIndex);
  const end = candles.find((candle) => candle.index === endIndex);
  if (!start || !end) return null;
  const changePct = start.close ? end.close / start.close - 1 : null;
  const labelX = clampNumber((start.x + end.x) / 2 + 12, 56, 728);
  const labelY = clampNumber(Math.min(start.closeY, end.closeY) - 12, 82, 332);
  return {
    start,
    end,
    bars: Math.abs(end.index - start.index),
    changePct,
    labelX,
    labelY,
    tone: (changePct || 0) >= 0 ? "positive" : "negative",
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
  if (period === "daily") return date;
  if (period === "monthly") return date.slice(0, 7);
  const parsed = parseChartDate(date);
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - day + 1);
  return isoDate(parsed);
}

function preparePeriodChartData(
  bars: MarketHistoryBar[],
  signals: ChartSignalMarker[],
  period: CandlePeriod,
) {
  const unit = CANDLE_PERIODS.find((item) => item.key === period)?.unit || "日线";
  const orderedBars = [...bars]
    .filter((bar) => bar.date && typeof bar.close === "number")
    .sort((left, right) => left.date.localeCompare(right.date));
  if (period === "daily") {
    return { bars: orderedBars as PeriodMarketBar[], signals, unit };
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
    const periodLabel = period === "monthly"
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

  return { bars: periodBars, signals: periodSignals, unit };
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
  const SIGNAL_LANE_Y = layout.signalLaneY;
  const sections = layout.sections;
  const visible = sliceVisibleBars(bars, range, rightOffset).filter((bar) => typeof bar.close === "number");
  if (visible.length === 0) {
    return {
      candles: [],
      markers: [],
      entryLinks: [],
      ma5: "",
      ma20: "",
      ma60: "",
      ma120: "",
      emaFastLine: "",
      emaSlowLine: "",
      vwapLine: "",
      bollUpper: "",
      bollMid: "",
      bollLower: "",
      volumeMa20Line: "",
      macdBars: [],
      difLine: "",
      deaLine: "",
      rsiLine: "",
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
      relativeLine: "",
      relativeZeroY: (PRICE_TOP + PRICE_BOTTOM) / 2,
      relativeLatest: null as number | null,
      volumeProfile: buildVolumeProfile([], { currentPrice: null }),
      priceTicks: [],
      timeTicks: [],
      latestIndicators: null,
      prevCloseY: null as number | null,
      macdZeroY: (MACD_TOP + MACD_BOTTOM) / 2,
      advanced100Y: ADVANCED_BOTTOM - 0.5 * (ADVANCED_BOTTOM - ADVANCED_TOP),
      emvZeroY: ADVANCED_BOTTOM - 0.5 * (ADVANCED_BOTTOM - ADVANCED_TOP),
      momentumZeroY: MOMENTUM_BOTTOM - 0.5 * (MOMENTUM_BOTTOM - MOMENTUM_TOP),
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
  const macdFast = Math.min(params.macdFast, params.macdSlow - 1);
  const macdSlow = Math.max(params.macdSlow, macdFast + 1);
  const bollValues = bollNumberValues(closeValues, params.bollPeriod, params.bollMultiplier);
  const emaFastValues = emaNumberValues(closeValues, macdFast);
  const emaSlowValues = emaNumberValues(closeValues, macdSlow);
  const vwapValues = vwapNumberValues(visible);
  const bollDomainValues = bollValues.flatMap((value) =>
    value ? [value.upper, value.lower] : [],
  );
  const levelDomainValues = levelPrices.filter(isFiniteNumber);
  const overlayDomainValues = [
    ...bollDomainValues,
    ...emaFastValues,
    ...emaSlowValues,
    ...vwapValues.filter(isFiniteNumber),
    ...levelDomainValues,
  ];
  const minPrice = Math.min(...lowValues, ...overlayDomainValues);
  const maxPrice = Math.max(...highValues, ...overlayDomainValues);
  const priceSpan = maxPrice - minPrice || 1;
  const maxVolume = Math.max(...volumes, 1);
  const volumeY = (value?: number | null) =>
    VOLUME_BOTTOM - ((Number(value || 0) / maxVolume) * (VOLUME_BOTTOM - VOLUME_TOP));
  const candleWidth = Math.max(3.2, Math.min(9.5, 620 / visible.length));
  const dateIndex = new Map(visible.map((bar, index) => [bar.date, index]));
  const xOf = (index: number) => PLOT_LEFT + (index / Math.max(visible.length - 1, 1)) * (PLOT_RIGHT - PLOT_LEFT);
  const yOf = (price?: number | null) =>
    PRICE_BOTTOM - ((Number(price || minPrice) - minPrice) / priceSpan) * (PRICE_BOTTOM - PRICE_TOP);
  const priceTicks = [
    { label: "high", value: maxPrice, y: yOf(maxPrice) },
    { label: "mid", value: minPrice + priceSpan / 2, y: yOf(minPrice + priceSpan / 2) },
    { label: "low", value: minPrice, y: yOf(minPrice) },
  ];
  const maValue = (index: number, windowSize: number) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = visible.slice(start, index + 1);
    if (slice.length < Math.min(windowSize, 5)) return null;
    return slice.reduce((sum, item) => sum + Number(item.close || 0), 0) / slice.length;
  };
  const difValues = closeValues.map((_, index) => emaFastValues[index] - emaSlowValues[index]);
  const deaValues = emaNumberValues(difValues, params.macdSignal);
  const macdValues = difValues.map((value, index) => (value - deaValues[index]) * 2);
  const rsiValues = rsiNumberValues(closeValues, params.rsiPeriod);
  const kdjValues = kdjNumberValues(highValues, lowValues, closeValues, params.kdjPeriod);
  const atrValues = atrNumberValues(highValues, lowValues, closeValues, params.atrPeriod);
  const obvValues = obvNumberValues(closeValues, volumes);
  const advancedValues = buildAdvancedIndicators(visible, {
    period: params.crPeriod,
    emvPeriod: params.emvPeriod,
  });
  const momentumValues = buildMomentumIndicators(visible, {
    period: params.momentumPeriod,
  });
  const volumeMa20Values = volumes.map((_, index) => {
    const start = Math.max(0, index - 19);
    const slice = volumes.slice(start, index + 1);
    if (slice.length < 5) return null;
    return averageNumberValues(slice);
  });
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
  const relativeValues = closeValues.map((close) => (closeValues[0] ? close / closeValues[0] - 1 : 0));
  const maxRelativeAbs = Math.max(0.01, ...relativeValues.map(Math.abs));
  const relativeY = (value: number) =>
    PRICE_BOTTOM - (((value + maxRelativeAbs) / (maxRelativeAbs * 2)) * (PRICE_BOTTOM - PRICE_TOP));
  const volumeProfile = buildVolumeProfile(visible, {
    binCount: 24,
    currentPrice: closeValues[closeValues.length - 1],
  });

  const candles = visible.map((bar, index) => {
    const open = Number(bar.open ?? bar.close ?? 0);
    const close = Number(bar.close ?? open);
    const high = Number(bar.high ?? Math.max(open, close));
    const low = Number(bar.low ?? Math.min(open, close));
    const prevClose = index > 0 ? closeValues[index - 1] : null;
    const change = typeof prevClose === "number" ? close - prevClose : null;
    const changePct = prevClose ? close / prevClose - 1 : null;
    const amplitudePct = prevClose ? (high - low) / prevClose : null;
    const openY = yOf(open);
    const closeY = yOf(close);
    const volumeHeight = Math.max(1, (Number(bar.volume || 0) / maxVolume) * (VOLUME_BOTTOM - VOLUME_TOP));
    const ma5 = maValue(index, fastPeriod);
    const ma20 = maValue(index, midPeriod);
    const ma60 = maValue(index, slowPeriod);
    const ma120 = maValue(index, 120);
    const averageVolume20 = averageNumberValues(volumes.slice(Math.max(0, index - 19), index + 1));
    const volumeRatio = averageVolume20 ? Number(bar.volume || 0) / averageVolume20 : null;
    const advanced = advancedValues[index];
    const momentum = momentumValues[index];
    return {
      date: bar.date,
      periodLabel: bar.period_label,
      x: xOf(index),
      index,
      width: candleWidth,
      highY: yOf(high),
      lowY: yOf(low),
      bodyY: Math.min(openY, closeY),
      bodyHeight: Math.abs(openY - closeY),
      closeY: yOf(close),
      volumeY: VOLUME_BOTTOM - volumeHeight,
      volumeHeight,
      tone: close >= open ? "positive" : "negative",
      high,
      low,
      close,
      open,
      prevClose,
      volume: Number(bar.volume || 0),
      amount: Number(bar.amount || 0),
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
        emaFast: emaFastValues[index],
        emaSlow: emaSlowValues[index],
        vwap: vwapValues[index],
        dif: difValues[index],
        dea: deaValues[index],
        macd: macdValues[index],
        rsi14: rsiValues[index],
        kdjK: kdjValues[index]?.k ?? null,
        kdjD: kdjValues[index]?.d ?? null,
        kdjJ: kdjValues[index]?.j ?? null,
        bollUpper: bollValues[index]?.upper ?? null,
        bollMid: bollValues[index]?.mid ?? null,
        bollLower: bollValues[index]?.lower ?? null,
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
      },
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
  const bollLine = (key: "upper" | "mid" | "lower") =>
    indicatorPoints(bollValues.map((value) => value?.[key] ?? null), yOf);
  const kdjLine = (key: "k" | "d" | "j") =>
    indicatorPoints(kdjValues.map((value) => value?.[key] ?? null), rsiY);
  const relativeLine = indicatorPoints(relativeValues, relativeY);
  const volumeMa20Line = indicatorPoints(volumeMa20Values, volumeY);
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
  const timeTicks = buildTimeTicks(candles.map((candle) => ({
    x: candle.x,
    label: candle.periodLabel || candle.date,
  })));

  return {
    candles,
    markers,
    entryLinks,
    ma5: maPoints("ma5"),
    ma20: maPoints("ma20"),
    ma60: maPoints("ma60"),
    ma120: maPoints("ma120"),
    emaFastLine: indicatorPoints(emaFastValues, yOf),
    emaSlowLine: indicatorPoints(emaSlowValues, yOf),
    vwapLine: indicatorPoints(vwapValues, yOf),
    bollUpper: bollLine("upper"),
    bollMid: bollLine("mid"),
    bollLower: bollLine("lower"),
    volumeMa20Line,
    macdBars,
    difLine: indicatorPoints(difValues, macdY),
    deaLine: indicatorPoints(deaValues, macdY),
    rsiLine: indicatorPoints(rsiValues, rsiY),
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
    relativeLine,
    relativeZeroY: relativeY(0),
    relativeLatest: relativeValues[relativeValues.length - 1] ?? null,
    volumeProfile,
    priceTicks,
    timeTicks,
    latestIndicators: candles[candles.length - 1]?.indicators || null,
    prevCloseY: isFiniteNumber(candles[candles.length - 1]?.prevClose)
      ? yOf(candles[candles.length - 1].prevClose)
      : null,
    macdZeroY,
    advanced100Y: advancedY(100),
    emvZeroY,
    momentumZeroY: momentumY(0),
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

function atrNumberValues(highs: number[], lows: number[], closes: number[], period: number) {
  const trueRanges = highs.map((high, index) => {
    if (index === 0) return high - lows[index];
    const previousClose = closes[index - 1];
    return Math.max(high - lows[index], Math.abs(high - previousClose), Math.abs(lows[index] - previousClose));
  });
  return trueRanges.map((_, index) => {
    if (index < period - 1) return null;
    return averageNumberValues(trueRanges.slice(index - period + 1, index + 1));
  });
}

function obvNumberValues(closes: number[], volumes: number[]) {
  let obv = 0;
  return closes.map((close, index) => {
    if (index === 0) return obv;
    if (close > closes[index - 1]) obv += volumes[index] || 0;
    else if (close < closes[index - 1]) obv -= volumes[index] || 0;
    return obv;
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

function chartPriceToY(chart: Record<string, any>, price?: number | null) {
  if (!isFiniteNumber(price) || !isFiniteNumber(chart.priceMin) || !isFiniteNumber(chart.priceMax)) return null;
  const span = chart.priceMax - chart.priceMin || 1;
  return chart.priceBottom - ((price - chart.priceMin) / span) * (chart.priceBottom - chart.priceTop);
}

function chartPriceFromY(chart: Record<string, any>, y: number) {
  if (!isFiniteNumber(chart.priceMin) || !isFiniteNumber(chart.priceMax)) return null;
  const boundedY = clampNumber(y, chart.priceTop, chart.priceBottom);
  const span = chart.priceMax - chart.priceMin || 1;
  return chart.priceMin + ((chart.priceBottom - boundedY) / (chart.priceBottom - chart.priceTop)) * span;
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
    { label: "RSI/MACD", value: `${formatNumber(indicators.rsi14, 1)} / ${formatNumber(indicators.macd, 2)}` },
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
  if (analysis.market_filter && !analysis.market_filter.passed) {
    items.push({
      tone: "warn",
      label: "大盘过滤",
      detail: `${analysis.market_filter.benchmark_symbol || "-"} · ${analysis.market_filter.status || "未通过"}`,
    });
  }
  if (!analysis.buy_signal?.mode_signal) {
    items.push({
      tone: "neutral",
      label: "未触发买点",
      detail: `S_buy=${formatNumber(analysis.buy_signal?.score, 3)}，阈值 ${formatNumber(analysis.buy_signal?.threshold, 3)}`,
    });
  }
  if (analysis.sell_signal?.regular_exit || analysis.sell_signal?.emergency || (analysis.sell_signal?.warning_level?.level || 0) > 0) {
    items.push({
      tone: "bad",
      label: "卖出压力",
      detail: `${analysis.sell_signal?.warning_level?.label || "-"} · S_sell=${formatNumber(analysis.sell_signal?.score, 2)}`,
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
