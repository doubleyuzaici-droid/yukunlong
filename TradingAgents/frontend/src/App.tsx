import { useState, useCallback, useEffect } from "react";
import AnalysisForm from "./components/AnalysisForm";
import { MarketTickerStrip } from "./components/MarketWidgets";
import ProgressPanel from "./components/ProgressPanel";
import ReportViewer from "./components/ReportViewer";
import AgentReviewPage from "./pages/AgentReviewPage";
import BacktestPage from "./pages/BacktestPage";
import CheckpointPage from "./pages/CheckpointPage";
import DailyReportPage from "./pages/DailyReportPage";
import DataHealthPage from "./pages/DataHealthPage";
import FactorResearchPage from "./pages/FactorResearchPage";
import FundamentalsPage from "./pages/FundamentalsPage";
import HistoryReportsPage from "./pages/HistoryReportsPage";
import MarketPulsePage from "./pages/MarketPulsePage";
import MarketMatrixPage from "./pages/MarketMatrixPage";
import MemoryPage from "./pages/MemoryPage";
import ModelConfigPage from "./pages/ModelConfigPage";
import NewsEvidencePage from "./pages/NewsEvidencePage";
import PipelineConsolePage from "./pages/PipelineConsolePage";
import PortfolioRiskPage from "./pages/PortfolioRiskPage";
import ResearchBriefPage from "./pages/ResearchBriefPage";
import RiskMonitorPage from "./pages/RiskMonitorPage";
import SignalTimelinePage from "./pages/SignalTimelinePage";
import SignalWorkbenchPage from "./pages/SignalWorkbenchPage";
import StrategyOptimizerPage from "./pages/StrategyOptimizerPage";
import SymbolWorkspacePage from "./pages/SymbolWorkspacePage";
import SymbolWorkspaceV2 from "./pages/symbol/SymbolWorkspaceV2";
import {
  buildWorkspaceVersionUrl,
  resolveWorkspaceVersion,
  setPreference,
  type WorkspaceVersion,
} from "./pages/symbol/featureFlag";
import TaskCenterPage from "./pages/TaskCenterPage";
import WatchlistPage from "./pages/WatchlistPage";

type View = "form" | "running" | "report";
type PriceColorMode = "global" | "cn";
type Workspace =
  | "brief"
  | "analysis"
  | "tasks"
  | "market"
  | "marketMatrix"
  | "symbolWorkspace"
  | "fundamentals"
  | "newsEvidence"
  | "factorResearch"
  | "watchlist"
  | "pipeline"
  | "riskMonitor"
  | "history"
  | "memory"
  | "checkpoint"
  | "signalWorkbench"
  | "signalHistory"
  | "report"
  | "backtest"
  | "portfolioRisk"
  | "review"
  | "optimizer"
  | "health"
  | "modelConfig";

const NAV_GROUPS: { title: string; items: { key: Workspace; label: string }[] }[] = [
  {
    title: "行情与信号",
    items: [
      { key: "brief", label: "投研首页" },
      { key: "market", label: "行情看板" },
      { key: "marketMatrix", label: "市场矩阵" },
      { key: "symbolWorkspace", label: "个股工作台" },
      { key: "fundamentals", label: "财报估值" },
      { key: "newsEvidence", label: "新闻证据" },
      { key: "factorResearch", label: "因子研究" },
      { key: "watchlist", label: "自选股" },
      { key: "signalWorkbench", label: "信号工作台" },
      { key: "signalHistory", label: "历史信号" },
    ],
  },
  {
    title: "分析与报告",
    items: [
      { key: "analysis", label: "单股分析" },
      { key: "history", label: "历史报告" },
      { key: "report", label: "每日复盘" },
      { key: "memory", label: "记忆反思" },
    ],
  },
  {
    title: "回测与优化",
    items: [
      { key: "backtest", label: "事件回测" },
      { key: "portfolioRisk", label: "组合风险" },
      { key: "review", label: "信号审查" },
      { key: "optimizer", label: "策略调优" },
    ],
  },
  {
    title: "系统与数据",
    items: [
      { key: "tasks", label: "任务中心" },
      { key: "riskMonitor", label: "告警中心" },
      { key: "pipeline", label: "流水线" },
      { key: "health", label: "数据健康" },
      { key: "modelConfig", label: "模型配置" },
      { key: "checkpoint", label: "断点恢复" },
    ],
  },
];

const WORKSPACES = new Set<Workspace>(
  NAV_GROUPS.flatMap((group) => group.items.map((item) => item.key)),
);

const today = new Date().toISOString().slice(0, 10);

function initialWorkspace(): Workspace {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") as Workspace | null;
  return view && WORKSPACES.has(view) ? view : "brief";
}

function initialPreference(key: string, fallback: string) {
  return window.localStorage.getItem(key) || fallback;
}

function App() {
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [view, setView] = useState<View>("form");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [report, setReport] = useState<Record<string, string> | null>(null);
  const [ticker, setTicker] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [marketSymbol, setMarketSymbol] = useState(
    new URLSearchParams(window.location.search).get("symbol") ||
      initialPreference("tradingagents.symbol", "600519.SH"),
  );
  const [marketDate, setMarketDate] = useState(
    new URLSearchParams(window.location.search).get("date") ||
      initialPreference("tradingagents.date", today),
  );
  const [priceColorMode, setPriceColorMode] = useState<PriceColorMode>(
    initialPreference("tradingagents.priceColorMode", "cn") as PriceColorMode,
  );
  const [workspaceVersion, setWorkspaceVersion] = useState<WorkspaceVersion>(() =>
    resolveWorkspaceVersion(marketSymbol),
  );

  const openSymbol = useCallback((symbol: string, date?: string) => {
    setMarketSymbol(symbol);
    if (date) setMarketDate(date);
    setWorkspace("symbolWorkspace");
  }, []);

  const switchWorkspaceVersion = useCallback((next: WorkspaceVersion) => {
    setPreference(next);
    const nextUrl = buildWorkspaceVersionUrl(window.location.href, next);
    window.history.replaceState(window.history.state, "", nextUrl);
    setWorkspaceVersion(next);
    setWorkspace("symbolWorkspace");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("tradingagents.symbol", marketSymbol);
    window.localStorage.setItem("tradingagents.date", marketDate);
    window.localStorage.setItem("tradingagents.priceColorMode", priceColorMode);

    const params = new URLSearchParams(window.location.search);
    params.set("view", workspace);
    params.set("symbol", marketSymbol);
    params.set("date", marketDate);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [workspace, marketSymbol, marketDate, priceColorMode]);

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
    if (workspace === "brief") {
      return (
        <ResearchBriefPage
          initialSymbol={marketSymbol}
          initialDate={marketDate}
          onNavigate={(targetView) => {
            if (WORKSPACES.has(targetView as Workspace)) setWorkspace(targetView as Workspace);
          }}
          onOpenSymbol={openSymbol}
        />
      );
    }
    if (workspace === "analysis") return renderAnalysis();
    if (workspace === "tasks") return <TaskCenterPage />;
    if (workspace === "market") {
      return (
        <MarketPulsePage
            onOpenSymbol={(symbol) => {
            openSymbol(symbol);
          }}
        />
      );
    }
    if (workspace === "marketMatrix") return <MarketMatrixPage onOpenSymbol={openSymbol} />;
    if (workspace === "symbolWorkspace") {
      const Page = workspaceVersion === "v2" ? SymbolWorkspaceV2 : SymbolWorkspacePage;
      return (
        <Page
          initialSymbol={marketSymbol}
          initialEnd={marketDate}
          onContextChange={(symbol, date) => {
            setMarketSymbol(symbol);
            setMarketDate(date);
          }}
        />
      );
    }
    if (workspace === "fundamentals") return <FundamentalsPage initialSymbol={marketSymbol} initialEnd={marketDate} />;
    if (workspace === "newsEvidence") return <NewsEvidencePage initialSymbol={marketSymbol} initialEnd={marketDate} />;
    if (workspace === "factorResearch") return <FactorResearchPage initialSymbol={marketSymbol} initialEnd={marketDate} />;
    if (workspace === "history") return <HistoryReportsPage />;
    if (workspace === "memory") return <MemoryPage />;
    if (workspace === "checkpoint") return <CheckpointPage />;
    if (workspace === "watchlist") {
      return (
        <WatchlistPage
          onOpenSymbol={(symbol) => {
            openSymbol(symbol);
          }}
        />
      );
    }
    if (workspace === "pipeline") return <PipelineConsolePage />;
    if (workspace === "riskMonitor") return <RiskMonitorPage onOpenSymbol={openSymbol} />;
    if (workspace === "signalWorkbench") {
      return (
        <SignalWorkbenchPage
          initialSymbol={marketSymbol}
          initialEnd={marketDate}
          onOpenSymbol={openSymbol}
        />
      );
    }
    if (workspace === "signalHistory") return <SignalTimelinePage initialSymbol={marketSymbol} initialEnd={marketDate} onOpenSymbol={openSymbol} />;
    if (workspace === "report") return <DailyReportPage />;
    if (workspace === "backtest") return <BacktestPage initialSymbol={marketSymbol} initialEnd={marketDate} onOpenSymbol={openSymbol} />;
    if (workspace === "portfolioRisk") return <PortfolioRiskPage />;
    if (workspace === "review") return <AgentReviewPage onOpenSymbol={openSymbol} />;
    if (workspace === "optimizer") return <StrategyOptimizerPage />;
    if (workspace === "modelConfig") return <ModelConfigPage />;
    return <DataHealthPage />;
  };

  return (
    <div className={`app-shell ${priceColorMode === "cn" ? "price-mode-cn" : ""}`}>
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-title">A/H 股投研工作台</span>
          <span className="brand-subtitle">规则信号 · 复盘 · 回测 · 审查</span>
        </div>
        <MarketTickerStrip
          onSelect={(symbol) => {
            openSymbol(symbol);
          }}
        />
        <div className="header-actions">
          <span className="context-chip">{marketSymbol} · {marketDate}</span>
          <button
            className="mini mode-toggle"
            onClick={() => setPriceColorMode((mode) => (mode === "cn" ? "global" : "cn"))}
            title="切换涨跌颜色习惯"
          >
            {priceColorMode === "cn" ? "红涨绿跌" : "绿涨红跌"}
          </button>
          {workspace === "symbolWorkspace" && (
            <div className="workspace-version-toggle" role="group" aria-label="切换个股工作台版本">
              <button
                type="button"
                className={workspaceVersion === "v1" ? "active" : ""}
                onClick={() => switchWorkspaceVersion("v1")}
                aria-pressed={workspaceVersion === "v1"}
                title="切换到旧版个股工作台"
              >
                旧版
              </button>
              <button
                type="button"
                className={workspaceVersion === "v2" ? "active" : ""}
                onClick={() => switchWorkspaceVersion("v2")}
                aria-pressed={workspaceVersion === "v2"}
                title="切换到新版个股工作台"
              >
                新版
              </button>
            </div>
          )}
          {workspace === "analysis" && view !== "form" && (
            <button onClick={handleReset}>新建分析</button>
          )}
        </div>
      </header>

      <main className="workspace-layout">
        <nav className="side-nav">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.title}>
              <span>{group.title}</span>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  className={workspace === item.key ? "active" : ""}
                  onClick={() => setWorkspace(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="workspace-content">{renderWorkspace()}</div>
      </main>
    </div>
  );
}

export default App;
