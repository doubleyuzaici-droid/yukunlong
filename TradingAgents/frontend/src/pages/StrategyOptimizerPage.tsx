import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface OptimizerPayload {
  summary?: unknown;
  candidate_yaml?: string;
  markdown?: string;
}

export default function StrategyOptimizerPage() {
  const [data, setData] = useState<OptimizerPayload | null>(null);

  const load = async () => {
    const response = await fetch("/api/research/optimizer");
    const result = await response.json();
    if (result.success) setData(result.data);
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>策略调优</h1>
        <p>读取回测表现，生成候选配置，所有候选都需要人工确认。</p>
      </div>
      <div className="toolbar">
        <button className="primary" onClick={load}>生成诊断</button>
      </div>
      {data ? (
        <div className="split-grid">
          <div className="markdown-panel">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {data.markdown || "暂无诊断摘要。"}
            </ReactMarkdown>
          </div>
          <pre className="code-panel">{data.candidate_yaml || "暂无候选配置。"}</pre>
        </div>
      ) : (
        <div className="empty-state block">等待诊断。</div>
      )}
    </section>
  );
}
