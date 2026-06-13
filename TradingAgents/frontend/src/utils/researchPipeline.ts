export interface WatchlistStatusRow {
  symbol: string;
  market: string;
  bar_count: number;
  latest_bar_date?: string | null;
  signal_count: number;
  latest_signal_date?: string | null;
  scan_readiness: string;
  readiness_reason: string;
}

export interface PipelineWarning {
  date?: string | null;
  check_name?: string | null;
  severity?: string | null;
  symbol?: string | null;
  message: string;
}

export interface PipelineSummary {
  start?: string;
  end?: string;
  signal_date?: string;
  rows_synced: number;
  fund_flow_rows?: number;
  factor_rows: number;
  signal_count: number;
  watchlist_count: number;
  watchlist_status: WatchlistStatusRow[];
  core_universe?: {
    symbol: string;
    name?: string | null;
    market: string;
    industry?: string | null;
    thesis?: string | null;
    in_watchlist?: boolean;
    scan_readiness?: string;
    bar_count?: number;
    latest_bar_date?: string | null;
    signal_count?: number;
  }[];
  missing_core_symbols?: string[];
  bootstrapped_symbols?: string[];
  warnings?: PipelineWarning[];
}

export const READINESS_LABELS: Record<string, string> = {
  no_data: "无数据",
  insufficient_20: "少于20日",
  insufficient_60: "少于60日",
  partial: "部分可扫",
  ready: "可扫描",
};

export function readinessCounts(rows: WatchlistStatusRow[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.scan_readiness] = (counts[row.scan_readiness] || 0) + 1;
    return counts;
  }, {});
}

export function pipelineEmptyReason(summary: PipelineSummary | null) {
  if (!summary) return "暂无记录。可先运行同步并扫描。";
  if (summary.watchlist_count === 0) return "自选股池为空，请先添加股票。";
  if ((summary.warnings || []).length > 0 && summary.rows_synced === 0) {
    return "数据同步失败，暂时无法生成有效信号。";
  }

  const counts = readinessCounts(summary.watchlist_status);
  const scannable = (counts.ready || 0) + (counts.partial || 0);
  if (scannable === 0) {
    return "自选股数据不足，需先补齐至少 60 个交易日行情。";
  }
  return "扫描完成，当前规则未触发信号。";
}
