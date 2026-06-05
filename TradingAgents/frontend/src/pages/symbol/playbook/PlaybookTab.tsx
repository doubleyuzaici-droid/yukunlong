// Tab 4 决策复盘 — SignalDetail + Backtest + Notes Timeline
import { useEffect, useState } from "react";
import { Pill, Skeleton } from "../_shared/atoms";
import { AsyncBoundary } from "../_shared/AsyncBoundary";
import type {
  AnalystNote,
  BacktestSummary,
  PlaybookRecentBar,
  PlaybookSignalRow,
  SignalDetail,
  SymbolPlaybookPayload,
} from "../../../types/symbol-workspace";
import { useSymbolPlaybook, writeNotes } from "../../../api/symbol-workspace/hooks";
import { fmtCompact, fmtPct, fmtRelativeTime } from "../formatters";

interface Props {
  symbol: string;
  date: string;
}

function PlaybookSkeleton() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <Skeleton height={360} />
        <Skeleton height={360} />
      </div>
      <Skeleton height={200} />
    </>
  );
}

export function PlaybookTab({ symbol, date }: Props) {
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const { state, reload } = useSymbolPlaybook(symbol, date, selectedSignalId);

  useEffect(() => {
    setSelectedSignalId(null);
    setReviewMessage("");
  }, [symbol, date]);

  const runSignalReview = async (signalId: string) => {
    setReviewing(true);
    setReviewMessage("正在生成 Agent 审查");
    try {
      const response = await fetch(`/api/signals/${encodeURIComponent(signalId)}/agent-review`, { // copy-lint:ignore API 调用，非用户文案
        method: "POST",
      });
      const data = (await response.json()) as { success?: boolean; error?: string | null };
      if (data.success) {
        setReviewMessage("Agent 审查已更新");
        reload();
      } else {
        setReviewMessage(data.error || "Agent 审查失败");
      }
    } catch {
      setReviewMessage("Agent 审查服务未连接");
    }
    setReviewing(false);
  };

  return (
    <AsyncBoundary<SymbolPlaybookPayload>
      state={state}
      skeleton={<PlaybookSkeleton />}
      emptyTitle="暂无信号详情"
      emptyHint="未选中信号或尚未生成"
    >
      {(data) => (
        <>
          <div className="sw-playbook-grid">
            <SignalDetailPanel
              detail={data.signal_detail}
              loading={reviewing}
              message={reviewMessage}
              onReview={runSignalReview}
            />
            <BacktestPanel summary={data.backtest} />
          </div>
          <PlaybookHistoryPanel
            signals={data.history_signals}
            recentBars={data.recent_bars}
            selectedSignalId={data.selected_signal_id}
            onSelectSignal={setSelectedSignalId}
          />
          <NotesTimeline symbol={symbol} date={date} initial={data.notes} />
        </>
      )}
    </AsyncBoundary>
  );
}

// ============================================================
// SignalDetail panel
// ============================================================
function SignalDetailPanel({
  detail,
  loading,
  message,
  onReview,
}: {
  detail: SignalDetail | null;
  loading: boolean;
  message: string;
  onReview: (signalId: string) => void;
}) {
  if (!detail) {
    return (
      <div className="sw-panel">
        <div className="sw-empty" style={{ padding: "var(--sw-sp-5)" }}>
          <strong>暂无信号</strong>
          <span style={{ fontSize: 12 }}>当前区间未生成共振信号</span>
        </div>
      </div>
    );
  }
  return (
    <div className="sw-panel">
      <div className="sw-signal-detail__head">
        <div className="sw-signal-detail__title">
          <h3>{detail.title}</h3>
          <small>
            {detail.id} · {detail.issued_at} · 评分{" "}
            {detail.score != null ? Math.round(detail.score * 100) : "-"} / 100
          </small>
        </div>
        <div className="sw-signal-detail__actions">
          {detail.agent ? (
            <Pill tone={detail.agent.tone}>{detail.agent.verdict}</Pill>
          ) : (
            <Pill tone="neutral">未审查</Pill>
          )}
          <button
            type="button"
            className="sw-btn sw-btn--mini"
            disabled={loading}
            onClick={() => onReview(detail.id)}
          >
            {detail.agent ? "重新审查" : "立即审查"}
          </button>
        </div>
      </div>
      {message && <div className="sw-action-message">{message}</div>}

      <div className="sw-signal-detail__grid">
        <ColList title="证据" items={detail.evidence} icon="✓" iconTone="success" />
        <ColList title="风险" items={detail.risks} icon="⚠" iconTone="warning" />
        <ColList
          title="失效条件"
          items={detail.invalidate}
          icon="✗"
          iconTone="danger"
        />
        <ColList
          title="下一步动作"
          items={
            detail.agent
              ? [detail.agent.summary]
              : ["进入 Agent 审查后生成下一步建议"]
          }
          icon="→"
          iconTone="info"
        />
      </div>

      {detail.agent && (
        <div className="sw-agent-card">
          <h5>Agent 审查结论</h5>
          <p>
            {detail.agent.summary}
            {detail.agent.trace_url && (
              <>
                {" "}
                <a
                  href={detail.agent.trace_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--sw-info)", textDecoration: "underline" }}
                >
                  查看推理链 →
                </a>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function PlaybookHistoryPanel({
  signals,
  recentBars,
  selectedSignalId,
  onSelectSignal,
}: {
  signals: PlaybookSignalRow[];
  recentBars: PlaybookRecentBar[];
  selectedSignalId: string | null;
  onSelectSignal: (signalId: string) => void;
}) {
  return (
    <div className="sw-playbook-history">
      <div className="sw-panel">
        <div className="sw-panel__head">
          <h3>历史信号</h3>
          <small>{signals.length} 条 · 点击后切换审查对象</small>
        </div>
        <div className="sw-history-signal-list">
          {signals.length === 0 && (
            <div className="sw-empty" style={{ padding: "var(--sw-sp-3)" }}>
              <strong style={{ fontSize: 12 }}>暂无历史信号</strong>
            </div>
          )}
          {signals.slice(0, 14).map((signal) => (
            <button
              className={`sw-history-signal${selectedSignalId === signal.id ? " is-active" : ""}`}
              key={signal.id}
              onClick={() => onSelectSignal(signal.id)}
              type="button"
            >
              <span>{signal.date}</span>
              <strong>{signal.name}</strong>
              <small>
                {signal.level || "-"} · {signal.direction || "-"} · 评分{" "}
                {signal.score == null ? "-" : signal.score.toFixed(signal.score > 10 ? 1 : 2)}
              </small>
              <b>20D {fmtPct(signal.ret20d, 1)}</b>
              <em>MAE {fmtPct(signal.max_adverse20d, 1)} · 审查 {signal.review_count}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="sw-panel">
        <div className="sw-panel__head">
          <h3>近期日线</h3>
          <small>最近 12 根</small>
        </div>
        <div className="sw-recent-bars">
          {recentBars.length === 0 && <span className="sw-faint">暂无日线</span>}
          {recentBars.map((bar) => (
            <div className="sw-recent-bar-row" key={bar.date}>
              <span>{bar.date}</span>
              <b>{bar.close == null ? "-" : bar.close.toFixed(2)}</b>
              <em className={bar.change_pct == null ? "" : bar.change_pct >= 0 ? "sw-tone-success" : "sw-tone-danger"}>
                {fmtPct(bar.change_pct, 2)}
              </em>
              <small>{bar.volume == null ? "-" : fmtCompact(bar.volume, 1)}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColList({
  title,
  items,
  icon,
  iconTone,
}: {
  title: string;
  items: string[];
  icon: string;
  iconTone: "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="sw-signal-detail__col">
      <h4>{title}</h4>
      <ul>
        {items.length === 0 && <li className="sw-faint">暂无</li>}
        {items.map((t) => (
          <li key={t}>
            <span className={`sw-tone-${iconTone}`} aria-hidden>
              {icon}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// Backtest panel
// ============================================================
function BacktestPanel({ summary }: { summary: BacktestSummary | null }) {
  if (!summary) {
    return (
      <div className="sw-panel">
        <div className="sw-panel__head">
          <h3>同类信号后验</h3>
          <small>等历史信号聚合</small>
        </div>
        <div className="sw-empty" style={{ padding: "var(--sw-sp-3)" }}>
          <strong style={{ fontSize: 12 }}>暂无后验统计</strong>
          <span style={{ fontSize: 11 }}>该标的历史信号样本不足，需累积更多数据</span>
        </div>
      </div>
    );
  }
  const isInsufficient = summary.sample_quality === "insufficient";
  return (
    <div className="sw-panel">
      <div className="sw-panel__head">
        <h3>同类信号后验</h3>
        <small>
          样本 {summary.n} · 区间 {summary.curve_start || "-"} 至 {summary.curve_end || "-"} · 质量{" "}
          <span className={`sw-mono ${isInsufficient ? "sw-tone-warning" : "sw-tone-success"}`}>
            {summary.sample_quality}
          </span>
        </small>
      </div>
      {isInsufficient && (
        <div className="sw-risk__warn">
          仅 {summary.n} 个历史样本，胜率统计不显著，建议作为辅助参考
        </div>
      )}
      <div className="sw-backtest__stats">
        <Row label="胜率" value={fmtPct(summary.win_rate, 1)} tone="success" />
        <Row label="盈亏" value={`${summary.win} / ${summary.loss}`} />
        <Row label="5D 均收益" value={fmtPct(summary.avg_5d, 2)} tone={(summary.avg_5d ?? 0) >= 0 ? "success" : "danger"} />
        <Row label="20D 均收益" value={fmtPct(summary.avg_20d, 2)} tone={(summary.avg_20d ?? 0) >= 0 ? "success" : "danger"} />
        <Row label="60D 均收益" value={fmtPct(summary.avg_60d, 2)} tone={(summary.avg_60d ?? 0) >= 0 ? "success" : "danger"} />
        <Row label="最大不利 MAE" value={fmtPct(summary.max_adverse, 2)} tone="danger" />
      </div>
      {/* #2: 按市场状态切分的胜率 — 同一评分在不同 regime 含金量天差地别 */}
      {summary.by_regime.length > 0 && (
        <>
          <h4 className="sw-faint" style={{ fontSize: 11, margin: "var(--sw-sp-3) 0 var(--sw-sp-2)" }}>
            分市场状态胜率（同评分在不同环境含金量不同）
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {summary.by_regime
              .filter((r) => r.n > 0)
              .map((r) => {
                const wr = r.win_rate;
                const tone =
                  wr == null || r.n < 5
                    ? "neutral"
                    : wr < 0.45
                      ? "danger"
                      : wr >= 0.6
                        ? "success"
                        : "warning";
                return (
                  <div
                    key={r.regime}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 8,
                      alignItems: "center",
                      fontSize: 12,
                      padding: "4px 8px",
                      borderRadius: "var(--sw-r-sm)",
                      background: r.is_current ? "var(--sw-info-bg)" : "transparent",
                      border: r.is_current
                        ? "1px solid var(--sw-info-border)"
                        : "1px solid transparent",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {r.is_current && (
                        <span
                          className="sw-tone-info"
                          style={{ fontSize: 10 }}
                          title="当前所处市场状态"
                        >
                          ▶
                        </span>
                      )}
                      <span className={r.is_current ? "sw-tone-info" : "sw-muted"}>
                        {r.label}
                      </span>
                    </span>
                    <span className="sw-faint" style={{ fontSize: 11 }}>
                      {r.n} 样本
                      {r.n < 5 && "（不显著）"}
                    </span>
                    <span
                      className={`sw-mono sw-tone-${tone}`}
                      style={{ fontWeight: 600 }}
                    >
                      {wr == null ? "-" : fmtPct(wr, 0)}
                    </span>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {summary.curve.length >= 2 && (
        <>
          <h4 className="sw-faint" style={{ fontSize: 11, margin: "var(--sw-sp-3) 0 var(--sw-sp-2)" }}>
            累积收益曲线
          </h4>
          <CurveChart values={summary.curve} />
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="sw-row">
      <span>{label}</span>
      <b className={tone ? `sw-tone-${tone}` : undefined}>{value}</b>
    </div>
  );
}

function CurveChart({ values }: { values: number[] }) {
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 50;
  const step = w / Math.max(values.length - 1, 1);
  const path = values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)},${(h - ((v - min) / range) * (h - 2) - 1).toFixed(1)}`
    )
    .join(" ");
  const area = `${path} L ${w},${h} L 0,${h} Z`;
  const endValue = values[values.length - 1];
  const positive = endValue >= 0;
  const color = positive ? "var(--sw-success)" : "var(--sw-danger)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 120, display: "block" }} aria-hidden>
      <defs>
        <linearGradient id="sw-bt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1={0}
        y1={(h - ((0 - min) / range) * (h - 2) - 1).toFixed(1)}
        x2={w}
        y2={(h - ((0 - min) / range) * (h - 2) - 1).toFixed(1)}
        stroke="var(--sw-border-strong)"
        strokeWidth={0.4}
        strokeDasharray="2,2"
      />
      <path d={area} fill="url(#sw-bt-grad)" />
      <path d={path} fill="none" stroke={color} strokeWidth={1.2} />
    </svg>
  );
}

// ============================================================
// Notes Timeline
// ============================================================
function NotesTimeline({
  symbol,
  date,
  initial,
}: {
  symbol: string;
  date: string;
  initial: AnalystNote[];
}) {
  const [notes, setNotes] = useState<AnalystNote[]>(initial);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setNotes(initial);
  }, [initial, symbol, date]);

  const addNote = () => {
    const body = draft.trim();
    if (!body) return;
    const tags = (body.match(/#([一-龥A-Za-z0-9_]+)/g) || []).map((m) => m.slice(1));
    const next: AnalystNote = {
      id: `${symbol}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      body,
      pinned: false,
      tags: Array.from(new Set(tags)),
    };
    const all = [next, ...notes];
    setNotes(all);
    setDraft("");
    writeNotes(symbol, date, all);
  };

  const togglePin = (id: string) => {
    const all = notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
    // 置顶排序
    all.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.timestamp.localeCompare(a.timestamp);
    });
    setNotes(all);
    writeNotes(symbol, date, all);
  };

  return (
    <div className="sw-notes-timeline">
      <div className="sw-panel__head">
        <h3>分析师笔记 · 时间线</h3>
        <small>本地持久化 · {notes.length} 条 · 支持 #标签</small>
      </div>
      <div className="sw-note-form" style={{ marginTop: "var(--sw-sp-2)" }}>
        <textarea
          className="sw-note-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="新建一条笔记... 输入 # 加标签，⌘ Enter 提交"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              addNote();
            }
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="sw-btn sw-btn--primary sw-btn--mini" onClick={addNote}>
            添加笔记
          </button>
        </div>
      </div>
      <div className="sw-notes-list">
        {notes.length === 0 && (
          <div className="sw-faint" style={{ fontSize: 12 }}>
            暂无笔记
          </div>
        )}
        {notes.map((n) => (
          <div className="sw-note" key={n.id}>
            <time>{fmtRelativeTime(n.timestamp)}</time>
            <div>
              <p>{renderTagged(n.body)}</p>
              {n.tags.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {n.tags.map((t) => (
                    <span className="sw-tag" key={t}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="sw-btn sw-btn--icon sw-btn--mini"
              onClick={() => togglePin(n.id)}
              aria-label={n.pinned ? "取消置顶" : "置顶"}
              style={{ background: "transparent", border: 0 }}
            >
              {n.pinned ? "★" : "☆"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderTagged(body: string) {
  // 简单 highlight #标签
  const parts = body.split(/(#[一-龥A-Za-z0-9_]+)/g);
  return parts.map((p, i) =>
    p.startsWith("#") ? (
      <span className="sw-tone-info" key={i}>
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
