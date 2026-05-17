import { FormEvent, useEffect, useMemo, useState } from "react";
import { DataTrustPanel } from "../components/DataTrustPanel";
import { QuoteCard, QuoteTable } from "../components/MarketWidgets";
import type { MarketPulsePayload, MarketQuote, MarketSnapshot } from "../types/market";
import { formatMoney, formatSignedPercent } from "../utils/formatters";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
}

export default function MarketPulsePage({
  onOpenSymbol,
}: {
  onOpenSymbol?: (symbol: string, date?: string) => void;
}) {
  const [symbols, setSymbols] = useState("");
  const [pulse, setPulse] = useState<MarketPulsePayload | null>(null);
  const [selected, setSelected] = useState<MarketQuote | null>(null);
  const [message, setMessage] = useState("读取中");
  const [loading, setLoading] = useState(false);

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setMessage("读取行情");
    const params = symbols.trim() ? `?${new URLSearchParams({ symbols }).toString()}` : "";
    try {
      const response = await fetch(`/api/market/pulse${params}`);
      const payload = (await response.json()) as ApiResponse<MarketPulsePayload>;
      if (payload.success) {
        setPulse(payload.data);
        const nextSelected =
          payload.data.quotes.find((quote) => quote.symbol === selected?.symbol) ||
          payload.data.quotes.find((quote) => quote.status === "ok") ||
          null;
        setSelected(nextSelected);
        setMessage(
          `加载 ${payload.data.breadth.loaded_count}/${payload.data.breadth.requested_count} 个标的`,
        );
      } else {
        setMessage(payload.error || "行情读取失败");
      }
    } catch {
      setMessage("行情服务未连接");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const breadth = pulse?.breadth;
  const structure = useMemo(() => {
    const quotes = (pulse?.quotes || []).filter((quote) => quote.status === "ok");
    const totalAmount = quotes.reduce((sum, quote) => sum + (quote.amount || 0), 0);
    const sortedByAmount = [...quotes].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    const top3Amount = sortedByAmount.slice(0, 3).reduce((sum, quote) => sum + (quote.amount || 0), 0);
    const strongest = [...quotes].sort((a, b) => (b.change_pct || 0) - (a.change_pct || 0))[0];
    const weakest = [...quotes].sort((a, b) => (a.change_pct || 0) - (b.change_pct || 0))[0];
    return {
      coverage: pulse?.breadth.requested_count
        ? (pulse.breadth.loaded_count / pulse.breadth.requested_count) * 100
        : 0,
      turnoverLeader: sortedByAmount[0],
      concentration: totalAmount ? (top3Amount / totalAmount) * 100 : 0,
      strongest,
      weakest,
    };
  }, [pulse]);

  return (
    <section className="workbench-section market-page">
      <div className="section-heading">
        <h1>行情看板</h1>
        <p>借鉴终端式行情面板，把自选池报价、市场宽度、涨跌榜和个股卡片集中到一屏。</p>
      </div>
      <form className="toolbar" onSubmit={load}>
        <input
          className="wide-input"
          value={symbols}
          onChange={(event) => setSymbols(event.target.value)}
          placeholder="留空使用自选池，或输入 600519.SH,00700.HK,AAPL"
        />
        <button className="primary" disabled={loading}>
          {loading ? "读取中" : "刷新行情"}
        </button>
        <span className="muted">{message}</span>
      </form>

      <div className="pipeline-summary">
        <Metric label="最新交易日" value={pulse?.latest_date || "-"} />
        <Metric label="上涨 / 下跌" value={`${breadth?.advancers || 0} / ${breadth?.decliners || 0}`} />
        <Metric label="平盘" value={String(breadth?.unchanged || 0)} />
        <Metric
          label="数据新鲜度"
          value={pulse?.freshness?.max_age_days == null ? "-" : `${pulse.freshness.max_age_days} 天`}
          note={pulse?.freshness?.delay_policy}
        />
      </div>
      {pulse?.freshness && (
        <div className="readiness-strip">
          <span className="status-badge freshness-fresh">新鲜 {pulse.freshness.fresh_count}</span>
          <span className="status-badge freshness-delayed">延迟 {pulse.freshness.delayed_count}</span>
          <span className="status-badge freshness-stale">陈旧 {pulse.freshness.stale_count}</span>
          <span className="status-badge muted-badge">缺失 {pulse.freshness.missing_count}</span>
        </div>
      )}
      <DataTrustPanel
        compact
        title="行情数据可信度"
        summary="行情看板使用本地研究库日线快照，准实时数据请进入个股工作台查看。"
        items={[
          { label: "请求标的", value: String(breadth?.requested_count || 0) },
          { label: "已加载", value: String(breadth?.loaded_count || 0), tone: (breadth?.loaded_count || 0) > 0 ? "good" : "warn" },
          { label: "最新交易日", value: pulse?.latest_date || "-" },
          { label: "延迟策略", value: pulse?.freshness?.delay_policy || "本地日线缓存，非实时行情" },
        ]}
        warnings={[
          ...(pulse?.freshness?.missing_count ? [`${pulse.freshness.missing_count} 个标的缺失本地行情`] : []),
          ...(pulse?.freshness?.stale_count ? [`${pulse.freshness.stale_count} 个标的数据陈旧`] : []),
        ]}
        disclaimer="本页用于研究扫描，不构成实盘报价或投资建议。"
      />
      <div className="market-structure-grid">
        <StructureCard label="行情覆盖率" value={`${structure.coverage.toFixed(0)}%`} note="已加载 / 请求标的" />
        <StructureCard
          label="成交额龙头"
          value={structure.turnoverLeader?.symbol || "-"}
          note={structure.turnoverLeader ? formatMoney(structure.turnoverLeader.amount) : "暂无成交额"}
        />
        <StructureCard label="成交集中度" value={`${structure.concentration.toFixed(0)}%`} note="Top3 成交额占比" />
        <StructureCard
          label="强弱对照"
          value={`${structure.strongest?.symbol || "-"} / ${structure.weakest?.symbol || "-"}`}
          note={`${formatSignedPercent(structure.strongest?.change_pct)} / ${formatSignedPercent(structure.weakest?.change_pct)}`}
        />
      </div>

      <div className="market-layout">
        <div className="market-main">
          <QuoteTable
            quotes={pulse?.quotes || []}
            onOpenSymbol={onOpenSymbol}
            onSelect={(symbol) => {
              const quote = pulse?.quotes.find((item) => item.symbol === symbol) || null;
              setSelected(quote);
            }}
          />
          <div className="section-subhead">
            <h2>分市场快照</h2>
            <span className="muted">按本地研究库最新日线汇总</span>
          </div>
          <div className="market-snapshot-grid">
            {(pulse?.market_snapshots || []).map((snapshot) => (
              <MarketSnapshotCard snapshot={snapshot} key={snapshot.market} />
            ))}
            {(pulse?.market_snapshots || []).length === 0 && (
              <div className="empty-state block">同步行情后查看市场快照。</div>
            )}
          </div>
        </div>

        <aside className="market-side">
          <QuoteCard quote={selected} />
          <MoverList title="涨幅榜" quotes={pulse?.gainers || []} onOpenSymbol={onOpenSymbol} />
          <MoverList title="跌幅榜" quotes={pulse?.losers || []} onOpenSymbol={onOpenSymbol} />
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small className="muted">{note}</small>}
    </div>
  );
}

function MarketSnapshotCard({ snapshot }: { snapshot: MarketSnapshot }) {
  return (
    <div className="list-panel market-snapshot-card">
      <h2>{snapshot.market}</h2>
      <div className="snapshot-line">
        <span>标的</span>
        <strong>{snapshot.count}</strong>
      </div>
      <div className="snapshot-line">
        <span>涨 / 跌 / 平</span>
        <strong>
          {snapshot.advancers} / {snapshot.decliners} / {snapshot.unchanged}
        </strong>
      </div>
      <div className="snapshot-line">
        <span>平均涨跌</span>
        <strong>{formatSignedPercent(snapshot.avg_change_pct)}</strong>
      </div>
      <div className="snapshot-line">
        <span>成交额</span>
        <strong>{formatMoney(snapshot.amount)}</strong>
      </div>
    </div>
  );
}

function StructureCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="metric-tile structure-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className="muted">{note}</small>
    </div>
  );
}

function MoverList({
  title,
  quotes,
  onOpenSymbol,
}: {
  title: string;
  quotes: MarketQuote[];
  onOpenSymbol?: (symbol: string, date?: string) => void;
}) {
  return (
    <div className="list-panel mover-list">
      <h2>{title}</h2>
      {quotes.map((quote) => (
        <button key={quote.symbol} onClick={() => onOpenSymbol?.(quote.symbol, quote.trade_date || undefined)}>
          <span>{quote.symbol}</span>
          <strong>{formatSignedPercent(quote.change_pct)}</strong>
        </button>
      ))}
      {quotes.length === 0 && <p className="empty-state">暂无记录</p>}
    </div>
  );
}
