// V2 API fetchers — 统一 fetch + abort + 错误处理
//
// 为什么不重用 V1 的 fetchApiPayload：
// - V1 那个签名是 callback 风格，不便接 AbortSignal
// - V2 全部组件走 useAsync 的 race protection，必须支持 signal
import type {
  MarketContextPayload,
  MarketHistoryPayload,
  RealtimeQuotePayload,
} from "../../types/market";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string | null;
  detail?: string;
}

async function fetchJson<T>(
  url: string,
  signal: AbortSignal,
  fallbackError: string
): Promise<T> {
  const res = await fetch(url, { signal });
  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(fallbackError);
  }
  if (!body.success || body.data == null) {
    throw new Error(body.error || body.detail || fallbackError);
  }
  return body.data;
}

async function postJson<T>(
  url: string,
  payload: unknown,
  fallbackError: string
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(fallbackError);
  }
  if (!body.success || body.data == null) {
    throw new Error(body.error || body.detail || fallbackError);
  }
  return body.data;
}

const q = (params: Record<string, string | number | undefined>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) u.append(k, String(v));
  });
  return u.toString();
};

// ============================================================
// 基础接口（V1 已有的复用）
// ============================================================

export interface SignalHistoryPayloadShape {
  symbol: string;
  total_count: number;
  signals: {
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
  }[];
}

export interface AnalysisReadinessPayloadShape {
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
  categories: {
    key: string;
    label: string;
    status: "ready" | "warn" | "blocker";
    coverage: number;
    impact: string;
    evidence: string[];
    next_step: string;
    target_view: string;
    metadata?: Record<string, unknown>;
  }[];
  next_actions: {
    key: string;
    priority: "P0" | "P1" | "P2";
    label: string;
    action: string;
    target_view: string;
  }[];
  disclaimer?: string;
}

export interface ResonanceV2AnalysisShape {
  strategy_name: string;
  symbol: string;
  mode: "conservative" | "aggressive";
  latest_bar?: { date?: string; close?: number | null };
  decision: {
    action: string;
    label: string;
    tone: string;
    /** 新增（向后兼容）：动作短语 + 理由列表 */
    action_phrase?: string;
    rationale?: string[];
  };
  /** 新增（向后兼容）：与 bull 真镜像的反向触发条件 */
  falsify_conditions?: {
    text: string;
    occurred: boolean;
    occurred_for_days?: number;
    mirror_of?: number;
  }[];
  trend_state?: {
    label?: string;
    strength?: number | null;
    action?: string;
    ema21?: number | null;
    ema89?: number | null;
  };
  market_filter?: {
    benchmark_symbol?: string;
    benchmark_reason?: string;
    status?: string;
    passed?: boolean;
    drivers?: string[];
  };
  buy_signal?: {
    score?: number | null;
    threshold?: number;
    mode_signal?: boolean;
    factors?: Record<string, number>;
  };
  sell_signal?: {
    score?: number | null;
    threshold?: number;
    regular_exit?: boolean;
    emergency?: boolean;
    warning_level?: { level: number; label: string; action: string };
    components?: Record<string, number>;
  };
  price_channels?: Record<string, number>;
  position_plan?: {
    suggested_shares?: number;
    suggested_position_pct?: number;
    risk_pct?: number;
    stop_distance?: number;
  };
  checklist?: { label: string; passed: boolean; detail: string }[];
  data_quality?: {
    warnings?: string[];
    blocking_reasons?: string[];
    bar_count?: number;
    has_benchmark?: boolean;
    has_fund_flow?: boolean;
  };
  disclaimer?: string;
}

export interface NewsEvidencePayloadShape {
  symbol: string;
  start: string;
  end: string;
  items: {
    news_id: string;
    date: string;
    headline: string;
    source?: string;
    url?: string | null;
    sentiment?: string;
    credibility?: number;
    summary?: string | null;
  }[];
}

export interface FundamentalsPayloadShape {
  symbol: string;
  end: string;
  security_profile: {
    symbol: string;
    name?: string | null;
    industry?: string | null;
    sub_industry?: string | null;
    market?: string | null;
    market_cap?: number | null;
    free_float_market_cap?: number | null;
  };
  market_snapshot?: Record<string, unknown> | null;
  valuation_snapshot?: {
    revenue?: number | null;
    net_income?: number | null;
    roe?: number | null;
    pe_ttm?: number | null;
    pb?: number | null;
    dividend_yield?: number | null;
    /** Phase 2 BE-1 扩展时新增 */
    quarters?: string[];
    /** Phase 3 BE-6 扩展时新增 */
    ps?: number | null;
    ev_ebitda?: number | null;
  } | null;
  financial_reports?: {
    items: {
      date: string;
      statement_type: string;
      period?: string;
      metrics_json?: string;
    }[];
    latest_by_type: Record<string, unknown>;
    summary: { available_count: number; missing_count: number };
  };
  /** BE-1 Phase 2 扩展：8 季度时间序列 */
  quarterly_series?: {
    quarters: string[];
    revenue: (number | null)[];
    net_income: (number | null)[];
    roe: (number | null)[];
  };
}

/** Phase 2 BE-2 新接口 */
export interface ValuationPercentilePayloadShape {
  symbol: string;
  date: string;
  items: {
    name: string;
    value: number | null;
    industry_pct: number | null;
    history_pct: number | null;
  }[];
}

/** Phase 2 BE-3 新接口 */
export interface CatalystsPayloadShape {
  symbol: string;
  past: {
    date: string;
    type: string;
    title: string;
    tone: string;
    source_url?: string;
    note?: string;
  }[];
  future: {
    date: string;
    type: string;
    title: string;
    tone: string;
    note?: string;
  }[];
  future_window_days: number;
}

/** 单个 regime 桶的后验统计 — #2 */
export interface RegimeBucketShape {
  regime: string;
  n: number;
  win: number;
  win_rate: number | null;
  avg_20d: number | null;
}

/** Phase 2 BE-4 新接口 */
export interface BacktestSummaryPayloadShape {
  symbol: string;
  strategy_version: string;
  n: number;
  win: number;
  loss: number;
  win_rate: number | null;
  avg_5d: number | null;
  avg_20d: number | null;
  avg_60d: number | null;
  max_adverse: number | null;
  curve: number[];
  curve_dates: string[];
  sample_quality: "A" | "B" | "C" | "insufficient";
  /** #2: 按市场状态切分的胜率 */
  by_regime?: RegimeBucketShape[];
}

// ============================================================
// Fetcher 函数 — 全部带 signal
// ============================================================

export const fetchHistory = (symbol: string, start: string, end: string, signal: AbortSignal) =>
  fetchJson<MarketHistoryPayload>(
    `/api/market/history?${q({ symbol, start, end, limit: 900 })}`,
    signal,
    "行情服务未连接"
  );

export const fetchContext = (symbol: string, start: string, end: string, signal: AbortSignal) =>
  fetchJson<MarketContextPayload>(
    `/api/market/context?${q({ symbol, start, end, limit: 180 })}`,
    signal,
    "市场上下文服务未连接"
  );

export const fetchRealtime = (symbol: string, signal: AbortSignal) =>
  fetchJson<RealtimeQuotePayload>(
    `/api/market/realtime/quotes?${q({ symbols: symbol })}`,
    signal,
    "准实时行情服务未连接"
  );

export const fetchStrategy = (
  symbol: string,
  start: string,
  end: string,
  mode: "conservative" | "aggressive",
  signal: AbortSignal
) =>
  fetchJson<ResonanceV2AnalysisShape>(
    `/api/strategies/resonance-v2/analyze?${q({ symbol, start, end, mode, capital: 1_000_000 })}`,
    signal,
    "V2 策略服务未连接"
  );

export const fetchReadiness = (symbol: string, date: string, signal: AbortSignal) =>
  fetchJson<AnalysisReadinessPayloadShape>(
    `/api/professional/analysis-readiness?${q({ symbol, date })}`,
    signal,
    "分析完整度服务未连接"
  );

export const fetchSignalHistory = (symbol: string, start: string, end: string, signal: AbortSignal) =>
  fetchJson<SignalHistoryPayloadShape>(
    `/api/signals/history?${q({ symbol, start, end })}`,
    signal,
    "信号服务未连接"
  );

export const fetchNews = (symbol: string, start: string, end: string, signal: AbortSignal) =>
  fetchJson<NewsEvidencePayloadShape>(
    `/api/professional/news-evidence?${q({ symbol, start, end, limit: 50 })}`,
    signal,
    "新闻证据服务未连接"
  );

export const fetchFundamentals = (
  symbol: string,
  end: string,
  signal: AbortSignal,
  opts: { quarters?: number } = {}
) =>
  fetchJson<FundamentalsPayloadShape>(
    `/api/professional/fundamentals?${q({ symbol, end })}`,
    signal,
    "基本面服务未连接"
  );

/** BE-1 扩展接口：N 季度财务序列 */
export const fetchFundamentalsQuarterly = (
  symbol: string,
  end: string,
  signal: AbortSignal,
  quarters = 8
) =>
  fetchJson<{
    symbol: string;
    end: string;
    quarters_requested: number;
    quarterly_series: {
      quarters: string[];
      revenue: (number | null)[];
      net_income: (number | null)[];
      roe: (number | null)[];
    };
    data_quality: { available: boolean; period_count: number };
  }>(
    `/api/professional/fundamentals-quarterly?${q({ symbol, end, quarters })}`,
    signal,
    "财务序列服务未连接"
  );

export interface FundamentalsSyncPayloadShape {
  symbols: string[];
  end: string;
  source: string;
  rows_written: number;
  statement_rows_written: number;
  failures: { symbol?: string; method?: string; error?: string }[];
}

export const syncFundamentals = (
  symbol: string,
  end: string,
  source = "yfinance"
) =>
  postJson<FundamentalsSyncPayloadShape>(
    "/api/professional/fundamentals/sync",
    { symbols: [symbol], end, source },
    "财报同步服务未连接"
  );

// Phase 2 — 新增 endpoints
export const fetchValuationPercentile = (symbol: string, date: string, signal: AbortSignal) =>
  fetchJson<ValuationPercentilePayloadShape>(
    `/api/professional/valuation-percentile?${q({ symbol, date })}`,
    signal,
    "估值百分位服务未连接"
  );

export const fetchCatalysts = (symbol: string, date: string, signal: AbortSignal) =>
  // 优先 v2（含 future），失败时上层会 fallback 到 news 推断
  fetchJson<CatalystsPayloadShape>(
    `/api/professional/catalysts-v2?${q({ symbol, date, past_days: 60, future_days: 30 })}`,
    signal,
    "催化剂服务未连接"
  );

/** BE-7: 龙虎榜机构席位 */
export interface InstitutionalDesksPayloadShape {
  symbol: string;
  date: string;
  items: {
    date: string;
    name: string;
    tag: "北向" | "机构" | "游资";
    net: number | null;
    buy: number | null;
    sell: number | null;
  }[];
  data_quality: { available: boolean; count: number };
}
export const fetchInstitutionalDesks = (
  symbol: string,
  date: string,
  signal: AbortSignal
) =>
  fetchJson<InstitutionalDesksPayloadShape>(
    `/api/professional/institutional-desks?${q({ symbol, date, limit: 20 })}`,
    signal,
    "机构席位服务未连接"
  );

/** #4: 卖方一致预期 */
export interface ConsensusPayloadShape {
  symbol: string;
  date: string;
  window_days: number;
  total_reports: number;
  org_count: number;
  recent_30d_count: number;
  rating_distribution: { rating: string; count: number }[];
  eps_consensus: number | null;
  target_price_avg: number | null;
  revision_hint: string | null;
}
export const fetchConsensus = (symbol: string, date: string, signal: AbortSignal) =>
  fetchJson<ConsensusPayloadShape>(
    `/api/professional/consensus?${q({ symbol, date, window_days: 90 })}`,
    signal,
    "卖方一致预期服务未连接"
  );

/** 盈利质量 / 现金流 */
export interface QualityMetricsPayloadShape {
  symbol: string;
  date: string;
  available: boolean;
  gross_margin: number | null;
  net_margin: number | null;
  operating_cashflow: number | null;
  ocf_to_net_income: number | null;
  free_cashflow: number | null;
  debt_to_assets: number | null;
  roe: number | null;
  quality_score: number | null;
  flags: {
    key: string;
    label: string;
    value: number | null;
    tone: string;
    detail: string;
  }[];
}
export const fetchQualityMetrics = (symbol: string, date: string, signal: AbortSignal) =>
  fetchJson<QualityMetricsPayloadShape>(
    `/api/professional/quality-metrics?${q({ symbol, date })}`,
    signal,
    "盈利质量服务未连接"
  );

/** 筹码集中度 */
export interface HoldingConcentrationPayloadShape {
  symbol: string;
  date: string;
  available: boolean;
  northbound_float_pct: number | null;
  northbound_total_pct: number | null;
  fund_float_pct: number | null;
  fund_count: number | null;
  shareholder_count: number | null;
  shareholder_count_delta_pct: number | null;
  top10_holder_pct: number | null;
  concentration_score: number | null;
  items: {
    key: string;
    label: string;
    value: number | null;
    tone: string;
    detail: string;
  }[];
}
export const fetchHoldingConcentration = (symbol: string, date: string, signal: AbortSignal) =>
  fetchJson<HoldingConcentrationPayloadShape>(
    `/api/professional/holding-concentration?${q({ symbol, date })}`,
    signal,
    "筹码集中度服务未连接"
  );

/** 同板块联动 — readability §3 缺失 1 */
export interface SectorSnapshotShape {
  symbol: string;
  date: string;
  industry: string | null;
  own_change_pct: number | null;
  sector_avg_change_pct: number | null;
  market_index: {
    symbol: string;
    change_pct: number | null;
  };
  peers: { symbol: string; name: string; change_pct: number | null }[];
}
export const fetchSectorSnapshot = (
  symbol: string,
  date: string,
  signal: AbortSignal
) =>
  fetchJson<SectorSnapshotShape>(
    `/api/professional/sector-snapshot?${q({ symbol, date })}`,
    signal,
    "板块联动服务未连接"
  );

export const fetchBacktestSummary = (symbol: string, signal: AbortSignal) =>
  fetchJson<BacktestSummaryPayloadShape>(
    `/api/professional/backtest-summary?${q({ symbol, strategy: "resonance_v2" })}`,
    signal,
    "后验聚合服务未连接"
  );
