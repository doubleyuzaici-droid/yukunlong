import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DataTrustPanel } from "../components/DataTrustPanel";
import { formatMoney, formatPercent } from "../utils/formatters";

const today = new Date().toISOString().slice(0, 10);

interface BacktestSummaryRow {
  signal_name: string;
  sample_count: number;
  win_rate_5d?: number;
  win_rate_20d?: number;
  win_rate_60d?: number;
  median_ret_5d?: number;
  median_ret_20d?: number;
  median_ret_60d?: number;
  mean_ret_20d?: number;
  mean_max_adverse_20d?: number;
}

interface BacktestFailure {
  symbol?: string;
  signal_name?: string;
  reason?: string;
  fail_reason?: string;
  date?: string;
}

interface EventRow {
  signal_id: string;
  date: string;
  symbol: string;
  market?: string;
  signal_name: string;
  signal_level?: string;
  entry_date?: string;
  entry_price?: number;
  ret_5d?: number;
  ret_20d?: number;
  ret_60d?: number;
  excess_index_20d?: number | null;
  max_adverse_20d?: number;
  max_favorable_20d?: number;
  market_regime?: string | null;
}

interface BacktestPayload {
  backtest_id: string;
  result: {
    events: EventRow[];
    summary: BacktestSummaryRow[];
    failures: BacktestFailure[];
  };
}

interface PortfolioPayload {
  backtest_id: string;
  result: {
    strategy_version: string;
    metrics: Record<string, number> & { benchmark_symbol?: string };
    equity_curve: EquityPoint[];
    benchmark_curve?: BenchmarkPoint[];
    trades: TradeRow[];
    position_lifecycle?: PositionLifecycleRow[];
    trade_attribution?: TradeAttributionRow[];
    capital_usage?: CapitalUsageRow[];
    exposures?: ExposureRow[];
    return_distribution?: ReturnDistribution;
    risk_diagnostics?: RiskDiagnostics;
    skipped_trades?: SkippedTradeRow[];
    execution_assumptions?: ExecutionAssumptions;
    audit_summary?: BacktestAuditSummary;
  };
}

interface EquityPoint {
  date: string;
  equity: number;
  drawdown?: number;
}

interface BenchmarkPoint {
  date: string;
  benchmark_symbol: string;
  benchmark_equity: number;
  benchmark_return: number;
  strategy_return: number;
  excess_return: number;
}

interface TradeRow {
  trade_id: string;
  symbol: string;
  side: string;
  date: string;
  price: number;
  quantity: number;
  cost: number;
  cost_breakdown?: {
    commission_tax?: number;
    slippage?: number;
    total?: number;
  };
  reason?: string;
}

interface SkippedTradeRow {
  signal_id: string;
  symbol: string;
  date: string;
  reason: string;
}

interface ExecutionAssumptions {
  execution_price: string;
  holding_days: number;
  slippage_bps: number;
  max_position_pct: number;
  t_plus_1: boolean;
  filters: string[];
}

interface BacktestAuditSummary {
  signal_count: number;
  executed_lifecycle_count: number;
  trade_log_count: number;
  skipped_count: number;
  cost_total: number;
}

interface PositionLifecycleRow {
  signal_id: string;
  symbol: string;
  market: string;
  signal_name: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  entry_notional: number;
  net_pnl: number;
  net_return: number;
  holding_days: number;
  exit_reason: string;
}

interface TradeAttributionRow {
  symbol: string;
  market: string;
  trade_count: number;
  win_rate: number;
  net_pnl: number;
  total_cost: number;
  avg_return: number;
}

interface CapitalUsageRow {
  date: string;
  cash: number;
  positions_value: number;
  capital_used_pct: number;
  symbol?: string;
  event?: string;
}

interface ExposureRow {
  market: string;
  position_count: number;
  capital_used: number;
  capital_share: number;
  net_pnl: number;
}

interface ReturnDistribution {
  total_count: number;
  win_count: number;
  loss_count: number;
  average_return: number;
  median_return: number;
  best_return: number;
  worst_return: number;
  average_win: number;
  average_loss: number;
  payoff_ratio?: number | null;
  buckets: { label: string; count: number }[];
}

interface RiskDiagnostics {
  monthly_returns?: { month: string; return: number }[];
  longest_drawdown_points?: number;
  exposure_peak_pct?: number;
  cost_to_equity_pct?: number;
  trade_return_stdev?: number;
  benchmark_status?: string;
}

interface BacktestHistoryRun {
  kind: "event" | "portfolio";
  backtest_id: string;
  created_at?: string;
  start?: string;
  end?: string;
  sample_count?: number;
  failure_count?: number;
  trade_count?: number;
  total_return?: number;
  max_drawdown?: number;
  strategy_version?: string;
}

export default function BacktestPage({
  initialSymbol,
  initialEnd = today,
  onOpenSymbol,
}: {
  initialSymbol?: string;
  initialEnd?: string;
  onOpenSymbol?: (symbol: string, date?: string) => void;
}) {
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState(initialEnd);
  const [signals, setSignals] = useState("趋势增强,放量突破,回踩确认");
  const [strategyVersion, setStrategyVersion] = useState("portfolio_v1");
  const [initialCash, setInitialCash] = useState(1000000);
  const [holdingDays, setHoldingDays] = useState(20);
  const [slippageBps, setSlippageBps] = useState(2);
  const [maxPositionPct, setMaxPositionPct] = useState(10);
  const [result, setResult] = useState<BacktestPayload | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioPayload | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [portfolioMarkdown, setPortfolioMarkdown] = useState("");
  const [history, setHistory] = useState<BacktestHistoryRun[]>([]);
  const [loading, setLoading] = useState<"event" | "portfolio" | null>(null);
  const [message, setMessage] = useState("");

  const eventChartRows = useMemo(() => result?.result.summary || [], [result]);
  const portfolioDiagnostics = useMemo(() => {
    const trades = portfolio?.result.trades || [];
    return {
      entryCount: trades.filter((trade) => trade.side === "entry").length,
      exitCount: trades.filter((trade) => trade.side === "exit").length,
      stopCount: trades.filter((trade) => /stop/i.test(trade.reason || "")).length,
      totalCost: trades.reduce((sum, trade) => sum + (trade.cost || 0), 0),
    };
  }, [portfolio]);

  const exportEventSamples = () => {
    const rows = result?.result.events || [];
    downloadCsv(
      `event-backtest-${result?.backtest_id || "samples"}.csv`,
      ["date", "symbol", "signal_name", "entry_date", "entry_price", "ret_5d", "ret_20d", "ret_60d", "max_adverse_20d"],
      rows.map((row) => [
        row.date,
        row.symbol,
        row.signal_name,
        row.entry_date || "",
        row.entry_price ?? "",
        row.ret_5d ?? "",
        row.ret_20d ?? "",
        row.ret_60d ?? "",
        row.max_adverse_20d ?? "",
      ]),
    );
  };

  const exportPortfolioTrades = () => {
    const rows = portfolio?.result.trades || [];
    downloadCsv(
      `portfolio-backtest-${portfolio?.backtest_id || "trades"}.csv`,
      ["trade_id", "symbol", "side", "date", "price", "quantity", "cost", "reason"],
      rows.map((row) => [
        row.trade_id,
        row.symbol,
        row.side,
        row.date,
        row.price,
        row.quantity,
        row.cost,
        row.reason || "",
      ]),
    );
  };

  useEffect(() => {
    setEnd(initialEnd);
  }, [initialEnd]);

  const loadHistory = async () => {
    const response = await fetch("/api/backtests/history");
    const data = await response.json();
    if (data.success) setHistory(data.data.runs);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const run = async () => {
    setLoading("event");
    setMessage("");
    setMarkdown("");
    const response = await fetch("/api/backtests/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start,
        end,
        signal_names: signals.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
      }),
    });
    const data = await response.json();
    if (data.success) {
      setResult(data.data);
      const reportResponse = await fetch(`/api/backtests/event/${data.data.backtest_id}/report`);
      const reportData = await reportResponse.json();
      if (reportData.success) setMarkdown(reportData.data.markdown);
      setMessage(`事件样本 ${data.data.result.events.length} 条`);
      await loadHistory();
    } else {
      setMessage("事件回测失败");
    }
    setLoading(null);
  };

  const runPortfolio = async () => {
    setLoading("portfolio");
    setMessage("");
    setPortfolioMarkdown("");
    const response = await fetch("/api/backtests/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start,
        end,
        strategy_version: strategyVersion,
        initial_cash: initialCash,
        holding_days: holdingDays,
        slippage_bps: slippageBps,
        max_position_pct: maxPositionPct / 100,
      }),
    });
    const data = await response.json();
    if (data.success) {
      setPortfolio(data.data);
      const reportResponse = await fetch(`/api/backtests/portfolio/${data.data.backtest_id}/report`);
      const reportData = await reportResponse.json();
      if (reportData.success) setPortfolioMarkdown(reportData.data.markdown);
      setMessage("组合回测完成");
      await loadHistory();
    } else {
      setMessage("组合回测失败");
    }
    setLoading(null);
  };

  const openHistory = async (run: BacktestHistoryRun) => {
    setMessage("");
    if (run.kind === "event") {
      const response = await fetch(`/api/backtests/event/${run.backtest_id}`);
      const data = await response.json();
      if (data.success) {
        setResult(data.data);
        const reportResponse = await fetch(`/api/backtests/event/${run.backtest_id}/report`);
        const reportData = await reportResponse.json();
        if (reportData.success) setMarkdown(reportData.data.markdown);
        setMessage(`已打开事件回测 ${run.backtest_id.slice(0, 8)}`);
      }
    } else {
      const response = await fetch(`/api/backtests/portfolio/${run.backtest_id}`);
      const data = await response.json();
      if (data.success) {
        setPortfolio(data.data);
        const reportResponse = await fetch(`/api/backtests/portfolio/${run.backtest_id}/report`);
        const reportData = await reportResponse.json();
        if (reportData.success) setPortfolioMarkdown(reportData.data.markdown);
        setMessage(`已打开组合回测 ${run.backtest_id.slice(0, 8)}`);
      }
    }
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>事件回测</h1>
        <p>按 T 日信号、T+1 开盘观察后验表现。</p>
      </div>
      <div className="toolbar">
        <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <input value={signals} onChange={(event) => setSignals(event.target.value)} />
        <input value={strategyVersion} onChange={(event) => setStrategyVersion(event.target.value)} />
        <input type="number" value={initialCash} onChange={(event) => setInitialCash(Number(event.target.value))} />
        <input type="number" value={holdingDays} min={1} max={252} onChange={(event) => setHoldingDays(Number(event.target.value))} />
        <input type="number" value={slippageBps} min={0} max={100} step={0.5} onChange={(event) => setSlippageBps(Number(event.target.value))} title="滑点 bps" />
        <input type="number" value={maxPositionPct} min={1} max={100} onChange={(event) => setMaxPositionPct(Number(event.target.value))} title="单票最大仓位 %" />
        <span className="context-chip">{initialSymbol || "全市场"} · 焦点上下文</span>
        <button className="primary" onClick={run} disabled={loading !== null}>
          {loading === "event" ? "运行中" : "事件回测"}
        </button>
        <button onClick={runPortfolio} disabled={loading !== null}>
          {loading === "portfolio" ? "运行中" : "组合回测"}
        </button>
        <button onClick={exportEventSamples} disabled={!result} type="button">导出事件CSV</button>
        <button onClick={exportPortfolioTrades} disabled={!portfolio} type="button">导出交易CSV</button>
        <span className="muted">{message}</span>
      </div>
      <DataTrustPanel
        compact
        title="回测审计口径"
        summary="每次回测必须披露参数、成本、成交过滤、基准覆盖和样本闭环，避免只看收益数字。"
        items={[
          { label: "回测区间", value: `${start} ~ ${end}` },
          { label: "策略版本", value: strategyVersion },
          { label: "初始资金", value: formatMoney(initialCash) },
          { label: "持有期", value: `${holdingDays} 个交易日` },
          { label: "滑点", value: `${slippageBps} bps` },
          { label: "单票上限", value: `${maxPositionPct}%` },
          { label: "基准覆盖", value: formatPercent(portfolio?.result.metrics.benchmark_coverage), tone: (portfolio?.result.metrics.benchmark_coverage || 0) >= 0.8 ? "good" : "warn" },
          { label: "成本合计", value: formatMoney(portfolioDiagnostics.totalCost) },
        ]}
        warnings={[
          ...(!portfolio ? ["尚未运行组合回测，权益/回撤/基准审计不可用"] : []),
          ...((portfolio?.result.metrics.benchmark_coverage || 0) < 0.8 ? ["基准覆盖不足 80%，超额收益解释需谨慎"] : []),
          ...(result && result.result.failures.length > 0 ? [`事件回测存在 ${result.result.failures.length} 个失败样本`] : []),
        ]}
        disclaimer="回测采用本地历史数据、成本模型和不可成交过滤，不能代表真实成交或未来收益。"
      />
      <div className="section-subhead">
        <h2>回测历史</h2>
        <button className="mini" onClick={loadHistory}>刷新</button>
      </div>
      <div className="data-table-wrap history-strip">
        <table className="data-table compact-table">
          <thead>
            <tr>
              <th>类型</th>
              <th>区间</th>
              <th>样本/交易</th>
              <th>收益</th>
              <th>回撤</th>
            </tr>
          </thead>
          <tbody>
            {history.map((run) => (
              <tr key={run.backtest_id} onClick={() => openHistory(run)}>
                <td>{run.kind === "event" ? "事件" : "组合"}</td>
                <td>{run.start || "-"} ~ {run.end || "-"}</td>
                <td>{run.kind === "event" ? run.sample_count || 0 : run.trade_count || 0}</td>
                <td>{run.kind === "portfolio" ? formatPercent(run.total_return) : "-"}</td>
                <td>{run.kind === "portfolio" ? formatPercent(run.max_drawdown) : "-"}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={5}>暂无历史回测，运行事件回测或组合回测后会自动归档。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {portfolio && (
        <>
          <div className="report-action-row">
            <span className="context-chip">
              组合回测 {portfolio.backtest_id.slice(0, 8)} · {portfolio.result.metrics.benchmark_symbol || "未匹配基准"}
            </span>
            <a
              className="button-link mini"
              href={`/api/backtests/portfolio/${portfolio.backtest_id}/download`}
            >
              下载组合报告
            </a>
          </div>
          <div className="pipeline-summary">
            <Metric label="初始资金" value={formatMoney(portfolio.result.metrics.initial_cash)} />
            <Metric label="最终权益" value={formatMoney(portfolio.result.metrics.final_equity)} />
            <Metric label="总收益" value={formatPercent(portfolio.result.metrics.total_return)} />
            <Metric label="基准收益" value={formatPercent(portfolio.result.metrics.benchmark_total_return)} />
            <Metric label="超额收益" value={formatPercent(portfolio.result.metrics.excess_return)} />
            <Metric label="最大回撤" value={formatPercent(portfolio.result.metrics.max_drawdown)} />
            <Metric label="胜率" value={formatPercent(portfolio.result.metrics.win_rate)} />
            <Metric label="Sharpe" value={portfolio.result.metrics.sharpe?.toFixed(2) || "-"} />
            <Metric label="IR" value={portfolio.result.metrics.information_ratio?.toFixed(2) || "-"} />
            <Metric label="Sortino" value={portfolio.result.metrics.sortino?.toFixed(2) || "-"} />
            <Metric label="Calmar" value={portfolio.result.metrics.calmar?.toFixed(2) || "-"} />
            <Metric label="成本合计" value={formatMoney(portfolioDiagnostics.totalCost)} />
          </div>
          <div className="split-grid">
            <EquityCurveChart rows={portfolio.result.equity_curve || []} />
            <DrawdownChart rows={portfolio.result.equity_curve || []} />
          </div>
          <div className="split-grid">
            <BenchmarkExcessChart rows={portfolio.result.benchmark_curve || []} />
            <ReturnDistributionChart distribution={portfolio.result.return_distribution} />
          </div>
          <ProfessionalBacktestDiagnostics
            rows={portfolio.result.equity_curve || []}
            diagnostics={portfolio.result.risk_diagnostics}
          />
          <div className="split-grid">
            <TradeTape trades={portfolio.result.trades || []} />
            <BacktestAssumptions
              strategyVersion={portfolio.result.strategy_version}
              initialCash={portfolio.result.metrics.initial_cash}
              holdingDays={holdingDays}
              executionAssumptions={portfolio.result.execution_assumptions}
              diagnostics={portfolioDiagnostics}
              riskDiagnostics={portfolio.result.risk_diagnostics}
              benchmarkSymbol={String(portfolio.result.metrics.benchmark_symbol || "-")}
              benchmarkCoverage={portfolio.result.metrics.benchmark_coverage}
            />
          </div>
          <div className="split-grid">
            <PortfolioIntegrityPanel
              metrics={portfolio.result.metrics}
              diagnostics={portfolio.result.risk_diagnostics}
              trades={portfolio.result.trades || []}
              lifecycle={portfolio.result.position_lifecycle || []}
              benchmarkRows={portfolio.result.benchmark_curve || []}
            />
            <div className="markdown-panel compact scroll-panel">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {portfolioMarkdown || "等待组合报告生成。"}
              </ReactMarkdown>
            </div>
          </div>
          <PortfolioAuditTables
            lifecycle={portfolio.result.position_lifecycle || []}
            attribution={portfolio.result.trade_attribution || []}
            capitalUsage={portfolio.result.capital_usage || []}
            exposures={portfolio.result.exposures || []}
          />
          <SkippedTradePanel rows={portfolio.result.skipped_trades || []} audit={portfolio.result.audit_summary} />
        </>
      )}
      {result ? (
        <div className="review-layout">
          <ReturnBarChart rows={eventChartRows} />
          <EventDiagnostics rows={result.result.events} />
          <div className="split-grid">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>信号</th>
                    <th>样本</th>
                    <th>5日胜率</th>
                    <th>20日胜率</th>
                    <th>20日中位收益</th>
                    <th>平均不利波动</th>
                  </tr>
                </thead>
                <tbody>
                  {result.result.summary.map((row) => (
                    <tr key={row.signal_name}>
                      <td>{row.signal_name}</td>
                      <td>{row.sample_count}</td>
                      <td>{formatPercent(row.win_rate_5d)}</td>
                      <td>{formatPercent(row.win_rate_20d)}</td>
                      <td>{formatPercent(row.median_ret_20d)}</td>
                      <td>{formatPercent(row.mean_max_adverse_20d)}</td>
                    </tr>
                  ))}
                  {result.result.summary.length === 0 && (
                    <tr>
                      <td colSpan={6}>暂无可统计样本</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="markdown-panel compact scroll-panel">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdown || "等待报告生成。"}
              </ReactMarkdown>
            </div>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>股票</th>
                  <th>信号</th>
                  <th>入场日</th>
                  <th>入场价</th>
                  <th>5日</th>
                  <th>20日</th>
                  <th>60日</th>
                  <th>指数超额</th>
                  <th>最大不利</th>
                  <th>最大有利</th>
                </tr>
              </thead>
              <tbody>
                {result.result.events.map((event) => (
                  <tr key={event.signal_id}>
                    <td>{event.date}</td>
                    <td>
                      <button className="text-action" onClick={() => onOpenSymbol?.(event.symbol, event.date)}>
                        {event.symbol}
                      </button>
                    </td>
                    <td>{event.signal_name}</td>
                    <td>{event.entry_date || "-"}</td>
                    <td>{event.entry_price?.toFixed(2) || "-"}</td>
                    <td>{formatPercent(event.ret_5d)}</td>
                    <td>{formatPercent(event.ret_20d)}</td>
                    <td>{formatPercent(event.ret_60d)}</td>
                    <td>{formatPercent(event.excess_index_20d)}</td>
                    <td>{formatPercent(event.max_adverse_20d)}</td>
                    <td>{formatPercent(event.max_favorable_20d)}</td>
                  </tr>
                ))}
                {result.result.events.length === 0 && (
                  <tr>
                    <td colSpan={11}>暂无事件样本</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="list-panel">
            <h2>失败样本</h2>
            {result.result.failures.slice(0, 12).map((failure, index) => (
              <p key={`${failure.symbol}-${index}`}>
                <strong>{failure.symbol || "-"}</strong>
                <span>{failure.fail_reason || failure.reason || "未记录原因"}</span>
              </p>
            ))}
            {result.result.failures.length === 0 && (
              <p className="empty-state">暂无失败样本</p>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state block">等待回测结果。</div>
      )}
    </section>
  );
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapeCell = (value: string | number | null | undefined) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escapeCell).join(","), ...rows.map((row) => row.map(escapeCell).join(","))].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReturnBarChart({ rows }: { rows: BacktestSummaryRow[] }) {
  const maxAbs = Math.max(
    0.01,
    ...rows.map((row) => Math.abs(row.median_ret_20d || 0)),
  );
  return (
    <div className="chart-panel">
      <div className="chart-title">
        <span>20日中位收益</span>
        <strong>{rows.length} 组信号</strong>
      </div>
      <div className="bar-chart">
        {rows.slice(0, 8).map((row) => {
          const value = row.median_ret_20d || 0;
          const width = Math.max(4, Math.abs(value) / maxAbs * 100);
          return (
            <div className="bar-row" key={row.signal_name}>
              <span>{row.signal_name}</span>
              <div className="bar-track">
                <i
                  className={value >= 0 ? "positive" : "negative"}
                  style={{ width: `${width}%` }}
                />
              </div>
              <b>{formatPercent(value)}</b>
            </div>
          );
        })}
        {rows.length === 0 && <p className="empty-state">暂无图表样本</p>}
      </div>
    </div>
  );
}

function EquityCurveChart({ rows }: { rows: EquityPoint[] }) {
  const points = useMemo(() => {
    if (rows.length === 0) return "";
    const min = Math.min(...rows.map((row) => row.equity));
    const max = Math.max(...rows.map((row) => row.equity));
    const spread = Math.max(1, max - min);
    return rows
      .map((row, index) => {
        const x = rows.length === 1 ? 20 : 20 + (index / (rows.length - 1)) * 560;
        const y = 180 - ((row.equity - min) / spread) * 140;
        return `${x},${y}`;
      })
      .join(" ");
  }, [rows]);

  return (
    <div className="chart-panel">
      <div className="chart-title">
        <span>权益曲线</span>
        <strong>{rows.length} 点</strong>
      </div>
      <svg className="equity-chart" viewBox="0 0 600 220" role="img" aria-label="组合回测权益曲线">
        <line x1="20" y1="180" x2="580" y2="180" />
        <line x1="20" y1="40" x2="20" y2="180" />
        {points && <polyline points={points} />}
      </svg>
    </div>
  );
}

function DrawdownChart({ rows }: { rows: EquityPoint[] }) {
  const bars = rows.slice(-40);
  const maxDrawdown = Math.min(0, ...bars.map((row) => row.drawdown || 0));
  const scale = Math.max(0.01, Math.abs(maxDrawdown));
  return (
    <div className="chart-panel">
      <div className="chart-title">
        <span>回撤路径</span>
        <strong>{formatPercent(maxDrawdown)}</strong>
      </div>
      <div className="drawdown-bars">
        {bars.map((row) => (
          <i
            key={row.date}
            title={`${row.date} ${formatPercent(row.drawdown)}`}
            style={{ height: `${Math.max(4, Math.abs(row.drawdown || 0) / scale * 120)}px` }}
          />
        ))}
        {bars.length === 0 && <p className="empty-state">暂无回撤序列</p>}
      </div>
    </div>
  );
}

function BenchmarkExcessChart({ rows }: { rows: BenchmarkPoint[] }) {
  const chart = useMemo(() => {
    if (rows.length === 0) return { strategy: "", benchmark: "", min: 0, max: 0 };
    const values = rows.flatMap((row) => [row.strategy_return, row.benchmark_return]);
    const min = Math.min(-0.01, ...values);
    const max = Math.max(0.01, ...values);
    const spread = Math.max(0.001, max - min);
    const toPoints = (key: "strategy_return" | "benchmark_return") =>
      rows
        .map((row, index) => {
          const x = rows.length === 1 ? 20 : 20 + (index / (rows.length - 1)) * 560;
          const y = 180 - ((row[key] - min) / spread) * 140;
          return `${x},${y}`;
        })
        .join(" ");
    return {
      strategy: toPoints("strategy_return"),
      benchmark: toPoints("benchmark_return"),
      min,
      max,
    };
  }, [rows]);
  const latest = rows[rows.length - 1];
  return (
    <div className="chart-panel">
      <div className="chart-title">
        <span>基准与超额</span>
        <strong>{latest ? formatPercent(latest.excess_return) : "-"}</strong>
      </div>
      <svg className="equity-chart benchmark-chart" viewBox="0 0 600 220" role="img" aria-label="组合回测基准与超额收益">
        <line x1="20" y1="180" x2="580" y2="180" />
        <line x1="20" y1="40" x2="20" y2="180" />
        {chart.benchmark && <polyline className="benchmark-line" points={chart.benchmark} />}
        {chart.strategy && <polyline className="strategy-line" points={chart.strategy} />}
      </svg>
      <div className="chart-legend">
        <span><i className="legend-strategy" />策略 {formatPercent(latest?.strategy_return)}</span>
        <span><i className="legend-benchmark" />基准 {formatPercent(latest?.benchmark_return)}</span>
      </div>
      {rows.length === 0 && <p className="empty-state">暂无基准曲线，需同步对应市场指数。</p>}
    </div>
  );
}

function ReturnDistributionChart({ distribution }: { distribution?: ReturnDistribution }) {
  const buckets = distribution?.buckets || [];
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <div className="chart-panel">
      <div className="chart-title">
        <span>单笔收益分布</span>
        <strong>{distribution?.total_count || 0} 笔</strong>
      </div>
      <div className="distribution-bars">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="distribution-row">
            <span>{bucket.label}</span>
            <div className="bar-track">
              <i
                className={bucket.label.includes("-") ? "negative" : "positive"}
                style={{ width: `${Math.max(4, bucket.count / maxCount * 100)}%` }}
              />
            </div>
            <b>{bucket.count}</b>
          </div>
        ))}
        {buckets.length === 0 && <p className="empty-state">暂无交易收益分布</p>}
      </div>
      <div className="distribution-summary">
        <span>均值 {formatPercent(distribution?.average_return)}</span>
        <span>中位 {formatPercent(distribution?.median_return)}</span>
        <span>Payoff {distribution?.payoff_ratio ? distribution.payoff_ratio.toFixed(2) : "-"}</span>
      </div>
    </div>
  );
}

function BacktestAssumptions({
  strategyVersion,
  initialCash,
  holdingDays,
  executionAssumptions,
  diagnostics,
  riskDiagnostics,
  benchmarkSymbol,
  benchmarkCoverage,
}: {
  strategyVersion: string;
  initialCash: number;
  holdingDays: number;
  executionAssumptions?: ExecutionAssumptions;
  diagnostics: { entryCount: number; exitCount: number; stopCount: number; totalCost: number };
  riskDiagnostics?: RiskDiagnostics;
  benchmarkSymbol: string;
  benchmarkCoverage?: number;
}) {
  return (
    <div className="list-panel compact-list">
      <h2>执行与成本假设</h2>
      <p>
        <strong>策略版本</strong>
        <span>{strategyVersion}</span>
      </p>
      <p>
        <strong>资金与持有期</strong>
        <span>{formatMoney(initialCash)} · {holdingDays} 个交易日</span>
      </p>
      <p>
        <strong>入场/出场</strong>
        <span>{executionAssumptions?.execution_price || "next_open"} · T+1 {executionAssumptions?.t_plus_1 ? "启用" : "未启用"} · 到期或 ATR 止损</span>
      </p>
      <p>
        <strong>成交过滤</strong>
        <span>{(executionAssumptions?.filters || ["低流动性", "涨跌停", "停牌"]).join(" / ")}</span>
      </p>
      <p>
        <strong>滑点与仓位</strong>
        <span>{executionAssumptions?.slippage_bps ?? 0} bps · 单票上限 {formatPercent(executionAssumptions?.max_position_pct)}</span>
      </p>
      <p>
        <strong>交易拆解</strong>
        <span>{diagnostics.entryCount} 入场 / {diagnostics.exitCount} 出场 / {diagnostics.stopCount} 止损</span>
      </p>
      <p>
        <strong>估算成本</strong>
        <span>{formatMoney(diagnostics.totalCost)}</span>
      </p>
      <p>
        <strong>基准覆盖</strong>
        <span>{benchmarkSymbol} · {formatPercent(benchmarkCoverage)} · {riskDiagnostics?.benchmark_status || "unknown"}</span>
      </p>
      <p>
        <strong>资金占用峰值</strong>
        <span>{formatPercent(riskDiagnostics?.exposure_peak_pct)}</span>
      </p>
    </div>
  );
}

function SkippedTradePanel({
  rows,
  audit,
}: {
  rows: SkippedTradeRow[];
  audit?: BacktestAuditSummary;
}) {
  return (
    <div className="detail-panel">
      <div className="section-subhead">
        <h2>不可成交与审计摘要</h2>
        <span className="muted">
          信号 {audit?.signal_count ?? 0} · 执行 {audit?.executed_lifecycle_count ?? 0} · 跳过 {audit?.skipped_count ?? rows.length}
        </span>
      </div>
      <div className="pipeline-summary">
        <Metric label="交易日志" value={String(audit?.trade_log_count ?? 0)} />
        <Metric label="跳过信号" value={String(audit?.skipped_count ?? rows.length)} />
        <Metric label="审计成本" value={formatMoney(audit?.cost_total)} />
      </div>
      <div className="data-table-wrap history-strip">
        <table className="data-table compact-table dense-table">
          <thead>
            <tr>
              <th>信号</th>
              <th>标的</th>
              <th>日期</th>
              <th>原因</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((row) => (
              <tr key={`${row.signal_id}-${row.reason}`}>
                <td>{row.signal_id}</td>
                <td>{row.symbol}</td>
                <td>{row.date}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4}>暂无不可成交样本</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PortfolioIntegrityPanel({
  metrics,
  diagnostics,
  trades,
  lifecycle,
  benchmarkRows,
}: {
  metrics: Record<string, number> & { benchmark_symbol?: string };
  diagnostics?: RiskDiagnostics;
  trades: TradeRow[];
  lifecycle: PositionLifecycleRow[];
  benchmarkRows: BenchmarkPoint[];
}) {
  const checks = [
    {
      label: "基准曲线",
      value: `${metrics.benchmark_symbol || "-"} · ${formatPercent(metrics.benchmark_coverage)}`,
      ok: (metrics.benchmark_coverage || 0) >= 0.8 && benchmarkRows.length > 0,
    },
    {
      label: "交易闭环",
      value: `${lifecycle.length} 笔持仓 / ${trades.length} 条日志`,
      ok: lifecycle.length === 0 ? trades.length === 0 : trades.length >= lifecycle.length * 2,
    },
    {
      label: "成本披露",
      value: formatPercent(diagnostics?.cost_to_equity_pct),
      ok: typeof diagnostics?.cost_to_equity_pct === "number",
    },
    {
      label: "风险路径",
      value: `${diagnostics?.longest_drawdown_points || 0} 个回撤权益点`,
      ok: Boolean(diagnostics?.monthly_returns?.length),
    },
  ];
  return (
    <div className="detail-panel">
      <div className="section-subhead">
        <h2>回测完整性检查</h2>
        <span className="muted">基准 · 交易闭环 · 成本 · 风险路径</span>
      </div>
      <div className="integrity-list">
        {checks.map((check) => (
          <p key={check.label}>
            <strong>{check.label}</strong>
            <span>{check.value}</span>
            <em className={check.ok ? "integrity-ok" : "integrity-warn"}>
              {check.ok ? "已覆盖" : "待补数据"}
            </em>
          </p>
        ))}
      </div>
    </div>
  );
}

function PortfolioAuditTables({
  lifecycle,
  attribution,
  capitalUsage,
  exposures,
}: {
  lifecycle: PositionLifecycleRow[];
  attribution: TradeAttributionRow[];
  capitalUsage: CapitalUsageRow[];
  exposures: ExposureRow[];
}) {
  return (
    <div className="portfolio-audit-grid">
      <div className="data-table-wrap">
        <table className="data-table compact-table dense-table">
          <thead>
            <tr>
              <th>持仓</th>
              <th>区间</th>
              <th>收益</th>
              <th>退出</th>
            </tr>
          </thead>
          <tbody>
            {lifecycle.slice(0, 10).map((row) => (
              <tr key={row.signal_id}>
                <td>{row.symbol}<br /><span className="muted">{row.signal_name}</span></td>
                <td>{row.entry_date} ~ {row.exit_date}<br /><span className="muted">{row.holding_days} 天</span></td>
                <td>{formatMoney(row.net_pnl)}<br /><span className={row.net_return >= 0 ? "positive" : "negative"}>{formatPercent(row.net_return)}</span></td>
                <td>{row.exit_reason}</td>
              </tr>
            ))}
            {lifecycle.length === 0 && <tr><td colSpan={4}>暂无持仓生命周期</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="data-table-wrap">
        <table className="data-table compact-table dense-table">
          <thead>
            <tr>
              <th>归因</th>
              <th>交易</th>
              <th>胜率</th>
              <th>净贡献</th>
            </tr>
          </thead>
          <tbody>
            {attribution.slice(0, 10).map((row) => (
              <tr key={row.symbol}>
                <td>{row.symbol}<br /><span className="muted">{row.market}</span></td>
                <td>{row.trade_count}</td>
                <td>{formatPercent(row.win_rate)}</td>
                <td>{formatMoney(row.net_pnl)}<br /><span className="muted">成本 {formatMoney(row.total_cost)}</span></td>
              </tr>
            ))}
            {attribution.length === 0 && <tr><td colSpan={4}>暂无交易归因</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="data-table-wrap">
        <table className="data-table compact-table dense-table">
          <thead>
            <tr>
              <th>资金事件</th>
              <th>现金</th>
              <th>持仓市值</th>
              <th>占用</th>
            </tr>
          </thead>
          <tbody>
            {capitalUsage.slice(-10).map((row, index) => (
              <tr key={`${row.date}-${index}`}>
                <td>{row.date}<br /><span className="muted">{row.symbol || "-"} · {row.event || "start"}</span></td>
                <td>{formatMoney(row.cash)}</td>
                <td>{formatMoney(row.positions_value)}</td>
                <td>{formatPercent(row.capital_used_pct)}</td>
              </tr>
            ))}
            {capitalUsage.length === 0 && <tr><td colSpan={4}>暂无资金占用</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="data-table-wrap">
        <table className="data-table compact-table dense-table">
          <thead>
            <tr>
              <th>市场</th>
              <th>持仓数</th>
              <th>资金占比</th>
              <th>净贡献</th>
            </tr>
          </thead>
          <tbody>
            {exposures.map((row) => (
              <tr key={row.market}>
                <td>{row.market}</td>
                <td>{row.position_count}</td>
                <td>{formatPercent(row.capital_share)}</td>
                <td>{formatMoney(row.net_pnl)}</td>
              </tr>
            ))}
            {exposures.length === 0 && <tr><td colSpan={4}>暂无暴露</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProfessionalBacktestDiagnostics({
  rows,
  diagnostics,
}: {
  rows: EquityPoint[];
  diagnostics?: RiskDiagnostics;
}) {
  const monthly = useMemo(() => {
    if (diagnostics?.monthly_returns?.length) {
      return diagnostics.monthly_returns.map((row) => ({
        month: row.month,
        ret: row.return,
      }));
    }
    const byMonth = new Map<string, { first: number; last: number }>();
    rows.forEach((row) => {
      const key = row.date.slice(0, 7);
      const current = byMonth.get(key);
      if (!current) byMonth.set(key, { first: row.equity, last: row.equity });
      else current.last = row.equity;
    });
    return [...byMonth.entries()].map(([month, value]) => ({
      month,
      ret: value.first ? value.last / value.first - 1 : 0,
    }));
  }, [diagnostics?.monthly_returns, rows]);
  const derived = useMemo(() => {
    if (rows.length < 2) return { best: null, worst: null, longestDrawdown: 0 };
    const monthlyValues = monthly.map((row) => row.ret);
    let longestDrawdown = 0;
    let currentDrawdown = 0;
    rows.forEach((row) => {
      if ((row.drawdown || 0) < 0) {
        currentDrawdown += 1;
        longestDrawdown = Math.max(longestDrawdown, currentDrawdown);
      } else {
        currentDrawdown = 0;
      }
    });
    return {
      best: monthlyValues.length ? Math.max(...monthlyValues) : null,
      worst: monthlyValues.length ? Math.min(...monthlyValues) : null,
      longestDrawdown: diagnostics?.longest_drawdown_points ?? longestDrawdown,
    };
  }, [diagnostics?.longest_drawdown_points, monthly, rows]);
  return (
    <div className="detail-panel">
      <div className="section-subhead">
        <h2>专业回测诊断</h2>
        <span className="muted">月度收益 · 回撤持续期 · 交易波动 · 披露假设</span>
      </div>
      <div className="pipeline-summary">
        <Metric label="最佳月份" value={formatPercent(derived.best)} />
        <Metric label="最差月份" value={formatPercent(derived.worst)} />
        <Metric label="最长回撤期" value={`${derived.longestDrawdown} 个权益点`} />
        <Metric label="交易波动" value={formatPercent(diagnostics?.trade_return_stdev)} />
        <Metric label="样本点" value={String(rows.length)} />
      </div>
      <div className="monthly-return-grid">
        {monthly.slice(-24).map((row) => (
          <span
            key={row.month}
            className={row.ret >= 0 ? "monthly-cell positive-cell" : "monthly-cell negative-cell"}
            title={`${row.month} ${formatPercent(row.ret)}`}
          >
            <b>{row.month.slice(2)}</b>
            <small>{formatPercent(row.ret)}</small>
          </span>
        ))}
        {monthly.length === 0 && <p className="empty-state">暂无月度收益</p>}
      </div>
      <div className="warning-list">
        <p>
          <strong>回测假设</strong>
          <span>本页采用本地交易日志、权益曲线、成本模型与不可成交过滤；基准状态 {diagnostics?.benchmark_status || "unknown"}，不代表真实可成交价格或投资建议。</span>
        </p>
      </div>
    </div>
  );
}

function EventDiagnostics({ rows }: { rows: EventRow[] }) {
  const regimes = useMemo(() => {
    return rows.reduce<Record<string, { count: number; win20: number; ret20: number }>>((acc, row) => {
      const key = row.market_regime || "unknown";
      const bucket = acc[key] || { count: 0, win20: 0, ret20: 0 };
      bucket.count += 1;
      bucket.win20 += (row.ret_20d || 0) > 0 ? 1 : 0;
      bucket.ret20 += row.ret_20d || 0;
      acc[key] = bucket;
      return acc;
    }, {});
  }, [rows]);
  const regimeRows = Object.entries(regimes).map(([name, value]) => ({
    name,
    ...value,
    winRate: value.count ? value.win20 / value.count : 0,
    meanRet: value.count ? value.ret20 / value.count : 0,
  }));
  return (
    <div className="data-table-wrap history-strip">
      <table className="data-table compact-table dense-table">
        <thead>
          <tr>
            <th>市场状态</th>
            <th>样本</th>
            <th>20日胜率</th>
            <th>平均20日收益</th>
          </tr>
        </thead>
        <tbody>
          {regimeRows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.count}</td>
              <td>{formatPercent(row.winRate)}</td>
              <td>{formatPercent(row.meanRet)}</td>
            </tr>
          ))}
          {regimeRows.length === 0 && (
            <tr>
              <td colSpan={4}>暂无市场状态分解</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TradeTape({ trades }: { trades: TradeRow[] }) {
  return (
    <div className="list-panel compact-list scroll-panel">
      <h2>交易日志</h2>
      {trades.slice(0, 10).map((trade) => (
        <p key={trade.trade_id}>
          <strong>{trade.symbol} · {trade.side}</strong>
          <span>
            {trade.date} · {trade.price.toFixed(2)} · 成本 {trade.cost.toFixed(2)}
            {trade.cost_breakdown ? ` · 滑点 ${formatMoney(trade.cost_breakdown.slippage)}` : ""}
          </span>
        </p>
      ))}
      {trades.length === 0 && <p className="empty-state">暂无交易</p>}
    </div>
  );
}
