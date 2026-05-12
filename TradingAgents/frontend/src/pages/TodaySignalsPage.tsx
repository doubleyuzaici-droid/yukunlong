import { useEffect, useMemo, useState } from "react";
import {
  pipelineEmptyReason,
  readinessCounts,
  READINESS_LABELS,
  type PipelineSummary,
} from "../utils/researchPipeline";

interface SignalRow {
  signal_id: string;
  symbol: string;
  market: string;
  signal_name: string;
  signal_level: string;
  direction: string;
  score: number;
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

export default function TodaySignalsPage() {
  const [date, setDate] = useState(today);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"scan" | "pipeline" | null>(null);

  const readiness = useMemo(
    () => readinessCounts(pipeline?.watchlist_status || []),
    [pipeline],
  );

  const load = async (targetDate = date) => {
    const response = await fetch(`/api/signals/today?date=${targetDate}`);
    const data = await response.json();
    if (data.success) setSignals(data.data);
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
              <div className="signal-row" key={signal.signal_id}>
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
