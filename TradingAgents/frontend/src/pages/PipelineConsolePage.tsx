import { FormEvent, useEffect, useState } from "react";
import {
  READINESS_LABELS,
  type PipelineSummary,
  type WatchlistStatusRow,
} from "../utils/researchPipeline";

const today = new Date().toISOString().slice(0, 10);

interface PipelineRun {
  run_id: string;
  created_at?: string;
  start: string;
  end: string;
  signal_date?: string;
  source?: string | null;
  include_fund_flow?: boolean;
  rows_synced: number;
  fund_flow_rows: number;
  factor_rows: number;
  signal_count: number;
  warning_count: number;
}

export default function PipelineConsolePage() {
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState(today);
  const [signalDate, setSignalDate] = useState(today);
  const [source, setSource] = useState("auto");
  const [includeFundFlow, setIncludeFundFlow] = useState(true);
  const [bootstrapCore, setBootstrapCore] = useState(true);
  const [result, setResult] = useState<PipelineSummary | null>(null);
  const [history, setHistory] = useState<PipelineRun[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    const response = await fetch("/api/research/pipeline/history");
    const data = await response.json();
    if (data.success) setHistory(data.data.runs);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const run = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("流水线运行中");
    const response = await fetch("/api/research/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start,
        end,
        signal_date: signalDate || end,
        source,
        include_fund_flow: includeFundFlow,
        bootstrap_core_symbols: bootstrapCore,
      }),
    });
    const data = await response.json();
    if (data.success) {
      setResult(data.data);
      setMessage(`完成：同步 ${data.data.rows_synced} 行，信号 ${data.data.signal_count} 条`);
      await loadHistory();
    } else {
      setMessage("流水线运行失败");
    }
    setLoading(false);
  };

  const readinessRows: WatchlistStatusRow[] = result?.watchlist_status || [];

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>流水线控制台</h1>
        <p>按区间、数据源和资金流选项运行同步、因子、信号、回测与诊断流水线。</p>
      </div>
      <form className="toolbar" onSubmit={run}>
        <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <input type="date" value={signalDate} onChange={(event) => setSignalDate(event.target.value)} />
        <select value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="auto">auto</option>
          <option value="akshare">akshare</option>
          <option value="tushare">tushare</option>
        </select>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={includeFundFlow}
            onChange={(event) => setIncludeFundFlow(event.target.checked)}
          />
          资金流
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={bootstrapCore}
            onChange={(event) => setBootstrapCore(event.target.checked)}
          />
          核心池
        </label>
        <button className="primary" disabled={loading}>
          {loading ? "运行中" : "运行流水线"}
        </button>
        <span className="muted">{message}</span>
      </form>
      {result && (
        <>
          <div className="pipeline-summary">
            <Metric label="行情" value={String(result.rows_synced)} />
            <Metric label="资金流" value={String(result.fund_flow_rows || 0)} />
            <Metric label="因子" value={String(result.factor_rows)} />
            <Metric label="信号" value={String(result.signal_count)} />
            <Metric label="补核心池" value={String(result.bootstrapped_symbols?.length || 0)} />
          </div>
          <div className="readiness-strip">
            {readinessRows.slice(0, 8).map((row) => (
              <span className="status-badge" key={row.symbol}>
                {row.symbol} · {READINESS_LABELS[row.scan_readiness] || row.scan_readiness}
              </span>
            ))}
          </div>
          <div className="warning-list">
            {(result.warnings || []).slice(0, 6).map((warning, index) => (
              <p key={index}>
                <strong>{warning.symbol || warning.check_name || "warning"}</strong>
                <span>{warning.message || "-"}</span>
              </p>
            ))}
          </div>
        </>
      )}
      <div className="section-subhead">
        <h2>运行历史</h2>
        <button className="mini" onClick={loadHistory}>刷新</button>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>运行</th>
              <th>区间</th>
              <th>数据源</th>
              <th>行情/因子/信号</th>
              <th>警告</th>
            </tr>
          </thead>
          <tbody>
            {history.map((run) => (
              <tr key={run.run_id}>
                <td>{run.run_id.slice(0, 8)}<br /><span className="muted">{run.created_at || "-"}</span></td>
                <td>{run.start} ~ {run.end}<br /><span className="muted">{run.signal_date || "-"}</span></td>
                <td>{run.source || "auto"}</td>
                <td>{run.rows_synced} / {run.factor_rows} / {run.signal_count}</td>
                <td>{run.warning_count}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={5}>暂无流水线历史</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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
