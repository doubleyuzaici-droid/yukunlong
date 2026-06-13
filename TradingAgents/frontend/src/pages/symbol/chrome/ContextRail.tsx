// V2 Right Context Rail — 跨 tab 常驻的摘要
import { useEffect, useRef, useState } from "react";
import { Dot, Mono, Pill } from "../_shared/atoms";
import type {
  SymbolHeader,
  SymbolNarrative,
  Tone,
} from "../../../types/symbol-workspace";
import { classOfChange, fmtPct, fmtPrice } from "../formatters";

interface RailNote {
  id: string;
  timestamp: string;
  body: string;
  pinned: boolean;
  tags: string[];
}

interface Props {
  header: SymbolHeader;
  narrative: SymbolNarrative;
  riskFlags: { text: string; tone: Tone }[];
  cta: { label: string; onClick: () => void };
  symbol: string;
  date: string;
}

const noteKey = (symbol: string, date: string) =>
  `tradingagents.symbol-workspace-v2.notes.${symbol}.${date}`;

function extractTags(body: string): string[] {
  const matches = body.match(/#([一-龥A-Za-z0-9_]+)/g);
  return matches ? Array.from(new Set(matches.map((m) => m.slice(1)))) : [];
}

export function ContextRail({
  header,
  narrative,
  riskFlags,
  cta,
  symbol,
  date,
}: Props) {
  const [draft, setDraft] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(noteKey(symbol, date));
      if (raw) {
        const list = JSON.parse(raw) as RailNote[];
        setDraft(list[0]?.body ?? "");
        setSavedAt(list[0]?.timestamp ?? null);
      } else {
        setDraft("");
        setSavedAt(null);
      }
    } catch {
      setDraft("");
      setSavedAt(null);
    }
  }, [symbol, date]);

  const persist = (next: string) => {
    try {
      const entry: RailNote = {
        id: `${symbol}-${date}`,
        timestamp: new Date().toISOString(),
        body: next,
        pinned: false,
        tags: extractTags(next),
      };
      const list: RailNote[] = next ? [entry] : [];
      window.localStorage.setItem(noteKey(symbol, date), JSON.stringify(list));
      setSavedAt(entry.timestamp);
    } catch {
      /* ignore */
    }
  };

  const onInput = (val: string) => {
    setDraft(val);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => persist(val), 800);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      persist(draft);
    }
  };

  const changeClass = classOfChange(header.change_pct);
  const arrow = header.change_pct == null ? "" : header.change_pct > 0 ? "↑" : header.change_pct < 0 ? "↓" : "→";

  return (
    <aside className="sw-context-rail" aria-label="标的上下文">
      <div className="sw-rail-price">
        <span className="sw-eyebrow">最新价</span>
        <Mono className={`sw-big ${changeClass}`}>{fmtPrice(header.price)}</Mono>
        <Mono className={`sw-chg ${changeClass}`}>
          {arrow}{" "}
          {header.change != null ? (header.change > 0 ? "+" : "") + header.change.toFixed(2) : "-"}
          {" / "}
          {fmtPct(header.change_pct, 2)}
        </Mono>
        <span className="sw-meta">
          <Dot tone={header.freshness === "live" ? "success" : "warning"} />
          {header.freshness_label}
        </span>
      </div>

      <button
        type="button"
        className="sw-btn sw-btn--primary sw-rail-cta"
        onClick={cta.onClick}
      >
        {cta.label}
      </button>

      <div className="sw-rail-card">
        <div className="sw-rail-card__head">
          <h4>多头叙事</h4>
          <Pill tone="success">{narrative.bull.length} 条</Pill>
        </div>
        <ul className="sw-rail-card__body">
          {narrative.bull.length === 0 && (
            <li className="sw-faint">暂无多头驱动</li>
          )}
          {narrative.bull.slice(0, 4).map((b) => (
            <li key={b}>
              <span className="sw-tone-success" aria-hidden>
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="sw-rail-card">
        <div className="sw-rail-card__head">
          <h4>风险旗标</h4>
          <Pill tone={riskFlags.length > 0 ? "warning" : "neutral"}>
            {riskFlags.length} 项
          </Pill>
        </div>
        <ul className="sw-rail-card__body">
          {riskFlags.length === 0 && (
            <li className="sw-faint">暂无显式风险</li>
          )}
          {riskFlags.map((f) => (
            <li key={f.text}>
              <Dot tone={f.tone} pulse={f.tone === "danger"} />
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="sw-rail-card sw-note-form">
        <div className="sw-rail-card__head">
          <h4>分析师笔记</h4>
          <span className="sw-faint" style={{ fontSize: 11 }}>
            {savedAt
              ? `已保存 ${new Date(savedAt).toLocaleTimeString("zh-CN")}`
              : "未保存（输入后自动保存）"}
          </span>
        </div>
        <textarea
          className="sw-note-input"
          value={draft}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="记录今天的思考... 输入 # 加标签"
          aria-label="分析师笔记"
        />
        <div className="sw-note-actions">
          <span>⌘ S / Ctrl S 手动保存</span>
          <button
            type="button"
            className="sw-btn sw-btn--mini"
            onClick={() => persist(draft)}
          >
            保存笔记
          </button>
        </div>
      </div>
    </aside>
  );
}
