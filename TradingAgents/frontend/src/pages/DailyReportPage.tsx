import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { pipelineEmptyReason, type PipelineSummary } from "../utils/researchPipeline";

const today = new Date().toISOString().slice(0, 10);

export default function DailyReportPage() {
  const [date, setDate] = useState(today);
  const [markdown, setMarkdown] = useState("");
  const [professionalHtml, setProfessionalHtml] = useState("");
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [loading, setLoading] = useState<"report" | "pipeline" | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading("report");
    const response = await fetch(`/api/reports/daily?date=${date}`);
    const data = await response.json();
    if (data.success) setMarkdown(data.data.markdown);
    setLoading(null);
  };

  const runPipelineAndLoad = async () => {
    setLoading("pipeline");
    setMessage("同步并生成中");
    const pipelineResponse = await fetch("/api/research/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ end: date, signal_date: date }),
    });
    const pipelineData = await pipelineResponse.json();
    if (pipelineData.success) {
      setPipeline(pipelineData.data);
      setMessage(`同步 ${pipelineData.data.rows_synced} 行，触发 ${pipelineData.data.signal_count} 条信号`);
      const reportResponse = await fetch(`/api/reports/daily?date=${date}`);
      const reportData = await reportResponse.json();
      if (reportData.success) setMarkdown(reportData.data.markdown);
    } else {
      setMessage("流水线运行失败");
    }
    setLoading(null);
  };

  const loadProfessional = async () => {
    setLoading("report");
    const response = await fetch(`/api/reports/professional/daily?date=${date}`);
    const data = await response.json();
    if (data.success) {
      setMarkdown(data.data.markdown);
      setProfessionalHtml(data.data.html);
      setMessage(`专业日报：信号 ${data.data.sections.signals.count} 条，质量问题 ${data.data.sections.data_quality.open_issue_count} 个`);
    } else {
      setMessage("专业日报生成失败");
    }
    setLoading(null);
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>每日复盘</h1>
        <p>按信号等级、风险和数据质量生成 Markdown 复盘。</p>
      </div>
      <div className="toolbar">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <button onClick={load} disabled={loading !== null}>
          {loading === "report" ? "生成中" : "仅生成报告"}
        </button>
        <button className="primary" onClick={runPipelineAndLoad} disabled={loading !== null}>
          {loading === "pipeline" ? "运行中" : "同步并生成"}
        </button>
        <button onClick={loadProfessional} disabled={loading !== null}>
          专业日报
        </button>
        <a className="button-link" href={`/api/reports/daily/download?date=${date}`}>下载</a>
        <a className="button-link" href={`/api/reports/professional/daily/download?date=${date}&format=html`}>下载HTML</a>
        <span className="muted">{message}</span>
      </div>
      {pipeline && (
        <div className="pipeline-summary">
          <div className="metric-tile">
            <span>扫描股票</span>
            <strong>{pipeline.watchlist_count}</strong>
          </div>
          <div className="metric-tile">
            <span>同步行情</span>
            <strong>{pipeline.rows_synced}</strong>
          </div>
          <div className="metric-tile">
            <span>触发信号</span>
            <strong>{pipeline.signal_count}</strong>
          </div>
        </div>
      )}
      {pipeline && pipeline.signal_count === 0 && (
        <p className="empty-state block">{pipelineEmptyReason(pipeline)}</p>
      )}
      <div className="markdown-panel">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {markdown || "选择日期后生成复盘。"}
        </ReactMarkdown>
      </div>
      {professionalHtml && (
        <div className="data-trust-panel compact">
          <div className="data-trust-head">
            <div>
              <span className="eyebrow">Professional Export</span>
              <h2>专业报告 HTML 已生成</h2>
              <p>可下载为 HTML 归档；Markdown 区域同步展示结构化内容。</p>
            </div>
            <span className="status-badge">ready</span>
          </div>
        </div>
      )}
    </section>
  );
}
