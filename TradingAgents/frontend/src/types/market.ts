export interface SparkPoint {
  date: string;
  close: number;
}

export interface MarketQuote {
  symbol: string;
  name?: string | null;
  display_name?: string | null;
  alias_notice?: string | null;
  asset_type?: "equity" | "index" | string;
  market: string;
  trade_date?: string | null;
  price?: number | null;
  prev_close?: number | null;
  change?: number | null;
  change_pct?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  amount?: number | null;
  source?: string | null;
  status: "ok" | "missing" | string;
  status_text?: string;
  data_age_days?: number | null;
  freshness_status?: "fresh" | "delayed" | "stale" | "missing" | string;
  freshness_text?: string;
  delay_policy?: string;
  sparkline: SparkPoint[];
}

export interface MarketBreadth {
  requested_count: number;
  loaded_count: number;
  missing_count: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  advance_decline_ratio?: number | null;
}

export interface MarketSnapshot {
  market: string;
  count: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  avg_change_pct: number;
  amount: number;
}

export interface MarketPulsePayload {
  symbols: string[];
  latest_date?: string | null;
  breadth: MarketBreadth;
  freshness?: {
    latest_date?: string | null;
    max_age_days?: number | null;
    fresh_count: number;
    delayed_count: number;
    stale_count: number;
    missing_count: number;
    delay_policy: string;
  };
  gainers: MarketQuote[];
  losers: MarketQuote[];
  market_snapshots: MarketSnapshot[];
  quotes: MarketQuote[];
}

export interface MarketHistoryBar {
  date: string;
  symbol: string;
  market: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
  amount?: number | null;
  adj_factor?: number | null;
  source?: string | null;
}

export interface MarketHistoryPayload {
  symbol: string;
  alias_symbol?: string | null;
  asset_type?: "equity" | "index" | string;
  name?: string | null;
  display_name?: string | null;
  alias_notice?: string | null;
  start: string;
  end: string;
  bar_count: number;
  quote?: MarketQuote | null;
  bars: MarketHistoryBar[];
}

export interface RealtimeQuote extends Omit<MarketQuote, "status" | "sparkline"> {
  name?: string | null;
  trade_time?: string | null;
  timestamp?: string | null;
  provider?: string | null;
  provider_status?: string | null;
  status: "live" | "fallback" | "unavailable" | string;
  status_text?: string;
  is_realtime: boolean;
  refresh_interval_seconds?: number | null;
  error?: string | null;
  sparkline?: SparkPoint[];
}

export interface RealtimeQuotePayload {
  requested_count: number;
  loaded_count: number;
  live_count: number;
  fallback_count: number;
  unavailable_count: number;
  generated_at: string;
  refresh_interval_seconds: number;
  delay_policy: string;
  quotes: RealtimeQuote[];
}

export interface IntradayPoint {
  symbol: string;
  date: string;
  time: string;
  datetime: string;
  price?: number | null;
  volume?: number | null;
  amount?: number | null;
  cumulative_volume?: number | null;
  cumulative_amount?: number | null;
}

export interface IntradayPayload {
  symbol: string;
  market: string;
  date?: string | null;
  interval: string;
  point_count: number;
  points: IntradayPoint[];
  quote?: RealtimeQuote | null;
  source?: string | null;
  provider?: string | null;
  provider_status?: string | null;
  status: "live" | "unavailable" | string;
  status_text?: string;
  is_realtime: boolean;
  delay_policy: string;
  refresh_interval_seconds?: number | null;
  generated_at?: string;
  error?: string | null;
}

export interface FactorSnapshot {
  date: string;
  symbol: string;
  ma20?: number | null;
  ma60?: number | null;
  ma120?: number | null;
  rsi14?: number | null;
  atr14?: number | null;
  volume_ratio20?: number | null;
  amount_ratio20?: number | null;
  ret20?: number | null;
  ret60?: number | null;
  rel_strength_index20?: number | null;
  rel_strength_industry20?: number | null;
  weekly_state?: string | null;
  monthly_state?: string | null;
  main_net_inflow_ratio20?: number | null;
  northbound_inflow_5d?: number | null;
}

export interface FundFlowSnapshot {
  date: string;
  symbol: string;
  main_net_inflow?: number | null;
  large_net_inflow?: number | null;
  northbound_net_inflow?: number | null;
}

export interface MarketContextPayload {
  symbol: string;
  start: string;
  end: string;
  factor_snapshot?: FactorSnapshot | null;
  factor_series: FactorSnapshot[];
  fund_flow_snapshot?: FundFlowSnapshot | null;
  fund_flow_series: FundFlowSnapshot[];
  market_state: {
    regime: string;
    label: string;
    tone: "positive" | "negative" | "flat" | "missing" | string;
    drivers: string[];
  };
  relative_strength: {
    rank?: number | null;
    total: number;
    percentile?: number | null;
    leader?: { symbol: string; rel_strength_index20?: number | null } | null;
  };
  trading_rules: {
    market: string;
    board: string;
    lot_size: number;
    settlement: string;
    price_limit_pct?: number | null;
    limit_up?: number | null;
    limit_down?: number | null;
    is_st?: boolean;
    is_suspended?: boolean;
    is_limit_up?: boolean;
    is_limit_down?: boolean;
    is_first_five_listing_days?: boolean;
    calendar?: {
      latest_trade_date?: string | null;
      recent_trade_dates: string[];
      list_date?: string | null;
      trade_days_since_listing?: number | null;
    };
    warnings: string[];
  };
  data_coverage: {
    bar_rows: number;
    factor_rows: number;
    fund_flow_rows: number;
    latest_bar_date?: string | null;
    latest_factor_date?: string | null;
    latest_fund_flow_date?: string | null;
    source?: string | null;
  };
}
