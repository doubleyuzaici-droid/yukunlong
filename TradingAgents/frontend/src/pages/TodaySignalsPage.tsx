import { useEffect, useMemo, useState } from "react";
import {
  pipelineEmptyReason,
  readinessCounts,
  READINESS_LABELS,
  type PipelineSummary,
} from "../utils/researchPipeline";
import { parseJsonList } from "../utils/formatters";
import { fetchQuotes, QuoteCard } from "../components/MarketWidgets";
import type { MarketQuote } from "../types/market";

interface SignalRow {
  signal_id: string;
  date?: string;
  symbol: string;
  market: string;
  signal_name: string;
  signal_level: string;
  direction: string;
  score: number;
  timeframe?: string;
  evidence_json?: string;
  risk_json?: string;
  invalid_json?: string;
  strategy_version?: string;
  market_regime?: string | null;
}

interface ReviewPayload {
  review_id: string;
  signal_id: string;
  action: string;
  confidence: string;
  bull_points: string[];
  bear_points: string[];
  risk_flags: string[];
  missing_data: string[];
  review_summary: string;
  created_at?: string;
}

const today = new Date().toISOString().slice(0, 10);
const GROUPS = [
  {
    key: "focus",
    label: "重点观察",
    match: (signal: SignalRow) =>
      signal.direction === "opportunity" && ["S", "A"].includes(signal.signal_level),
  },
  {
    key: "new",
    label: "新增观察",
    match: (signal: SignalRow) =>
      signal.direction === "opportunity" && signal.signal_level === "B",
  },
  {
    key: "pending",
    label: "等待确认",
    match: (signal: SignalRow) =>
      signal.direction === "neutral" ||
      (signal.direction === "opportunity" && signal.signal_level === "C"),
  },
  {
    key: "risk",
    label: "风险升高",
    match: (signal: SignalRow) =>
      signal.direction === "risk" && signal.signal_level !== "D",
  },
  {
    key: "invalid",
    label: "信号失效",
    match: (signal: SignalRow) =>
      signal.direction === "risk" && signal.signal_level === "D",
  },
];

export default function TodaySignalsPage({
  onOpenSymbol,
}: {
  onOpenSymbol?: (symbol: string, date?: string) => void;
}) {
  const [date, setDate] = useState(today);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<SignalRow | null>(null);
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [signalReviews, setSignalReviews] = useState<ReviewPayload[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<MarketQuote | null>(null);
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"scan" | "pipeline" | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const readiness = useMemo(
    () => readinessCounts(pipeline?.watchlist_status || []),
    [pipeline],
  );

  const load = async (targetDate = date) => {
    const response = await fetch(`/api/signals/today?date=${targetDate}`);
    const data = await response.json();
    if (data.success) {
      setSignals(data.data);
      setSelectedSignal((current) => {
        if (current && data.data.some((item: SignalRow) => item.signal_id === current.signal_id)) {
          return current;
        }
        return data.data[0] || null;
      });
    }
  };

  useEffect(() => {
    load(date);
  }, []);

  const scan = async () => {
    setLoading("scan");
    setMessage("扫描中");
    const response = await fetch("/api/signals/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const data = await response.json();
    setMessage(data.success ? `触发 ${data.data.count} 条信号` : "扫描失败");
    await load(date);
    setLoading(null);
  };

  const runPipeline = async () => {
    setLoading("pipeline");
    setMessage("同步并扫描中");
    const response = await fetch("/api/research/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ end: date, signal_date: date }),
    });
    const data = await response.json();
    if (data.success) {
      setPipeline(data.data);
      setMessage(`同步 ${data.data.rows_synced} 行，触发 ${data.data.signal_count} 条信号`);
    } else {
      setMessage("流水线运行失败");
    }
    await load(date);
    setLoading(null);
  };

  const loadReviews = async (signalId: string) => {
    const response = await fetch(`/api/agent-reviews?signal_id=${encodeURIComponent(signalId)}`);
    const data = await response.json();
    if (data.success) setSignalReviews(data.data);
  };

  const selectSignal = async (signal: SignalRow) => {
    setSelectedSignal(signal);
    setReview(null);
    await loadReviews(signal.signal_id);
  };

  const runReview = async () => {
    if (!selectedSignal) return;
    setReviewing(true);
    const response = await fetch(
      `/api/signals/${encodeURIComponent(selectedSignal.signal_id)}/agent-review`,
      { method: "POST" },
    );
    const data = await response.json();
    if (data.success) {
      setReview(data.data);
      await loadReviews(selectedSignal.signal_id);
      setMessage(`${selectedSignal.symbol} 审查完成`);
    } else {
      setMessage("审查失败");
    }
    setReviewing(false);
  };

  useEffect(() => {
    if (selectedSignal) loadReviews(selectedSignal.signal_id);
  }, [selectedSignal?.signal_id]);

  useEffect(() => {
    if (!selectedSignal?.symbol) {
      setSelectedQuote(null);
      return;
    }
    fetchQuotes([selectedSignal.symbol])
      .then((quotes) => setSelectedQuote(quotes[0] || null))
      .catch(() => setSelectedQuote(null));
  }, [selectedSignal?.symbol]);

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>今日信号</h1>
        <p>规则引擎输出观察、确认、风险和失效信号。</p>
      </div>
      <div className="toolbar">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <button onClick={scan} disabled={loading !== null}>
          {loading === "scan" ? "扫描中" : "仅扫描已有数据"}
        </button>
        <button className="primary" onClick={runPipeline} disabled={loading !== null}>
          {loading === "pipeline" ? "运行中" : "同步并扫描"}
        </button>
        <button onClick={() => load(date)}>刷新</button>
        <span className="muted">{message}</span>
      </div>
      {pipeline && (
        <div className="pipeline-summary">
          <div className="metric-tile">
            <span>同步行情</span>
            <strong>{pipeline.rows_synced}</strong>
          </div>
          <div className="metric-tile">
            <span>计算因子</span>
            <strong>{pipeline.factor_rows}</strong>
          </div>
          <div className="metric-tile">
            <span>触发信号</span>
            <strong>{pipeline.signal_count}</strong>
          </div>
          <div className="metric-tile">
            <span>可扫描</span>
            <strong>{(readiness.ready || 0) + (readiness.partial || 0)}</strong>
          </div>
        </div>
      )}
      {pipeline && (
        <div className="readiness-strip">
          {Object.entries(READINESS_LABELS).map(([key, label]) => (
            <span className="status-badge" key={key}>
              {label} {readiness[key] || 0}
            </span>
          ))}
        </div>
      )}
      {(pipeline?.warnings || []).length > 0 && (
        <div className="warning-list">
          {pipeline?.warnings?.slice(0, 4).map((warning, index) => (
            <p key={`${warning.symbol || "warning"}-${index}`}>
              <strong>{warning.symbol || warning.check_name || "数据提示"}</strong>
              <span>{warning.message}</span>
            </p>
          ))}
        </div>
      )}
      {signals.length === 0 && (
        <p className="empty-state block">{pipelineEmptyReason(pipeline)}</p>
      )}
      {selectedSignal && (
        <div className="detail-panel signal-detail">
          <div className="detail-header">
            <div>
              <span className="eyebrow">信号详情</span>
              <h2>{selectedSignal.symbol} · {selectedSignal.signal_name}</h2>
              <p>
                {selectedSignal.market} / {selectedSignal.signal_level} / {selectedSignal.direction}
                {selectedSignal.market_regime ? ` / ${selectedSignal.market_regime}` : ""}
              </p>
            </div>
            <div className="header-button-group">
              <button onClick={() => onOpenSymbol?.(selectedSignal.symbol, selectedSignal.date || date)}>个股工作台</button>
              <button className="primary" onClick={runReview} disabled={reviewing}>
                {reviewing ? "审查中" : "Agent 审查"}
              </button>
            </div>
          </div>
          <QuoteCard quote={selectedQuote} />
          <div className="detail-grid">
            <SignalList title="证据" items={parseJsonList(selectedSignal.evidence_json)} />
            <SignalList title="风险" items={parseJsonList(selectedSignal.risk_json)} />
            <SignalList title="失效条件" items={parseJsonList(selectedSignal.invalid_json)} />
          </div>
          {(review || signalReviews[0]) && (
            <div className="review-summary-strip">
              <strong>{review?.action || signalReviews[0].action}</strong>
              <span>{review?.confidence || signalReviews[0].confidence}</span>
              <p>{review?.review_summary || signalReviews[0].review_summary}</p>
            </div>
          )}
        </div>
      )}
      <div className="signal-grid">
        {GROUPS.map((group) => {
          const rows = signals.filter(group.match);
          return (
            <div className="signal-column" key={group.key}>
              <h2>
                {group.label}
                <span>{rows.length}</span>
              </h2>
              {rows.map((signal) => (
              <div
                className={`signal-row ${selectedSignal?.signal_id === signal.signal_id ? "selected-card" : ""}`}
                key={signal.signal_id}
                onClick={() => selectSignal(signal)}
              >
                <div>
                  <strong>{signal.symbol}</strong>
                  <span>{signal.market}</span>
                </div>
                <span>{signal.signal_name}</span>
                <b>{signal.signal_level}</b>
                <small>{Number(signal.score || 0).toFixed(1)}</small>
              </div>
              ))}
              {rows.length === 0 && <p className="empty-state">暂无记录</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SignalList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="list-panel compact-list">
      <h2>{title}</h2>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
      {items.length === 0 && <p className="empty-state">暂无记录</p>}
    </div>
  );
}
