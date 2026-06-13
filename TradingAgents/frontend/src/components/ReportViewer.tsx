import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  report: Record<string, string>;
  ticker: string;
  tradeDate: string;
  taskId?: string;
}

const TABS: { key: string; label: string }[] = [
  { key: "final_trade_decision", label: "最终决策" },
  { key: "market_report", label: "市场技术面" },
  { key: "fundamentals_report", label: "基本面" },
  { key: "news_report", label: "新闻" },
  { key: "sentiment_report", label: "市场情绪" },
  { key: "investment_debate_summary", label: "多空辩论" },
  { key: "investment_plan", label: "投资计划" },
  { key: "trader_investment_plan", label: "交易计划" },
  { key: "risk_debate_summary", label: "风险辩论" },
  { key: "quant_signal_context", label: "量化信号" },
];

const SECTION_OWNERS: Record<string, string> = {
  final_trade_decision: "Portfolio Manager",
  market_report: "Market Analyst",
  fundamentals_report: "Fundamentals Analyst",
  news_report: "News Analyst",
  sentiment_report: "Social Analyst",
  investment_debate_summary: "Bull/Bear Debate",
  investment_plan: "Bull/Bear + Research Manager",
  trader_investment_plan: "Trader",
  risk_debate_summary: "Risk Analysts",
  quant_signal_context: "Rule Signals",
};

export default function ReportViewer({ report, ticker, tradeDate, taskId }: Props) {
  const [activeTab, setActiveTab] = useState("final_trade_decision");
  const [downloading, setDownloading] = useState(false);
  const content = report[activeTab] || "(无内容)";
  const savedPath = report.saved_path || "";

  const handleDownload = async () => {
    if (!taskId) return;
    setDownloading(true);
    try {
      window.open(`/api/tasks/${taskId}/download`, "_blank");
    } catch {
      alert("下载失败");
    }
    setDownloading(false);
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0, borderBottom: "1px solid var(--border-color)",
        background: "var(--bg-secondary)", padding: "0 24px", flexShrink: 0, alignItems: "center",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "0 16px", marginRight: 16,
          fontSize: 14, fontWeight: 600, color: "var(--accent-green)",
          borderRight: "1px solid var(--border-color)",
        }}>
          {ticker} @ {tradeDate}
          {report.research_depth && (
            <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 400 }}>
              {report.research_depth}
            </span>
          )}
        </div>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: "transparent", border: "none",
              borderBottom: activeTab === tab.key ? "2px solid var(--accent-green)" : "2px solid transparent",
              borderRadius: 0, padding: "12px 16px",
              color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-secondary)",
              fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400, whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8 }}>
          {taskId && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="primary"
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              {downloading ? "下载中..." : "⬇ 下载报告"}
            </button>
          )}
          {savedPath && (
            <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>
              已保存
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px", lineHeight: 1.8 }}>
        <div className="report-structure-strip">
          {TABS.map((tab) => {
            const filled = Boolean(report[tab.key]);
            return (
              <button
                key={tab.key}
                className={activeTab === tab.key ? "active" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                <strong>{tab.label}</strong>
                <span>{SECTION_OWNERS[tab.key]}</span>
                <small>{filled ? "已生成" : "待生成"}</small>
              </button>
            );
          })}
        </div>
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1 style={{ fontSize: 22, margin: "24px 0 12px", borderBottom: "1px solid var(--border-color)", paddingBottom: 8 }}>{children}</h1>,
            h2: ({ children }) => <h2 style={{ fontSize: 18, margin: "20px 0 10px" }}>{children}</h2>,
            h3: ({ children }) => <h3 style={{ fontSize: 16, margin: "16px 0 8px" }}>{children}</h3>,
            p: ({ children }) => <p style={{ margin: "8px 0", color: "var(--text-primary)" }}>{children}</p>,
            ul: ({ children }) => <ul style={{ paddingLeft: 24, margin: "8px 0" }}>{children}</ul>,
            ol: ({ children }) => <ol style={{ paddingLeft: 24, margin: "8px 0" }}>{children}</ol>,
            li: ({ children }) => <li style={{ margin: "4px 0" }}>{children}</li>,
            code: ({ children, className }) => {
              const isInline = !className;
              return isInline
                ? <code style={{ background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4, fontSize: "0.9em" }}>{children}</code>
                : <pre style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 13, lineHeight: 1.5 }}><code>{children}</code></pre>;
            },
            blockquote: ({ children }) => (
              <blockquote style={{ borderLeft: "3px solid var(--accent-blue)", paddingLeft: 16, margin: "12px 0", color: "var(--text-secondary)" }}>{children}</blockquote>
            ),
            strong: ({ children }) => <strong style={{ color: "var(--accent-yellow)" }}>{children}</strong>,
            table: ({ children }) => (
              <div style={{ overflow: "auto", margin: "12px 0" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>{children}</table></div>
            ),
            th: ({ children }) => <th style={{ border: "1px solid var(--border-color)", padding: "8px 12px", background: "var(--bg-tertiary)", textAlign: "left", fontWeight: 600 }}>{children}</th>,
            td: ({ children }) => <td style={{ border: "1px solid var(--border-color)", padding: "8px 12px" }}>{children}</td>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
