import { useState } from "react";

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
}

const ACTION_LABELS: Record<string, string> = {
  upgrade: "升级",
  keep: "保留",
  downgrade: "降级",
  reject: "拒绝",
};

export default function AgentReviewPage() {
  const [signalId, setSignalId] = useState("");
  const [review, setReview] = useState<ReviewPayload | null>(null);

  const run = async () => {
    if (!signalId) return;
    const response = await fetch(`/api/signals/${encodeURIComponent(signalId)}/agent-review`, {
      method: "POST",
    });
    const data = await response.json();
    if (data.success) setReview(data.data);
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>信号审查</h1>
        <p>对规则信号做解释、反证、风险旗标和缺失数据检查。</p>
      </div>
      <div className="toolbar">
        <input value={signalId} onChange={(event) => setSignalId(event.target.value)} placeholder="signal_id" />
        <button className="primary" onClick={run}>审查</button>
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
          </div>
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
    </section>
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
