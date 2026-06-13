import { useEffect, useMemo, useState } from "react";
import { Sparkline } from "../components/MarketWidgets";
import type { MarketQuote } from "../types/market";
import {
  formatCompactNumber,
  formatMoney,
  formatNumber,
  formatSignedNumber,
  formatSignedPercent,
  freshnessTone,
  quoteTone,
} from "../utils/formatters";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
}

interface QuotePayload {
  requested_count: number;
  loaded_count: number;
  missing_count: number;
  quotes: MarketQuote[];
}

interface MatrixPanelConfig {
  id: string;
  title: string;
  symbols: string[];
  accent: "blue" | "teal" | "amber" | "red";
}

type MatrixColumn = "last" | "change" | "range" | "volume" | "amount" | "spark" | "status";

const PANEL_STORAGE_KEY = "tradingagents.marketMatrix.panels";
const COLUMN_STORAGE_KEY = "tradingagents.marketMatrix.columns";

const DEFAULT_COLUMNS: MatrixColumn[] = ["last", "change", "range", "volume", "amount", "spark", "status"];

const COLUMN_LABELS: Record<MatrixColumn, string> = {
  last: "最新",
  change: "涨跌",
  range: "高低",
  volume: "成交量",
  amount: "成交额",
  spark: "走势",
  status: "状态",
};

const DEFAULT_PANELS: MatrixPanelConfig[] = [
  {
    id: "cn-index",
    title: "A股核心指数",
    symbols: ["000016.SH", "000300.SH", "000905.SH", "000852.SH"],
    accent: "blue",
  },
  {
    id: "hk-core",
    title: "港股核心观察",
    symbols: ["HSI", "00700.HK", "01024.HK", "03690.HK", "09988.HK"],
    accent: "teal",
  },
  {
    id: "watch-pool",
    title: "研究池样例",
    symbols: ["600519.SH", "00700.HK", "01024.HK", "AAPL", "MSFT"],
    accent: "amber",
  },
  {
    id: "turnover",
    title: "成交额雷达",
    symbols: ["600519.SH", "000001.SZ", "000858.SZ", "00700.HK", "09988.HK"],
    accent: "red",
  },
  {
    id: "risk-barometer",
    title: "风险温度计",
    symbols: ["HSI", "000300.SH", "000905.SH", "AAPL", "NVDA"],
    accent: "blue",
  },
  {
    id: "signal-candidates",
    title: "策略候选席",
    symbols: ["600519.SH", "300750.SZ", "00700.HK", "03690.HK"],
    accent: "teal",
  },
];

export default function MarketMatrixPage({
  onOpenSymbol,
}: {
  onOpenSymbol?: (symbol: string, date?: string) => void;
}) {
  const [panels, setPanels] = useState<MatrixPanelConfig[]>(loadPanels);
  const [columns, setColumns] = useState<MatrixColumn[]>(loadColumns);
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [message, setMessage] = useState("准备读取行情");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftSymbols, setDraftSymbols] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const allSymbols = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    panels.forEach((panel) => {
      panel.symbols.forEach((symbol) => {
        const normalized = symbol.trim().toUpperCase();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        result.push(normalized);
      });
    });
    return result;
  }, [panels]);

  const quoteBySymbol = useMemo(
    () => new Map(quotes.map((quote) => [quote.symbol, quote])),
    [quotes],
  );

  const summary = useMemo(() => summarizeQuotes(quotes), [quotes]);

  const loadQuotes = async () => {
    if (allSymbols.length === 0) {
      setQuotes([]);
      setMessage("暂无标的");
      return;
    }
    setLoading(true);
    setMessage("读取矩阵行情");
    try {
      const params = new URLSearchParams({ symbols: allSymbols.join(",") });
      const response = await fetch(`/api/market/quotes?${params.toString()}`);
      const payload = (await response.json()) as ApiResponse<QuotePayload>;
      if (payload.success) {
        setQuotes(payload.data.quotes);
        setLastUpdated(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
        setMessage(`加载 ${payload.data.loaded_count}/${payload.data.requested_count} 个标的`);
      } else {
        setMessage(payload.error || "行情读取失败");
      }
    } catch {
      setMessage("行情服务未连接");
    }
    setLoading(false);
  };

  useEffect(() => {
    window.localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panels));
  }, [panels]);

  useEffect(() => {
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
    void loadQuotes();
  }, [allSymbols.join("|")]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void loadQuotes(), 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, allSymbols.join("|")]);

  const toggleColumn = (column: MatrixColumn) => {
    setColumns((value) => {
      if (value.includes(column)) {
        const next = value.filter((item) => item !== column);
        return next.length ? next : value;
      }
      return [...value, column];
    });
  };

  const startEdit = (panel: MatrixPanelConfig) => {
    setEditingId(panel.id);
    setDraftSymbols(panel.symbols.join(", "));
  };

  const savePanelSymbols = (panelId: string) => {
    const symbols = parseSymbols(draftSymbols);
    setPanels((value) =>
      value.map((panel) =>
        panel.id === panelId ? { ...panel, symbols: symbols.length ? symbols : panel.symbols } : panel,
      ),
    );
    setEditingId(null);
  };

  const resetPrototype = () => {
    setPanels(DEFAULT_PANELS);
    setColumns(DEFAULT_COLUMNS);
    setEditingId(null);
  };

  return (
    <section className="workbench-section market-matrix-page">
      <div className="matrix-command-bar">
        <div>
          <span className="eyebrow">Terminal Prototype</span>
          <h1>市场矩阵</h1>
          <p>把 FinceptTerminal 的多面板行情屏压缩成 A/H 投研工作台原型：多市场、可配置列、点击直达个股工作台。</p>
        </div>
        <div className="matrix-command-actions">
          <SessionPill market="A股" status={marketSession("cn")} />
          <SessionPill market="港股" status={marketSession("hk")} />
          <button className="mini" onClick={() => void loadQuotes()} disabled={loading}>
            {loading ? "刷新中" : "刷新"}
          </button>
          <button className={`mini ${autoRefresh ? "active-soft" : ""}`} onClick={() => setAutoRefresh((value) => !value)}>
            AUTO {autoRefresh ? "ON" : "OFF"}
          </button>
          <button className="mini" onClick={resetPrototype}>重置原型</button>
        </div>
      </div>

      <div className="matrix-tape" aria-label="行情摘要">
        <TapeItem label="覆盖" value={`${summary.loaded}/${allSymbols.length}`} />
        <TapeItem label="上涨/下跌" value={`${summary.advancers}/${summary.decliners}`} />
        <TapeItem label="最强" value={summary.strongest ? `${summary.strongest.symbol} ${formatSignedPercent(summary.strongest.change_pct)}` : "-"} tone="positive" />
        <TapeItem label="最弱" value={summary.weakest ? `${summary.weakest.symbol} ${formatSignedPercent(summary.weakest.change_pct)}` : "-"} tone="negative" />
        <TapeItem label="成交额" value={formatMoney(summary.amount)} />
        <TapeItem label="更新" value={lastUpdated || "-"} />
        <span className="matrix-message">{message}</span>
      </div>

      <div className="matrix-column-toggle" aria-label="市场矩阵列配置">
        <span>列配置</span>
        {DEFAULT_COLUMNS.map((column) => (
          <button
            className={columns.includes(column) ? "active" : ""}
            key={column}
            onClick={() => toggleColumn(column)}
            type="button"
          >
            {COLUMN_LABELS[column]}
          </button>
        ))}
      </div>

      <div className="market-matrix-grid">
        {panels.map((panel) => (
          <MatrixPanel
            columns={columns}
            editing={editingId === panel.id}
            draftSymbols={draftSymbols}
            key={panel.id}
            onCancelEdit={() => setEditingId(null)}
            onDraftSymbolsChange={setDraftSymbols}
            onOpenSymbol={onOpenSymbol}
            onSaveEdit={() => savePanelSymbols(panel.id)}
            onStartEdit={() => startEdit(panel)}
            panel={panel}
            quoteBySymbol={quoteBySymbol}
          />
        ))}
      </div>
    </section>
  );
}

function MatrixPanel({
  panel,
  quoteBySymbol,
  columns,
  editing,
  draftSymbols,
  onDraftSymbolsChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onOpenSymbol,
}: {
  panel: MatrixPanelConfig;
  quoteBySymbol: Map<string, MarketQuote>;
  columns: MatrixColumn[];
  editing: boolean;
  draftSymbols: string;
  onDraftSymbolsChange: (value: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onOpenSymbol?: (symbol: string, date?: string) => void;
}) {
  const panelQuotes = panel.symbols.map((symbol) => quoteBySymbol.get(symbol) || missingQuote(symbol));
  const loaded = panelQuotes.filter((quote) => quote.status === "ok").length;

  return (
    <section className={`matrix-panel accent-${panel.accent}`}>
      <header className="matrix-panel-head">
        <div>
          <h2>{panel.title}</h2>
          <span>{loaded}/{panel.symbols.length} loaded</span>
        </div>
        <button className="mini" onClick={onStartEdit}>编辑</button>
      </header>

      {editing && (
        <div className="matrix-panel-editor">
          <input
            value={draftSymbols}
            onChange={(event) => onDraftSymbolsChange(event.target.value)}
            placeholder="600519.SH, 00700.HK, HSI"
          />
          <button className="mini primary" onClick={onSaveEdit}>保存</button>
          <button className="mini" onClick={onCancelEdit}>取消</button>
        </div>
      )}

      <div className="matrix-table-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>SYMBOL</th>
              {columns.map((column) => <th key={column}>{COLUMN_LABELS[column]}</th>)}
            </tr>
          </thead>
          <tbody>
            {panelQuotes.map((quote) => (
              <tr key={quote.symbol} onClick={() => onOpenSymbol?.(quote.symbol, quote.trade_date || undefined)}>
                <td>
                  <strong>{quote.symbol}</strong>
                  <span>{quote.name || quote.display_name || quote.market || "-"}</span>
                </td>
                {columns.map((column) => (
                  <MatrixCell column={column} quote={quote} key={column} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MatrixCell({ column, quote }: { column: MatrixColumn; quote: MarketQuote }) {
  const tone = quoteTone(quote.change_pct);
  if (column === "last") return <td className="number-cell">{formatNumber(quote.price, 2)}</td>;
  if (column === "change") {
    return (
      <td className={`number-cell ${tone}`}>
        <span>{formatSignedNumber(quote.change)}</span>
        <small>{formatSignedPercent(quote.change_pct)}</small>
      </td>
    );
  }
  if (column === "range") {
    return (
      <td className="number-cell muted-range">
        <span>{formatNumber(quote.high, 2)}</span>
        <small>{formatNumber(quote.low, 2)}</small>
      </td>
    );
  }
  if (column === "volume") return <td className="number-cell">{formatCompactNumber(quote.volume)}</td>;
  if (column === "amount") return <td className="number-cell">{formatMoney(quote.amount)}</td>;
  if (column === "spark") {
    return (
      <td className="matrix-spark-cell">
        <Sparkline points={quote.sparkline || []} tone={tone} />
      </td>
    );
  }
  return (
    <td>
      <span className={`status-badge freshness-${freshnessTone(quote.freshness_status)}`}>
        {quote.status === "ok" ? quote.freshness_text || quote.trade_date || "OK" : "缺失"}
      </span>
    </td>
  );
}

function SessionPill({ market, status }: { market: string; status: { label: string; tone: string } }) {
  return (
    <span className={`session-pill ${status.tone}`}>
      <b>{market}</b>
      {status.label}
    </span>
  );
}

function TapeItem({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <span className={`matrix-tape-item ${tone}`}>
      <em>{label}</em>
      <strong>{value}</strong>
    </span>
  );
}

function summarizeQuotes(quotes: MarketQuote[]) {
  const loadedQuotes = quotes.filter((quote) => quote.status === "ok");
  const sortedByChange = [...loadedQuotes].sort((a, b) => (b.change_pct || 0) - (a.change_pct || 0));
  return {
    loaded: loadedQuotes.length,
    advancers: loadedQuotes.filter((quote) => (quote.change_pct || 0) > 0).length,
    decliners: loadedQuotes.filter((quote) => (quote.change_pct || 0) < 0).length,
    strongest: sortedByChange[0],
    weakest: sortedByChange[sortedByChange.length - 1],
    amount: loadedQuotes.reduce((sum, quote) => sum + (quote.amount || 0), 0),
  };
}

function missingQuote(symbol: string): MarketQuote {
  return {
    symbol,
    market: "-",
    status: "missing",
    status_text: "暂无行情",
    sparkline: [],
  };
}

function parseSymbols(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[\s,，]+/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function loadPanels() {
  try {
    const stored = window.localStorage.getItem(PANEL_STORAGE_KEY);
    if (!stored) return DEFAULT_PANELS;
    const parsed = JSON.parse(stored) as MatrixPanelConfig[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PANELS;
  } catch {
    return DEFAULT_PANELS;
  }
}

function loadColumns() {
  try {
    const stored = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!stored) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(stored) as MatrixColumn[];
    const valid = parsed.filter((item): item is MatrixColumn => DEFAULT_COLUMNS.includes(item as MatrixColumn));
    return valid.length ? valid : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function marketSession(market: "cn" | "hk") {
  const now = new Date();
  const day = now.getDay();
  const hhmm = now.getHours() * 100 + now.getMinutes();
  const weekday = day >= 1 && day <= 5;
  if (!weekday) return { label: "CLOSED", tone: "closed" };
  if (hhmm >= 930 && hhmm <= 1130) return { label: "OPEN", tone: "open" };
  if (market === "cn" && hhmm >= 1300 && hhmm <= 1500) return { label: "OPEN", tone: "open" };
  if (market === "hk" && hhmm >= 1300 && hhmm <= 1600) return { label: "OPEN", tone: "open" };
  if (hhmm < 930) return { label: "PRE", tone: "pre" };
  return { label: "CLOSED", tone: "closed" };
}
