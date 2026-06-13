// URL 状态同步 — Phase 4 UX-P0-2
// 把 tab/mode/symbol/date 同步到 URL query，刷新不丢上下文，可被书签和分享
import { useCallback, useEffect, useState } from "react";
import type { StrategyMode, TabKey } from "../../../types/symbol-workspace";

export interface UrlState {
  symbol: string;
  date: string;
  tab: TabKey;
  mode: StrategyMode;
}

const VALID_TABS: TabKey[] = ["pulse", "chart", "fundamentals", "playbook"];
const VALID_MODES: StrategyMode[] = ["conservative", "aggressive"];

function readFromUrl(defaults: UrlState): UrlState {
  if (typeof window === "undefined") return defaults;
  try {
    const params = new URLSearchParams(window.location.search);
    const symbol = params.get("symbol")?.trim().toUpperCase() || defaults.symbol;
    const date = params.get("date") || defaults.date;
    const tabRaw = params.get("tab") as TabKey | null;
    const tab = tabRaw && VALID_TABS.includes(tabRaw) ? tabRaw : defaults.tab;
    const modeRaw = params.get("mode") as StrategyMode | null;
    const mode = modeRaw && VALID_MODES.includes(modeRaw) ? modeRaw : defaults.mode;
    return { symbol, date, tab, mode };
  } catch {
    return defaults;
  }
}

function writeToUrl(state: UrlState) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    // 保留 ws 偏好等其它参数
    url.searchParams.set("symbol", state.symbol);
    url.searchParams.set("date", state.date);
    url.searchParams.set("tab", state.tab);
    url.searchParams.set("mode", state.mode);
    // replaceState 避免污染浏览器历史栈
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* ignore */
  }
}

/**
 * 使用方式：
 *   const [state, setState] = useUrlState({ symbol: "600519.SH", date: today, tab: "pulse", mode: "conservative" });
 *   setState({ tab: "chart" });  // 仅更新一个字段
 */
export function useUrlState(
  defaults: UrlState
): [UrlState, (partial: Partial<UrlState>) => void] {
  const [state, setState] = useState<UrlState>(() => readFromUrl(defaults));

  // 任何 state 变化 → 写回 URL
  useEffect(() => {
    writeToUrl(state);
  }, [state]);

  // popstate 时（浏览器后退/前进）重读 URL
  useEffect(() => {
    const handler = () => setState((prev) => readFromUrl(prev));
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const update = useCallback((partial: Partial<UrlState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  return [state, update];
}
