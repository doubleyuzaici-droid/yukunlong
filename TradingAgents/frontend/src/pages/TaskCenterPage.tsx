import { useEffect, useMemo, useState } from "react";

interface TaskRow {
  task_id: string;
  status: string;
  ticker: string;
  trade_date: string;
  research_depth?: string;
  current_step?: string;
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
  messages?: { time?: string; type?: string; content?: string }[];
  tool_events?: {
    event_type: string;
    message_index?: number;
    tool_call_id?: string;
    tool_name?: string;
    args?: Record<string, unknown>;
    content_preview?: string;
  }[];
  stages?: {
    key: string;
    label: string;
    status: string;
    agents: { key: string; label: string; status: string; enabled: boolean }[];
  }[];
  current_stage_key?: string;
  token_stats?: {
    input_tokens: number;
    output_tokens: number;
    llm_calls: number;
    tool_calls: number;
  } | null;
}

interface TaskReport {
  market_report?: string;
  sentiment_report?: string;
  news_report?: string;
  fundamentals_report?: string;
  investment_plan?: string;
  trader_investment_plan?: string;
  investment_debate_summary?: string;
  risk_debate_summary?: string;
  quant_signal_context?: string;
  final_trade_decision?: string;
}

export default function TaskCenterPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [selected, setSelected] = useState<TaskRow | null>(null);
  const [selectedReport, setSelectedReport] = useState<TaskReport | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const response = await fetch("/api/tasks");
    const data = await response.json();
    if (data.success) {
      setTasks(data.data.tasks);
      setSelected((current) => current || data.data.tasks[0] || null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected || selected.status !== "completed") {
      setSelectedReport(null);
      return;
    }
    fetch(`/api/tasks/${selected.task_id}/report`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setSelectedReport(data?.success ? data.data : null);
      })
      .catch(() => setSelectedReport(null));
  }, [selected]);

  const counts = useMemo(() => {
    return tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});
  }, [tasks]);

  const cancelTask = async (task: TaskRow) => {
    setLoading(true);
    const response = await fetch(`/api/tasks/${task.task_id}/cancel`, { method: "POST" });
    const data = await response.json();
    setMessage(data.success ? `${task.task_id} 已标记取消` : "取消失败");
    await load();
    setLoading(false);
  };

  const retryTask = async (task: TaskRow) => {
    setLoading(true);
    const response = await fetch(`/api/tasks/${task.task_id}/retry`, { method: "POST" });
    const data = await response.json();
    setMessage(data.success ? `已创建重试任务 ${data.data.task_id}` : "重试失败");
    await load();
    setLoading(false);
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>任务中心</h1>
        <p>集中查看分析任务状态，处理失败任务、重试任务和运行日志。</p>
      </div>
      <div className="toolbar">
        <button className="primary" onClick={load}>刷新</button>
        <span className="muted">{message}</span>
      </div>
      <div className="pipeline-summary">
        <Metric label="全部" value={String(tasks.length)} />
        <Metric label="运行中" value={String(counts.running || 0)} />
        <Metric label="失败" value={String(counts.failed || 0)} />
        <Metric label="已完成" value={String(counts.completed || 0)} />
      </div>
      <div className="split-grid">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>任务</th>
                <th>股票</th>
                <th>日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  className={selected?.task_id === task.task_id ? "selected-row" : ""}
                  key={task.task_id}
                  onClick={() => setSelected(task)}
                >
                  <td>{task.task_id}</td>
                  <td>{task.ticker}</td>
                  <td>{task.trade_date}</td>
                  <td><span className="status-badge">{task.status}</span></td>
                  <td>
                    <button className="mini" onClick={(event) => { event.stopPropagation(); retryTask(task); }} disabled={loading}>
                      重试
                    </button>
                    <button className="danger mini" onClick={(event) => { event.stopPropagation(); cancelTask(task); }} disabled={loading}>
                      取消
                    </button>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5}>暂无任务</td>
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
                  <span className="eyebrow">{selected.status}</span>
                  <h2>{selected.ticker} · {selected.trade_date}</h2>
                  <p>{selected.current_step || "-"}</p>
                </div>
                <span className="status-badge">{selected.research_depth || "medium"}</span>
              </div>
              <div className="detail-grid">
                <Metric label="LLM Calls" value={String(selected.token_stats?.llm_calls || 0)} />
                <Metric label="Tool Calls" value={String(selected.token_stats?.tool_calls || 0)} />
                <Metric label="Output Tokens" value={String(selected.token_stats?.output_tokens || 0)} />
              </div>
              <AgentStageMatrix
                stages={selected.stages || []}
                currentStageKey={selected.current_stage_key}
              />
              <ToolCallTape toolEvents={selected.tool_events || []} />
              <AgentDecisionPath messages={selected.messages || []} />
              <ReportCoverage report={selectedReport} />
              <div className="list-panel compact-list">
                <h2>任务日志</h2>
                {(selected.messages || []).slice(-12).map((item, index) => (
                  <p key={`${item.time}-${index}`}>
                    <strong>{item.type || "info"}</strong>
                    <span>{item.content || "-"}</span>
                  </p>
                ))}
                {(selected.messages || []).length === 0 && <p className="empty-state">暂无日志</p>}
              </div>
              {selected.error && <pre className="code-panel">{selected.error}</pre>}
            </>
          ) : (
            <>
              <div className="empty-state block">选择任务后查看详情。</div>
              <AgentStageMatrix stages={[]} />
              <ToolCallTape toolEvents={[]} />
              <AgentDecisionPath messages={[]} />
              <ReportCoverage report={null} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ToolCallTape({ toolEvents }: { toolEvents: NonNullable<TaskRow["tool_events"]> }) {
  return (
    <div className="list-panel compact-list tool-call-tape">
      <h2>工具调用轨迹</h2>
      {toolEvents.slice(-12).map((event, index) => (
        <p key={`${event.tool_call_id}-${index}`}>
          <strong>{event.event_type === "tool_call" ? event.tool_name || "tool" : `${event.tool_name || "tool"} 返回`}</strong>
          <span>
            {event.event_type === "tool_call"
              ? JSON.stringify(event.args || {})
              : event.content_preview || "-"}
          </span>
        </p>
      ))}
      {toolEvents.length === 0 && <p className="empty-state">暂无工具调用轨迹；新完成任务会自动提取。</p>}
    </div>
  );
}

function AgentStageMatrix({
  stages,
  currentStageKey,
}: {
  stages: NonNullable<TaskRow["stages"]>;
  currentStageKey?: string;
}) {
  return (
    <div className="list-panel agent-stage-panel">
      <h2>Agent 执行矩阵</h2>
      <div className="agent-stage-grid">
        {stages.map((stage) => (
          <div className={`agent-stage-card ${currentStageKey === stage.key ? "active" : ""}`} key={stage.key}>
            <strong>{stage.label}</strong>
            <span className="muted">{stage.status}</span>
            <div>
              {stage.agents.filter((agent) => agent.enabled).map((agent) => (
                <small className={`agent-chip ${agent.status}`} key={agent.key}>
                  {agent.label}
                </small>
              ))}
            </div>
          </div>
        ))}
        {stages.length === 0 && <p className="empty-state">暂无阶段数据</p>}
      </div>
    </div>
  );
}

function AgentDecisionPath({ messages }: { messages: NonNullable<TaskRow["messages"]> }) {
  const checkpoints = messages.filter((item) =>
    /(初始化|研究深度|分析师|Graph|完成|失败|checkpoint|Checkpoint)/i.test(item.content || ""),
  );
  return (
    <div className="list-panel compact-list">
      <h2>审查闭环</h2>
      {checkpoints.slice(-8).map((item, index) => (
        <p key={`${item.time}-${index}`}>
          <strong>{item.type || "info"}</strong>
          <span>{item.content || "-"}</span>
        </p>
      ))}
      {checkpoints.length === 0 && <p className="empty-state">暂无闭环事件</p>}
    </div>
  );
}

const REPORT_SECTIONS: { key: keyof TaskReport; label: string; owner: string }[] = [
  { key: "market_report", label: "市场技术面", owner: "Market Analyst" },
  { key: "sentiment_report", label: "情绪/社媒", owner: "Social Analyst" },
  { key: "news_report", label: "新闻", owner: "News Analyst" },
  { key: "fundamentals_report", label: "基本面", owner: "Fundamentals Analyst" },
  { key: "investment_debate_summary", label: "多空辩论", owner: "Bull/Bear Debate" },
  { key: "investment_plan", label: "研究经理计划", owner: "Bull/Bear + Manager" },
  { key: "trader_investment_plan", label: "交易计划", owner: "Trader" },
  { key: "risk_debate_summary", label: "风险辩论", owner: "Risk Analysts" },
  { key: "quant_signal_context", label: "量化信号", owner: "Rule Scanner" },
  { key: "final_trade_decision", label: "组合经理决策", owner: "Risk + Portfolio" },
];

function ReportCoverage({ report }: { report: TaskReport | null }) {
  return (
    <div className="list-panel report-coverage-panel">
      <h2>报告结构</h2>
      <div className="report-coverage-grid">
        {REPORT_SECTIONS.map((section) => {
          const filled = Boolean(report?.[section.key]);
          return (
            <span className={filled ? "status-badge freshness-fresh" : "status-badge muted-badge"} key={section.key}>
              {section.label} · {section.owner}
            </span>
          );
        })}
      </div>
    </div>
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
