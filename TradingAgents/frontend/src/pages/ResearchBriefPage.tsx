import { FormEvent, useEffect, useMemo, useState } from "react";
import { DataTrustPanel } from "../components/DataTrustPanel";
import { formatNumber, formatPercent, formatSignedPercent } from "../utils/formatters";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
}

interface BriefSignal {
  signal_id: string;
  date: string;
  symbol: string;
  signal_name: string;
  signal_level?: string | null;
  direction?: string | null;
  score?: number | null;
  strategy_version?: string | null;
  evidence?: string[];
  risks?: string[];
}

interface DecisionBriefPayload {
  symbol: string;
  date: string;
  strategy_version: string;
  decision_layer: {
    status: "actionable" | "watch" | "blocked" | "empty" | string;
    label: string;
    summary: string;
    tone: "opportunity" | "watch" | "risk" | "neutral" | string;
  };
  layers: { key: string; label: string; summary: string }[];
  trust: {
    level: "good" | "warn" | "blocked" | string;
    coverage: number;
    missing_tables: string[];
    low_coverage_tables: string[];
    open_quality_issues: { check_name?: string; severity?: string; message?: string }[];
  };
  today: {
    top_signal?: BriefSignal | null;
    latest_review?: {
      review_id?: string;
      action?: string;
      confidence?: string;
      decision_status?: string;
      review_summary?: string;
      risk_flags?: string[];
      missing_data?: string[];
    } | null;
    queue_summary: {
      candidate_count: number;
      approved_count: number;
      blocked_count: number;
      executed_count: number;
      pending_count: number;
    };
    queue_items: {
      signal_id: string;
      symbol: string;
      signal_name: string;
      execution_status: string;
      recommended_next_step: string;
    }[];
  };
  risk: {
    position_count: number;
    gross_exposure_pct?: number | null;
    top_symbol?: string | null;
    top_weight?: number | null;
    current_drawdown?: number | null;
    risk_flags: string[];
  };
  explainers: {
    label: string;
    value: string;
    detail: string;
    target_view: string;
  }[];
  next_steps: {
    priority: "P0" | "P1" | "P2" | string;
    title: string;
    detail: string;
    target_view: string;
  }[];
  audit: {
    generated_at: string;
    sync_trace_count: number;
    disclaimer: string;
  };
}

interface GovernanceItem {
  key: string;
  title: string;
  status: "ready" | "warn" | "blocker" | string;
  user_impact: string;
  evidence: string[];
  target_view: string;
  depth: "decision" | "explain" | "audit" | string;
}

interface GovernancePayload {
  symbol: string;
  date: string;
  groups: {
    P0: GovernanceItem[];
    P1: GovernanceItem[];
  };
  summary: {
    p0_total: number;
    p0_ready_count: number;
    p0_blocker_count: number;
    p1_total: number;
    p1_ready_count: number;
    decision_blocked: boolean;
    maturity_score: number;
  };
  hard_blocks: GovernanceItem[];
  generated_at: string;
}

interface TradingCalendarItem {
  signal_id: string;
  date: string;
  symbol: string;
  signal_name: string;
  action: "buy" | "watch" | "blocked" | string;
  risk_status: "pass" | "warn" | "blocked" | string;
  entry_zone: {
    low?: number | null;
    high?: number | null;
    basis?: string;
  };
  hard_stop?: number | null;
  max_position_pct?: number | null;
  monitor_count: number;
  blocker_count: number;
  warning_count: number;
  next_step: string;
}

interface TradingCalendarPayload {
  date: string;
  strategy_version: string;
  items: TradingCalendarItem[];
  summary: {
    plan_count: number;
    buy_count: number;
    blocked_count: number;
    watch_count: number;
    monitor_count: number;
    review_due_count: number;
  };
}

interface ProxyInstrument {
  symbol: string;
  name: string;
  market: string;
  proxy_type: string;
  currency?: string;
  lot_size?: number;
  cost_bps?: number;
  tracking_note?: string;
}

interface TradeProxyPayload {
  symbol: string;
  asset_type: "index" | "equity" | string;
  name?: string;
  date: string;
  status: "mapped" | "direct" | "unmapped" | string;
  default_proxy?: ProxyInstrument | null;
  alternatives: ProxyInstrument[];
  execution_checks: { key: string; label: string; status: string; detail: string }[];
  disclaimer?: string;
}

export default function ResearchBriefPage({
  initialSymbol = "600519.SH",
  initialDate,
  onNavigate,
  onOpenSymbol,
}: {
  initialSymbol?: string;
  initialDate?: string;
  onNavigate?: (view: string) => void;
  onOpenSymbol?: (symbol: string, date?: string) => void;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [brief, setBrief] = useState<DecisionBriefPayload | null>(null);
  const [governance, setGovernance] = useState<GovernancePayload | null>(null);
  const [tradingCalendar, setTradingCalendar] = useState<TradingCalendarPayload | null>(null);
  const [tradeProxy, setTradeProxy] = useState<TradeProxyPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("读取中");

  useEffect(() => {
    setSymbol(initialSymbol);
    if (initialDate) setDate(initialDate);
  }, [initialSymbol, initialDate]);

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
      setMessage("生成决策简报");
    try {
      const params = new URLSearchParams({ symbol, date }).toString();
      const [briefResponse, governanceResponse, tradingCalendarResponse, tradeProxyResponse] = await Promise.all([
        fetch(`/api/professional/decision-brief?${params}`),
        fetch(`/api/professional/investment-governance?${params}`),
        fetch(`/api/professional/trading-calendar?date=${encodeURIComponent(date)}`),
        fetch(`/api/professional/trade-proxy?${params}`),
      ]);
      const briefPayload = (await briefResponse.json()) as ApiResponse<DecisionBriefPayload>;
      const governancePayload = (await governanceResponse.json()) as ApiResponse<GovernancePayload>;
      const tradingCalendarPayload = (await tradingCalendarResponse.json()) as ApiResponse<TradingCalendarPayload>;
      const tradeProxyPayload = (await tradeProxyResponse.json()) as ApiResponse<TradeProxyPayload>;
      if (briefPayload.success) {
        setBrief(briefPayload.data);
        if (governancePayload.success) setGovernance(governancePayload.data);
        if (tradingCalendarPayload.success) setTradingCalendar(tradingCalendarPayload.data);
        if (tradeProxyPayload.success) setTradeProxy(tradeProxyPayload.data);
        const maturity = governancePayload.success
          ? ` · 专业成熟度 ${formatPercent(governancePayload.data.summary.maturity_score, 0)}`
          : "";
        const planSummary = tradingCalendarPayload.success
          ? ` · 交易计划 ${tradingCalendarPayload.data.summary.buy_count}/${tradingCalendarPayload.data.summary.plan_count}`
          : "";
        setMessage(`${briefPayload.data.decision_layer.label} · 数据覆盖 ${formatPercent(briefPayload.data.trust.coverage, 0)}${maturity}${planSummary}`);
      } else {
        setMessage(briefPayload.error || "决策简报生成失败");
      }
    } catch {
      setMessage("专业简报服务未连接");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const topSignal = brief?.today.top_signal || null;
  const review = brief?.today.latest_review || null;
  const trustWarnings = useMemo(() => {
    const warnings = [
      ...(brief?.trust.missing_tables || []).map((table) => `${table} 缺失`),
      ...(brief?.trust.low_coverage_tables || []).map((table) => `${table} 字段覆盖不足`),
      ...(brief?.trust.open_quality_issues || []).slice(0, 3).map((issue) => issue.message || issue.check_name || "数据质量问题"),
    ];
    return warnings;
  }, [brief]);

  return (
    <section className="workbench-section research-brief-page">
      <div className="section-heading">
        <h1>投研首页</h1>
        <p>把复杂的行情、信号、审查、回测和风控收口成决策层；需要时再进入解释和审计。</p>
      </div>

      <form className="toolbar" onSubmit={load}>
        <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="600519.SH" />
        <input value={date} onChange={(event) => setDate(event.target.value)} type="date" />
        <button className="primary" disabled={loading}>
          {loading ? "生成中" : "刷新简报"}
        </button>
        <span className="muted">{message}</span>
      </form>

      <div className={`brief-decision-hero ${brief?.decision_layer.tone || "neutral"}`}>
        <div>
          <span className="eyebrow">Decision Layer</span>
          <h2>{brief?.decision_layer.label || "等待决策简报"}</h2>
          <p>{brief?.decision_layer.summary || "读取后展示可执行动作、阻断原因和下一步。"}</p>
        </div>
        <div className="brief-hero-actions">
          <button className="primary" type="button" onClick={() => topSignal && onOpenSymbol?.(topSignal.symbol, topSignal.date)} disabled={!topSignal}>
            打开个股
          </button>
          <button type="button" onClick={() => onNavigate?.("review")}>审查队列</button>
        </div>
      </div>

      <div className="brief-five-grid">
        <BriefTile
          label="数据是否可信"
          value={brief ? trustLabel(brief.trust.level) : "-"}
          detail={`覆盖 ${formatPercent(brief?.trust.coverage, 0)}`}
          tone={brief?.trust.level === "good" ? "good" : brief?.trust.level === "blocked" ? "bad" : "warn"}
        />
        <BriefTile
          label="今日该看什么"
          value={brief ? `${brief.today.queue_summary.approved_count} 已采纳 / ${brief.today.queue_summary.pending_count} 待审` : "-"}
          detail="信号执行队列"
        />
        <BriefTile
          label="这只股票怎么看"
          value={topSignal?.signal_name || "暂无主信号"}
          detail={topSignal ? `${topSignal.signal_level || "-"} · ${formatNumber(topSignal.score, 0)}分` : "等待信号"}
        />
        <BriefTile
          label="这个信号靠谱吗"
          value={review?.decision_status || "pending"}
          detail={review?.confidence ? `置信度 ${review.confidence}` : "等待审查"}
        />
        <BriefTile
          label="执行会怎样"
          value={`${brief?.risk.position_count || 0} 持仓`}
          detail={`暴露 ${formatPercent(brief?.risk.gross_exposure_pct, 1)} · 回撤 ${formatSignedPercent(brief?.risk.current_drawdown, 1)}`}
          tone={(brief?.risk.risk_flags.length || 0) > 0 ? "warn" : "neutral"}
        />
      </div>

      <TradingDisciplinePanel
        calendar={tradingCalendar}
        onOpenSymbol={onOpenSymbol}
        onNavigate={onNavigate}
      />

      <TradeProxyPanel proxy={tradeProxy} />

      <DataTrustPanel
        compact
        title="简报可信度"
        summary="默认只给结论；所有判断都能追溯到数据血缘、同步记录和审查闭环。"
        items={[
          { label: "数据覆盖", value: formatPercent(brief?.trust.coverage, 0), tone: brief?.trust.level === "good" ? "good" : "warn" },
          { label: "缺失表", value: String(brief?.trust.missing_tables.length || 0), tone: brief?.trust.missing_tables.length ? "warn" : "good" },
          { label: "同步记录", value: String(brief?.audit.sync_trace_count || 0) },
          { label: "生成时间", value: brief?.audit.generated_at?.slice(0, 19) || "-" },
        ]}
        warnings={trustWarnings}
        disclaimer={brief?.audit.disclaimer}
      />

      <GovernanceMatrix governance={governance} onNavigate={onNavigate} />

      <div className="brief-layer-grid">
        {(brief?.layers || []).map((layer) => (
          <div className="list-panel brief-layer-card" key={layer.key}>
            <span className="eyebrow">{layer.key}</span>
            <h2>{layer.label}</h2>
            <p>{layer.summary}</p>
          </div>
        ))}
      </div>

      <div className="split-grid">
        <div className="list-panel">
          <div className="section-subhead">
            <h2>下一步</h2>
            <span className="muted">优先级只保留 P0/P1</span>
          </div>
          {(brief?.next_steps || []).map((step) => (
            <button className="brief-step-row" key={`${step.priority}-${step.title}`} onClick={() => onNavigate?.(step.target_view)} type="button">
              <strong>{step.priority}</strong>
              <span>{step.title}</span>
              <em>{step.detail}</em>
            </button>
          ))}
          {!brief && <p className="empty-state">等待简报。</p>}
        </div>

        <div className="list-panel">
          <div className="section-subhead">
            <h2>解释入口</h2>
            <span className="muted">需要细节时再展开</span>
          </div>
          {(brief?.explainers || []).map((item) => (
            <button className="brief-explainer-row" key={item.label} onClick={() => onNavigate?.(item.target_view)} type="button">
              <span>{item.label}</span>
              <strong>{item.value || "-"}</strong>
              <em>{item.detail}</em>
            </button>
          ))}
          {!brief && <p className="empty-state">等待简报。</p>}
        </div>
      </div>

      <div className="table-panel brief-queue-panel">
        <div className="section-subhead">
          <h2>执行队列摘要</h2>
          <span className="muted">只展示最近 8 条，完整列表进入信号审查</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>标的</th>
              <th>信号</th>
              <th>状态</th>
              <th>下一步</th>
            </tr>
          </thead>
          <tbody>
            {(brief?.today.queue_items || []).map((item) => (
              <tr key={item.signal_id}>
                <td>{item.symbol}</td>
                <td>{item.signal_name}</td>
                <td>{executionLabel(item.execution_status)}</td>
                <td>{item.recommended_next_step}</td>
              </tr>
            ))}
            {(brief?.today.queue_items || []).length === 0 && (
              <tr><td colSpan={4}>暂无执行队列</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TradeProxyPanel({ proxy }: { proxy: TradeProxyPayload | null }) {
  const defaultProxy = proxy?.default_proxy;
  return (
    <div className="trade-proxy-panel">
      <div className="section-subhead">
        <div>
          <span className="eyebrow">Execution Proxy</span>
          <h2>可交易代理映射</h2>
        </div>
        <span className={`status-badge ${proxy?.status === "mapped" || proxy?.status === "direct" ? "success-badge" : "muted-badge"}`}>
          {tradeProxyStatusLabel(proxy?.status)}
        </span>
      </div>
      <div className="brief-five-grid proxy-grid">
        <BriefTile
          label="研究标的"
          value={proxy?.symbol || "-"}
          detail={proxy?.asset_type === "index" ? proxy.name || "指数" : "个股可直接映射"}
          tone={proxy?.status === "unmapped" ? "warn" : "good"}
        />
        <BriefTile
          label="默认代理"
          value={defaultProxy?.symbol || "-"}
          detail={defaultProxy ? `${defaultProxy.name} · ${defaultProxy.proxy_type}` : "尚未配置"}
          tone={defaultProxy ? "good" : "warn"}
        />
        <BriefTile
          label="交易市场"
          value={defaultProxy?.market || "-"}
          detail={`${defaultProxy?.currency || "-"} · lot ${defaultProxy?.lot_size ?? "-"}`}
        />
        <BriefTile
          label="成本假设"
          value={defaultProxy?.cost_bps != null ? `${formatNumber(defaultProxy.cost_bps, 2)} bps` : "-"}
          detail="模拟交易成本口径"
        />
        <BriefTile
          label="替代代理"
          value={String(proxy?.alternatives.length || 0)}
          detail="可扩展 ETF/期货/篮子"
        />
      </div>
      <div className="proxy-check-list">
        {(proxy?.execution_checks || []).map((check) => (
          <div className={`proxy-check ${check.status}`} key={check.key}>
            <strong>{check.label}</strong>
            <span>{check.detail}</span>
          </div>
        ))}
        {!proxy && <p className="empty-state">刷新简报后展示代理映射。</p>}
      </div>
      {defaultProxy?.tracking_note && <p className="muted">{defaultProxy.tracking_note}</p>}
    </div>
  );
}

function TradingDisciplinePanel({
  calendar,
  onOpenSymbol,
  onNavigate,
}: {
  calendar: TradingCalendarPayload | null;
  onOpenSymbol?: (symbol: string, date?: string) => void;
  onNavigate?: (view: string) => void;
}) {
  const summary = calendar?.summary;
  const items = calendar?.items || [];
  return (
    <div className="trading-discipline-panel">
      <div className="section-subhead">
        <div>
          <span className="eyebrow">Trading Desk</span>
          <h2>操盘纪律台</h2>
        </div>
        <span className="muted">{calendar ? `${calendar.date} · ${calendar.strategy_version}` : "等待交易计划"}</span>
      </div>

      <div className="trading-discipline-grid">
        <BriefTile
          label="交易计划"
          value={summary ? `${summary.buy_count}/${summary.plan_count}` : "-"}
          detail="可执行 / 全部计划"
          tone={(summary?.buy_count || 0) > 0 ? "good" : "neutral"}
        />
        <BriefTile
          label="禁止交易"
          value={String(summary?.blocked_count ?? "-")}
          detail="风险闸门阻断"
          tone={(summary?.blocked_count || 0) > 0 ? "bad" : "good"}
        />
        <BriefTile
          label="盘中监控"
          value={String(summary?.monitor_count ?? "-")}
          detail="硬止损、追高、止盈和量能"
          tone={(summary?.monitor_count || 0) > 0 ? "warn" : "neutral"}
        />
        <BriefTile
          label="待复盘"
          value={String(summary?.review_due_count ?? "-")}
          detail="观察或审查未闭环"
        />
      </div>

      <div className="trading-plan-list">
        {items.slice(0, 6).map((item) => (
          <button
            className={`trading-plan-row ${item.risk_status}`}
            key={item.signal_id}
            onClick={() => onOpenSymbol?.(item.symbol, item.date)}
            type="button"
          >
            <span className={`status-badge ${item.action === "buy" ? "success-badge" : item.action === "blocked" ? "danger-badge" : "muted-badge"}`}>
              {tradingActionLabel(item.action)}
            </span>
            <strong>{item.symbol} · {item.signal_name}</strong>
            <em>
              入场 {formatPriceRange(item.entry_zone.low, item.entry_zone.high)} · 硬止损 {formatNumber(item.hard_stop, 2)} · 仓位 {formatPercent(item.max_position_pct, 1)}
            </em>
            <small>{item.next_step}</small>
          </button>
        ))}
        {items.length === 0 && (
          <div className="trading-plan-empty">
            <strong>暂无可执行交易计划</strong>
            <span>先完成信号生成与 Agent 审查，系统才会生成入场带、硬止损和盘中监控项。</span>
            <button type="button" onClick={() => onNavigate?.("review")}>进入审查队列</button>
          </div>
        )}
      </div>
    </div>
  );
}

function GovernanceMatrix({
  governance,
  onNavigate,
}: {
  governance: GovernancePayload | null;
  onNavigate?: (view: string) => void;
}) {
  const groups = governance?.groups || { P0: [], P1: [] };
  return (
    <div className="governance-panel">
      <div className="section-subhead">
        <h2>P0/P1 专业治理矩阵</h2>
        <span className="muted">
          {governance
            ? `成熟度 ${formatPercent(governance.summary.maturity_score, 0)} · P0阻断 ${governance.summary.p0_blocker_count}`
            : "等待治理状态"}
        </span>
      </div>
      <div className="governance-summary-grid">
        <BriefTile
          label="P0 就绪"
          value={governance ? `${governance.summary.p0_ready_count}/${governance.summary.p0_total}` : "-"}
          detail={governance?.summary.decision_blocked ? "存在阻断项" : "核心链路可继续"}
          tone={governance?.summary.decision_blocked ? "bad" : "good"}
        />
        <BriefTile
          label="P1 就绪"
          value={governance ? `${governance.summary.p1_ready_count}/${governance.summary.p1_total}` : "-"}
          detail="深度能力成熟度"
        />
        <BriefTile
          label="决策阻断"
          value={governance?.summary.decision_blocked ? "是" : "否"}
          detail={(governance?.hard_blocks || []).map((item) => item.title).join(" / ") || "暂无硬阻断"}
          tone={governance?.summary.decision_blocked ? "bad" : "good"}
        />
      </div>
      <div className="governance-group-grid">
        <GovernanceGroup title="P0 安全完整方案" items={groups.P0} onNavigate={onNavigate} />
        <GovernanceGroup title="P1 专业深度方案" items={groups.P1} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function GovernanceGroup({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: GovernanceItem[];
  onNavigate?: (view: string) => void;
}) {
  return (
    <div className="list-panel governance-group">
      <div className="section-subhead">
        <h2>{title}</h2>
        <span className="muted">{items.filter((item) => item.status === "ready").length}/{items.length} ready</span>
      </div>
      {items.map((item) => (
        <button className={`governance-item ${item.status}`} key={item.key} onClick={() => onNavigate?.(item.target_view)} type="button">
          <span className="status-badge muted-badge">{governanceStatusLabel(item.status)}</span>
          <strong>{item.title}</strong>
          <em>{item.user_impact}</em>
          <small>{item.evidence.join(" · ")}</small>
        </button>
      ))}
      {items.length === 0 && <p className="empty-state">等待治理矩阵。</p>}
    </div>
  );
}

function BriefTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className={`brief-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{detail}</em>
    </div>
  );
}

function trustLabel(level?: string) {
  if (level === "good") return "可用";
  if (level === "blocked") return "禁止下结论";
  return "有缺口";
}

function tradeProxyStatusLabel(status?: string) {
  if (status === "mapped") return "已映射";
  if (status === "direct") return "直接交易";
  if (status === "unmapped") return "待映射";
  return status || "等待映射";
}

function executionLabel(status: string) {
  if (status === "approved") return "已采纳";
  if (status === "blocked") return "已阻断";
  if (status === "executed") return "已执行";
  return "待确认";
}

function tradingActionLabel(action: string) {
  if (action === "buy") return "可执行";
  if (action === "blocked") return "禁止";
  return "观察";
}

function formatPriceRange(low?: number | null, high?: number | null) {
  return `${formatNumber(low, 2)}-${formatNumber(high, 2)}`;
}

function governanceStatusLabel(status: string) {
  if (status === "ready") return "就绪";
  if (status === "blocker") return "阻断";
  return "关注";
}
