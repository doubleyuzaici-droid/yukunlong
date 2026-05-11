import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const today = new Date().toISOString().slice(0, 10);

export default function DailyReportPage() {
  const [date, setDate] = useState(today);
  const [markdown, setMarkdown] = useState("");

  const load = async () => {
    const response = await fetch(`/api/reports/daily?date=${date}`);
    const data = await response.json();
    if (data.success) setMarkdown(data.data.markdown);
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>每日复盘</h1>
        <p>按信号等级、风险和数据质量生成 Markdown 复盘。</p>
      </div>
      <div className="toolbar">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <button className="primary" onClick={load}>生成</button>
        <a className="button-link" href={`/api/reports/daily/download?date=${date}`}>下载</a>
      </div>
      <div className="markdown-panel">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {markdown || "选择日期后生成复盘。"}
        </ReactMarkdown>
      </div>
    </section>
  );
}
