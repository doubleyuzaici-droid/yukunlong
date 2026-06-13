// 全局键盘快捷键 — Phase 4 UX-P1-4
// 仅在 SymbolWorkspaceV2 内启用，避免污染其它页面
import { useEffect } from "react";
import type { TabKey, StrategyMode } from "../../../types/symbol-workspace";

export interface ShortcutHandlers {
  openSearch: () => void;
  switchTab: (tab: TabKey) => void;
  toggleMode: () => void;
  refresh: () => void;
  toggleHelp: () => void;
  focusNotes: () => void;
}

const TAB_KEYS: Record<string, TabKey> = {
  "1": "pulse",
  "2": "chart",
  "3": "fundamentals",
  "4": "playbook",
};

/** 是否在文本输入框内（不拦截这些场景） */
function isTextInput(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, currentMode: StrategyMode) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — 搜索（即使在输入框内也允许）
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handlers.openSearch();
        return;
      }
      // 输入框内不拦截其它键
      if (isTextInput(e.target)) return;
      // 单字符快捷键，且无 modifier
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (TAB_KEYS[e.key]) {
        e.preventDefault();
        handlers.switchTab(TAB_KEYS[e.key]);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "r") {
        e.preventDefault();
        handlers.refresh();
      } else if (k === "m") {
        e.preventDefault();
        handlers.toggleMode();
      } else if (k === "n") {
        e.preventDefault();
        handlers.focusNotes();
      } else if (k === "?") {
        e.preventDefault();
        handlers.toggleHelp();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // 仅在 handlers 函数引用变化时重新绑定。currentMode 用于 closure。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    handlers.openSearch,
    handlers.switchTab,
    handlers.toggleMode,
    handlers.refresh,
    handlers.toggleHelp,
    handlers.focusNotes,
    currentMode,
  ]);
}

/** 帮助面板上要展示的快捷键清单 */
export const SHORTCUT_HELP: { keys: string; description: string }[] = [
  { keys: "⌘ K / Ctrl K", description: "聚焦搜索框" },
  { keys: "1 / 2 / 3 / 4", description: "切换到 现状速览 / 图表与信号 / 基本面 / 决策复盘" },
  { keys: "←  / →", description: "在 Tab 之间左右移动（焦点在 tab 时）" },
  { keys: "M", description: "切换保守 / 激进模式" },
  { keys: "R", description: "刷新当前数据" },
  { keys: "N", description: "聚焦笔记输入框" },
  { keys: "⌘ S / Ctrl S", description: "在笔记框内：手动保存" },
  { keys: "?", description: "显示 / 关闭本帮助面板" },
];
