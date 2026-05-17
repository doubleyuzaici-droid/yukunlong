import { FormEvent, useEffect, useState } from "react";
import {
  READINESS_LABELS,
  type PipelineSummary,
  type WatchlistStatusRow,
} from "../utils/researchPipeline";
import { fetchQuotes, Sparkline } from "../components/MarketWidgets";
import type { MarketQuote } from "../types/market";
import { formatNumber, formatSignedPercent, quoteTone } from "../utils/formatters";
import { recordAuditEvent } from "../utils/audit";

interface WatchlistItem {
  symbol: string;
  market: string;
  industry?: string | null;
  thesis?: string | null;
  status: string;
}

export default function WatchlistPage({
  onOpenSymbol,
}: {
  onOpenSymbol?: (symbol: string) => void;
}) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [symbols, setSymbols] = useState("00700.HK 600519.SH");
  const [market, setMarket] = useState("");
  const [industry, setIndustry] = useState("");
  const [thesis, setThesis] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [statusRows, setStatusRows] = useState<WatchlistStatusRow[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);

  const load = async () => {
    const response = await fetch("/api/research/watchlist");
    const data = await response.json();
    if (data.success) {
      setItems(data.data);
      setQuotes(await fetchQuotes(data.data.map((item: WatchlistItem) => item.symbol)));
    }
    const statusResponse = await fetch("/api/research/status");
    const statusData = await statusResponse.json();
    if (statusData.success) setStatusRows(statusData.data.watchlist_status);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const parsed = symbols.split(/[\s,，]+/).filter(Boolean);
    const response = await fetch("/api/research/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbols: parsed,
        market: market || undefined,
        industry: industry || undefined,
        thesis: thesis || undefined,
      }),
    });
    const data = await response.json();
    if (data.success) {
      setItems(data.data);
      setMessage(`已更新 ${parsed.length} 个标的`);
      await load();
    } else {
      setMessage("更新失败");
    }
    setLoading(false);
  };

  const remove = async (symbol: string) => {
    if (!window.confirm(`确认将 ${symbol} 移出观察池？该标的不会再参与默认同步和扫描。`)) {
      return;
    }
    setMessage("");
    const response = await fetch(
      `/api/research/watchlist/${encodeURIComponent(symbol)}`,
      { method: "DELETE" },
    );
    const data = await response.json();
    if (data.success) {
      recordAuditEvent("remove_watchlist_symbol", symbol, "removed from default research scope");
      setItems(data.data);
      setMessage(`${symbol} 已移出观察池`);
      await load();
    } else {
      setMessage("移除失败");
    }
  };

  const runPipeline = async () => {
    setLoading(true);
    setMessage("同步并扫描中");
    const response = await fetch("/api/research/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (data.success) {
      setPipeline(data.data);
      setStatusRows(data.data.watchlist_status);
      setMessage(`同步 ${data.data.rows_synced} 行，触发 ${data.data.signal_count} 条信号`);
    } else {
      setMessage("流水线运行失败");
    }
    setLoading(false);
  };

  const bootstrapCoreWatchlist = async () => {
    setLoading(true);
    setMessage("补入核心研究池");
    const response = await fetch("/api/research/watchlist/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (data.success) {
      setStatusRows(data.data.watchlist_status);
      setMessage(`已补入核心样本：${(data.data.inserted || []).map((row: WatchlistItem) => row.symbol).join(" / ")}`);
      await load();
    } else {
      setMessage("核心研究池补入失败");
    }
    setLoading(false);
  };

  const statusBySymbol = new Map(statusRows.map((row) => [row.symbol, row]));
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>自选股池</h1>
        <p>维护 A/H 研究范围，供每日扫描、复盘和回测共用。</p>
      </div>
      <form className="toolbar stacked" onSubmit={submit}>
        <input
          className="wide-input"
          value={symbols}
          onChange={(event) => setSymbols(event.target.value)}
          placeholder="00700.HK 1024.HK 600519.SH"
        />
        <select value={market} onChange={(event) => setMarket(event.target.value)}>
          <option value="">自动识别市场</option>
          <option value="CHINA">A 股</option>
          <option value="HONGKONG">港股</option>
        </select>
        <input
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          placeholder="行业"
        />
        <input
          className="wide-input"
          value={thesis}
          onChange={(event) => setThesis(event.target.value)}
          placeholder="关注逻辑"
        />
        <button className="primary" disabled={loading}>
          {loading ? "处理中" : "添加"}
        </button>
        <button type="button" onClick={bootstrapCoreWatchlist} disabled={loading}>
          补核心池
        </button>
        <button type="button" onClick={runPipeline} disabled={loading || items.length === 0}>
          同步并扫描
        </button>
        <span className="muted">{message}</span>
      </form>
      {pipeline && (
        <div className="pipeline-summary">
          <div className="metric-tile">
            <span>同步行情</span>
            <strong>{pipeline.rows_synced}</strong>
          </div>
          <div className="metric-tile">
            <span>计算因子</span>
            <strong>{pipeline.factor_rows}</strong>
          </div>
          <div className="metric-tile">
            <span>触发信号</span>
            <strong>{pipeline.signal_count}</strong>
          </div>
        </div>
      )}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>股票</th>
              <th>市场</th>
              <th>行业</th>
              <th>关注逻辑</th>
              <th>价格</th>
              <th>涨跌</th>
              <th>走势</th>
              <th>数据状态</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const status = statusBySymbol.get(item.symbol);
              const quote = quoteBySymbol.get(item.symbol);
              const tone = quoteTone(quote?.change_pct);
              return (
                <tr key={item.symbol}>
                  <td>{item.symbol}</td>
                  <td>{item.market}</td>
                  <td>{item.industry || "-"}</td>
                  <td>{item.thesis || "-"}</td>
                  <td>
                    {formatNumber(quote?.price, 2)}
                    <br />
                    <span className="muted">{quote?.trade_date || "未同步"}</span>
                  </td>
                  <td className={tone}>
                    {formatSignedPercent(quote?.change_pct)}
                    <br />
                    <span className="muted">{quote?.status_text || "-"}</span>
                  </td>
                  <td>
                    <Sparkline points={quote?.sparkline || []} tone={tone} />
                  </td>
                  <td>
                    <span className="status-badge">
                      {READINESS_LABELS[status?.scan_readiness || ""] || "-"}
                    </span>
                    <br />
                    <span className="muted">{status?.readiness_reason || "-"}</span>
                  </td>
                  <td>{item.status}</td>
                  <td>
                    <button className="mini" onClick={() => onOpenSymbol?.(item.symbol)}>
                      工作台
                    </button>{" "}
                    <button className="danger mini" onClick={() => remove(item.symbol)}>
                      移除
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={10}>暂无自选股</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
