// V2 Header — sticky dark workbench header
// 数据来自 SymbolHeader (mapper §5.1)
import type { FormEvent } from "react";
import { Dot, Mono } from "../_shared/atoms";
import type { SymbolHeader } from "../../../types/symbol-workspace";
import { classOfChange, fmtPct, fmtPrice } from "../formatters";
import { switchWorkspaceVersion } from "../featureFlag";

interface Props {
  header: SymbolHeader;
  date: string;
  onSearch: (next: string) => void;
  onDateChange: (next: string) => void;
  onAddWatch: () => void;
  onRefresh: () => void;
  watchMessage?: string;
}

export function Header({
  header,
  date,
  onSearch,
  onDateChange,
  onAddWatch,
  onRefresh,
  watchMessage,
}: Props) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.elements.namedItem("symbol") as HTMLInputElement | null;
    const next = input?.value.trim().toUpperCase();
    if (next) onSearch(next);
  };
  const changeClass = classOfChange(header.change_pct);
  const arrow = header.change_pct == null ? "" : header.change_pct > 0 ? "↑" : header.change_pct < 0 ? "↓" : "→";
  return (
    <header className="sw-header" role="banner">
      <form className="sw-header__search" onSubmit={handleSubmit}>
        <span className="sw-faint sw-mono" aria-hidden>
          ⌕
        </span>
        <input
          name="symbol"
          defaultValue={header.symbol}
          placeholder="搜索代码、简称…"
          aria-label="搜索股票代码"
          autoComplete="off"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label="分析日期"
          className="sw-mono"
          style={{ fontSize: 12, width: 130, color: "var(--sw-text-secondary)" }}
        />
      </form>

      <div className="sw-header__brand">
        <h1>{header.name}</h1>
        <span className="sw-code">{header.symbol}</span>
        <Mono className={`sw-price ${changeClass}`}>{fmtPrice(header.price)}</Mono>
        <Mono className={`sw-chg ${changeClass}`}>
          {arrow}{" "}
          {header.change != null ? (header.change > 0 ? "+" : "") + header.change.toFixed(2) : "-"}
          {" / "}
          {fmtPct(header.change_pct, 2)}
        </Mono>
        <span className="sw-freshness">
          <Dot tone={header.freshness === "live" ? "success" : header.freshness === "delayed" ? "warning" : "neutral"} />
          {header.freshness_label}
        </span>
      </div>

      <div className="sw-header__actions">
        <button type="button" className="sw-btn" onClick={onAddWatch}>
          ＋ 加入自选
        </button>
        {watchMessage && <span className="sw-header__message">{watchMessage}</span>}
        <button type="button" className="sw-btn sw-btn--icon" onClick={onRefresh} aria-label="刷新">
          ↻
        </button>
        <button
          type="button"
          className="sw-btn sw-btn--mini"
          onClick={() => switchWorkspaceVersion("v1")}
          title="切回 V1 工作台（灰度可逆）"
          aria-label="切回 V1 工作台"
        >
          ⤺ V1
        </button>
      </div>
    </header>
  );
}
