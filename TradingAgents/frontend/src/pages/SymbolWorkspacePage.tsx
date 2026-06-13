import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  PriceHistoryChart,
  RealtimeMarketPanel,
  TradingSignalKlinePanel,
} from "../components/MarketWidgets";
import {
  buildReadableStrategyDecisionCopy,
  buildReadableStrategyGateText,
  type ReadableStrategyStepLike,
} from "../components/TradingSignalKline.helpers.js";
import FundamentalsPage from "./FundamentalsPage";
import NewsEvidencePage from "./NewsEvidencePage";
import { switchWorkspaceVersion } from "./symbol/featureFlag";
import {
  buildDisplayQuoteModel,
  buildWorkspaceLoadMessage,
  buildKlineEvidenceEvents,
  buildMarketAnalysisOverview as buildMarketAnalysisOverviewModel,
  buildWorkspaceDataStatusModel,
  buildWorkspaceNavigationModel,
  type KlineEvidenceEvent,
  type MarketAnalysisItem as OverviewItem,
  type MarketAnalysisOverviewModel as OverviewModel,
  type MarketAnalysisTechnicalChart,
  type RelativeStrengthTrendModel,
  type WorkspaceDataStatusModel,
  type WorkspaceNavigationItem,
  type WorkspaceNavigationModel,
} from "./SymbolWorkspacePage.helpers";
import type {
  IntradayPayload,
  MarketContextPayload,
  MarketHistoryBar,
  MarketHistoryPayload,
  MarketQuote,
  RealtimeQuote,
  RealtimeQuotePayload,
} from "../types/market";
import {
  formatCompactNumber,
  formatMoney,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  parseJsonList,
} from "../utils/formatters";

const today = new Date().toISOString().slice(0, 10);

type SymbolWorkspaceTab = "overview" | "chart" | "fundamentals" | "news" | "review" | "history";

const SYMBOL_WORKSPACE_TABS: { key: SymbolWorkspaceTab; label: string; note: string }[] = [
  { key: "overview", label: "行情分析", note: "价格、指标、资金、策略" },
  { key: "chart", label: "图表信号", note: "K线、指标、信号点" },
  { key: "fundamentals", label: "财报估值", note: "三表、估值、血缘" },
  { key: "news", label: "新闻证据", note: "公告、资讯、证据" },
  { key: "review", label: "信号审查", note: "Agent、风险、解释" },
  { key: "history", label: "历史表现", note: "信号、日线、后验" },
];

function readableStrategyModeLabel(mode: ResonanceV2Analysis["mode"]) {
  return mode === "aggressive" ? "激进权重模式" : "保守确认模式";
}

function buildReadableSymbolStrategySteps(analysis: ResonanceV2Analysis): ReadableStrategyStepLike[] {
  const trendLabel = analysis.trend_state?.label || analysis.decision.label || "-";
  const trendBad = /空|弱|bear|down|未通过/i.test(trendLabel);
  const trendGood = !trendBad && /多|bull|up|向上|强势/i.test(trendLabel);
  const warningLevel = analysis.sell_signal?.warning_level?.level || 0;
  return [
    buildReadableStrategyGateText({
      gate: "M1",
      trendGood,
      trendBad,
      trendLabel,
    }),
    buildReadableStrategyGateText({
      gate: "M2",
      marketPassed: Boolean(analysis.market_filter?.passed),
      marketStatus: analysis.market_filter?.status,
      benchmarkSymbol: analysis.market_filter?.benchmark_symbol,
    }),
    buildReadableStrategyGateText({
      gate: "M3",
      buyTriggered: Boolean(analysis.buy_signal?.mode_signal),
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
      shares: analysis.position_plan?.suggested_shares,
      positionPct: analysis.position_plan?.suggested_position_pct,
      riskPct: analysis.position_plan?.risk_pct,
    }),
  ];
}

function buildReadableSymbolStrategyCopy(analysis: ResonanceV2Analysis) {
  return buildReadableStrategyDecisionCopy({
    date: analysis.latest_bar?.date,
    symbol: analysis.symbol,
    modeLabel: readableStrategyModeLabel(analysis.mode),
    decisionLabel: analysis.decision.label,
    decisionAction:
      analysis.sell_signal?.warning_level?.action ||
      analysis.trend_state?.action ||
      analysis.decision.action,
    steps: buildReadableSymbolStrategySteps(analysis),
  });
}

function readableRiskFlag(flag: string) {
  return flag
    .replace(/S_buy/g, "买入强度")
    .replace(/S_sell/g, "卖出压力")
    .replace(/大盘过滤转为reject或missing/g, "大盘环境转弱或基准数据缺失")
    .replace(/reject或missing/g, "未通过或数据缺失")
    .replace(/\breject\b/g, "未通过")
    .replace(/\bmissing\b/g, "数据缺失");
}

function defaultStartFor(endDate: string, years = 3) {
  const parsed = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  parsed.setUTCFullYear(parsed.getUTCFullYear() - years);
  return parsed.toISOString().slice(0, 10);
}

type ApiResponse<T> =
  | {
      success: true;
      data: T;
      error?: string | null;
    }
  | {
      success: false;
      data?: T;
      error?: string | null;
    };

async function fetchApiPayload<T>(url: string, fallbackError: string): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url);
    const payload = await response.json() as Partial<ApiResponse<T>> & { detail?: string };
    if (payload && typeof payload.success === "boolean") {
      return payload as ApiResponse<T>;
    }
    return {
      success: false,
      error: payload?.error || payload?.detail || fallbackError,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error && error.message ? error.message : fallbackError,
    };
  }
}

interface WatchlistItem {
  symbol: string;
  name?: string | null;
  market?: string | null;
  status?: string | null;
}

interface SignalHistoryRow {
  signal_id: string;
  date: string;
  symbol: string;
  signal_name: string;
  signal_level?: string;
  direction?: string;
  evidence_json?: string;
  risk_json?: string;
  invalid_json?: string;
  score?: number;
  review_count?: number;
  latest_review_at?: string | null;
  event_return?: {
    entry_date?: string | null;
    entry_price?: number | null;
    ret_5d?: number | null;
    ret_20d?: number | null;
    ret_60d?: number | null;
    excess_index_20d?: number | null;
    max_adverse_20d?: number | null;
    max_favorable_20d?: number | null;
    fail_reason?: string | null;
  } | null;
}

interface SignalHistoryPayload {
  symbol: string;
  total_count: number;
  signals: SignalHistoryRow[];
}

interface ResonanceV2Analysis {
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
    ema21?: number | null;
    ema89?: number | null;
    period?: string;
    sample_count?: number;
    reliability?: string;
  };
  market_filter?: {
    benchmark_symbol?: string;
    benchmark_reason?: string;
    status?: string;
    passed?: boolean;
    trend_label?: string;
    rsi14?: number | null;
    market_strength?: number | null;
    drivers?: string[];
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
    capital?: number;
    risk_pct?: number;
    risk_amount?: number;
    signal_coef?: number;
    money_coef?: number;
    market_coef?: number;
    max_position_pct?: number;
    suggested_shares?: number;
    suggested_notional?: number;
    suggested_position_pct?: number;
    stop_distance?: number;
    lot_size?: number;
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

interface ResonanceV2BacktestPayload {
  kind: string;
  backtest_id: string;
  created_at: string;
  start: string;
  end: string;
  result: {
    strategy_version: string;
    symbol: string;
    zero_trade_reasons?: string[];
    metrics: {
      initial_cash?: number;
      final_equity?: number;
      total_return?: number;
      max_drawdown?: number;
      trade_count?: number;
      round_trip_count?: number;
      order_count?: number;
      win_rate?: number;
      signal_count?: number;
      benchmark_symbol?: string;
      benchmark_total_return?: number;
      excess_return?: number;
      benchmark_coverage?: number;
    };
    equity_curve: { date: string; equity: number; drawdown?: number }[];
    signals: {
      date: string;
      action: string;
      label?: string;
      buy_score?: number | null;
      sell_score?: number | null;
    }[];
    trades: {
      side: string;
      date: string;
      price: number;
      quantity: number;
      reason?: string;
    }[];
    data_quality?: {
      no_trade_reasons?: string[];
    };
  };
}

interface SignalExplainPayload {
  signal: {
    signal_id: string;
    symbol: string;
    date: string;
    signal_name?: string;
    direction?: string;
    score?: number;
  };
  layers: {
    decision: {
      action: string;
      review_status: string;
      risk_status?: string | null;
      next_step: string;
    };
    explain: {
      evidence: string[];
      risks: string[];
      invalidations: string[];
      review_bull_points: string[];
      review_bear_points: string[];
    };
    audit: {
      trade_proxy_status?: string | null;
      generated_at: string;
    };
  };
  review: {
    decision_status: string;
    confidence?: string | null;
    summary?: string | null;
    risk_flags: string[];
    missing_data: string[];
  };
  attribution?: SignalHistoryRow["event_return"] | null;
  trading_plan?: {
    action: string;
    hard_stop?: number | null;
    max_position_pct?: number | null;
    risk_gate?: {
      status: string;
      blockers: string[];
      warnings: string[];
      checks: { key: string; label: string; status: string; detail: string }[];
    };
  } | null;
  trade_proxy?: {
    status: string;
    default_proxy?: {
      symbol: string;
      name: string;
      proxy_type: string;
      market: string;
      cost_bps?: number | null;
    } | null;
  };
  quality: {
    trust_level: string;
    missing_tables: string[];
  };
}

interface AnalysisReadinessCategory {
  key: string;
  label: string;
  status: "ready" | "warn" | "blocker";
  coverage: number;
  impact: string;
  evidence: string[];
  next_step: string;
  target_view: string;
  metadata?: Record<string, unknown>;
}

interface AnalysisReadinessPayload {
  symbol: string;
  date: string;
  asset_type: string;
  score: number;
  level: "ready" | "partial" | "thin" | "blocked";
  summary: {
    ready_count: number;
    warn_count: number;
    blocker_count: number;
    total_count: number;
  };
  categories: AnalysisReadinessCategory[];
  next_actions: {
    key: string;
    priority: "P0" | "P1" | "P2";
    label: string;
    action: string;
    target_view: string;
  }[];
  disclaimer?: string;
}

export default function SymbolWorkspacePage({
  initialSymbol = "600519.SH",
  initialEnd,
  onContextChange,
}: {
  initialSymbol?: string;
  initialEnd?: string;
  onContextChange?: (symbol: string, date: string) => void;
}) {
  const resolvedInitialEnd = initialEnd || today;
  const [symbol, setSymbol] = useState(initialSymbol);
  const [start, setStart] = useState(defaultStartFor(resolvedInitialEnd));
  const [end, setEnd] = useState(resolvedInitialEnd);
  const [history, setHistory] = useState<MarketHistoryPayload | null>(null);
  const [context, setContext] = useState<MarketContextPayload | null>(null);
  const [signals, setSignals] = useState<SignalHistoryRow[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<SignalHistoryRow | null>(null);
  const [signalExplain, setSignalExplain] = useState<SignalExplainPayload | null>(null);
  const [readiness, setReadiness] = useState<AnalysisReadinessPayload | null>(null);
  const [activeTab, setActiveTab] = useState<SymbolWorkspaceTab>("overview");
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const [strategyMode, setStrategyMode] = useState<"conservative" | "aggressive">("conservative");
  const [strategyAnalysis, setStrategyAnalysis] = useState<ResonanceV2Analysis | null>(null);
  const [strategyBacktest, setStrategyBacktest] = useState<ResonanceV2BacktestPayload | null>(null);
  const [autoBacktestKey, setAutoBacktestKey] = useState("");
  const [strategyActionMessage, setStrategyActionMessage] = useState("");
  const [realtimePayload, setRealtimePayload] = useState<{ quote: RealtimeQuote | null; intraday: IntradayPayload | null }>({
    quote: null,
    intraday: null,
  });
  const [strategyBusy, setStrategyBusy] = useState(false);
  const [message, setMessage] = useState("读取中");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSymbol(initialSymbol);
    if (initialEnd) {
      setEnd(initialEnd);
      setStart(defaultStartFor(initialEnd));
    }
  }, [initialSymbol, initialEnd]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("tradingagents.symbolWorkspace.recentSymbols");
      setRecentSymbols(stored ? JSON.parse(stored) : []);
    } catch {
      setRecentSymbols([]);
    }
    const loadWatchlist = async () => {
      const payload = await fetchApiPayload<WatchlistItem[]>("/api/research/watchlist", "自选股服务未连接");
      setWatchlist(payload.success ? payload.data : []);
    };
    void loadWatchlist();
  }, []);

  const rememberRecentSymbol = (nextSymbol: string) => {
    const normalized = nextSymbol.trim().toUpperCase();
    if (!normalized) return;
    setRecentSymbols((value) => {
      const next = [normalized, ...value.filter((item) => item !== normalized)].slice(0, 8);
      try {
        window.localStorage.setItem("tradingagents.symbolWorkspace.recentSymbols", JSON.stringify(next));
      } catch {
        // Recent symbols are a convenience only; failing to persist should not block analysis.
      }
      return next;
    });
  };

  const load = async (
    event?: FormEvent,
    targetSymbol = symbol,
    targetEnd = end,
    targetMode = strategyMode,
    targetStart = start,
  ) => {
    event?.preventDefault();
    setLoading(true);
    setMessage("读取个股工作台");
    setStrategyBacktest(null);
    setAutoBacktestKey("");
    const historyParams = new URLSearchParams({ symbol: targetSymbol, start: targetStart, end: targetEnd, limit: "900" });
    const signalParams = new URLSearchParams({ symbol: targetSymbol, start: targetStart, end: targetEnd });
    const contextParams = new URLSearchParams({ symbol: targetSymbol, start: targetStart, end: targetEnd, limit: "180" });
    const readinessParams = new URLSearchParams({ symbol: targetSymbol, date: targetEnd });
    const realtimeParams = new URLSearchParams({ symbols: targetSymbol });
    const strategyParams = new URLSearchParams({
      symbol: targetSymbol,
      start: targetStart,
      end: targetEnd,
      mode: targetMode,
      capital: "1000000",
    });
    try {
      const [historyPayload, signalPayload, contextPayload, strategyPayload, readinessPayload, realtimeQuotePayload] = await Promise.all([
        fetchApiPayload<MarketHistoryPayload>(
          `/api/market/history?${historyParams.toString()}`,
          "行情服务未连接",
        ),
        fetchApiPayload<SignalHistoryPayload>(
          `/api/signals/history?${signalParams.toString()}`,
          "信号服务未连接",
        ),
        fetchApiPayload<MarketContextPayload>(
          `/api/market/context?${contextParams.toString()}`,
          "市场上下文服务未连接",
        ),
        fetchApiPayload<ResonanceV2Analysis>(
          `/api/strategies/resonance-v2/analyze?${strategyParams.toString()}`,
          "V2策略服务未连接",
        ),
        fetchApiPayload<AnalysisReadinessPayload>(
          `/api/professional/analysis-readiness?${readinessParams.toString()}`,
          "分析完整度服务未连接",
        ),
        fetchApiPayload<RealtimeQuotePayload>(
          `/api/market/realtime/quotes?${realtimeParams.toString()}`,
          "准实时行情服务未连接",
        ),
      ]);
      const failedServiceLabels = [
        historyPayload.success ? null : "行情",
        signalPayload.success ? null : "信号",
        contextPayload.success ? null : "上下文",
        strategyPayload.success ? null : "V2策略",
        readinessPayload.success ? null : "完整度",
      ].filter((item): item is string => Boolean(item));
      if (historyPayload.success) {
        setHistory(historyPayload.data);
      } else {
        setHistory(null);
      }
      setContext(contextPayload.success ? contextPayload.data : null);
      setStrategyAnalysis(strategyPayload.success ? strategyPayload.data : null);
      setReadiness(readinessPayload.success ? readinessPayload.data : null);
      setRealtimePayload({
        quote: realtimeQuotePayload.success ? realtimeQuotePayload.data.quotes[0] || null : null,
        intraday: null,
      });
      if (signalPayload.success) {
        setSignals(signalPayload.data.signals);
        setSelectedSignal(signalPayload.data.signals[0] || null);
      } else {
        setSignals([]);
        setSelectedSignal(null);
      }
      if (historyPayload.success) {
        onContextChange?.(historyPayload.data.symbol, targetEnd);
        rememberRecentSymbol(historyPayload.data.symbol);
      }
      setMessage(buildWorkspaceLoadMessage({
        historySuccess: historyPayload.success,
        historyError: historyPayload.success ? null : historyPayload.error,
        barCount: historyPayload.success ? historyPayload.data.bar_count : 0,
        signalSuccess: signalPayload.success,
        signalCount: signalPayload.success ? signalPayload.data.total_count : 0,
        failedServiceLabels,
      }));
    } catch {
      setHistory(null);
      setContext(null);
      setSignals([]);
      setSelectedSignal(null);
      setStrategyAnalysis(null);
      setReadiness(null);
      setRealtimePayload({ quote: null, intraday: null });
      setMessage("后端 API 未连接：请先启动服务（默认 8100），再刷新个股工作台。");
    }
    setLoading(false);
  };

  const changeStrategyMode = (mode: "conservative" | "aggressive") => {
    setStrategyMode(mode);
    void load(undefined, symbol, end, mode);
  };

  const openNavigationSymbol = (nextSymbol: string) => {
    if (!nextSymbol || nextSymbol === symbol) return;
    setSymbol(nextSymbol);
    setActiveTab("overview");
    void load(undefined, nextSymbol, end, strategyMode, start);
  };

  const createStrategySignal = async () => {
    setStrategyBusy(true);
    setStrategyActionMessage("正在写入V2策略信号");
    try {
      const response = await fetch("/api/strategies/resonance-v2/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          start,
          end,
          mode: strategyMode,
          capital: 1_000_000,
          persist: true,
        }),
      });
      const payload = (await response.json()) as ApiResponse<{
        signal: { signal_id: string; signal_level?: string; direction?: string };
        persisted: boolean;
      }>;
      if (payload.success) {
        await load(undefined, symbol, end, strategyMode);
        setStrategyActionMessage(
          payload.data.persisted
            ? `已写入 ${payload.data.signal.signal_level || "-"} 级${payload.data.signal.direction || ""}信号`
            : "已生成信号但未写入",
        );
      } else {
        setStrategyActionMessage(payload.error || "V2信号写入失败");
      }
    } catch {
      setStrategyActionMessage("V2信号服务未连接");
    }
    setStrategyBusy(false);
  };

  const runStrategyBacktest = async () => {
    setStrategyBusy(true);
    setStrategyActionMessage("正在运行V2专属回测");
    try {
      const response = await fetch("/api/strategies/resonance-v2/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          start,
          end,
          mode: strategyMode,
          initial_cash: 1_000_000,
          risk_pct: 0.01,
        }),
      });
      const payload = (await response.json()) as ApiResponse<ResonanceV2BacktestPayload>;
      if (payload.success) {
        setStrategyBacktest(payload.data);
        setStrategyActionMessage(`V2回测完成 ${payload.data.backtest_id.slice(0, 8)}`);
      } else {
        setStrategyActionMessage(payload.error || "V2回测失败");
      }
    } catch {
      setStrategyActionMessage("V2回测服务未连接");
    }
    setStrategyBusy(false);
  };

  useEffect(() => {
    const targetEnd = initialEnd || end;
    load(undefined, initialSymbol, targetEnd, strategyMode, defaultStartFor(targetEnd));
  }, [initialSymbol, initialEnd]);

  const strategyBacktestKey = `${history?.symbol || symbol}:${start}:${end}:${strategyMode}`;
  useEffect(() => {
    if (activeTab !== "chart") return;
    if (!history || !strategyAnalysis || strategyBacktest || loading || strategyBusy) return;
    if (autoBacktestKey === strategyBacktestKey) return;
    setAutoBacktestKey(strategyBacktestKey);
    void runStrategyBacktest();
  }, [activeTab, autoBacktestKey, history, loading, strategyAnalysis, strategyBacktest, strategyBacktestKey, strategyBusy]);

  const latestBars = useMemo(() => [...(history?.bars || [])].slice(-12).reverse(), [history]);
  const chartSignals = useMemo(
    () =>
      signals.map((signal) => ({
        signal_id: signal.signal_id,
        date: signal.date,
        signal_name: signal.signal_name,
        signal_level: signal.signal_level,
        direction: signal.direction,
        entry_date: signal.event_return?.entry_date,
        entry_price: signal.event_return?.entry_price,
        score: signal.score,
        review_count: signal.review_count,
        ret_5d: signal.event_return?.ret_5d,
        ret_20d: signal.event_return?.ret_20d,
        ret_60d: signal.event_return?.ret_60d,
        max_adverse_20d: signal.event_return?.max_adverse_20d,
      })),
    [signals],
  );
  const realtimeQuote = realtimePayload.intraday?.quote || realtimePayload.quote;
  const displayQuote = useMemo(
    () =>
      buildDisplayQuoteModel({
        historyQuote: history?.quote || null,
        realtimeQuote,
      }),
    [history?.quote, realtimeQuote],
  );
  const marketOverview = useMemo(
    () =>
      buildMarketAnalysisOverviewModel({
        history,
        displayQuote: displayQuote.quote,
        displayQuoteFreshnessText: displayQuote.freshnessText,
        researchQuoteDetail: displayQuote.researchDetail,
        context,
        signals,
        readiness,
        strategyAnalysis,
      }),
    [context, displayQuote, history, readiness, signals, strategyAnalysis],
  );
  const dataStatus = useMemo(
    () =>
      buildWorkspaceDataStatusModel({
        history,
        context,
        displayQuote: displayQuote.quote,
        readiness,
        strategyAnalysis,
      }),
    [context, displayQuote.quote, history, readiness, strategyAnalysis],
  );
  const navigation = useMemo(
    () =>
      buildWorkspaceNavigationModel({
        currentSymbol: history?.symbol || symbol,
        watchlist,
        signals,
        recentSymbols,
      }),
    [history?.symbol, recentSymbols, signals, symbol, watchlist],
  );
  const chartEvidenceEvents = useMemo<KlineEvidenceEvent[]>(
    () =>
      buildKlineEvidenceEvents({
        history,
        signals,
        readiness,
        strategyAnalysis,
      }),
    [history, readiness, signals, strategyAnalysis],
  );
  const quote = displayQuote.quote as MarketQuote | RealtimeQuote | null;
  const displayName =
    history?.display_name ||
    (history?.name ? `${history.name} / ${history.symbol}` : history?.symbol || symbol);
  const aliasNotice =
    history?.alias_notice ||
    (history?.alias_symbol ? `${history.alias_symbol} 已标准化为 ${history.symbol}` : "");

  const selectSignalFromChart = (signalId: string) => {
    const signal = signals.find((item) => item.signal_id === signalId);
    if (signal) setSelectedSignal(signal);
  };

  useEffect(() => {
    if (!selectedSignal) {
      setSignalExplain(null);
      return;
    }
    let cancelled = false;
    const loadSignalExplain = async () => {
      try {
        const response = await fetch(
          `/api/professional/signal-explain?signal_id=${encodeURIComponent(selectedSignal.signal_id)}`,
        );
        const payload = (await response.json()) as ApiResponse<SignalExplainPayload>;
        if (!cancelled) setSignalExplain(payload.success ? payload.data : null);
      } catch {
        if (!cancelled) setSignalExplain(null);
      }
    };
    void loadSignalExplain();
    return () => {
      cancelled = true;
    };
  }, [selectedSignal?.signal_id]);

  const runSignalReview = async () => {
    if (!selectedSignal) return;
    setLoading(true);
    const response = await fetch(
      `/api/signals/${encodeURIComponent(selectedSignal.signal_id)}/agent-review`,
      { method: "POST" },
    );
    const data = await response.json();
    setMessage(data.success ? "信号审查已写入" : "信号审查失败");
    await load(undefined, symbol, end);
    setLoading(false);
  };

  return (
    <section className="workbench-section symbol-workspace-page">
      <V1DeprecationBanner />
      <div className="section-heading">
        <h1>个股工作台</h1>
        <p>
          {displayName} · 一个选中标的驱动行情卡、历史走势、规则信号、审查状态和近期日线。
          {aliasNotice ? ` ${aliasNotice}` : ""}
        </p>
      </div>
      <form className="toolbar" onSubmit={load}>
        <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="600519.SH" />
        <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <button className="primary" disabled={loading}>
          {loading ? "读取中" : "打开标的"}
        </button>
        <span className="muted">{message}</span>
      </form>

      <WorkspaceDataStatusPanel
        model={dataStatus}
        disclaimer={strategyAnalysis?.disclaimer || "本页仅用于研究和模拟交易，不构成投资建议或实盘指令。"}
      />

      <div className="symbol-layout symbol-layout-three">
        <aside className="symbol-side symbol-left-rail">
          <SymbolNavigationRail navigation={navigation} onOpenSymbol={openNavigationSymbol} />
        </aside>

        <div className="symbol-main symbol-workspace-core">
          <div className="symbol-tab-strip" role="tablist" aria-label="个股工作台分析页签">
            {SYMBOL_WORKSPACE_TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.key}
                className={activeTab === tab.key ? "active" : ""}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                type="button"
              >
                <strong>{tab.label}</strong>
                <span>{tab.note}</span>
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="symbol-tab-panel">
              <MarketAnalysisOverview
                chartSignals={chartSignals}
                context={context}
                history={history}
                onOpenChart={() => setActiveTab("chart")}
                onOpenReview={() => setActiveTab("review")}
                overview={marketOverview}
                readiness={readiness}
                selectedSignal={selectedSignal}
                strategyAnalysis={strategyAnalysis}
              />
            </div>
          )}

          {activeTab === "chart" && (
            <div className="symbol-tab-panel">
              <RealtimeMarketPanel symbol={symbol} onDataChange={setRealtimePayload} />
              <TradingSignalKlinePanel
                bars={history?.bars || []}
                drawingScope={history?.symbol || symbol}
                evidenceEvents={chartEvidenceEvents}
                factorRows={context?.factor_series || []}
                fundFlowRows={context?.fund_flow_series || []}
                intradayPoints={realtimePayload.intraday?.points || []}
                intradaySource={realtimePayload.intraday?.source || null}
                realtimeQuote={realtimePayload.intraday?.quote || realtimePayload.quote}
                signals={chartSignals}
                strategyAnalysis={strategyAnalysis}
                strategyControls={{
                  mode: strategyMode,
                  loading: loading || strategyBusy,
                  actionMessage: strategyActionMessage,
                  backtest: strategyBacktest,
                  onModeChange: changeStrategyMode,
                  onCreateSignal: createStrategySignal,
                  onRunBacktest: runStrategyBacktest,
                }}
                selectedSignalId={selectedSignal?.signal_id}
                onSelectSignal={selectSignalFromChart}
              />
              <div className="detail-panel compact-history-chart">
                <div className="section-subhead">
                  <h2>历史走势概览</h2>
                  <span className="muted">保留轻量全局视角</span>
                </div>
                <PriceHistoryChart bars={history?.bars || []} signals={chartSignals} />
              </div>
            </div>
          )}

          {activeTab === "fundamentals" && (
            <div className="symbol-tab-panel">
              <MarketContextDashboard context={context} />
              <div className="embedded-workspace-pane">
                <FundamentalsPage initialSymbol={symbol} initialEnd={end} />
              </div>
            </div>
          )}

          {activeTab === "news" && (
            <div className="symbol-tab-panel embedded-workspace-pane">
              <NewsEvidencePage initialSymbol={symbol} initialEnd={end} />
            </div>
          )}

          {activeTab === "review" && (
            <div className="symbol-tab-panel">
              <div className="section-subhead">
                <h2>信号审查</h2>
                <span className="muted">{selectedSignal?.signal_id.slice(0, 10) || "未选择信号"}</span>
              </div>
              <SignalDetailWorkbench signal={selectedSignal} explain={signalExplain} onReview={runSignalReview} loading={loading} />
            </div>
          )}

          {activeTab === "history" && (
            <div className="symbol-tab-panel">
              <div className="symbol-lower-grid">
                <div>
                  <div className="section-subhead">
                    <h2>历史信号</h2>
                    <span className="muted">{signals.length} 条</span>
                  </div>
                  <div className="timeline-panel symbol-signal-panel">
                    {signals.slice(0, 12).map((signal) => (
                      <button
                        className={`signal-history-card ${selectedSignal?.signal_id === signal.signal_id ? "active" : ""}`}
                        key={signal.signal_id}
                        onClick={() => {
                          setSelectedSignal(signal);
                          setActiveTab("review");
                        }}
                        type="button"
                      >
                        <span>{signal.date}</span>
                        <strong>{signal.signal_name}</strong>
                        <small>
                          {signal.signal_level || "-"} · {signal.direction || "-"} ·{" "}
                          {formatNumber(signal.score, 1)}
                        </small>
                        <b>{signal.review_count || 0} 次审查</b>
                        <em>20日 {formatPercent(signal.event_return?.ret_20d)}</em>
                      </button>
                    ))}
                    {signals.length === 0 && <div className="empty-state block">暂无历史信号。</div>}
                  </div>
                </div>

                <div>
                  <div className="section-subhead">
                    <h2>近期日线</h2>
                    <span className="muted">最近 12 根</span>
                  </div>
                  <RecentBarsTable bars={latestBars} />
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="symbol-context-rail">
          <SymbolContextPanel
            context={context}
            dataStatus={dataStatus}
            displayName={displayName}
            end={end}
            history={history}
            onOpenReview={() => setActiveTab("review")}
            quote={quote}
            quoteFreshnessText={displayQuote.freshnessText}
            quoteSourceDetail={displayQuote.sourceDetail}
            researchQuoteDetail={displayQuote.researchDetail}
            selectedSignal={selectedSignal}
            signalExplain={signalExplain}
            strategyAnalysis={strategyAnalysis}
            symbol={symbol}
          />
        </aside>
      </div>
    </section>
  );
}

// Phase 5 PR-20：V1 软下线提示横幅（不真正删除，A/B 灰度未完结前必须保留）
function V1DeprecationBanner() {
  const switchToV2 = () => {
    switchWorkspaceVersion("v2");
  };
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        marginBottom: 12,
        background: "rgba(245,158,11,0.10)",
        border: "1px solid rgba(245,158,11,0.25)",
        borderRadius: 6,
        color: "var(--accent-yellow, #e3b341)",
        fontSize: 12,
      }}
    >
      <span>⚠</span>
      <span style={{ flex: 1 }}>
        <strong>旧版工作台已进入下线流程</strong> · 新版已全量可用，含 4 个分析视图、催化剂时间线、风险预算计算器、浅色主题。
        当前可随时切回旧版。
      </span>
      <button
        type="button"
        onClick={switchToV2}
        style={{
          padding: "4px 12px",
          background: "var(--coinbase-blue, #0052ff)",
          color: "white",
          border: 0,
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        切换到新版 →
      </button>
    </div>
  );
}

function WorkspaceDataStatusPanel({
  disclaimer,
  model,
}: {
  disclaimer: string;
  model: WorkspaceDataStatusModel;
}) {
  return (
    <details className={`workspace-data-status ${model.tone}`} open={model.tone === "blocked" || model.tone === "missing"}>
      <summary>
        <div>
          <span className="eyebrow">Data Status</span>
          <strong>{model.title}</strong>
          <em>{model.subtitle}</em>
        </div>
        <div className="workspace-data-status-metrics">
          {model.metrics.map((metric) => (
            <span className={metric.tone} key={metric.key}>
              {metric.label} <b>{metric.value}</b>
            </span>
          ))}
        </div>
      </summary>
      <div className="workspace-data-status-body">
        <div className="workspace-data-status-gaps">
          {model.gaps.map((gap) => (
            <div className={`workspace-data-gap ${gap.status}`} key={gap.key}>
              <strong>{gap.label}</strong>
              <span>{gap.impact}</span>
              <em>{gap.nextStep}</em>
            </div>
          ))}
          {model.gaps.length === 0 && <p className="empty-state">暂无优先数据缺口。</p>}
        </div>
        <div className="workspace-data-status-side">
          <span>主下一步</span>
          <strong>{model.primaryAction || "保持同步并进入图表信号复核。"}</strong>
          {model.warnings.slice(0, 3).map((warning) => (
            <em key={warning}>{warning}</em>
          ))}
          <small>{disclaimer}</small>
        </div>
      </div>
    </details>
  );
}

function SymbolNavigationRail({
  navigation,
  onOpenSymbol,
}: {
  navigation: WorkspaceNavigationModel;
  onOpenSymbol: (symbol: string) => void;
}) {
  return (
    <div className="symbol-navigation-rail">
      <NavigationSection title="自选" items={navigation.watchlist} onOpenSymbol={onOpenSymbol} empty="自选股池暂无可用标的。" />
      <NavigationSection title="信号" items={navigation.signals} onOpenSymbol={onOpenSymbol} empty="当前区间暂无机会信号。" />
      <NavigationSection title="风险" items={navigation.risk} onOpenSymbol={onOpenSymbol} empty="暂无风险升高标的。" />
      <NavigationSection title="最近" items={navigation.recent} onOpenSymbol={onOpenSymbol} empty="暂无最近查看。" />
    </div>
  );
}

function NavigationSection({
  empty,
  items,
  onOpenSymbol,
  title,
}: {
  empty: string;
  items: WorkspaceNavigationItem[];
  onOpenSymbol: (symbol: string) => void;
  title: string;
}) {
  return (
    <div className="symbol-navigation-section">
      <div className="symbol-navigation-section-head">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      <div className="symbol-navigation-list">
        {items.map((item) => (
          <button
            className={`symbol-navigation-item ${item.tone} ${item.active ? "active" : ""}`}
            key={`${title}-${item.symbol}-${item.label}`}
            onClick={() => onOpenSymbol(item.symbol)}
            type="button"
          >
            <strong>{item.label}</strong>
            <span>{item.symbol}</span>
            <em>{item.detail}</em>
          </button>
        ))}
        {items.length === 0 && <p className="empty-state">{empty}</p>}
      </div>
    </div>
  );
}

function AnalysisReadinessPanel({ readiness }: { readiness: AnalysisReadinessPayload | null }) {
  if (!readiness) {
    return (
      <div className="analysis-readiness-panel loading">
        <div>
          <span className="eyebrow">Analysis Readiness</span>
          <h2>分析完整度读取中</h2>
        </div>
        <p className="muted">连接后端后展示数据缺口、影响范围和下一步建议。</p>
      </div>
    );
  }
  const blockers = readiness.categories.filter((item) => item.status === "blocker");
  const warnings = readiness.categories.filter((item) => item.status === "warn");
  const visibleGaps = [...blockers, ...warnings].slice(0, 5);
  const levelLabel = {
    ready: "可完整分析",
    partial: "部分可用",
    thin: "数据偏薄",
    blocked: "核心阻断",
  }[readiness.level];
  return (
    <div className={`analysis-readiness-panel ${readiness.level}`}>
      <div className="analysis-readiness-score">
        <span className="eyebrow">Analysis Readiness</span>
        <strong>{Math.round(readiness.score * 100)}</strong>
        <em>{levelLabel}</em>
      </div>
      <div className="analysis-readiness-summary">
        <div className="analysis-readiness-counts">
          <span><b>{readiness.summary.ready_count}</b> ready</span>
          <span><b>{readiness.summary.warn_count}</b> warn</span>
          <span><b>{readiness.summary.blocker_count}</b> blocker</span>
        </div>
        <div className="analysis-gap-list">
          {visibleGaps.map((item) => (
            <div className={`analysis-gap-item ${item.status}`} key={item.key}>
              <strong>{item.label}</strong>
              <span>{item.impact}</span>
              <em>{item.next_step}</em>
            </div>
          ))}
          {visibleGaps.length === 0 && <div className="empty-state block">当前完整度良好，暂无优先缺口。</div>}
        </div>
      </div>
      <div className="analysis-next-actions">
        <span>下一步</span>
        {readiness.next_actions.slice(0, 4).map((action) => (
          <b className={`priority-${action.priority.toLowerCase()}`} key={action.key}>
            {action.priority} · {action.label}
          </b>
        ))}
        {readiness.next_actions.length === 0 && <b>保持同步并继续复盘</b>}
      </div>
    </div>
  );
}

function MarketAnalysisOverview({
  chartSignals,
  context,
  history,
  onOpenChart,
  onOpenReview,
  overview,
  readiness,
  selectedSignal,
  strategyAnalysis,
}: {
  chartSignals: {
    signal_id: string;
    date: string;
    signal_name: string;
    signal_level?: string;
    direction?: string;
    entry_date?: string | null;
    entry_price?: number | null;
    score?: number;
    review_count?: number;
    ret_5d?: number | null;
    ret_20d?: number | null;
    ret_60d?: number | null;
    max_adverse_20d?: number | null;
  }[];
  context: MarketContextPayload | null;
  history: MarketHistoryPayload | null;
  onOpenChart: () => void;
  onOpenReview: () => void;
  overview: OverviewModel;
  readiness: AnalysisReadinessPayload | null;
  selectedSignal: SignalHistoryRow | null;
  strategyAnalysis: ResonanceV2Analysis | null;
}) {
  const coreIndicators = overview.indicators.filter((item) =>
    ["trend", "macd", "rsi", "boll", "fund_flow", "relative_strength"].includes(item.key),
  );
  const compactFeatures = overview.chartFeatures.map((item) =>
    item.key === "signal_layer"
      ? { ...item, value: `${chartSignals.length} 条`, detail: `${history?.bar_count || 0} 根K线 · ${item.detail}` }
      : item,
  );
  const strategySteps = strategyAnalysis ? buildReadableSymbolStrategySteps(strategyAnalysis) : [];
  const strategyCopy = strategyAnalysis ? buildReadableSymbolStrategyCopy(strategyAnalysis) : null;
  return (
    <div className="market-analysis-overview">
      <div className={`analysis-overview-hero ${overview.summary.tone}`}>
        <div>
          <span className="eyebrow">Market Analysis</span>
          <h2>{overview.summary.title}</h2>
          <p>{overview.summary.subtitle}</p>
        </div>
        <div className="analysis-overview-actions">
          <button className="primary compact-action" onClick={onOpenChart} type="button">
            打开完整K线
          </button>
          <button className="mini" onClick={onOpenReview} type="button" disabled={!selectedSignal}>
            查看审查
          </button>
        </div>
      </div>

      <div className="analysis-radar-grid">
        {overview.radar.map((item) => (
          <OverviewMetricCard item={item} key={item.key} />
        ))}
      </div>

      <div className="analysis-chart-feature-strip compact">
        {compactFeatures.map((item) => (
          <OverviewMiniItem item={item} key={item.key} />
        ))}
      </div>

      <div className="analysis-overview-grid focused">
        <section className="analysis-overview-panel">
          <div className="section-subhead">
            <h2>核心指标</h2>
            <span className="muted">趋势 · 动能 · 资金 · 相对强弱</span>
          </div>
          <div className="indicator-matrix">
            {coreIndicators.map((item) => (
              <IndicatorCard item={item} key={item.key} onOpenChart={onOpenChart} />
            ))}
          </div>
        </section>

        <section className="analysis-overview-panel">
          <div className="section-subhead">
            <h2>策略与风险</h2>
            <span className="muted">{strategyAnalysis?.strategy_name || "V2策略"}</span>
          </div>
          <div className="analysis-strategy-grid">
            <MiniMetric label="个股趋势" value={strategySteps[0]?.status || "-"} />
            <MiniMetric label="市场环境" value={strategySteps[1]?.status || "-"} />
            <MiniMetric label="买入强度" value={`${formatNumber(strategyAnalysis?.buy_signal?.score, 3)} / ${strategySteps[2]?.status || "-"}`} />
            <MiniMetric label="卖出风险" value={`${formatNumber(strategyAnalysis?.sell_signal?.score, 2)} / ${strategySteps[3]?.status || "-"}`} />
            <MiniMetric label="止损参考" value={formatNumber(strategyAnalysis?.price_channels?.stop_price, 2)} />
            <MiniMetric label="仓位参考" value={`${formatCompactNumber(strategyAnalysis?.position_plan?.suggested_shares)} 股 / ${formatPercent(strategyAnalysis?.position_plan?.suggested_position_pct)}`} />
          </div>
          <div className="analysis-next-step-list">
            {(strategyCopy?.reasons || overview.nextSteps).slice(0, 2).map((step) => (
              <p key={step}>
                <span>{strategyCopy ? "判断依据" : "主下一步"}</span>
                <strong>{step}</strong>
              </p>
            ))}
          </div>
        </section>

        <section className="analysis-overview-panel">
          <div className="section-subhead">
            <h2>证据闭环</h2>
            <span className="muted">{readiness ? `${Math.round(readiness.score * 100)}%` : "待诊断"}</span>
          </div>
          <div className="overview-evidence-grid">
            {overview.evidence.map((item) => (
              <OverviewMetricCard item={item} key={item.key} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function OverviewMetricCard({ item }: { item: OverviewItem }) {
  return (
    <div className={`overview-metric-card ${item.tone}`}>
      <span>{item.label}</span>
      <strong>{item.value}</strong>
      <em>{item.detail}</em>
    </div>
  );
}

function OverviewMiniItem({ item }: { item: OverviewItem }) {
  return (
    <div className={`overview-mini-item ${item.tone}`}>
      <strong>{item.label}</strong>
      <span>{item.value}</span>
      <em>{item.detail}</em>
    </div>
  );
}

function IndicatorCard({ item, onOpenChart }: { item: OverviewItem; onOpenChart: () => void }) {
  return (
    <button className={`indicator-card ${item.tone}`} onClick={onOpenChart} type="button" title={item.nextStep || item.detail}>
      <span>{item.label}</span>
      <strong>{item.value}</strong>
      <em>{item.detail}</em>
      {item.nextStep && <small>{item.nextStep}</small>}
    </button>
  );
}

function SymbolContextPanel({
  context,
  dataStatus,
  displayName,
  end,
  history,
  onOpenReview,
  quote,
  quoteFreshnessText,
  quoteSourceDetail,
  researchQuoteDetail,
  selectedSignal,
  signalExplain,
  strategyAnalysis,
  symbol,
}: {
  context: MarketContextPayload | null;
  dataStatus: WorkspaceDataStatusModel;
  displayName: string;
  end: string;
  history: MarketHistoryPayload | null;
  onOpenReview: () => void;
  quote?: MarketQuote | RealtimeQuote | null;
  quoteFreshnessText: string;
  quoteSourceDetail: string;
  researchQuoteDetail: string;
  selectedSignal: SignalHistoryRow | null;
  signalExplain: SignalExplainPayload | null;
  strategyAnalysis: ResonanceV2Analysis | null;
  symbol: string;
}) {
  const riskFlags = [
    ...(signalExplain?.review.risk_flags || []),
    ...(context?.trading_rules.warnings || []),
    ...(strategyAnalysis?.data_quality?.blocking_reasons || []),
    ...(strategyAnalysis?.data_quality?.warnings || []),
  ].filter(Boolean).map(readableRiskFlag);
  const missingTables = signalExplain?.quality.missing_tables || [];
  const nextStep =
    dataStatus.primaryAction ||
    signalExplain?.layers.decision.next_step ||
    strategyAnalysis?.trend_state?.action ||
    (selectedSignal ? "进入信号审查，核对证据、风险和后验表现。" : "先在图表信号页确认 K 线、信号点和数据覆盖。");
  const trustLabel =
    dataStatus.title ||
    signalExplain?.quality.trust_level ||
    (context?.data_coverage.factor_rows ? "可用于研究" : "待补数据");
  const quoteToneClass = quote?.change_pct && quote.change_pct > 0
    ? "positive"
    : quote?.change_pct && quote.change_pct < 0
      ? "negative"
      : "flat";

  return (
    <div className="symbol-context-panel">
      <div className="symbol-context-head">
        <span className="eyebrow">Research Context</span>
        <h2>{displayName || symbol}</h2>
        <p>{symbol} · {end} · {history?.asset_type || "equity"}</p>
      </div>

      <div className="symbol-context-price">
        <span>最新价</span>
        <strong>{formatNumber(quote?.price, 2)}</strong>
        <em className={quoteToneClass}>
          {formatSignedPercent(quote?.change_pct)} · {quoteFreshnessText}
        </em>
        <small>{quoteSourceDetail}</small>
        <small>{researchQuoteDetail}</small>
      </div>

      <div className="symbol-context-metric-grid">
        <MiniMetric label="20日收益" value={formatSignedPercent(context?.factor_snapshot?.ret20)} />
        <MiniMetric label="60日收益" value={formatSignedPercent(context?.factor_snapshot?.ret60)} />
        <MiniMetric label="相对强弱" value={context?.relative_strength.rank ? `${context.relative_strength.rank}/${context.relative_strength.total}` : "-"} />
        <MiniMetric label="日线覆盖" value={`${history?.bar_count || 0} 根`} />
      </div>

      <div className="symbol-context-block">
        <div className="section-subhead">
          <h2>当前信号</h2>
          <span className="muted">{selectedSignal?.date || "-"}</span>
        </div>
        {selectedSignal ? (
          <div className="symbol-context-signal">
            <strong>{selectedSignal.signal_name}</strong>
            <span>{selectedSignal.signal_level || "-"} · {selectedSignal.direction || "-"} · 评分 {formatNumber(selectedSignal.score, 1)}</span>
            <span>20日 {formatSignedPercent(selectedSignal.event_return?.ret_20d)} · 最大不利 {formatSignedPercent(selectedSignal.event_return?.max_adverse_20d)}</span>
            <button className="mini" onClick={onOpenReview} type="button">查看审查</button>
          </div>
        ) : (
          <p className="empty-state">当前区间暂无选中信号。</p>
        )}
      </div>

      <div className="symbol-context-block">
        <div className="section-subhead">
          <h2>数据状态</h2>
          <span className="muted">{trustLabel}</span>
        </div>
        <div className="compact-list">
          {dataStatus.metrics.map((metric) => (
            <p key={metric.key}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </p>
          ))}
          <p>
            <span>缺失表</span>
            <strong>{missingTables.length + dataStatus.gaps.length}</strong>
          </p>
        </div>
      </div>

      <div className="symbol-context-block">
        <div className="section-subhead">
          <h2>Agent 审查</h2>
          <span className="muted">{signalExplain?.review.decision_status || "pending"}</span>
        </div>
        <p>{signalExplain?.review.summary || "选择信号后可查看或生成 Agent 审查摘要。"}</p>
        <p className="muted">{signalExplain?.review.confidence ? `置信度 ${signalExplain.review.confidence}` : "审查用于解释和质疑信号，不替代实盘风控。"}</p>
      </div>

      <div className="symbol-context-block">
        <div className="section-subhead">
          <h2>风险旗标</h2>
          <span className="muted">{riskFlags.length} 项</span>
        </div>
        <div className="symbol-risk-list">
          {riskFlags.slice(0, 5).map((flag) => (
            <span key={flag}>{flag}</span>
          ))}
          {riskFlags.length === 0 && <span>暂无显式风险旗标</span>}
        </div>
      </div>

      <div className="symbol-context-next-step">
        <span>下一步</span>
        <strong>{nextStep}</strong>
      </div>
    </div>
  );
}

function ContextStatusCard({ context }: { context: MarketContextPayload | null }) {
  return (
    <div className="list-panel compact-list">
      <h2>能力覆盖</h2>
      <p>
        <span>因子</span>
        <strong>{context?.data_coverage.factor_rows || 0} 行</strong>
      </p>
      <p>
        <span>资金流</span>
        <strong>{context?.data_coverage.fund_flow_rows || 0} 行</strong>
      </p>
      <p>
        <span>市场状态</span>
        <strong>{context?.market_state.label || "-"}</strong>
      </p>
      <p>
        <span>交易规则</span>
        <strong>{context?.trading_rules.board || "-"}</strong>
      </p>
    </div>
  );
}

function MarketContextDashboard({ context }: { context: MarketContextPayload | null }) {
  if (!context) {
    return <div className="empty-state block">暂无市场上下文。运行研究流水线后可查看因子、资金流、市场状态和交易规则。</div>;
  }
  const factor = context.factor_snapshot;
  const flow = context.fund_flow_snapshot;
  return (
    <div className="context-grid">
      <div className="detail-panel market-state-panel">
        <div className="detail-header">
          <div>
            <span className={`eyebrow ${context.market_state.tone}`}>Market Regime</span>
            <h2>{context.market_state.label}</h2>
            <p>
              {context.data_coverage.latest_factor_date || "-"} · 相对强弱{" "}
              {context.relative_strength.rank
                ? `${context.relative_strength.rank}/${context.relative_strength.total}`
                : "-"}
            </p>
          </div>
          <span className="status-badge">{context.market_state.regime}</span>
        </div>
        <div className="factor-driver-list">
          {context.market_state.drivers.map((driver) => (
            <span key={driver}>{driver}</span>
          ))}
        </div>
      </div>

      <div className="detail-panel factor-panel">
        <div className="section-subhead">
          <h2>因子快照</h2>
          <span className="muted">{factor?.date || "未计算"}</span>
        </div>
        <div className="factor-metric-grid">
          <MiniMetric label="MA20/60/120" value={`${formatNumber(factor?.ma20, 1)} / ${formatNumber(factor?.ma60, 1)} / ${formatNumber(factor?.ma120, 1)}`} />
          <MiniMetric label="RSI14" value={formatNumber(factor?.rsi14, 1)} />
          <MiniMetric label="ATR14" value={formatNumber(factor?.atr14, 2)} />
          <MiniMetric label="20/60日收益" value={`${formatSignedPercent(factor?.ret20)} / ${formatSignedPercent(factor?.ret60)}`} />
          <MiniMetric label="量/额比" value={`${formatNumber(factor?.volume_ratio20, 2)} / ${formatNumber(factor?.amount_ratio20, 2)}`} />
          <MiniMetric label="相对指数/行业" value={`${formatSignedPercent(factor?.rel_strength_index20)} / ${formatSignedPercent(factor?.rel_strength_industry20)}`} />
        </div>
        <FactorSparkline rows={context.factor_series} />
      </div>

      <div className="detail-panel flow-panel">
        <div className="section-subhead">
          <h2>资金流</h2>
          <span className="muted">{flow?.date || "未同步"}</span>
        </div>
        <div className="factor-metric-grid">
          <MiniMetric label="主力净流入" value={formatMoney(flow?.main_net_inflow)} />
          <MiniMetric label="大单净流入" value={formatMoney(flow?.large_net_inflow)} />
          <MiniMetric label="北向净流入" value={formatMoney(flow?.northbound_net_inflow)} />
          <MiniMetric label="20日主力强度" value={formatNumber(factor?.main_net_inflow_ratio20, 2)} />
          <MiniMetric label="5日北向累计" value={formatMoney(factor?.northbound_inflow_5d)} />
          <MiniMetric label="覆盖" value={`${context.data_coverage.fund_flow_rows} 行`} />
        </div>
        <FundFlowTrendChart rows={context.fund_flow_series} />
      </div>

      <div className="detail-panel rule-panel">
        <div className="section-subhead">
          <h2>市场规则</h2>
          <span className="muted">{context.trading_rules.market}</span>
        </div>
        <div className="rule-grid">
          <MiniMetric label="板块" value={context.trading_rules.board} />
          <MiniMetric label="每手" value={`${context.trading_rules.lot_size}`} />
          <MiniMetric label="交收" value={context.trading_rules.settlement} />
          <MiniMetric label="涨跌幅" value={formatPercent(context.trading_rules.price_limit_pct)} />
          <MiniMetric label="涨停/跌停" value={`${formatNumber(context.trading_rules.limit_up, 2)} / ${formatNumber(context.trading_rules.limit_down, 2)}`} />
          <MiniMetric label="交易日" value={context.trading_rules.calendar?.latest_trade_date || "-"} />
          <MiniMetric label="上市交易日" value={String(context.trading_rules.calendar?.trade_days_since_listing ?? "-")} />
          <MiniMetric
            label="状态旗标"
            value={[
              context.trading_rules.is_st ? "ST" : null,
              context.trading_rules.is_suspended ? "停牌" : null,
              context.trading_rules.is_limit_up ? "涨停" : null,
              context.trading_rules.is_limit_down ? "跌停" : null,
              context.trading_rules.is_first_five_listing_days ? "上市前五日" : null,
            ].filter(Boolean).join(" / ") || "常规"}
          />
        </div>
        <div className="factor-driver-list">
          {context.trading_rules.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResonanceV2StrategyPanel({
  analysis,
  mode,
  loading,
  actionMessage,
  backtest,
  onModeChange,
  onCreateSignal,
  onRunBacktest,
}: {
  analysis: ResonanceV2Analysis | null;
  mode: "conservative" | "aggressive";
  loading: boolean;
  actionMessage: string;
  backtest: ResonanceV2BacktestPayload | null;
  onModeChange: (mode: "conservative" | "aggressive") => void;
  onCreateSignal: () => void;
  onRunBacktest: () => void;
}) {
  if (!analysis) {
    return (
      <div className="detail-panel resonance-panel">
        <div className="section-subhead">
          <h2>V2 多指标共振策略</h2>
          <span className="muted">独立策略模块</span>
        </div>
        <div className="empty-state block">暂无策略分析。请确认后端策略服务和本地日线数据可用。</div>
      </div>
    );
  }
  const decisionTone = `resonance-decision ${analysis.decision.tone || "neutral"}`;
  const buyFactors = analysis.buy_signal?.factors || {};
  const sellComponents = analysis.sell_signal?.components || {};
  const strategySteps = buildReadableSymbolStrategySteps(analysis);
  const strategyCopy = buildReadableSymbolStrategyCopy(analysis);
  const warnings = [
    ...(analysis.data_quality?.blocking_reasons || []),
    ...(analysis.data_quality?.warnings || []),
  ];
  return (
    <div className="detail-panel resonance-panel">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Standalone Strategy</span>
          <h2>V2 多指标共振策略</h2>
          <p>
            {analysis.latest_bar?.date || "-"} · {analysis.symbol} ·{" "}
            {readableStrategyModeLabel(mode)}
          </p>
        </div>
        <div className="strategy-action-bar">
          <div className="segmented-control">
            <button
              className={mode === "conservative" ? "active" : ""}
              onClick={() => onModeChange("conservative")}
              disabled={loading}
            >
              保守
            </button>
            <button
              className={mode === "aggressive" ? "active" : ""}
              onClick={() => onModeChange("aggressive")}
              disabled={loading}
            >
              激进
            </button>
          </div>
          <button className="mini" onClick={onCreateSignal} disabled={loading}>
            写入信号
          </button>
          <button className="primary compact-action" onClick={onRunBacktest} disabled={loading}>
            V2回测
          </button>
        </div>
      </div>

      <div className={decisionTone}>
        <div>
          <span>当前结论</span>
          <strong>{strategyCopy.title}</strong>
        </div>
        <p>{strategyCopy.reasons.slice(0, 2).join(" ")}</p>
      </div>

      <div className="resonance-grid">
        <MiniMetric
          label="个股趋势"
          value={`${strategySteps[0]?.status || "-"} · ${analysis.trend_state?.label || "-"}`}
        />
        <MiniMetric label="市场环境" value={`${strategySteps[1]?.status || "-"} · ${analysis.market_filter?.benchmark_symbol || "-"}`} />
        <MiniMetric label="买入强度" value={`${formatNumber(analysis.buy_signal?.score, 3)} / ${strategySteps[2]?.status || "-"}`} />
        <MiniMetric label="卖出风险" value={`${formatNumber(analysis.sell_signal?.score, 2)} / ${strategySteps[3]?.status || "-"}`} />
        <MiniMetric label="仓位计划" value={`${formatCompactNumber(analysis.position_plan?.suggested_shares)} 股 / ${formatPercent(analysis.position_plan?.suggested_position_pct)}`} />
        <MiniMetric label="止损距离" value={`${formatNumber(analysis.position_plan?.stop_distance, 2)} · 风险 ${formatPercent(analysis.position_plan?.risk_pct)}`} />
      </div>

      {actionMessage && <p className="strategy-action-note">{actionMessage}</p>}

      {backtest && (
        <div className="strategy-backtest-card">
          <div className="section-subhead">
            <h2>V2专属回测</h2>
            <span className="muted">{backtest.backtest_id.slice(0, 8)} · {backtest.start} 至 {backtest.end}</span>
          </div>
          <div className="resonance-grid">
            <MiniMetric label="总收益" value={formatPercent(backtest.result.metrics.total_return)} />
            <MiniMetric label="最大回撤" value={formatPercent(backtest.result.metrics.max_drawdown)} />
            <MiniMetric label="胜率" value={formatPercent(backtest.result.metrics.win_rate)} />
            <MiniMetric label="闭环交易" value={`${backtest.result.metrics.trade_count || 0} 笔`} />
            <MiniMetric label="策略信号" value={`${backtest.result.metrics.signal_count || 0} 次`} />
            <MiniMetric
              label="相对基准"
              value={`${backtest.result.metrics.benchmark_symbol || "-"} / ${formatPercent(backtest.result.metrics.excess_return)}`}
            />
          </div>
          <div className="strategy-backtest-foot">
            <span>终值 {formatMoney(backtest.result.metrics.final_equity)}</span>
            <span>成交腿 {backtest.result.metrics.order_count || backtest.result.trades.length}</span>
            <span>权益点 {backtest.result.equity_curve.length}</span>
          </div>
          {(backtest.result.zero_trade_reasons?.length || backtest.result.data_quality?.no_trade_reasons?.length) ? (
            <div className="warning-list compact-list">
              {(backtest.result.zero_trade_reasons || backtest.result.data_quality?.no_trade_reasons || [])
                .slice(0, 2)
                .map((reason) => (
                  <p key={reason}>
                    <strong>0交易解释</strong>
                    <span>{reason}</span>
                  </p>
                ))}
            </div>
          ) : null}
        </div>
      )}

      <div className="resonance-split">
        <div className="resonance-score-card">
          <div className="section-subhead">
            <h2>买入因子</h2>
            <span className="muted">买入强度拆解</span>
          </div>
          <ScoreRows
            rows={[
              ["趋势", buyFactors.trend],
              ["动能", buyFactors.momentum],
              ["超卖", buyFactors.oversold],
              ["量能", buyFactors.volume],
              ["大盘", buyFactors.market],
            ]}
          />
        </div>
        <div className="resonance-score-card">
          <div className="section-subhead">
            <h2>卖出因子</h2>
            <span className="muted">卖出压力拆解</span>
          </div>
          <ScoreRows
            rows={[
              ["趋势转弱", sellComponents.trend],
              ["MACD", sellComponents.macd],
              ["KDJ", sellComponents.kdj],
              ["大盘恶化", sellComponents.market],
              ["资金撤离", sellComponents.money],
            ]}
          />
        </div>
      </div>

      <div className="resonance-split">
        <PriceChannelTable channels={analysis.price_channels || {}} />
        <div className="checklist-panel">
          <div className="section-subhead">
            <h2>执行清单</h2>
            <span className="muted">盘后决策</span>
          </div>
          <div className="strategy-checklist">
            {(analysis.checklist || []).map((item) => (
              <p key={item.label} className={item.passed ? "passed" : "failed"}>
                <strong>{item.passed ? "通过" : "未过"}</strong>
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="resonance-footer">
        <div className="factor-driver-list">
          {(analysis.market_filter?.drivers || []).map((driver) => (
            <span key={driver}>{driver}</span>
          ))}
          {analysis.market_filter?.benchmark_reason && (
            <span>{analysis.market_filter.benchmark_reason}</span>
          )}
        </div>
        {warnings.length > 0 && (
          <div className="warning-list">
            {warnings.map((warning) => (
              <p key={warning}>
                <strong>数据提示</strong>
                <span>{warning}</span>
              </p>
            ))}
          </div>
        )}
        <p className="muted">{analysis.disclaimer}</p>
      </div>
    </div>
  );
}

function ScoreRows({ rows }: { rows: [string, number | undefined][] }) {
  const maxAbs = Math.max(0.01, ...rows.map(([, value]) => Math.abs(value || 0)));
  return (
    <div className="score-row-list">
      {rows.map(([label, value]) => {
        const normalized = Math.max(4, Math.abs(value || 0) / maxAbs * 100);
        return (
          <div className="score-row" key={label}>
            <span>{label}</span>
            <div className="bar-track">
              <i
                className={(value || 0) >= 0 ? "positive" : "negative"}
                style={{ width: `${normalized}%` }}
              />
            </div>
            <b>{formatNumber(value, 3)}</b>
          </div>
        );
      })}
    </div>
  );
}

function PriceChannelTable({ channels }: { channels: Record<string, number> }) {
  const rows = [
    ["预测高1", channels.predict_high_1],
    ["预测低1", channels.predict_low_1],
    ["预测高2", channels.predict_high_2],
    ["预测低2", channels.predict_low_2],
    ["极端卖出价", channels.sell_price],
    ["买回/硬止损线", channels.buy_back_price],
    ["止损价", channels.stop_price],
    ["目标价1/2", channels.target1, channels.target2],
  ];
  return (
    <div className="data-table-wrap">
      <table className="data-table compact-table dense-table">
        <thead>
          <tr>
            <th>价位</th>
            <th>数值</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value, extra]) => (
            <tr key={String(label)}>
              <td>{label}</td>
              <td>{formatNumber(value as number | undefined, 2)}{typeof extra === "number" ? ` / ${formatNumber(extra, 2)}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OverviewTechnicalChartCard({ chart }: { chart: MarketAnalysisTechnicalChart }) {
  const points = chart.points.slice(-32);
  const values = points.map((point) => point.value).filter(Number.isFinite);
  const scaleMin = typeof chart.scaleMin === "number"
    ? chart.scaleMin
    : Math.min(0, ...values);
  const scaleMax = typeof chart.scaleMax === "number"
    ? chart.scaleMax
    : Math.max(0, ...values);
  const spread = scaleMax === scaleMin ? 1 : scaleMax - scaleMin;
  const xOfFor = (index: number, length: number) => 5 + (index / Math.max(length - 1, 1)) * 110;
  const xOf = (index: number) => xOfFor(index, points.length);
  const yOf = (value: number) => 57 - ((value - scaleMin) / spread) * 48;
  const linePointsFor = (linePoints: typeof points) => linePoints
    .map((point, index) => `${xOfFor(index, linePoints.length).toFixed(1)},${yOf(point.value).toFixed(1)}`)
    .join(" ");
  const linePoints = linePointsFor(points);
  const zeroY = yOf(Math.max(scaleMin, Math.min(scaleMax, 0)));
  return (
    <div className={`overview-technical-chart ${chart.tone}`}>
      <div className="overview-technical-chart-head">
        <span>{chart.label}</span>
        <strong>{chart.value}</strong>
      </div>
      <svg viewBox="0 0 120 64" preserveAspectRatio="none" aria-hidden="true">
        {chart.key === "rsi" && (
          <>
            <line className="threshold risk" x1="4" x2="116" y1={yOf(70)} y2={yOf(70)} />
            <line className="threshold good" x1="4" x2="116" y1={yOf(30)} y2={yOf(30)} />
          </>
        )}
        {chart.key === "dmi-adx" && (
          <line className="threshold good" x1="4" x2="116" y1={yOf(25)} y2={yOf(25)} />
        )}
        {chart.key === "cci" && (
          <>
            <line className="threshold risk" x1="4" x2="116" y1={yOf(100)} y2={yOf(100)} />
            <line className="threshold good" x1="4" x2="116" y1={yOf(-100)} y2={yOf(-100)} />
          </>
        )}
        {chart.key === "williams-r" && (
          <>
            <line className="threshold risk" x1="4" x2="116" y1={yOf(-20)} y2={yOf(-20)} />
            <line className="threshold good" x1="4" x2="116" y1={yOf(-80)} y2={yOf(-80)} />
          </>
        )}
        <line className="baseline" x1="4" x2="116" y1={zeroY} y2={zeroY} />
        {chart.key === "macd" ? points.map((point, index) => {
          const x = xOf(index);
          const y = yOf(point.value);
          return (
            <rect
              className={point.value >= 0 ? "positive-bar" : "negative-bar"}
              height={Math.max(1, Math.abs(zeroY - y))}
              key={`${point.date}-${index}`}
              rx="0.8"
              width={Math.max(1.3, 78 / Math.max(points.length, 1))}
              x={x - 1}
              y={Math.min(zeroY, y)}
            />
          );
        }) : (
          <>
            <polyline className="primary-line" points={linePoints} />
            {(chart.lines || []).map((line) => (
              <polyline
                className={`companion-line ${line.key}`}
                key={line.key}
                points={linePointsFor(line.points.slice(-32))}
              />
            ))}
          </>
        )}
      </svg>
      <em>{chart.detail}</em>
      {points.length === 0 && <span className="empty-state">暂无指标序列</span>}
    </div>
  );
}

function FactorSparkline({ rows }: { rows: MarketContextPayload["factor_series"] }) {
  const latest = rows.slice(-18);
  const maxAbs = Math.max(0.01, ...latest.map((row) => Math.abs(row.ret20 || 0)));
  return (
    <div className="factor-sparkline" aria-label="20日收益因子序列">
      {latest.map((row) => {
        const value = row.ret20 || 0;
        const height = Math.max(8, (Math.abs(value) / maxAbs) * 44);
        return (
          <i
            key={row.date}
            className={value >= 0 ? "positive-bar" : "negative-bar"}
            title={`${row.date} ${formatSignedPercent(value)}`}
            style={{ height: `${height}px` }}
          />
        );
      })}
      {latest.length === 0 && <span className="empty-state">暂无因子序列</span>}
    </div>
  );
}

function RelativeStrengthTrendChart({ model }: { model: RelativeStrengthTrendModel }) {
  const points = model.points;
  const values = points
    .flatMap((point) => [point.indexValue, point.industryValue])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const scaleMin = Math.min(-0.02, 0, ...values);
  const scaleMax = Math.max(0.02, 0, ...values);
  const spread = scaleMax === scaleMin ? 1 : scaleMax - scaleMin;
  const xOf = (index: number) => 5 + (index / Math.max(points.length - 1, 1)) * 110;
  const yOf = (value: number) => 57 - ((value - scaleMin) / spread) * 48;
  const linePoints = (selector: (point: RelativeStrengthTrendModel["points"][number]) => number | null) => points
    .flatMap((point, index) => {
      const value = selector(point);
      if (typeof value !== "number" || !Number.isFinite(value)) return [];
      return [`${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`];
    })
    .join(" ");
  const zeroY = yOf(0);

  return (
    <div className={`relative-strength-chart ${model.tone}`} aria-label="相对强弱趋势">
      <div className="relative-strength-chart-head">
        <span>指数 {formatSignedPercent(model.latestIndex)}</span>
        <strong>行业 {formatSignedPercent(model.latestIndustry)}</strong>
      </div>
      <svg viewBox="0 0 120 64" preserveAspectRatio="none" aria-hidden="true">
        <line className="baseline" x1="4" x2="116" y1={zeroY} y2={zeroY} />
        <polyline className="index-line" points={linePoints((point) => point.indexValue)} />
        <polyline className="industry-line" points={linePoints((point) => point.industryValue)} />
      </svg>
      {points.length === 0 && <span className="empty-state">暂无相对强弱序列</span>}
      <div className="chart-legend">
        <span><i className="legend-line ma20" />相对指数</span>
        <span><i className="legend-line ma60" />相对行业</span>
      </div>
      <em>{model.detail}</em>
    </div>
  );
}

function FundFlowTrendChart({ rows }: { rows: MarketContextPayload["fund_flow_series"] }) {
  const latest = rows.slice(-24);
  const maxAbs = Math.max(
    1,
    ...latest.flatMap((row) => [
      Math.abs(row.main_net_inflow || 0),
      Math.abs(row.large_net_inflow || 0),
      Math.abs(row.northbound_net_inflow || 0),
    ]),
  );
  return (
    <div className="flow-trend-chart" aria-label="资金流趋势">
      <div className="chart-title">
        <span>资金流趋势</span>
        <strong>{latest.length} 日</strong>
      </div>
      <div className="flow-bars">
        {latest.map((row) => (
          <div className="flow-day" key={row.date} title={row.date}>
            {(["main_net_inflow", "large_net_inflow", "northbound_net_inflow"] as const).map((key) => {
              const value = row[key] || 0;
              return (
                <i
                  key={key}
                  className={value >= 0 ? "positive-bar" : "negative-bar"}
                  style={{ height: `${Math.max(4, Math.abs(value) / maxAbs * 54)}px` }}
                />
              );
            })}
          </div>
        ))}
        {latest.length === 0 && <span className="empty-state">暂无资金流序列</span>}
      </div>
      <div className="chart-legend">
        <span><i className="legend-line ma20" />主力</span>
        <span><i className="legend-line ma60" />大单</span>
        <span><i className="legend-marker" />北向</span>
      </div>
    </div>
  );
}

function SignalDetailWorkbench({
  signal,
  explain,
  onReview,
  loading,
}: {
  signal: SignalHistoryRow | null;
  explain: SignalExplainPayload | null;
  onReview: () => void;
  loading: boolean;
}) {
  if (!signal) {
    return <div className="empty-state block">选择左侧信号后查看证据、审查和后验表现。</div>;
  }
  return (
    <div className="detail-panel signal-workbench">
      <div className="detail-header">
        <div>
          <span className="eyebrow">{signal.direction || "SIGNAL"}</span>
          <h2>{signal.signal_name}</h2>
          <p>
            {signal.date} · {signal.signal_level || "-"} · 评分 {formatNumber(signal.score, 1)}
          </p>
        </div>
        <button className="primary" onClick={onReview} disabled={loading}>
          {loading ? "审查中" : "Agent 审查"}
        </button>
      </div>
      <div className="pipeline-summary signal-metrics">
        <Metric label="审查次数" value={String(signal.review_count || 0)} />
        <Metric label="5日收益" value={formatPercent(signal.event_return?.ret_5d)} />
        <Metric label="20日收益" value={formatPercent(signal.event_return?.ret_20d)} />
        <Metric label="最大不利" value={formatPercent(signal.event_return?.max_adverse_20d)} />
      </div>
      <div className="signal-explain-strip">
        <Metric label="决策动作" value={signalExplainActionLabel(explain?.layers.decision.action)} />
        <Metric label="审查状态" value={explain?.review.decision_status || "pending"} />
        <Metric label="风控闸门" value={explain?.trading_plan?.risk_gate?.status || "-"} />
        <Metric label="代理映射" value={explain?.trade_proxy?.default_proxy?.symbol || explain?.trade_proxy?.status || "-"} />
      </div>
      {explain && (
        <div className="signal-explain-panel">
          <div className="list-panel compact-list">
            <h2>统一解释</h2>
            <p>{explain.layers.decision.next_step}</p>
            <p>数据可信度 {explain.quality.trust_level} · 缺失 {explain.quality.missing_tables.length}</p>
            <p>代理 {explain.trade_proxy?.default_proxy?.name || "直接标的"} · {explain.trade_proxy?.default_proxy?.proxy_type || explain.trade_proxy?.status}</p>
          </div>
          <div className="list-panel compact-list">
            <h2>审查结论</h2>
            <p>{explain.review.summary || "暂无审查摘要"}</p>
            {(explain.review.risk_flags || []).slice(0, 3).map((item) => <p key={item}>{readableRiskFlag(item)}</p>)}
          </div>
          <div className="list-panel compact-list">
            <h2>交易计划</h2>
            <p>硬止损 {formatNumber(explain.trading_plan?.hard_stop, 2)}</p>
            <p>最大仓位 {formatPercent(explain.trading_plan?.max_position_pct, 1)}</p>
            {(explain.trading_plan?.risk_gate?.warnings || []).slice(0, 2).map((item) => <p key={item}>{item}</p>)}
          </div>
        </div>
      )}
      <div className="detail-grid">
        <SignalList title="证据" items={explain?.layers.explain.evidence || parseJsonList(signal.evidence_json)} />
        <SignalList title="风险" items={(explain?.layers.explain.risks || parseJsonList(signal.risk_json)).map(readableRiskFlag)} />
        <SignalList title="失效条件" items={(explain?.layers.explain.invalidations || parseJsonList(signal.invalid_json)).map(readableRiskFlag)} />
      </div>
      <div className="data-table-wrap">
        <table className="data-table compact-table dense-table">
          <tbody>
            <tr>
              <th>入场</th>
              <td>{signal.event_return?.entry_date || "-"} / {formatNumber(signal.event_return?.entry_price, 2)}</td>
            </tr>
            <tr>
              <th>5 / 20 / 60日</th>
              <td>
                {formatPercent(signal.event_return?.ret_5d)} / {formatPercent(signal.event_return?.ret_20d)} /{" "}
                {formatPercent(signal.event_return?.ret_60d)}
              </td>
            </tr>
            <tr>
              <th>超额 / 最大有利</th>
              <td>
                {formatPercent(signal.event_return?.excess_index_20d)} /{" "}
                {formatPercent(signal.event_return?.max_favorable_20d)}
              </td>
            </tr>
            <tr>
              <th>最近审查</th>
              <td>{signal.latest_review_at || "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function signalExplainActionLabel(action?: string) {
  if (action === "buy") return "可执行";
  if (action === "blocked") return "禁止";
  if (action === "watch") return "观察";
  return action || "-";
}

function SignalList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="list-panel compact-list">
      <h2>{title}</h2>
      {items.slice(0, 4).map((item) => (
        <p key={item}>{item}</p>
      ))}
      {items.length === 0 && <p className="empty-state">暂无记录</p>}
    </div>
  );
}

function RecentBarsTable({ bars }: { bars: MarketHistoryBar[] }) {
  const [sortKey, setSortKey] = useState<"date" | "close" | "volume">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const sortedBars = useMemo(() => {
    return [...bars].sort((a, b) => {
      const result =
        sortKey === "date"
          ? a.date.localeCompare(b.date)
          : Number(a[sortKey] || 0) - Number(b[sortKey] || 0);
      return sortDirection === "asc" ? result : -result;
    });
  }, [bars, sortDirection, sortKey]);
  const toggleSort = (key: "date" | "close" | "volume") => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

  return (
    <div className="data-table-wrap">
      <table className="data-table compact-table dense-table">
        <thead>
          <tr>
            <th><button className="table-sort" onClick={() => toggleSort("date")}>日期</button></th>
            <th><button className="table-sort" onClick={() => toggleSort("close")}>收盘</button></th>
            <th>高 / 低</th>
            <th><button className="table-sort" onClick={() => toggleSort("volume")}>成交量</button></th>
          </tr>
        </thead>
        <tbody>
          {sortedBars.map((bar) => (
            <tr key={bar.date}>
              <td>{bar.date}</td>
              <td>{formatNumber(bar.close, 2)}</td>
              <td>
                {formatNumber(bar.high, 2)} / {formatNumber(bar.low, 2)}
              </td>
              <td>{formatCompactNumber(bar.volume)}</td>
            </tr>
          ))}
          {bars.length === 0 && (
            <tr>
              <td colSpan={4}>暂无日线</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
