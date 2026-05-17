import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatPercent, parseJsonList } from "../utils/formatters";

const today = new Date().toISOString().slice(0, 10);

interface EventReturn {
  entry_date?: string;
  entry_price?: number;
  ret_5d?: number;
  ret_20d?: number;
  ret_60d?: number;
  excess_index_20d?: number | null;
  max_adverse_20d?: number;
  max_favorable_20d?: number;
  success_flag?: number;
  fail_reason?: string | null;
}

interface SignalHistoryRow {
  signal_id: string;
  date: string;
  symbol: string;
  market?: string;
  signal_name: string;
  signal_level?: string;
  direction?: string;
  timeframe?: string;
  evidence_json?: string;
  risk_json?: string;
  invalid_json?: string;
  score?: number;
  strategy_version?: string;
  market_regime?: string | null;
  review_count: number;
  latest_review_at?: string | null;
  event_return?: EventReturn | null;
}

export default function SignalTimelinePage({
  initialSymbol = "600519.SH",
  initialEnd = today,
  onOpenSymbol,
}: {
  initialSymbol?: string;
  initialEnd?: string;
  onOpenSymbol?: (symbol: string, date?: string) => void;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState(initialEnd);
  const [signals, setSignals] = useState<SignalHistoryRow[]>([]);
  const [selected, setSelected] = useState<SignalHistoryRow | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const directionCounts = useMemo(() => {
    return signals.reduce<Record<string, number>>((acc, signal) => {
      const key = signal.direction || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [signals]);

  useEffect(() => {
    setSymbol(initialSymbol);
    setEnd(initialEnd);
  }, [initialSymbol, initialEnd]);

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams({ symbol, start, end });
    const response = await fetch(`/api/signals/history?${params.toString()}`);
    const data = await response.json();
    if (data.success) {
      setSignals(data.data.signals);
      setSelected(data.data.signals[0] || null);
      setMessage(`读取 ${data.data.total_count} 条历史信号`);
    } else {
      setMessage("历史信号读取失败");
    }
    setLoading(false);
  };

  const runReview = async () => {
    if (!selected) return;
    setLoading(true);
    const response = await fetch(
      `/api/signals/${encodeURIComponent(selected.signal_id)}/agent-review`,
      { method: "POST" },
    );
    const data = await response.json();
    setMessage(data.success ? "审查已写入历史" : "审查失败");
    await load();
    setLoading(false);
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>历史信号</h1>
        <p>按标的回看规则信号时间线，串联事件回测和 Agent 审查状态。</p>
      </div>
      <form className="toolbar" onSubmit={load}>
        <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="600519.SH" />
        <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <button className="primary" disabled={loading}>
          {loading ? "读取中" : "加载时间线"}
        </button>
        <span className="muted">{message}</span>
      </form>
      <div className="pipeline-summary">
        <Metric label="全部信号" value={String(signals.length)} />
        <Metric label="机会" value={String(directionCounts.opportunity || 0)} />
        <Metric label="风险" value={String(directionCounts.risk || 0)} />
        <Metric label="已审查" value={String(signals.filter((item) => item.review_count > 0).length)} />
      </div>
      <div className="split-grid">
        <div className="timeline-panel">
          {signals.map((signal) => (
            <button
              className={`timeline-item ${selected === signal ? "active" : ""}`}
              key={signal.signal_id}
              onClick={() => setSelected(signal)}
            >
              <span>{signal.date}</span>
              <strong>{signal.signal_name}</strong>
              <small>
                {signal.signal_level || "-"} · {signal.direction || "-"} · {signal.score ?? "-"}
              </small>
            </button>
          ))}
          {signals.length === 0 && (
            <div className="empty-state block">加载后查看该标的历史信号。</div>
          )}
        </div>
        <div className="detail-panel">
          {selected ? (
            <>
              <div className="detail-header">
                <div>
                  <span className="eyebrow">{selected.signal_id}</span>
                  <h2>{selected.symbol} · {selected.signal_name}</h2>
                  <p>
                    {selected.date} · {selected.signal_level || "-"} · {selected.strategy_version || "-"}
                  </p>
                </div>
                <button onClick={runReview} disabled={loading}>
                  发起审查
                </button>
                <button onClick={() => onOpenSymbol?.(selected.symbol, selected.date)}>
                  个股工作台
                </button>
              </div>
              <div className="detail-grid">
                <SignalList title="证据" items={parseJsonList(selected.evidence_json)} />
                <SignalList title="风险" items={parseJsonList(selected.risk_json)} />
                <SignalList title="失效条件" items={parseJsonList(selected.invalid_json)} />
              </div>
              <div className="pipeline-summary">
                <Metric label="审查次数" value={String(selected.review_count)} />
                <Metric label="20日收益" value={formatPercent(selected.event_return?.ret_20d)} />
                <Metric label="指数超额" value={formatPercent(selected.event_return?.excess_index_20d)} />
                <Metric label="最大不利" value={formatPercent(selected.event_return?.max_adverse_20d)} />
              </div>
              <div className="data-table-wrap">
                <table className="data-table compact-table">
                  <tbody>
                    <tr>
                      <th>入场日</th>
                      <td>{selected.event_return?.entry_date || "-"}</td>
                    </tr>
                    <tr>
                      <th>入场价</th>
                      <td>{selected.event_return?.entry_price?.toFixed(2) || "-"}</td>
                    </tr>
                    <tr>
                      <th>5日 / 20日 / 60日</th>
                      <td>
                        {formatPercent(selected.event_return?.ret_5d)} /{" "}
                        {formatPercent(selected.event_return?.ret_20d)} /{" "}
                        {formatPercent(selected.event_return?.ret_60d)}
                      </td>
                    </tr>
                    <tr>
                      <th>最近审查</th>
                      <td>{selected.latest_review_at || "-"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state block">选择信号后查看详情。</div>
          )}
        </div>
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

function SignalList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="list-panel compact-list">
      <h2>{title}</h2>
      {items.slice(0, 5).map((item) => (
        <p key={item}>{item}</p>
      ))}
      {items.length === 0 && <p className="empty-state">暂无记录</p>}
    </div>
  );
}
