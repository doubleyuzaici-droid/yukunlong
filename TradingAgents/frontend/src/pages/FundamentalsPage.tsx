import { FormEvent, useEffect, useState } from "react";
import { DataTrustPanel } from "../components/DataTrustPanel";
import { formatMoney, formatNumber, formatPercent, formatSignedPercent } from "../utils/formatters";

interface FundamentalsPayload {
  symbol: string;
  security_profile?: Record<string, unknown>;
  market_snapshot?: Record<string, number | string | null>;
  valuation_snapshot?: Record<string, number | string | null> | null;
  factor_snapshot?: Record<string, number | string | null> | null;
  agent_evidence: Record<string, unknown>[];
  data_quality: {
    fundamental_available: boolean;
    market_price_available: boolean;
    factor_available: boolean;
    disclosure: string;
  };
}

interface LineagePayload {
  summary: { available_count: number; missing_count: number; coverage: number };
  items: {
    table: string;
    status: string;
    record_date?: string | null;
    source?: string | null;
    field_coverage?: number | null;
    row_count?: number | null;
  }[];
}

export default function FundamentalsPage({
  initialSymbol = "600519.SH",
  initialEnd,
}: {
  initialSymbol?: string;
  initialEnd?: string;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [end, setEnd] = useState(initialEnd || new Date().toISOString().slice(0, 10));
  const [payload, setPayload] = useState<FundamentalsPayload | null>(null);
  const [lineage, setLineage] = useState<LineagePayload | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSymbol(initialSymbol);
    if (initialEnd) setEnd(initialEnd);
  }, [initialSymbol, initialEnd]);

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    const response = await fetch(
      `/api/professional/fundamentals?${new URLSearchParams({ symbol, end }).toString()}`,
    );
    const data = await response.json();
    if (data.success) {
      setPayload(data.data);
      setMessage(data.data.data_quality.fundamental_available ? "已读取基本面快照" : "暂无财务快照，展示可审计缺失状态");
      void loadLineage();
    } else {
      setMessage("基本面读取失败");
    }
  };

  const loadLineage = async () => {
    const response = await fetch(
      `/api/professional/lineage?${new URLSearchParams({ symbol, date: end }).toString()}`,
    );
    const data = await response.json();
    if (data.success) setLineage(data.data);
  };

  const syncFundamentals = async () => {
    setMessage("同步财务快照中");
    const response = await fetch("/api/professional/fundamentals/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: [symbol], end, source: "auto" }),
    });
    const data = await response.json();
    setMessage(data.success ? `财务同步 ${data.data.rows_written} 条` : "财务同步失败");
    await load();
  };

  useEffect(() => {
    load();
  }, [initialSymbol, initialEnd]);

  const valuation = payload?.valuation_snapshot;
  const market = payload?.market_snapshot;
  const factor = payload?.factor_snapshot;
  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>基本面与估值</h1>
        <p>展示已落库财务快照、估值倍数、市场价格与 Agent 基本面证据；不对缺失财务字段做伪估算。</p>
      </div>
      <form className="toolbar" onSubmit={load}>
        <input value={symbol} onChange={(event) => setSymbol(event.target.value)} />
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <button className="primary">读取基本面</button>
        <button type="button" onClick={syncFundamentals}>同步财务</button>
        <span className="muted">{message}</span>
      </form>
      <DataTrustPanel
        compact
        title="基本面可信度"
        summary="基本面页只展示已落库财务和估值快照；缺失字段明确披露，不做伪估算。"
        items={[
          { label: "财务快照", value: payload?.data_quality.fundamental_available ? "已落库" : "缺失", tone: payload?.data_quality.fundamental_available ? "good" : "warn" },
          { label: "行情价格", value: payload?.data_quality.market_price_available ? "可用" : "缺失", tone: payload?.data_quality.market_price_available ? "good" : "warn" },
          { label: "因子快照", value: payload?.data_quality.factor_available ? "可用" : "缺失", tone: payload?.data_quality.factor_available ? "good" : "warn" },
          { label: "估值来源", value: String(valuation?.source || "-") },
          { label: "披露口径", value: payload?.data_quality.disclosure || "-" },
        ]}
        warnings={[
          ...(!payload?.data_quality.fundamental_available ? ["缺少财务快照，估值和盈利质量判断不可完整使用"] : []),
          ...(!payload?.data_quality.factor_available ? ["缺少因子快照，基本面结论无法联动技术/相对强弱"] : []),
        ]}
        disclaimer="基本面证据用于研究解释，不直接生成交易指令。"
      />
      <div className="pipeline-summary">
        <Metric label="最新价格" value={formatNumber(Number(market?.close), 2)} />
        <Metric label="PE / PB" value={`${formatNumber(Number(valuation?.pe_ttm), 1)} / ${formatNumber(Number(valuation?.pb), 1)}`} />
        <Metric label="ROE / 毛利率" value={`${formatPercent(Number(valuation?.roe))} / ${formatPercent(Number(valuation?.gross_margin))}`} />
        <Metric label="20日/60日收益" value={`${formatSignedPercent(Number(factor?.ret20))} / ${formatSignedPercent(Number(factor?.ret60))}`} />
      </div>
      <div className="context-grid">
        <div className="detail-panel">
          <div className="detail-header">
            <div>
              <span className="eyebrow">Security Master</span>
              <h2>{String(payload?.security_profile?.name || payload?.symbol || "-")}</h2>
              <p>{String(payload?.security_profile?.industry || "-")} · {String(payload?.security_profile?.market || "-")}</p>
            </div>
            <span className={payload?.data_quality.fundamental_available ? "status-badge" : "status-badge muted-badge"}>
              {payload?.data_quality.fundamental_available ? "财务已落库" : "财务缺失"}
            </span>
          </div>
          <div className="factor-metric-grid">
            <Mini label="营收" value={formatMoney(Number(valuation?.revenue))} />
            <Mini label="净利润" value={formatMoney(Number(valuation?.net_income))} />
            <Mini label="EPS" value={formatNumber(Number(valuation?.eps), 2)} />
            <Mini label="股息率" value={formatPercent(Number(valuation?.dividend_yield))} />
            <Mini label="来源" value={String(valuation?.source || "-")} />
            <Mini label="披露" value={payload?.data_quality.disclosure || "-"} />
          </div>
        </div>
        <div className="list-panel compact-list">
          <h2>数据血缘</h2>
          {(lineage?.items || []).map((item) => (
            <p key={item.table}>
              <strong>{item.table} · {item.status}</strong>
              <span>{item.record_date || "-"} · {item.source || "-"} · 覆盖 {formatPercent(item.field_coverage)}</span>
            </p>
          ))}
          {!lineage && <p className="empty-state">读取后展示血缘。</p>}
        </div>
        <div className="list-panel compact-list">
          <h2>Agent 基本面证据</h2>
          {(payload?.agent_evidence || []).map((row, index) => (
            <p key={`${row.signal_id}-${index}`}>
              <strong>{String(row.signal_name || row.signal_id || "-")}</strong>
              <span>日期 {String(row.date || "-")} · 评分 {String(row.score || "-")}</span>
              <span>{String(row.evidence_json || "-").slice(0, 180)}</span>
            </p>
          ))}
          {(payload?.agent_evidence || []).length === 0 && <p className="empty-state">暂无 Agent 基本面证据</p>}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="mini-metric"><span>{label}</span><strong>{value}</strong></div>;
}
