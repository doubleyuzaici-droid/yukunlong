// V2 Tab Bar — 4 tab 切换
// Phase 4 PR-18：hover 触发预取
import { useRef } from "react";
import type { TabKey } from "../../../types/symbol-workspace";

const TABS: { key: TabKey; label: string; note: string }[] = [
  { key: "pulse", label: "现状速览", note: "30 秒看懂" },
  { key: "chart", label: "图表与信号", note: "K 线 · 催化剂" },
  { key: "fundamentals", label: "基本面 & 催化剂", note: "估值 · 财务 · 公告" },
  { key: "playbook", label: "决策与复盘", note: "审查 · 后验 · 笔记" },
];

interface Props {
  value: TabKey;
  onChange: (next: TabKey) => void;
  onPrefetch?: (tab: TabKey) => void;
}

export function TabBar({ value, onChange, onPrefetch }: Props) {
  // 防抖：hover 80ms 才触发预取
  const timerRef = useRef<number | null>(null);

  const handleHover = (tab: TabKey) => {
    if (!onPrefetch || tab === value) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => onPrefetch(tab), 80);
  };
  const handleLeave = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  // 键盘左右切换
  const handleKey = (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const nextIdx = (currentIdx + dir + TABS.length) % TABS.length;
      onChange(TABS[nextIdx].key);
      (e.currentTarget.parentElement?.children[nextIdx] as HTMLButtonElement | undefined)?.focus();
    }
  };

  return (
    <nav className="sw-tab-bar" role="tablist" aria-label="工作台分页">
      {TABS.map((tab, idx) => (
        <button
          key={tab.key}
          type="button"
          className={`sw-tab${value === tab.key ? " is-active" : ""}`}
          role="tab"
          aria-selected={value === tab.key}
          aria-controls={`sw-panel-${tab.key}`}
          id={`sw-tab-${tab.key}`}
          tabIndex={value === tab.key ? 0 : -1}
          onClick={() => onChange(tab.key)}
          onMouseEnter={() => handleHover(tab.key)}
          onFocus={() => handleHover(tab.key)}
          onMouseLeave={handleLeave}
          onBlur={handleLeave}
          onKeyDown={(e) => handleKey(e, idx)}
        >
          <strong>{tab.label}</strong>
          <small>{tab.note}</small>
        </button>
      ))}
    </nav>
  );
}
