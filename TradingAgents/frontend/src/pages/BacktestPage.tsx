import { useState } from "react";

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
}

interface BacktestFailure {
  symbol?: string;
  signal_name?: string;
  reason?: string;
  date?: string;
}

interface BacktestPayload {
  backtest_id: string;
  result: {
    summary: BacktestSummaryRow[];
    failures: BacktestFailure[];
  };
}

export default function BacktestPage() {
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState(today);
  const [signals, setSignals] = useState("趋势增强,放量突破,回踩确认");
  const [result, setResult] = useState<BacktestPayload | null>(null);

  const run = async () => {
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
    if (data.success) setResult(data.data);
  };

  const formatPercent = (value?: number) =>
    typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "-";

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
        <button className="primary" onClick={run}>运行</button>
      </div>
      {result ? (
        <div className="split-grid">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>信号</th>
                  <th>样本</th>
                  <th>5日胜率</th>
                  <th>20日胜率</th>
                  <th>60日胜率</th>
                  <th>20日中位收益</th>
                </tr>
              </thead>
              <tbody>
                {result.result.summary.map((row) => (
                  <tr key={row.signal_name}>
                    <td>{row.signal_name}</td>
                    <td>{row.sample_count}</td>
                    <td>{formatPercent(row.win_rate_5d)}</td>
                    <td>{formatPercent(row.win_rate_20d)}</td>
                    <td>{formatPercent(row.win_rate_60d)}</td>
                    <td>{formatPercent(row.median_ret_20d)}</td>
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
          <div className="list-panel">
            <h2>失败样本</h2>
            {result.result.failures.slice(0, 8).map((failure, index) => (
              <p key={`${failure.symbol}-${index}`}>
                <strong>{failure.symbol || "-"}</strong>
                <span>{failure.reason || "未记录原因"}</span>
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
