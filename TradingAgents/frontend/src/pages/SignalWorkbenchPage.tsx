import { FormEvent, useEffect, useMemo, useState } from "react";
import { PriceHistoryChart, QuoteCard } from "../components/MarketWidgets";
import type { MarketHistoryPayload, MarketQuote } from "../types/market";
import { formatNumber, formatPercent, parseJsonList } from "../utils/formatters";

const today = new Date().toISOString().slice(0, 10);

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
}

interface EventReturn {
  entry_date?: string | null;
  entry_price?: number | null;
  ret_5d?: number | null;
  ret_20d?: number | null;
  ret_60d?: number | null;
  excess_index_20d?: number | null;
  max_adverse_20d?: number | null;
  max_favorable_20d?: number | null;
  fail_reason?: string | null;
}

interface SignalRow {
  signal_id: string;
  date: string;
  symbol: string;
  market?: string;
  signal_name: string;
  signal_level?: string;
  direction?: string;
  evidence_json?: string;
  risk_json?: string;
  invalid_json?: string;
  score?: number;
  review_count: number;
  latest_review_at?: string | null;
  event_return?: EventReturn | null;
}

interface SignalHistoryPayload {
  symbol: string;
  total_count: number;
  signals: SignalRow[];
}

interface ReviewPayload {
  review_id: string;
  action: string;
  confidence: string;
  review_summary: string;
  created_at?: string;
}

export default function SignalWorkbenchPage({
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
  const [signalId, setSignalId] = useState("");
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [selected, setSelected] = useState<SignalRow | null>(null);
  const [history, setHistory] = useState<MarketHistoryPayload | null>(null);
  const [reviews, setReviews] = useState<ReviewPayload[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSymbol(initialSymbol);
    setEnd(initialEnd);
  }, [initialEnd, initialSymbol]);

  const loadReviews = async (targetSignalId: string) => {
    const response = await fetch(`/api/agent-reviews?signal_id=${encodeURIComponent(targetSignalId)}`);
    const data = await response.json();
    if (data.success) setReviews(data.data);
  };

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setMessage("读取信号工作台");
    const signalParams = new URLSearchParams({ symbol, start, end });
    const historyParams = new URLSearchParams({ symbol, start, end, limit: "260" });
    try {
      const [signalResponse, historyResponse] = await Promise.all([
        fetch(`/api/signals/history?${signalParams.toString()}`),
        fetch(`/api/market/history?${historyParams.toString()}`),
      ]);
      const signalPayload = (await signalResponse.json()) as ApiResponse<SignalHistoryPayload>;
      const historyPayload = (await historyResponse.json()) as ApiResponse<MarketHistoryPayload>;
      const nextSignals = signalPayload.success ? signalPayload.data.signals : [];
      const nextSelected =
        nextSignals.find((signal) => signal.signal_id === signalId.trim()) || nextSignals[0] || null;
      setSignals(nextSignals);
      setSelected(nextSelected);
      setHistory(historyPayload.success ? historyPayload.data : null);
      if (nextSelected) {
        setSignalId(nextSelected.signal_id);
        await loadReviews(nextSelected.signal_id);
      } else {
        setReviews([]);
      }
      setMessage(`读取 ${nextSignals.length} 条信号`);
    } catch {
      setMessage("信号或行情服务未连接");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [initialSymbol, initialEnd]);

  const quote = history?.quote as MarketQuote | null | undefined;
  const markers = useMemo(
    () =>
      signals.map((signal) => ({
        signal_id: signal.signal_id,
        date: signal.date,
        signal_name: signal.signal_name,
        signal_level: signal.signal_level,
        direction: signal.direction,
        entry_date: signal.event_return?.entry_date,
      })),
    [signals],
  );

  const selectSignal = async (signal: SignalRow) => {
    setSelected(signal);
    setSignalId(signal.signal_id);
    await loadReviews(signal.signal_id);
  };

  const runReview = async () => {
    if (!selected) return;
    setLoading(true);
    const response = await fetch(`/api/signals/${encodeURIComponent(selected.signal_id)}/agent-review`, {
      method: "POST",
    });
    const data = await response.json();
    setMessage(data.success ? "审查已写入" : "审查失败");
    await loadReviews(selected.signal_id);
    setLoading(false);
  };

  return (
    <section className="workbench-section signal-workbench-page">
      <div className="section-heading">
        <h1>信号工作台</h1>
        <p>围绕单一信号集中查看行情、触发证据、Agent 审查、后验表现和历史同类样本。</p>
      </div>
      <form className="toolbar" onSubmit={load}>
        <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="600519.SH" />
        <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <input
          className="wide-input"
          value={signalId}
          onChange={(event) => setSignalId(event.target.value)}
          placeholder="可选 signal_id"
        />
        <button className="primary" disabled={loading}>
          {loading ? "读取中" : "加载信号"}
        </button>
        <span className="muted">{message}</span>
      </form>

      <div className="signal-workbench-layout">
        <aside className="signal-workbench-side">
          <QuoteCard quote={quote} />
          <div className="timeline-panel symbol-signal-panel">
            {signals.map((signal) => (
              <button
                className={`signal-history-card ${selected?.signal_id === signal.signal_id ? "active" : ""}`}
                key={signal.signal_id}
                onClick={() => selectSignal(signal)}
              >
                <span>{signal.date}</span>
                <strong>{signal.signal_name}</strong>
                <small>
                  {signal.signal_level || "-"} · {signal.direction || "-"} · {formatNumber(signal.score, 1)}
                </small>
                <b>{signal.review_count || 0} 审查</b>
                <em>{formatPercent(signal.event_return?.ret_20d)}</em>
              </button>
            ))}
            {signals.length === 0 && <div className="empty-state block">加载后查看信号列表。</div>}
          </div>
        </aside>

        <main className="signal-workbench-main">
          <PriceHistoryChart bars={history?.bars || []} signals={markers} />
          {selected ? (
            <div className="detail-panel signal-workbench">
              <div className="detail-header">
                <div>
                  <span className="eyebrow">{selected.signal_id}</span>
                  <h2>{selected.symbol} · {selected.signal_name}</h2>
                  <p>
                    {selected.date} · {selected.signal_level || "-"} · {selected.direction || "-"} · 评分{" "}
                    {formatNumber(selected.score, 1)}
                  </p>
                </div>
                <div className="header-button-group">
                  <button onClick={() => onOpenSymbol?.(selected.symbol, selected.date)}>个股工作台</button>
                  <button className="primary" onClick={runReview} disabled={loading}>
                    {loading ? "审查中" : "Agent 审查"}
                  </button>
                </div>
              </div>
              <div className="pipeline-summary signal-metrics">
                <Metric label="审查次数" value={String(selected.review_count || reviews.length)} />
                <Metric label="5日收益" value={formatPercent(selected.event_return?.ret_5d)} />
                <Metric label="20日收益" value={formatPercent(selected.event_return?.ret_20d)} />
                <Metric label="最大不利" value={formatPercent(selected.event_return?.max_adverse_20d)} />
              </div>
              <div className="detail-grid">
                <SignalList title="触发证据" items={parseJsonList(selected.evidence_json)} />
                <SignalList title="反证/风险" items={parseJsonList(selected.risk_json)} />
                <SignalList title="失效条件" items={parseJsonList(selected.invalid_json)} />
              </div>
              <div className="split-grid">
                <ReviewTape reviews={reviews} />
                <div className="data-table-wrap">
                  <table className="data-table compact-table dense-table">
                    <tbody>
                      <tr>
                        <th>入场</th>
                        <td>{selected.event_return?.entry_date || "-"} / {formatNumber(selected.event_return?.entry_price, 2)}</td>
                      </tr>
                      <tr>
                        <th>5 / 20 / 60日</th>
                        <td>
                          {formatPercent(selected.event_return?.ret_5d)} / {formatPercent(selected.event_return?.ret_20d)} /{" "}
                          {formatPercent(selected.event_return?.ret_60d)}
                        </td>
                      </tr>
                      <tr>
                        <th>超额 / 最大有利</th>
                        <td>
                          {formatPercent(selected.event_return?.excess_index_20d)} /{" "}
                          {formatPercent(selected.event_return?.max_favorable_20d)}
                        </td>
                      </tr>
                      <tr>
                        <th>失败原因</th>
                        <td>{selected.event_return?.fail_reason || "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state block">选择一个信号后查看完整上下文。</div>
          )}
        </main>
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

function ReviewTape({ reviews }: { reviews: ReviewPayload[] }) {
  return (
    <div className="list-panel review-tape">
      <h2>审查时间线</h2>
      {reviews.map((review) => (
        <p key={review.review_id}>
          <strong>{review.action} · {review.confidence}</strong>
          <span>{review.review_summary}</span>
          <small className="muted">{review.created_at || review.review_id.slice(0, 10)}</small>
        </p>
      ))}
      {reviews.length === 0 && <p className="empty-state">暂无审查记录。</p>}
    </div>
  );
}
