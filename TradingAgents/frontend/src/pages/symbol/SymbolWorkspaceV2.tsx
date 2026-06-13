// Symbol Workspace V2 主页 — 三栏布局 + 4 tab
//
// 与 V1 SymbolWorkspacePage 的关键区别：
//   - 全部状态走 useAsync，自带 race protection（解决 V1 切换标的的脏数据 bug）
//   - mapper 层把后端字段集中映射，组件不再直接拼数据
//   - 4 tab + 跨 tab Context Rail
//   - 笔记自动持久化 localStorage（按 symbol+date）
//
// V1 -> V2 切换：URL `?ws=v2` 或 props.useV2={true}
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSymbolCritical, useSymbolPulse, rememberRecent } from "../../api/symbol-workspace/hooks";
import { invalidatePrefetch, prefetchTabData } from "../../api/symbol-workspace/prefetch";
import { useUrlState } from "./_shared/useUrlState";
import { useKeyboardShortcuts } from "./_shared/useKeyboardShortcuts";
import { ShortcutHelpPanel } from "./_shared/ShortcutHelpPanel";
import type {
  StrategyMode,
  SymbolCriticalPayload,
  TabKey,
} from "../../types/symbol-workspace";
import { AsyncBoundary } from "./_shared/AsyncBoundary";
import { Skeleton } from "./_shared/atoms";
import { ContextRail } from "./chrome/ContextRail";
import { Header } from "./chrome/Header";
import { NavRail } from "./chrome/NavRail";
import { PricePositionBar } from "./chrome/PricePositionBar";
import { ProfileStrip } from "./chrome/ProfileStrip";
import { StatusBanner } from "./chrome/StatusBanner";
import { TabBar } from "./chrome/TabBar";
import { ChartTab } from "./chart/ChartTab";
import { FundamentalsTab } from "./fundamentals/FundamentalsTab";
import { PlaybookTab } from "./playbook/PlaybookTab";
import { PulseTab } from "./pulse/PulseTab";

import "./tokens.css";
import "./workspace.css";

interface Props {
  initialSymbol?: string;
  initialEnd?: string;
  onContextChange?: (symbol: string, date: string) => void;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function SymbolWorkspaceV2({
  initialSymbol = "600519.SH",
  initialEnd,
  onContextChange,
}: Props) {
  // URL 状态同步：symbol/date/tab/mode 都走 URL（刷新/书签/分享均不丢上下文）
  const [urlState, setUrlState] = useUrlState({
    symbol: initialSymbol,
    date: initialEnd || todayStr(),
    tab: "pulse",
    mode: "conservative",
  });
  const { symbol, date, tab: activeTab, mode } = urlState;
  const setSymbol = useCallback((s: string) => setUrlState({ symbol: s }), [setUrlState]);
  const setDate = useCallback((d: string) => setUrlState({ date: d }), [setUrlState]);
  const setActiveTab = useCallback(
    (t: TabKey) => setUrlState({ tab: t }),
    [setUrlState]
  );
  const setMode = useCallback(
    (m: StrategyMode) => setUrlState({ mode: m }),
    [setUrlState]
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [watchMessage, setWatchMessage] = useState("");

  // 同步 props → URL
  useEffect(() => {
    if (initialSymbol && initialSymbol !== symbol) setSymbol(initialSymbol);
    if (initialEnd && initialEnd !== date) setDate(initialEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSymbol, initialEnd]);

  const critical = useSymbolCritical(symbol, date);
  const railPulse = useSymbolPulse(symbol, date, mode);
  const railPulseData =
    railPulse.state.status === "ok" || railPulse.state.status === "partial"
      ? railPulse.state.data
      : null;
  const railRiskFlags = [
    ...(railPulseData?.risk_flags || []),
    ...((railPulseData?.narrative.falsify || [])
      .filter((item) => item.occurred)
      .map((item) => ({
        text: item.occurred_for_days
          ? `${item.text} · 已持续 ${item.occurred_for_days} 天`
          : item.text,
        tone: "warning" as const,
      }))),
  ].slice(0, 6);

  // 通知父级 + 落 recent
  useEffect(() => {
    if (critical.state.status === "ok" || critical.state.status === "partial") {
      const data = critical.state.data as { header: { symbol: string } };
      onContextChange?.(data.header.symbol, date);
      rememberRecent(data.header.symbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [critical.state.status, date]);

  // CTA 动态：根据数据状态 + 当前 tab 决定主行动按钮
  // 文案规范：动词具体 / 宾语具体 / 与场景关联
  const cta = useMemo(() => {
    if (critical.state.status === "ok" || critical.state.status === "partial") {
      const data = critical.state.data as { status: { kind: string } };
      if (data.status.kind === "blocked") {
        return { label: "同步行情数据 →", onClick: () => critical.reload() };
      }
      // tab 之间引导用户走向"决策 → 验证 → 执行"的研究闭环
      const labelByTab: Record<TabKey, { label: string; nextTab: TabKey }> = {
        pulse:        { label: "在 K 线上验证 →",      nextTab: "chart" },
        chart:        { label: "查看决策与复盘 →",     nextTab: "playbook" },
        fundamentals: { label: "查看决策与复盘 →",     nextTab: "playbook" },
        playbook:     { label: "回到现状速览 →",       nextTab: "pulse" },
      };
      const next = labelByTab[activeTab];
      return {
        label: next.label,
        onClick: () => setActiveTab(next.nextTab),
      };
    }
    return { label: "重新加载", onClick: () => critical.reload() };
  }, [critical, activeTab]);

  // 切换标的 — 清掉旧 cache，避免内存泄漏
  const openSymbol = (next: string) => {
    if (!next || next === symbol) return;
    invalidatePrefetch();
    setSymbol(next);
    setActiveTab("pulse");
  };

  // TabBar hover 预取
  const onTabPrefetch = useCallback(
    (_tab: TabKey) => prefetchTabData(symbol, date),
    [symbol, date]
  );

  // 键盘快捷键
  useKeyboardShortcuts(
    {
      openSearch: () => {
        const input = document.querySelector<HTMLInputElement>(".sw-header__search input[name='symbol']");
        input?.focus();
        input?.select();
      },
      switchTab: setActiveTab,
      toggleMode: () => setMode(mode === "conservative" ? "aggressive" : "conservative"),
      refresh: () => critical.reload(),
      toggleHelp: () => setHelpOpen((v) => !v),
      focusNotes: () => {
        const ta = document.querySelector<HTMLTextAreaElement>(".sw-context-rail .sw-note-input");
        ta?.focus();
      },
    },
    mode
  );

  return (
    <section className="symbol-workspace-v2" data-theme="dark">
      <a className="sw-skip-link" href={`#sw-panel-${activeTab}`}>
        跳到主内容
      </a>
      <ShortcutHelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      <div className="sw-app">
        <AsyncBoundary<SymbolCriticalPayload>
          state={critical.state}
          skeleton={
            <>
              <Skeleton height={56} />
              <Skeleton height={64} />
            </>
          }
          emptyTitle="标的数据为空"
          emptyHint="确认代码格式（如 600519.SH）"
        >
          {(data) => (
            <>
              <Header
                header={data.header}
                date={date}
                onSearch={openSymbol}
                onDateChange={setDate}
                watchMessage={watchMessage}
                onAddWatch={async () => {
                  setWatchMessage("正在加入自选");
                  try {
                    const response = await fetch("/api/research/watchlist", { // copy-lint:ignore API 调用，非用户文案
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        symbols: [data.header.symbol],
                        name: data.header.name,
                      }),
                    });
                    const payload = (await response.json()) as { success?: boolean; error?: string | null };
                    if (payload.success) {
                      setWatchMessage("已加入自选");
                      critical.reload();
                    } else {
                      setWatchMessage(payload.error || "加入失败");
                    }
                  } catch {
                    setWatchMessage("自选服务未连接");
                  }
                }}
                onRefresh={() => critical.reload()}
              />
              <ProfileStrip profile={data.profile} />
              <PricePositionBar
                header={data.header}
                bars={(data as unknown as { bars: import("../../types/market").MarketHistoryBar[] }).bars ?? []}
              />
              <StatusBanner
                status={data.status}
                onRetry={() => critical.reload()}
              />
              <div className="sw-body">
                <NavRail
                  navigation={data.navigation}
                  currentSymbol={symbol}
                  onOpenSymbol={openSymbol}
                />
                <main className="sw-workspace">
                  <TabBar value={activeTab} onChange={setActiveTab} onPrefetch={onTabPrefetch} />
                  <div
                    className="sw-tab-panel"
                    id={`sw-panel-${activeTab}`}
                    role="tabpanel"
                    aria-labelledby={`sw-tab-${activeTab}`}
                  >
                    {activeTab === "pulse" && (
                      <PulseTab
                        symbol={symbol}
                        date={date}
                        mode={mode}
                        onModeChange={setMode}
                      />
                    )}
                    {activeTab === "chart" && (
                      <ChartTab
                        symbol={symbol}
                        date={date}
                        mode={mode}
                        onModeChange={setMode}
                      />
                    )}
                    {activeTab === "fundamentals" && (
                      <FundamentalsTab symbol={symbol} date={date} />
                    )}
                    {activeTab === "playbook" && (
                      <PlaybookTab symbol={symbol} date={date} />
                    )}
                  </div>
                </main>
                <ContextRail
                  header={data.header}
                  narrative={railPulseData?.narrative || { bull: [], falsify: [] }}
                  riskFlags={railRiskFlags}
                  cta={cta}
                  symbol={symbol}
                  date={date}
                />
              </div>
            </>
          )}
        </AsyncBoundary>
      </div>
    </section>
  );
}
