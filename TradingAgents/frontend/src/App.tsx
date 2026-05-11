import { useState, useCallback } from "react";
import AnalysisForm from "./components/AnalysisForm";
import ProgressPanel from "./components/ProgressPanel";
import ReportViewer from "./components/ReportViewer";
import AgentReviewPage from "./pages/AgentReviewPage";
import BacktestPage from "./pages/BacktestPage";
import DailyReportPage from "./pages/DailyReportPage";
import DataHealthPage from "./pages/DataHealthPage";
import StrategyOptimizerPage from "./pages/StrategyOptimizerPage";
import TodaySignalsPage from "./pages/TodaySignalsPage";
import WatchlistPage from "./pages/WatchlistPage";

type View = "form" | "running" | "report";
type Workspace =
  | "analysis"
  | "watchlist"
  | "signals"
  | "report"
  | "backtest"
  | "review"
  | "optimizer"
  | "health";

const NAV_ITEMS: { key: Workspace; label: string }[] = [
  { key: "analysis", label: "单股分析" },
  { key: "watchlist", label: "自选股" },
  { key: "signals", label: "今日信号" },
  { key: "report", label: "每日复盘" },
  { key: "backtest", label: "事件回测" },
  { key: "review", label: "信号审查" },
  { key: "optimizer", label: "策略调优" },
  { key: "health", label: "数据健康" },
];

function App() {
  const [workspace, setWorkspace] = useState<Workspace>("signals");
  const [view, setView] = useState<View>("form");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [report, setReport] = useState<Record<string, string> | null>(null);
  const [ticker, setTicker] = useState("");
  const [tradeDate, setTradeDate] = useState("");

  const handleAnalysisStart = useCallback((id: string, t: string, d: string) => {
    setTaskId(id);
    setTicker(t);
    setTradeDate(d);
    setWorkspace("analysis");
    setView("running");
  }, []);

  const handleAnalysisComplete = useCallback((rep: Record<string, string>) => {
    setReport(rep);
    setView("report");
  }, []);

  const handleReset = useCallback(() => {
    setWorkspace("analysis");
    setView("form");
    setTaskId(null);
    setReport(null);
  }, []);

  const renderAnalysis = () => (
    <>
      {view === "form" && <AnalysisForm onStart={handleAnalysisStart} />}
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
    </>
  );

  const renderWorkspace = () => {
    if (workspace === "analysis") return renderAnalysis();
    if (workspace === "watchlist") return <WatchlistPage />;
    if (workspace === "signals") return <TodaySignalsPage />;
    if (workspace === "report") return <DailyReportPage />;
    if (workspace === "backtest") return <BacktestPage />;
    if (workspace === "review") return <AgentReviewPage />;
    if (workspace === "optimizer") return <StrategyOptimizerPage />;
    return <DataHealthPage />;
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-title">A/H 股投研工作台</span>
          <span className="brand-subtitle">规则信号 · 复盘 · 回测 · 审查</span>
        </div>
        <div className="header-actions">
          {workspace === "analysis" && view !== "form" && (
            <button onClick={handleReset}>新建分析</button>
          )}
        </div>
      </header>

      <main className="workspace-layout">
        <nav className="side-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={workspace === item.key ? "active" : ""}
              onClick={() => setWorkspace(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="workspace-content">{renderWorkspace()}</div>
      </main>
    </div>
  );
}

export default App;
