import { useEffect, useState } from "react";
import { formatPercent } from "../utils/formatters";

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
  decision_status?: string;
  decision_note?: string | null;
  resolved_at?: string | null;
  date?: string;
  symbol?: string;
  created_at?: string;
}

interface PerformanceRow {
  action: string;
  sample_count: number;
  win_rate_20d?: number;
  mean_ret_20d?: number;
  mean_max_adverse_20d?: number;
}

interface ExecutionQueuePayload {
  summary: {
    candidate_count: number;
    approved_count: number;
    blocked_count: number;
    executed_count: number;
    pending_count: number;
  };
  items: {
    signal_id: string;
    symbol: string;
    date: string;
    signal_name: string;
    review_id?: string | null;
    review_action?: string | null;
    decision_status: string;
    execution_status: string;
    recommended_next_step: string;
  }[];
}

const ACTION_LABELS: Record<string, string> = {
  upgrade: "升级",
  keep: "保留",
  downgrade: "降级",
  reject: "拒绝",
};

export default function AgentReviewPage({
  onOpenSymbol,
}: {
  onOpenSymbol?: (symbol: string, date?: string) => void;
}) {
  const [signalId, setSignalId] = useState("");
  const [reviewId, setReviewId] = useState("");
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [reviews, setReviews] = useState<ReviewPayload[]>([]);
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);
  const [queue, setQueue] = useState<ExecutionQueuePayload | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"review" | "fetch" | null>(null);

  const loadReviews = async (targetSignalId = signalId) => {
    const suffix = targetSignalId ? `?signal_id=${encodeURIComponent(targetSignalId)}` : "";
    const response = await fetch(`/api/agent-reviews${suffix}`);
    const data = await response.json();
    if (data.success) setReviews(data.data);
  };

  const loadPerformance = async () => {
    const response = await fetch("/api/agent-reviews/performance");
    const data = await response.json();
    if (data.success) setPerformance(data.data);
  };

  const loadQueue = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await fetch(`/api/professional/execution-queue?date=${today}`);
    const data = await response.json();
    if (data.success) setQueue(data.data);
  };

  useEffect(() => {
    loadReviews("");
    loadPerformance();
    loadQueue();
  }, []);

  const run = async () => {
    if (!signalId) return;
    setLoading("review");
    setMessage("");
    const response = await fetch(`/api/signals/${encodeURIComponent(signalId)}/agent-review`, {
      method: "POST",
    });
    const data = await response.json();
    if (data.success) {
      setReview(data.data);
      setReviewId(data.data.review_id);
      await loadReviews(signalId);
      await loadPerformance();
      await loadQueue();
      setMessage("审查完成");
    } else {
      setMessage("审查失败");
    }
    setLoading(null);
  };

  const closeReview = async (decisionStatus: "adopted" | "rejected" | "watch") => {
    if (!review) return;
    const response = await fetch(`/api/agent-reviews/${encodeURIComponent(review.review_id)}/decision`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision_status: decisionStatus,
        decision_note: decisionStatus === "adopted" ? "纳入模拟执行队列" : decisionStatus === "rejected" ? "人工驳回" : "继续观察",
      }),
    });
    const data = await response.json();
    if (data.success) {
      setReview(data.data);
      await loadReviews(signalId);
      await loadQueue();
      setMessage("人工闭环状态已更新");
    } else {
      setMessage("人工闭环更新失败");
    }
  };

  const fetchReview = async (targetReviewId = reviewId) => {
    if (!targetReviewId) return;
    setLoading("fetch");
    setMessage("");
    const response = await fetch(`/api/agent-reviews/${encodeURIComponent(targetReviewId)}`);
    const data = await response.json();
    if (data.success) {
      setReview(data.data);
      setSignalId(data.data.signal_id);
      setReviewId(data.data.review_id);
    } else {
      setMessage("未找到审查记录");
    }
    setLoading(null);
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>信号审查</h1>
        <p>对规则信号做解释、反证、风险旗标、缺失数据检查和后验表现复盘。</p>
      </div>
      <div className="toolbar">
        <input value={signalId} onChange={(event) => setSignalId(event.target.value)} placeholder="signal_id" />
        <button className="primary" onClick={run} disabled={loading !== null}>
          {loading === "review" ? "审查中" : "审查"}
        </button>
        <input value={reviewId} onChange={(event) => setReviewId(event.target.value)} placeholder="review_id" />
        <button onClick={() => fetchReview()} disabled={loading !== null}>
          {loading === "fetch" ? "读取中" : "读取记录"}
        </button>
        <button onClick={() => loadReviews(signalId)}>刷新历史</button>
        <span className="muted">{message}</span>
      </div>
      <div className="pipeline-summary">
        {performance.slice(0, 4).map((row) => (
          <div className="metric-tile" key={row.action}>
            <span>{ACTION_LABELS[row.action] || row.action} · {row.sample_count} 样本</span>
            <strong>{formatPercent(row.win_rate_20d)}</strong>
            <small className="muted">20日均值 {formatPercent(row.mean_ret_20d)}</small>
          </div>
        ))}
        {performance.length === 0 && (
          <div className="metric-tile">
            <span>后验表现</span>
            <strong>-</strong>
            <small className="muted">等待事件回测沉淀样本</small>
          </div>
        )}
      </div>
      {review ? (
        <div className="review-layout">
          <div className="metric-grid compact">
            <div className="metric-tile">
              <span>Action</span>
              <strong>{ACTION_LABELS[review.action] || review.action}</strong>
            </div>
            <div className="metric-tile">
              <span>置信度</span>
              <strong>{review.confidence}</strong>
            </div>
            <div className="metric-tile">
              <span>审查编号</span>
              <strong>{review.review_id.slice(0, 8)}</strong>
            </div>
            <div className="metric-tile">
              <span>人工闭环</span>
              <strong>{review.decision_status || "pending"}</strong>
            </div>
          </div>
          {review.symbol && (
            <div className="readiness-strip">
              <button className="mini" onClick={() => onOpenSymbol?.(review.symbol || "", review.date)}>
                打开 {review.symbol} 工作台
              </button>
              <span className="status-badge muted-badge">信号 {review.signal_id}</span>
              <button className="mini" onClick={() => closeReview("adopted")}>采纳</button>
              <button className="mini" onClick={() => closeReview("watch")}>观察</button>
              <button className="danger mini" onClick={() => closeReview("rejected")}>驳回</button>
            </div>
          )}
          <div className="split-grid">
            <ListPanel title="看多理由" items={review.bull_points} />
            <ListPanel title="看空理由" items={review.bear_points} />
            <ListPanel title="风险旗标" items={review.risk_flags} />
            <ListPanel title="missing_data" items={review.missing_data} />
          </div>
          <div className="markdown-panel compact">{review.review_summary}</div>
        </div>
      ) : (
        <div className="empty-state block">输入 signal_id 后开始审查。</div>
      )}
      <div className="section-subhead">
        <h2>审查历史</h2>
        <span>{reviews.length} 条</span>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>审查编号</th>
              <th>信号</th>
              <th>股票</th>
              <th>Action</th>
                <th>置信度</th>
              <th>闭环</th>
                <th>摘要</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((item) => (
              <tr key={item.review_id} onClick={() => fetchReview(item.review_id)}>
                <td>{item.review_id.slice(0, 10)}</td>
                <td>{item.signal_id}</td>
                <td>
                  {item.symbol ? (
                    <button
                      className="text-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenSymbol?.(item.symbol || "", item.date);
                      }}
                    >
                      {item.symbol}
                    </button>
                  ) : "-"}
                </td>
                <td>{ACTION_LABELS[item.action] || item.action}</td>
                <td>{item.confidence}</td>
                <td>{item.decision_status || "pending"}</td>
                <td>{item.review_summary}</td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan={7}>暂无审查记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ExecutionQueuePanel queue={queue} onOpenSymbol={onOpenSymbol} />
    </section>
  );
}

function ExecutionQueuePanel({
  queue,
  onOpenSymbol,
}: {
  queue: ExecutionQueuePayload | null;
  onOpenSymbol?: (symbol: string, date?: string) => void;
}) {
  return (
    <div className="detail-panel">
      <div className="section-subhead">
        <h2>信号执行队列</h2>
        <span className="muted">
          approved {queue?.summary.approved_count || 0} · blocked {queue?.summary.blocked_count || 0} · executed {queue?.summary.executed_count || 0}
        </span>
      </div>
      <div className="data-table-wrap history-strip">
        <table className="data-table compact-table dense-table">
          <thead>
            <tr>
              <th>信号</th>
              <th>标的</th>
              <th>审查</th>
              <th>状态</th>
              <th>下一步</th>
            </tr>
          </thead>
          <tbody>
            {(queue?.items || []).slice(0, 12).map((item) => (
              <tr key={item.signal_id}>
                <td>{item.signal_name}<br /><span className="muted">{item.signal_id}</span></td>
                <td>
                  <button className="text-action" onClick={() => onOpenSymbol?.(item.symbol, item.date)}>{item.symbol}</button>
                </td>
                <td>{item.review_action || "-"} / {item.decision_status}</td>
                <td><span className="status-badge">{item.execution_status}</span></td>
                <td>{item.recommended_next_step}</td>
              </tr>
            ))}
            {(queue?.items || []).length === 0 && <tr><td colSpan={5}>暂无执行队列</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="list-panel">
      <h2>{title}</h2>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
      {items.length === 0 && <p className="empty-state">暂无记录</p>}
    </div>
  );
}
