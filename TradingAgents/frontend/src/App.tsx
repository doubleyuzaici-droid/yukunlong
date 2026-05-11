import { useState, useCallback } from "react";
import AnalysisForm from "./components/AnalysisForm";
import ProgressPanel from "./components/ProgressPanel";
import ReportViewer from "./components/ReportViewer";

type View = "form" | "running" | "report";

function App() {
  const [view, setView] = useState<View>("form");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [report, setReport] = useState<Record<string, string> | null>(null);
  const [ticker, setTicker] = useState("");
  const [tradeDate, setTradeDate] = useState("");

  const handleAnalysisStart = useCallback((id: string, t: string, d: string) => {
    setTaskId(id);
    setTicker(t);
    setTradeDate(d);
    setView("running");
  }, []);

  const handleAnalysisComplete = useCallback((rep: Record<string, string>) => {
    setReport(rep);
    setView("report");
  }, []);

  const handleReset = useCallback(() => {
    setView("form");
    setTaskId(null);
    setReport(null);
  }, []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-color)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-green)" }}>
            TradingAgents
          </span>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Multi-Agent Financial Trading Framework
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {view !== "form" && (
            <button onClick={handleReset}>新建分析</button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {view === "form" && (
          <AnalysisForm onStart={handleAnalysisStart} />
        )}
        {view === "running" && taskId && (
          <ProgressPanel
            taskId={taskId}
            ticker={ticker}
            tradeDate={tradeDate}
            onComplete={handleAnalysisComplete}
          />
        )}
        {view === "report" && report && (
          <ReportViewer
            report={report}
            ticker={ticker}
            tradeDate={tradeDate}
            taskId={taskId ?? undefined}
          />
        )}
      </main>
    </div>
  );
}

export default App;
