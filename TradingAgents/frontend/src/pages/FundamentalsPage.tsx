import { FormEvent, useEffect, useState } from "react";
import { DataTrustPanel } from "../components/DataTrustPanel";
import { formatMoney, formatNumber, formatPercent, formatSignedPercent } from "../utils/formatters";

interface FundamentalsPayload {
  symbol: string;
  security_profile?: Record<string, unknown>;
  market_snapshot?: Record<string, number | string | null>;
  valuation_snapshot?: Record<string, number | string | null> | null;
  financial_reports?: FinancialReportsPayload;
  factor_snapshot?: Record<string, number | string | null> | null;
  agent_evidence: Record<string, unknown>[];
  data_quality: {
    fundamental_available: boolean;
    financial_reports_available?: boolean | null;
    market_price_available: boolean;
    factor_available: boolean;
    disclosure: string;
  };
}

interface FinancialStatementItem {
  date?: string | null;
  statement_type?: string | null;
  period?: string | null;
  metrics?: Record<string, number | string | null>;
  source?: string | null;
  updated_at?: string | null;
}

interface FinancialReportsPayload {
  items: FinancialStatementItem[];
  latest_by_type: Record<string, FinancialStatementItem | undefined>;
  summary: {
    available_count: number;
    missing_count: number;
    latest_date?: string | null;
    statement_types: string[];
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
      setMessage(
        data.data.data_quality.financial_reports_available
          ? "已读取财报数据"
          : data.data.data_quality.fundamental_available
            ? "已读取估值快照"
            : "暂无财报数据，展示可审计缺失状态",
      );
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
    setMessage(
      data.success
        ? `财务同步 ${data.data.rows_written} 条，财报 ${data.data.statement_rows_written || 0} 条`
        : "财务同步失败",
    );
    await load();
  };

  useEffect(() => {
    load();
  }, [initialSymbol, initialEnd]);

  const valuation = payload?.valuation_snapshot;
  const reports = payload?.financial_reports;
  const income = reports?.latest_by_type?.income;
  const balance = reports?.latest_by_type?.balance;
  const cashflow = reports?.latest_by_type?.cashflow;
  const market = payload?.market_snapshot;
  const factor = payload?.factor_snapshot;
  const revenue = firstNumber(valuation?.revenue, income?.metrics?.revenue);
  const netIncome = firstNumber(valuation?.net_income, income?.metrics?.net_income);
  const totalAssets = firstNumber(balance?.metrics?.total_assets);
  const operatingCashflow = firstNumber(cashflow?.metrics?.operating_cashflow);
  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>财报与估值</h1>
        <p>优先获取利润表、资产负债表和现金流；估值倍数作为补充证据，不再用缺失字段伪估算。</p>
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
        summary="财报页只展示已获取的三表和估值快照；缺失字段明确披露，不做伪估算。"
        items={[
          { label: "财报数据", value: payload?.data_quality.financial_reports_available ? "已获取" : "缺失", tone: payload?.data_quality.financial_reports_available ? "good" : "warn" },
          { label: "估值快照", value: payload?.data_quality.fundamental_available ? "已落库" : "缺失", tone: payload?.data_quality.fundamental_available ? "good" : "warn" },
          { label: "行情价格", value: payload?.data_quality.market_price_available ? "可用" : "缺失", tone: payload?.data_quality.market_price_available ? "good" : "warn" },
          { label: "因子快照", value: payload?.data_quality.factor_available ? "可用" : "缺失", tone: payload?.data_quality.factor_available ? "good" : "warn" },
          { label: "最新财报期", value: reports?.summary.latest_date || "-" },
          { label: "披露口径", value: payload?.data_quality.disclosure || "-" },
        ]}
        warnings={[
          ...(!payload?.data_quality.financial_reports_available ? ["缺少财报三表，盈利质量和财务安全边际不可完整使用"] : []),
          ...(!payload?.data_quality.fundamental_available ? ["缺少估值快照，PE/PB/ROE 等估值倍数可能不完整"] : []),
          ...(!payload?.data_quality.factor_available ? ["缺少因子快照，基本面结论无法联动技术/相对强弱"] : []),
        ]}
        disclaimer="基本面证据用于研究解释，不直接生成交易指令。"
      />
      {payload && !payload.data_quality.financial_reports_available && (
        <EvidenceReadinessCallout
          actionLabel="获取财报"
          detail="当前可以使用价格、因子和资金流做辅助判断，但缺少利润表、资产负债表和现金流。"
          onAction={syncFundamentals}
          status="财报数据未就绪"
          title="先获取三表数据"
        />
      )}
      <div className="pipeline-summary">
        <Metric label="最新价格" value={formatNumber(Number(market?.close), 2)} />
        <Metric label="PE / PB" value={`${formatNumber(Number(valuation?.pe_ttm), 1)} / ${formatNumber(Number(valuation?.pb), 1)}`} />
        <Metric label="ROE / 毛利率" value={`${formatPercent(Number(valuation?.roe))} / ${formatPercent(Number(valuation?.gross_margin))}`} />
        <Metric label="20日/60日收益" value={`${formatSignedPercent(Number(factor?.ret20))} / ${formatSignedPercent(Number(factor?.ret60))}`} />
      </div>
      <FinancialReportsPanel reports={reports} onSync={syncFundamentals} />
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
            <Mini label="营收" value={formatMoney(revenue)} />
            <Mini label="净利润" value={formatMoney(netIncome)} />
            <Mini label="总资产" value={formatMoney(totalAssets)} />
            <Mini label="经营现金流" value={formatMoney(operatingCashflow)} />
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

function FinancialReportsPanel({
  reports,
  onSync,
}: {
  reports?: FinancialReportsPayload;
  onSync: () => void;
}) {
  const latest = reports?.latest_by_type || {};
  const cards = [
    {
      key: "income",
      title: "利润表",
      subtitle: "收入、利润和盈利质量",
      item: latest.income,
      metrics: [
        ["营收", "revenue", "money"],
        ["净利润", "net_income", "money"],
        ["毛利", "gross_profit", "money"],
        ["EPS", "eps", "number"],
      ],
    },
    {
      key: "balance",
      title: "资产负债表",
      subtitle: "资产、负债和权益结构",
      item: latest.balance,
      metrics: [
        ["总资产", "total_assets", "money"],
        ["总负债", "total_liabilities", "money"],
        ["股东权益", "total_equity", "money"],
        ["资产负债率", "debt_to_assets", "percent"],
      ],
    },
    {
      key: "cashflow",
      title: "现金流量表",
      subtitle: "经营、投资、融资现金流",
      item: latest.cashflow,
      metrics: [
        ["经营现金流", "operating_cashflow", "money"],
        ["投资现金流", "investing_cashflow", "money"],
        ["融资现金流", "financing_cashflow", "money"],
        ["自由现金流", "free_cashflow", "money"],
      ],
    },
  ];

  if (!reports || reports.summary.available_count === 0) {
    return (
      <div className="evidence-readiness-callout warn">
        <div>
          <span>财报未获取</span>
          <strong>点击获取利润表、资产负债表和现金流</strong>
          <em>获取成功后这里会展示最近财报期的核心科目。</em>
        </div>
        <button className="mini primary" onClick={onSync} type="button">获取财报</button>
      </div>
    );
  }

  return (
    <div className="context-grid">
      {cards.map((card) => (
        <div className="detail-panel" key={card.key}>
          <div className="detail-header">
            <div>
              <span className="eyebrow">{card.item?.date || "缺失"}</span>
              <h2>{card.title}</h2>
              <p>{card.subtitle} · {card.item?.source || "-"}</p>
            </div>
            <span className={card.item ? "status-badge" : "status-badge muted-badge"}>
              {card.item ? "已获取" : "缺失"}
            </span>
          </div>
          <div className="factor-metric-grid">
            {card.metrics.map(([label, key, kind]) => (
              <Mini
                key={key}
                label={label}
                value={formatFinancialMetric(card.item?.metrics?.[key], kind)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="mini-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatFinancialMetric(value: unknown, kind: string) {
  const parsed = firstNumber(value);
  if (kind === "money") return formatMoney(parsed);
  if (kind === "percent") return formatPercent(parsed);
  return formatNumber(parsed, 2);
}

function EvidenceReadinessCallout({
  actionLabel,
  detail,
  onAction,
  status,
  title,
}: {
  actionLabel: string;
  detail: string;
  onAction: () => void;
  status: string;
  title: string;
}) {
  return (
    <div className="evidence-readiness-callout warn">
      <div>
        <span>{status}</span>
        <strong>{title}</strong>
        <em>{detail}</em>
      </div>
      <button className="mini primary" onClick={onAction} type="button">{actionLabel}</button>
    </div>
  );
}
