import { useEffect, useState, useRef } from "react";

interface LogMessage {
  time: string;
  type: "info" | "success" | "error" | "warning";
  content: string;
}

interface AgentInfo {
  key: string;
  label: string;
  status: string;
  enabled: boolean;
}

interface StageData {
  key: string;
  label: string;
  status: string;
  agents: AgentInfo[];
}

interface TokenData {
  input_tokens: number;
  output_tokens: number;
  llm_calls: number;
  tool_calls: number;
}

interface ToolEvent {
  event_type: "tool_call" | "tool_result" | string;
  tool_call_id?: string;
  tool_name?: string;
  args?: Record<string, unknown>;
  content_preview?: string;
}

interface Props {
  taskId: string;
  ticker: string;
  tradeDate: string;
  onComplete: (report: Record<string, string>) => void;
}

const STATUS_COLORS: Record<string, string> = {
  running: "var(--accent-blue)",
  completed: "var(--accent-green)",
  failed: "var(--accent-red)",
};

const AGENT_COLORS: Record<string, string> = {
  pending: "#484f58",
  in_progress: "var(--accent-blue)",
  completed: "var(--accent-green)",
  error: "var(--accent-red)",
};

const MSG_COLORS: Record<string, string> = {
  info: "var(--text-secondary)",
  success: "var(--accent-green)",
  error: "var(--accent-red)",
  warning: "var(--accent-yellow)",
};

function fmtTokens(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export default function ProgressPanel({ taskId, ticker, tradeDate, onComplete }: Props) {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [status, setStatus] = useState("running");
  const [currentStep, setCurrentStep] = useState("初始化中...");
  const [stages, setStages] = useState<StageData[]>([]);
  const [currentStageKey, setCurrentStageKey] = useState("");
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [reportHtml, setReportHtml] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(["analysts"]));
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const es = new EventSource(`/api/tasks/${taskId}/stream`);

    es.addEventListener("message", (e) => {
      try {
        const msg: LogMessage = JSON.parse(e.data);
        setLogs((prev) => [...prev, msg]);
      } catch {}
    });

    es.addEventListener("status", (e) => {
      try {
        const data = JSON.parse(e.data);
        setStatus(data.status);
        setCurrentStep(data.current_step || "");
        if (data.stages?.length) setStages(data.stages);
        if (data.current_stage_key) {
          setCurrentStageKey(data.current_stage_key);
          setExpandedStages((prev) => { const next = new Set(prev); next.add(data.current_stage_key); return next; });
        }
        if (data.token_stats) setTokens(data.token_stats);
        if (Array.isArray(data.tool_events)) setToolEvents(data.tool_events);
        if (data.current_report_html) setReportHtml(data.current_report_html);
        if (data.status === "completed" || data.status === "failed") es.close();
      } catch {}
    });

    es.onerror = () => es.close();
    return () => es.close();
  }, [taskId]);

  useEffect(() => {
    if (status !== "completed") return;
    const fetchReport = async () => {
      const resp = await fetch(`/api/tasks/${taskId}/report`);
      const data = await resp.json();
      if (data.success && data.data) onComplete(data.data);
    };
    fetchReport();
  }, [status, taskId, onComplete]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const toggleExpand = (key: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const completedAgents = stages.reduce(
    (acc, s) => acc + s.agents.filter((a) => a.enabled && a.status === "completed").length, 0
  );
  const totalAgents = stages.reduce(
    (acc, s) => acc + s.agents.filter((a) => a.enabled).length, 0
  );

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", overflow: "hidden" }}>
      {/* LEFT: Agent Status + Token Stats */}
      <div style={{ width: 320, flexShrink: 0, borderRight: "1px solid var(--border-color)", padding: "16px", overflow: "auto", background: "var(--bg-secondary)" }}>
        {/* Header */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{ticker} ({tradeDate})</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
            {formatTime(elapsed)} · {currentStep}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: "var(--bg-tertiary)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: totalAgents > 0 ? `${(completedAgents / totalAgents) * 100}%` : "0%",
            background: "var(--accent-green)",
            borderRadius: 2,
            transition: "width 0.5s ease",
          }} />
        </div>

        {/* Token Stats */}
        {tokens && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14,
            padding: 10, background: "var(--bg-primary)", borderRadius: 6, border: "1px solid var(--border-color)",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>LLM 调用</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{tokens.llm_calls}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>工具调用</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{tokens.tool_calls}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Token 输入</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-blue)" }}>{fmtTokens(tokens.input_tokens)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Token 输出</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-purple)" }}>{fmtTokens(tokens.output_tokens)}</div>
            </div>
          </div>
        )}

        {toolEvents.length > 0 && (
          <div style={{
            marginBottom: 14, padding: 10, background: "var(--bg-primary)",
            borderRadius: 6, border: "1px solid var(--border-color)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
              工具调用轨迹
            </div>
            {toolEvents.slice(-5).map((event, index) => (
              <div
                key={`${event.tool_call_id || event.tool_name || "tool"}-${index}`}
                style={{ borderTop: index === 0 ? 0 : "1px solid rgba(51,64,77,0.7)", padding: "7px 0" }}
              >
                <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>
                  {event.event_type === "tool_result" ? `${event.tool_name || "tool"} 返回` : event.tool_name || "tool"}
                </div>
                <div style={{
                  marginTop: 3, color: "var(--text-secondary)", fontSize: 11,
                  lineHeight: 1.45, wordBreak: "break-all",
                }}>
                  {event.event_type === "tool_result"
                    ? event.content_preview || "-"
                    : JSON.stringify(event.args || {})}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stage list with agents */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
          Agent 状态 ({completedAgents}/{totalAgents})
        </div>
        {stages.map((stage) => (
          <div key={stage.key} style={{ marginBottom: 6 }}>
            <div
              onClick={() => toggleExpand(stage.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                borderRadius: 6, cursor: "pointer", fontSize: 13,
                background: currentStageKey === stage.key ? "rgba(88,166,255,0.08)" : "transparent",
                border: currentStageKey === stage.key ? "1px solid rgba(88,166,255,0.2)" : "1px solid transparent",
              }}
            >
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: AGENT_COLORS[stage.status] || "#484f58",
                flexShrink: 0,
                animation: stage.status === "in_progress" ? "pulse 1.5s infinite" : "none",
              }} />
              <span style={{ flex: 1 }}>{stage.label}</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {stage.agents.filter((a) => a.enabled && a.status === "completed").length}
                /{stage.agents.filter((a) => a.enabled).length}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-secondary)", transform: expandedStages.has(stage.key) ? "" : "rotate(-90deg)" }}>
                ▼
              </span>
            </div>
            {expandedStages.has(stage.key) && stage.agents.filter((a) => a.enabled).map((agent) => (
              <div
                key={agent.key}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "3px 8px 3px 28px",
                  fontSize: 12, color: agent.status === "in_progress" ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <span style={{
                  display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                  background: AGENT_COLORS[agent.status] || "#484f58",
                  animation: agent.status === "in_progress" ? "pulse 1.5s infinite" : "none",
                }} />
                {agent.label}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* RIGHT: Logs + Report Preview */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Live Report Preview */}
        {reportHtml && (
          <div style={{
            flexShrink: 0, maxHeight: 180, overflow: "auto", padding: "12px 16px",
            borderBottom: "1px solid var(--border-color)", fontSize: 13,
            lineHeight: 1.6, background: "rgba(63,185,80,0.03)",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--accent-green)", animation: "pulse 1.5s infinite" }} />
              实时报告预览
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", color: "var(--text-primary)" }}>
              {reportHtml}
            </div>
          </div>
        )}

        {/* Log area */}
        <div style={{
          flex: 1, overflow: "auto", padding: "12px 16px",
          fontFamily: "monospace", fontSize: 12, lineHeight: 1.6,
        }}>
          {logs.length === 0 && (
            <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: 40 }}>
              等待分析启动...
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: 3, display: "flex", gap: 8 }}>
              <span style={{ color: "var(--text-secondary)", flexShrink: 0, fontSize: 11 }}>
                {new Date(log.time).toLocaleTimeString()}
              </span>
              <span style={{ color: MSG_COLORS[log.type] || "var(--text-primary)", wordBreak: "break-all" }}>
                {log.content}
              </span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {status === "failed" && (
          <div style={{
            flexShrink: 0, padding: "12px 16px",
            background: "rgba(248,81,73,0.1)", borderTop: "1px solid var(--accent-red)",
            color: "var(--accent-red)", fontSize: 13,
          }}>
            分析任务失败。请检查日志了解详情。
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
