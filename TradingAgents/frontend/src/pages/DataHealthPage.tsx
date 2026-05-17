import { useEffect, useMemo, useState } from "react";
import { recordAuditEvent } from "../utils/audit";

interface ResearchSourcesPayload {
  supported_sources: string[];
  active_source: string;
  rate_limit_policies: Record<string, { quota_status: string; rate_limit_hint: string }>;
  credential_readiness: { source: string; env?: string | null; configured: boolean }[];
  source_rows: { source: string; row_count: number; symbol_count: number; latest_date?: string | null }[];
  source_health: {
    source: string;
    last_success_at?: string | null;
    latest_trade_date?: string | null;
    row_count: number;
    symbol_count: number;
    last_error_at?: string | null;
    open_error_count: number;
    status: string;
  }[];
  quality_counts: { check_name: string; severity: string; resolution_status: string; count: number }[];
  operational_commands: {
    cli_command: string;
    api_endpoint?: string | null;
    method?: string | null;
    description: string;
  }[];
}

interface SyncTracePayload {
  traces: {
    trace_id: string;
    symbol?: string | null;
    job_type: string;
    start?: string | null;
    end?: string | null;
    primary_source?: string | null;
    fallback_source?: string | null;
    status?: string | null;
    rows_written?: number | null;
    elapsed_ms?: number | null;
    error?: string | null;
    created_at?: string | null;
  }[];
  summary: {
    total: number;
    success_count: number;
    failed_count: number;
  };
}

export default function DataHealthPage() {
  const [issues, setIssues] = useState<Record<string, unknown>[]>([]);
  const [sources, setSources] = useState<ResearchSourcesPayload | null>(null);
  const [syncTrace, setSyncTrace] = useState<SyncTracePayload | null>(null);
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("auto");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const issueSummary = useMemo(() => {
    return issues.reduce<Record<string, number>>((acc, issue) => {
      const key = `${String(issue.severity || "unknown")} / ${String(issue.check_name || "unknown")}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [issues]);

  const load = () => {
    fetch("/api/research/data-quality")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setIssues(data.data);
      });
    fetch("/api/research/sources")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setSources(data.data);
      });
    fetch("/api/professional/sync-trace")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setSyncTrace(data.data);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const resolveIssue = async (id: unknown, status: string) => {
    if (!window.confirm(status === "ignored" ? "确认忽略该数据质量问题？" : "确认将该问题标记为已处理？")) {
      return;
    }
    setLoading(true);
    const response = await fetch(`/api/research/data-quality/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resolution_status: status,
        resolution_note: status === "ignored" ? "人工忽略" : "人工确认修复",
      }),
    });
    const data = await response.json();
    if (data.success) recordAuditEvent("resolve_data_quality_issue", String(id), status);
    setMessage(data.success ? "处理状态已更新" : "处理失败");
    load();
    setLoading(false);
  };

  const resync = async () => {
    setLoading(true);
    setMessage("补数中");
    const response = await fetch("/api/research/data-quality/resync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end, source }),
    });
    const data = await response.json();
    setMessage(data.success ? `补数 ${data.data.rows_synced} 行` : "补数失败");
    load();
    setLoading(false);
  };

  const runResearchJob = async (kind: "bars" | "fundFlow" | "factors" | "fundamentals" | "news") => {
    setLoading(true);
    const endpoint =
      kind === "bars"
        ? "/api/research/sync-bars"
        : kind === "fundFlow"
          ? "/api/research/fund-flow/sync"
          : kind === "factors"
            ? "/api/research/factors/compute"
            : kind === "fundamentals"
              ? "/api/professional/fundamentals/sync"
              : "/api/professional/news-evidence/sync";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end, source }),
    });
    const data = await response.json();
    if (data.success) {
      const count =
        data.data.rows_synced ?? data.data.fund_flow_rows ?? data.data.factor_rows ?? data.data.rows_written ?? 0;
      recordAuditEvent("run_research_job", kind, `${endpoint} rows=${count}`);
      setMessage(`${kind === "bars" ? "行情同步" : kind === "fundFlow" ? "资金流同步" : kind === "factors" ? "因子计算" : kind === "fundamentals" ? "财务同步" : "新闻同步"} ${count} 行`);
      load();
    } else {
      setMessage("研究作业失败");
    }
    setLoading(false);
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>数据健康</h1>
        <p>查看、确认和修复行情缺失、异常价格和数据源失败记录。</p>
      </div>
      <div className="toolbar">
        <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <select value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="auto">auto</option>
          <option value="akshare">akshare</option>
          <option value="tushare">tushare</option>
        </select>
        <button className="primary" onClick={resync} disabled={loading}>
          {loading ? "处理中" : "按区间补数"}
        </button>
        <button onClick={() => runResearchJob("bars")} disabled={loading}>同步日线</button>
        <button onClick={() => runResearchJob("fundFlow")} disabled={loading}>同步资金流</button>
        <button onClick={() => runResearchJob("factors")} disabled={loading}>计算因子</button>
        <button onClick={() => runResearchJob("fundamentals")} disabled={loading}>同步财务</button>
        <button onClick={() => runResearchJob("news")} disabled={loading}>同步新闻</button>
        <button onClick={load}>刷新</button>
        <span className="muted">{message}</span>
      </div>
      {sources && (
        <div className="data-source-grid">
          <div className="detail-panel">
            <div className="section-subhead">
              <h2>数据源状态</h2>
              <span className="muted">active: {sources.active_source}</span>
            </div>
            <div className="factor-metric-grid">
              {sources.source_health.slice(0, 6).map((row) => (
                <div className="mini-metric" key={row.source}>
                  <span>{row.source}</span>
                  <strong>{row.status}</strong>
                  <small className="muted">
                    {row.symbol_count} 标的 · {row.latest_trade_date || "-"} · 错误 {row.open_error_count}
                  </small>
                </div>
              ))}
              {sources.source_health.length === 0 && (
                <div className="empty-state block">本地研究库暂无行情来源记录。</div>
              )}
            </div>
          </div>
          <div className="detail-panel">
            <div className="section-subhead">
              <h2>凭证与能力</h2>
              <span className="muted">{sources.supported_sources.join(" / ")}</span>
            </div>
            <div className="readiness-strip compact-readiness">
              {sources.credential_readiness.map((item) => (
                <span className={item.configured ? "status-badge freshness-fresh" : "status-badge freshness-delayed"} key={item.source}>
                  {item.source} · {item.configured ? "可用" : `${item.env || "env"} 未配置`}
                </span>
              ))}
            </div>
            <div className="command-grid">
              {Object.entries(sources.rate_limit_policies).map(([sourceName, policy]) => (
                <div className="command-card" key={sourceName}>
                  <strong>{sourceName} · {policy.quota_status}</strong>
                  <span>{policy.rate_limit_hint}</span>
                </div>
              ))}
            </div>
            <div className="command-grid">
              {sources.operational_commands.map((command) => (
                <div className="command-card" key={command.cli_command}>
                  <strong>{command.cli_command}</strong>
                  <span>{command.description}</span>
                  <small className="muted">{command.method || "CLI"} {command.api_endpoint || "本地命令"}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="section-subhead">
        <h2>同步链路 Trace</h2>
        <span className="muted">
          {syncTrace ? `${syncTrace.summary.success_count}/${syncTrace.summary.total} 成功` : "暂无记录"}
        </span>
      </div>
      <div className="data-table-wrap history-strip">
        <table className="data-table compact-table dense-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>任务</th>
              <th>标的</th>
              <th>区间</th>
              <th>主/备源</th>
              <th>状态</th>
              <th>行数/耗时</th>
              <th>错误</th>
            </tr>
          </thead>
          <tbody>
            {(syncTrace?.traces || []).slice(0, 12).map((trace) => (
              <tr key={trace.trace_id}>
                <td>{trace.created_at || "-"}</td>
                <td>{trace.job_type}</td>
                <td>{trace.symbol || "watchlist"}</td>
                <td>{trace.start || "-"} ~ {trace.end || "-"}</td>
                <td>{trace.primary_source || "-"} / {trace.fallback_source || "-"}</td>
                <td><span className={trace.status === "success" ? "status-badge" : "status-badge muted-badge"}>{trace.status || "-"}</span></td>
                <td>{trace.rows_written || 0} / {trace.elapsed_ms || 0}ms</td>
                <td>{trace.error || "-"}</td>
              </tr>
            ))}
            {(syncTrace?.traces || []).length === 0 && (
              <tr><td colSpan={8}>暂无同步 Trace，运行同步/流水线后自动记录。</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="readiness-strip">
        {Object.entries(issueSummary).slice(0, 8).map(([key, count]) => (
          <span className="status-badge muted-badge" key={key}>
            {key} · {count}
          </span>
        ))}
        {issues.length === 0 && <span className="status-badge">当前无打开问题</span>}
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>检查</th>
              <th>级别</th>
              <th>股票</th>
              <th>信息</th>
              <th>处理</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => (
              <tr key={index}>
                <td>{String(issue.date || "-")}</td>
                <td>{String(issue.check_name || "-")}</td>
                <td>
                  <span className="pill">{String(issue.severity || "-")}</span>
                </td>
                <td>{String(issue.symbol || "-")}</td>
                <td>{String(issue.message || "-")}</td>
                <td>
                  <span className={String(issue.resolution_status || "open") === "open" ? "status-badge muted-badge" : "status-badge"}>
                    {String(issue.resolution_status || "open")}
                  </span>
                  <br />
                  <span className="muted">{String(issue.resolution_note || "")}</span>
                </td>
                <td>
                  <button className="mini" onClick={() => resolveIssue(issue.id, "resolved")} disabled={loading}>
                    确认
                  </button>
                  <button className="danger mini" onClick={() => resolveIssue(issue.id, "ignored")} disabled={loading}>
                    忽略
                  </button>
                </td>
              </tr>
            ))}
            {issues.length === 0 && (
              <tr>
                <td colSpan={7}>暂无数据质量记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
