import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MemoryEntry {
  date: string;
  ticker: string;
  rating: string;
  pending: boolean;
  raw?: string | null;
  alpha?: string | null;
  holding?: string | null;
  decision: string;
  reflection?: string;
}

interface MemoryPayload {
  memory_log_path?: string;
  pending_count: number;
  resolved_count: number;
  entries: MemoryEntry[];
}

export default function MemoryPage() {
  const [payload, setPayload] = useState<MemoryPayload | null>(null);
  const [selected, setSelected] = useState<MemoryEntry | null>(null);
  const [query, setQuery] = useState("");
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setMessage("");
    const response = await fetch("/api/memory");
    const data = await response.json();
    if (data.success) {
      setPayload(data.data);
      setSelected((current) => current || data.data.entries[0] || null);
    } else {
      setMessage("记忆日志读取失败");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const entries = payload?.entries || [];
    const normalized = query.trim().toUpperCase();
    return entries.filter((entry) => {
      if (showPendingOnly && !entry.pending) return false;
      if (!normalized) return true;
      return `${entry.ticker} ${entry.date} ${entry.rating}`.toUpperCase().includes(normalized);
    });
  }, [payload?.entries, query, showPendingOnly]);

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>记忆反思</h1>
        <p>查看交易决策记忆、待结算条目和已生成的 outcome reflection。</p>
      </div>
      <div className="toolbar">
        <input
          className="wide-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索股票、日期或评级"
        />
        <button onClick={() => setShowPendingOnly((value) => !value)}>
          {showPendingOnly ? "全部记忆" : "仅待反思"}
        </button>
        <button onClick={load}>刷新</button>
        <span className="muted">{message || pathLabel(payload?.memory_log_path)}</span>
      </div>
      <div className="pipeline-summary">
        <Metric label="全部记忆" value={String(payload?.entries.length || 0)} />
        <Metric label="待结算" value={String(payload?.pending_count || 0)} />
        <Metric label="已反思" value={String(payload?.resolved_count || 0)} />
        <Metric
          label="当前筛选"
          value={String(filtered.length)}
        />
      </div>
      <div className="split-grid report-workspace">
        <div className="data-table-wrap">
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>股票</th>
                <th>评级</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr
                  className={selected === entry ? "selected-row" : ""}
                  key={`${entry.date}-${entry.ticker}-${entry.pending ? "pending" : "done"}`}
                  onClick={() => setSelected(entry)}
                >
                  <td>{entry.date}</td>
                  <td>{entry.ticker}</td>
                  <td>{entry.rating}</td>
                  <td>
                    <span className={entry.pending ? "status-badge muted-badge" : "status-badge"}>
                      {entry.pending ? "待结算" : "已反思"}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4}>暂无记忆条目</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="detail-panel scroll-panel">
          {selected ? (
            <>
              <div className="detail-header">
                <div>
                  <span className="eyebrow">{selected.pending ? "PENDING" : "REFLECTED"}</span>
                  <h2>{selected.ticker} · {selected.date}</h2>
                  <p>
                    {selected.rating} · 原始收益 {selected.raw || "-"} · Alpha {selected.alpha || "-"}
                    {selected.holding ? ` · ${selected.holding}` : ""}
                  </p>
                </div>
                <span className={selected.pending ? "status-badge muted-badge" : "status-badge"}>
                  {selected.pending ? "等待下一次同标的分析结算" : "反思已写入"}
                </span>
              </div>
              <div className="markdown-panel compact">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selected.decision || "暂无决策内容。"}
                </ReactMarkdown>
              </div>
              <div className="markdown-panel compact">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selected.reflection || "暂无反思。"}
                </ReactMarkdown>
              </div>
            </>
          ) : (
            <div className="empty-state block">选择左侧记忆后查看决策和反思。</div>
          )}
        </div>
      </div>
    </section>
  );
}

function pathLabel(path?: string) {
  if (!path) return "";
  const name = path.split(/[\\/]/).filter(Boolean).pop() || "memory log";
  return `存储文件：${name}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
