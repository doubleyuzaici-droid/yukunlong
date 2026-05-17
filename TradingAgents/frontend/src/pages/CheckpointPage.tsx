import { FormEvent, useEffect, useState } from "react";
import { recordAuditEvent } from "../utils/audit";

const today = new Date().toISOString().slice(0, 10);

interface CheckpointFile {
  ticker: string;
  path: string;
  size_bytes: number;
  updated_at: number;
  checkpoint_count: number;
  thread_count: number;
  latest_checkpoint_id?: string | null;
}

interface CheckpointStatus {
  ticker: string;
  trade_date: string;
  thread_id: string;
  has_checkpoint: boolean;
  checkpoint_id?: string | null;
  step?: number | null;
  cleared?: boolean;
}

export default function CheckpointPage() {
  const [files, setFiles] = useState<CheckpointFile[]>([]);
  const [ticker, setTicker] = useState("NVDA");
  const [tradeDate, setTradeDate] = useState(today);
  const [marketProfile, setMarketProfile] = useState("us");
  const [researchDepth, setResearchDepth] = useState("medium");
  const [llmProvider, setLlmProvider] = useState("openai");
  const [status, setStatus] = useState<CheckpointStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadFiles = async () => {
    const response = await fetch("/api/checkpoints");
    const data = await response.json();
    if (data.success) setFiles(data.data.checkpoints);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const checkStatus = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch(
      `/api/checkpoints/${encodeURIComponent(ticker)}/${tradeDate}`,
    );
    const data = await response.json();
    if (data.success) {
      recordAuditEvent("clear_checkpoint", `${ticker}/${tradeDate}`, data.data.cleared ? "cleared" : "nothing_to_clear");
      setStatus(data.data);
      setMessage(data.data.has_checkpoint ? "找到可恢复断点" : "未找到该日期断点");
    } else {
      setMessage("断点查询失败");
    }
    setLoading(false);
  };

  const clearOne = async () => {
    if (!window.confirm(`确认清除 ${ticker} / ${tradeDate} 的 checkpoint？清除后该任务无法从断点续跑。`)) {
      return;
    }
    setLoading(true);
    const response = await fetch(
      `/api/checkpoints/${encodeURIComponent(ticker)}/${tradeDate}`,
      { method: "DELETE" },
    );
    const data = await response.json();
    if (data.success) {
      setStatus(data.data);
      setMessage(data.data.cleared ? "已清除该断点" : "没有需要清除的断点");
      await loadFiles();
    } else {
      setMessage("断点清除失败");
    }
    setLoading(false);
  };

  const clearAll = async () => {
    if (!window.confirm("确认清除全部 checkpoint 文件？这会移除所有可恢复状态。")) {
      return;
    }
    setLoading(true);
    const response = await fetch("/api/checkpoints", { method: "DELETE" });
    const data = await response.json();
    if (data.success) {
      recordAuditEvent("clear_all_checkpoints", "checkpoint", `deleted ${data.data.deleted}`);
      setStatus(null);
      setMessage(`已删除 ${data.data.deleted} 个 checkpoint 文件`);
      await loadFiles();
    } else {
      setMessage("批量清除失败");
    }
    setLoading(false);
  };

  const resume = async () => {
    setLoading(true);
    setMessage("创建续跑任务");
    const response = await fetch(
      `/api/checkpoints/${encodeURIComponent(ticker)}/${tradeDate}/resume`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market_profile: marketProfile,
          research_depth: researchDepth,
          llm_provider: llmProvider,
          deep_think_llm: "gpt-5.4",
          quick_think_llm: "gpt-5.4-mini",
        }),
      },
    );
    const data = await response.json();
    if (data.success) {
      recordAuditEvent("resume_checkpoint", `${ticker}/${tradeDate}`, data.data.task_id);
      setMessage(`已创建续跑任务 ${data.data.task_id}`);
    } else {
      setMessage("续跑任务创建失败");
    }
    setLoading(false);
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>断点恢复</h1>
        <p>检查 LangGraph checkpoint 文件，并管理同一股票和交易日期的可恢复状态。</p>
      </div>
      <form className="toolbar" onSubmit={checkStatus}>
        <input value={ticker} onChange={(event) => setTicker(event.target.value)} />
        <input type="date" value={tradeDate} onChange={(event) => setTradeDate(event.target.value)} />
        <select value={marketProfile} onChange={(event) => setMarketProfile(event.target.value)}>
          <option value="us">美股</option>
          <option value="china">A股</option>
          <option value="hongkong">港股</option>
        </select>
        <select value={researchDepth} onChange={(event) => setResearchDepth(event.target.value)}>
          <option value="shallow">快速</option>
          <option value="medium">标准</option>
          <option value="deep">深度</option>
        </select>
        <select value={llmProvider} onChange={(event) => setLlmProvider(event.target.value)}>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
          <option value="deepseek">DeepSeek</option>
          <option value="qwen">Qwen</option>
        </select>
        <button className="primary" disabled={loading}>
          {loading ? "查询中" : "检测断点"}
        </button>
        <button type="button" onClick={resume} disabled={loading}>
          从断点续跑
        </button>
        <button type="button" onClick={clearOne} disabled={loading}>
          清除该断点
        </button>
        <button type="button" className="danger" onClick={clearAll} disabled={loading || files.length === 0}>
          清除全部
        </button>
        <span className="muted">{message}</span>
      </form>
      {status && (
        <div className="pipeline-summary">
          <Metric label="状态" value={status.has_checkpoint ? "可恢复" : "无断点"} />
          <Metric label="Step" value={status.step == null ? "-" : String(status.step)} />
          <Metric label="Thread" value={status.thread_id.slice(0, 8)} />
          <Metric label="Checkpoint" value={status.checkpoint_id || "-"} />
        </div>
      )}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>股票</th>
              <th>Checkpoint 数</th>
              <th>Thread 数</th>
              <th>最近 ID</th>
              <th>大小</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.path} onClick={() => setTicker(file.ticker)}>
                <td>{file.ticker}</td>
                <td>{file.checkpoint_count}</td>
                <td>{file.thread_count}</td>
                <td>{file.latest_checkpoint_id || "-"}</td>
                <td>{Math.round(file.size_bytes / 1024)} KB</td>
                <td>{new Date(file.updated_at * 1000).toLocaleString()}</td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr>
                <td colSpan={6}>暂无 checkpoint 文件</td>
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
