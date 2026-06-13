import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface HistoryItem {
  ticker: string;
  trade_date: string;
  file_path?: string;
  report_path?: string | null;
  has_report?: boolean;
  created_at?: string | null;
}

interface HistoryReport {
  ticker: string;
  trade_date: string;
  markdown: string;
  sections?: Record<string, string>;
  section_status?: Record<string, string>;
  saved_path?: string;
}

const REPORT_SECTIONS = [
  { key: "final_trade_decision", label: "最终决策", owner: "Portfolio Manager" },
  { key: "market_report", label: "市场技术面", owner: "Market Analyst" },
  { key: "fundamentals_report", label: "基本面", owner: "Fundamentals Analyst" },
  { key: "news_report", label: "新闻", owner: "News Analyst" },
  { key: "sentiment_report", label: "市场情绪", owner: "Social Analyst" },
  { key: "investment_debate_summary", label: "多空辩论", owner: "Research Manager" },
  { key: "investment_plan", label: "投资计划", owner: "Bull/Bear Team" },
  { key: "trader_investment_plan", label: "交易计划", owner: "Trader" },
  { key: "risk_debate_summary", label: "风险辩论", owner: "Risk Team" },
  { key: "quant_signal_context", label: "量化信号", owner: "Rule Signals" },
];

export default function HistoryReportsPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [report, setReport] = useState<HistoryReport | null>(null);
  const [reportSearch, setReportSearch] = useState("");
  const [activeSection, setActiveSection] = useState("full_report");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.ticker} ${item.trade_date}`.toUpperCase().includes(normalized),
    );
  }, [items, query]);

  const sectionSummary = useMemo(() => {
    const status = report?.section_status || {};
    const parsed = REPORT_SECTIONS.filter((section) => status[section.key] === "parsed").length;
    return { parsed, total: REPORT_SECTIONS.length };
  }, [report?.section_status]);

  const headings = useMemo(() => {
    return (report?.markdown || "")
      .split("\n")
      .filter((line) => /^#{1,3}\s+/.test(line))
      .map((line) => line.replace(/^#{1,3}\s+/, "").trim())
      .slice(0, 12);
  }, [report?.markdown]);

  const renderedMarkdown = useMemo(() => {
    const activeSectionBody =
      activeSection !== "full_report" ? report?.sections?.[activeSection] || "" : "";
    const sourceMarkdown = activeSectionBody || report?.markdown || "选择左侧历史记录后查看报告。";
    const title = REPORT_SECTIONS.find((section) => section.key === activeSection)?.label;
    if (!reportSearch.trim()) return title && activeSectionBody ? `### ${title}\n\n${sourceMarkdown}` : sourceMarkdown;
    const keyword = reportSearch.trim();
    const lines = sourceMarkdown.split("\n");
    const matched = lines.filter((line) => line.toLowerCase().includes(keyword.toLowerCase()));
    return matched.length > 0
      ? `### 搜索结果：${keyword}\n\n${matched.join("\n\n")}`
      : `### 搜索结果：${keyword}\n\n未找到匹配内容。`;
  }, [activeSection, report?.markdown, report?.sections, reportSearch]);

  const loadHistory = async () => {
    setLoading(true);
    const response = await fetch("/api/history");
    const data = await response.json();
    if (data.success) {
      setItems(data.data);
      if (!selected && data.data.length > 0) {
        await openReport(data.data.find((item: HistoryItem) => item.has_report) || data.data[0]);
      }
    } else {
      setMessage("历史记录读取失败");
    }
    setLoading(false);
  };

  const openReport = async (item: HistoryItem) => {
    setSelected(item);
    setReport(null);
    setActiveSection("full_report");
    setMessage("");
    if (!item.has_report) {
      setMessage("该记录只有状态日志，未找到 Markdown 报告");
      return;
    }
    const response = await fetch(
      `/api/history/${encodeURIComponent(item.ticker)}/${item.trade_date}/report`,
    );
    const data = await response.json();
    if (data.success) {
      setReport(data.data);
      const firstParsed = REPORT_SECTIONS.find(
        (section) => data.data.section_status?.[section.key] === "parsed",
      );
      setActiveSection(firstParsed?.key || "full_report");
    } else {
      setMessage("报告读取失败");
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>历史报告</h1>
        <p>检索已完成的单股分析，重新打开 Markdown 报告并下载归档。</p>
      </div>
      <div className="toolbar">
        <input
          className="wide-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索股票或日期"
        />
        <button onClick={loadHistory} disabled={loading}>
          {loading ? "刷新中" : "刷新"}
        </button>
        {selected?.has_report && (
          <a
            className="button-link"
            href={`/api/history/${encodeURIComponent(selected.ticker)}/${selected.trade_date}/download`}
          >
            下载
          </a>
        )}
        <input
          className="wide-input"
          value={reportSearch}
          onChange={(event) => setReportSearch(event.target.value)}
          placeholder="在当前报告内搜索"
        />
        <span className="muted">{message}</span>
      </div>
      <div className="split-grid report-workspace">
        <div className="report-side">
          <div className="data-table-wrap">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>股票</th>
                  <th>日期</th>
                  <th>报告</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    className={selected === item ? "selected-row" : ""}
                    key={`${item.ticker}-${item.trade_date}`}
                    onClick={() => openReport(item)}
                  >
                    <td>{item.ticker}</td>
                    <td>{item.trade_date}</td>
                    <td>
                      <span className={item.has_report ? "status-badge" : "status-badge muted-badge"}>
                        {item.has_report ? "可打开" : "仅日志"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3}>暂无历史记录</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="list-panel compact-list">
            <h2>报告目录</h2>
            {headings.map((heading) => (
              <p key={heading}>{heading}</p>
            ))}
            {headings.length === 0 && <p className="empty-state">打开报告后显示目录。</p>}
          </div>
          <div className="list-panel compact-list">
            <h2>结构化覆盖</h2>
            <p>
              <strong>{sectionSummary.parsed}/{sectionSummary.total}</strong>
              <span>已解析分区</span>
            </p>
            <p>
              <strong>{report?.saved_path ? "已归档" : "-"}</strong>
              <span>{report?.saved_path || "暂无保存路径"}</span>
            </p>
          </div>
        </div>
        <div>
          <HistorySectionNavigator
            activeSection={activeSection}
            report={report}
            onSelect={setActiveSection}
          />
          <div className="markdown-panel scroll-panel">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {renderedMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </section>
  );
}

function HistorySectionNavigator({
  activeSection,
  report,
  onSelect,
}: {
  activeSection: string;
  report: HistoryReport | null;
  onSelect: (key: string) => void;
}) {
  const status = report?.section_status || {};
  return (
    <div className="report-structure-strip history-section-strip">
      <button
        className={activeSection === "full_report" ? "active" : ""}
        onClick={() => onSelect("full_report")}
      >
        <strong>完整报告</strong>
        <span>Markdown Archive</span>
        <small>{report?.markdown ? "可查看" : "待打开"}</small>
      </button>
      {REPORT_SECTIONS.map((section) => {
        const parsed = status[section.key] === "parsed";
        return (
          <button
            key={section.key}
            className={activeSection === section.key ? "active" : ""}
            onClick={() => onSelect(section.key)}
            disabled={!report}
          >
            <strong>{section.label}</strong>
            <span>{section.owner}</span>
            <small>{parsed ? "已解析" : "缺失"}</small>
          </button>
        );
      })}
    </div>
  );
}
