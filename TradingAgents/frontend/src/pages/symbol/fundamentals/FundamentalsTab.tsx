// Tab 3 基本面 & 催化剂 — 2x2 panel grid
// 估值百分位与 8 季度财务图未接入时走 partial 态占位
import { useState } from "react";
import { Pill, Skeleton } from "../_shared/atoms";
import { AsyncBoundary } from "../_shared/AsyncBoundary";
import type {
  ConsensusModel,
  Disclosure,
  InstitutionalDesk,
  HoldingConcentrationModel,
  QualityMetricsModel,
  SymbolFundamentalsPayload,
  ValuationPercentile,
  FinancialSeries,
  NorthboundSeries,
} from "../../../types/symbol-workspace";
import { useSymbolFundamentals } from "../../../api/symbol-workspace/hooks";
import { syncFundamentals } from "../../../api/symbol-workspace/fetchers";
import { fmtCompact, fmtNumber, fmtPct } from "../formatters";

interface Props {
  symbol: string;
  date: string;
}

function FundamentalsSkeleton() {
  return (
    <div className="sw-fund-grid">
      <Skeleton height={260} />
      <Skeleton height={260} />
      <Skeleton height={260} />
      <Skeleton height={260} />
    </div>
  );
}

export function FundamentalsTab({ symbol, date }: Props) {
  const { state, reload } = useSymbolFundamentals(symbol, date);
  return (
    <AsyncBoundary<SymbolFundamentalsPayload>
      state={state}
      skeleton={<FundamentalsSkeleton />}
      emptyTitle="暂无基本面数据"
      emptyHint="未运行基本面同步流水线"
    >
      {(data) => (
        <div className="sw-fund-grid">
          {/* #4: 卖方一致预期 — 跨列置顶，投研高优先级 */}
          <div style={{ gridColumn: "1 / -1" }}>
            <ConsensusPanel consensus={data.consensus} />
          </div>
          <ValuationPanel items={data.valuation} />
          <FinancialPanel
            date={date}
            onSynced={reload}
            series={data.financials}
            symbol={symbol}
          />
          <QualityPanel quality={data.quality} />
          <DisclosurePanel items={data.disclosures} />
          <HoldingPanel holding={data.holding} />
          <InstitutionalPanel
            northbound={data.northbound}
            desks={data.institutional}
          />
        </div>
      )}
    </AsyncBoundary>
  );
}

// ============================================================
// #4: 卖方一致预期（评级分布 + 覆盖机构 + 一致预期 EPS/目标价）
// ============================================================
const RATING_TONE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  买入: "success",
  增持: "info",
  中性: "warning",
  减持: "danger",
  其它: "neutral",
};

function ConsensusPanel({ consensus }: { consensus: ConsensusModel | null }) {
  if (!consensus) {
    return (
      <div className="sw-panel">
        <div className="sw-panel__head">
          <h3>卖方观点 · 一致预期</h3>
          <small>近 90 日研报聚合</small>
        </div>
        <div className="sw-empty" style={{ padding: "var(--sw-sp-3)" }}>
          <strong style={{ fontSize: 12 }}>近期无研报覆盖</strong>
          <span style={{ fontSize: 11 }}>该标的近 90 日暂无卖方研报，或数据尚未同步</span>
        </div>
      </div>
    );
  }
  const totalRated = consensus.rating_distribution.reduce((s, r) => s + r.count, 0);
  return (
    <div className="sw-panel">
      <div className="sw-panel__head">
        <h3>卖方观点 · 一致预期</h3>
        <small>
          近 90 日 · {consensus.org_count} 家机构 · {consensus.total_reports} 篇研报
          （近 30 日 {consensus.recent_30d_count} 篇）
        </small>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr",
          gap: "var(--sw-sp-4)",
          alignItems: "center",
        }}
      >
        {/* 评级分布堆叠条 */}
        <div>
          <div className="sw-faint" style={{ fontSize: 11, marginBottom: 6 }}>
            评级分布（按机构去重取最新）
          </div>
          <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "var(--sw-bg-input)" }}>
            {consensus.rating_distribution.map((r) => (
              <div
                key={r.rating}
                title={`${r.rating} ${r.count} 家`}
                style={{
                  width: totalRated > 0 ? `${(r.count / totalRated) * 100}%` : "0",
                  background: `var(--sw-${RATING_TONE[r.rating] ?? "neutral"})`,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sw-sp-3)", marginTop: 6 }}>
            {consensus.rating_distribution.map((r) => (
              <span key={r.rating} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: `var(--sw-${RATING_TONE[r.rating] ?? "neutral"})`,
                    display: "inline-block",
                  }}
                />
                <span className="sw-muted">{r.rating}</span>
                <span className="sw-mono" style={{ fontWeight: 600 }}>{r.count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* 一致预期 EPS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="sw-faint" style={{ fontSize: 11 }}>一致预期 EPS</span>
          <span className="sw-mono" style={{ fontSize: 18, fontWeight: 600 }}>
            {consensus.eps_consensus != null ? fmtNumber(consensus.eps_consensus, 2) : "-"}
          </span>
          <span className="sw-faint" style={{ fontSize: 11 }}>
            {consensus.eps_consensus != null ? "近 90 日研报均值" : "机构未披露 EPS"}
          </span>
        </div>

        {/* 目标价（该数据源多数无目标价，诚实标注）*/}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="sw-faint" style={{ fontSize: 11 }}>一致预期目标价</span>
          <span className="sw-mono" style={{ fontSize: 18, fontWeight: 600 }}>
            {consensus.target_price_avg != null ? `¥${fmtNumber(consensus.target_price_avg, 2)}` : "暂无"}
          </span>
          <span className="sw-faint" style={{ fontSize: 11 }}>
            {consensus.target_price_avg != null ? "研报均值" : "多数机构未披露目标价"}
          </span>
        </div>
      </div>

      <div className="sw-faint" style={{ fontSize: 11, marginTop: "var(--sw-sp-3)", paddingTop: "var(--sw-sp-3)", borderTop: "1px solid var(--sw-border-subtle)" }}>
        {consensus.revision_hint
          ? `预期修正：${consensus.revision_hint}`
          : "预期修正方向需积累历史快照后启用（多次同步后对比）"}
      </div>
    </div>
  );
}

// ============================================================
// 估值定位
// ============================================================
function ValuationPanel({ items }: { items: ValuationPercentile[] }) {
  return (
    <div className="sw-panel">
      <div className="sw-panel__head">
        <h3>估值定位</h3>
        <small>行业百分位 · 自身历史百分位（近 5 年）</small>
      </div>
      {items.length === 0 ? (
        <div className="sw-empty" style={{ padding: "var(--sw-sp-3)" }}>
          <strong style={{ fontSize: 12 }}>估值百分位暂未支持</strong>
          <span style={{ fontSize: 11 }}>该标的历史样本不足或行业横截面缺失</span>
        </div>
      ) : (
        items.map((item) => (
          <div className="sw-valuation-row" key={item.name}>
            <span className="sw-name">
              {item.name}
              <b>{item.value}</b>
            </span>
            <div className="sw-bar">
              {item.industry_pct != null && (
                <>
                  <i style={{ width: `${item.industry_pct * 100}%` }} />
                  <small>行业 {Math.round(item.industry_pct * 100)}%</small>
                </>
              )}
            </div>
            <span className="sw-axis-label">vs 自身</span>
            <div className="sw-bar">
              {item.history_pct != null && (
                <>
                  <i
                    style={{
                      width: `${item.history_pct * 100}%`,
                      background: "var(--sw-success)",
                    }}
                  />
                  <small>历史 {Math.round(item.history_pct * 100)}%</small>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================
// 财务序列（8 季度）
// ============================================================
type SyncMessage = {
  tone: "success" | "warning" | "danger" | "info";
  text: string;
};

function FinancialPanel({
  date,
  onSynced,
  series,
  symbol,
}: {
  date: string;
  onSynced: () => void;
  series: FinancialSeries;
  symbol: string;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<SyncMessage | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage({ tone: "info", text: "正在同步季度财报" });
    try {
      const result = await syncFundamentals(symbol, date, "yfinance"); // copy-lint:ignore 数据源参数，非用户文案
      const statementRows = result.statement_rows_written ?? 0;
      if (statementRows > 0) {
        setSyncMessage({
          tone: "success",
          text: `已同步 ${statementRows} 条财报记录，正在刷新`,
        });
        onSynced();
      } else {
        const firstError = result.failures?.[0]?.error;
        setSyncMessage({
          tone: "warning",
          text: firstError
            ? `数据源未返回可解析财报：${firstError}`
            : "数据源暂无可解析财报",
        });
      }
    } catch (error) {
      setSyncMessage({
        tone: "danger",
        text: error instanceof Error ? error.message : "财报同步失败",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (series.quarters.length === 0) {
    return (
      <div className="sw-panel">
        <div className="sw-panel__head">
          <h3>财务走势 · 近 8 季度</h3>
          <small>季度三表</small>
        </div>
        <div className="sw-empty" style={{ padding: "var(--sw-sp-3)" }}>
          <strong style={{ fontSize: 12 }}>暂无财务时间序列</strong>
          <span style={{ fontSize: 11 }}>可先同步该标的季度财报</span>
          <button
            className="sw-btn sw-btn--primary sw-btn--mini"
            disabled={syncing}
            onClick={handleSync}
            type="button"
          >
            {syncing ? "同步中" : "同步财报"}
          </button>
          {syncMessage && (
            <span className={`sw-fin-sync-message sw-tone-${syncMessage.tone}`}>
              {syncMessage.text}
            </span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="sw-panel">
      <div className="sw-panel__head">
        <h3>财务走势 · 近 {series.quarters.length} 季度</h3>
        <small>同比口径 · 最新季：{series.quarters[series.quarters.length - 1] ?? "-"}</small>
      </div>
      <div className="sw-fin-charts">
        <FinChart title="营收 (亿)" values={series.revenue} unit="亿" />
        <FinChart title="净利润 (亿)" values={series.net_profit} unit="亿" />
        <FinChart title="ROE %" values={series.roe} unit="%" line />
      </div>
    </div>
  );
}

function FinChart({
  title,
  values,
  unit,
  line,
}: {
  title: string;
  values: (number | null)[];
  unit: string;
  line?: boolean;
}) {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  const latest = finite[finite.length - 1] ?? null;
  const prev = finite[finite.length - 2] ?? null;
  const yoy = latest != null && prev != null && prev !== 0 ? (latest - prev) / Math.abs(prev) : null;
  const max = finite.length ? Math.max(...finite) : 0;
  const min = finite.length ? Math.min(...finite, 0) : 0;
  const range = max - min || 1;
  const w = 80;
  const h = 60;
  const barW = w / Math.max(values.length, 1);

  return (
    <div className="sw-fin-chart">
      <h4>{title}</h4>
      <div className="sw-latest">
        {latest != null ? latest.toFixed(latest >= 100 ? 0 : 1) : "-"}
        {yoy != null && (
          <span className={`sw-yoy sw-tone-${yoy >= 0 ? "success" : "danger"}`} style={{ marginLeft: 6 }}>
            {yoy >= 0 ? "+" : ""}
            {(yoy * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
        {line ? (
          <polyline
            points={values
              .map((v, i) => {
                if (v == null) return null;
                const x = i * barW + barW / 2;
                const y = h - ((v - min) / range) * (h - 4) - 2;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .filter(Boolean)
              .join(" ")}
            fill="none"
            stroke="var(--sw-success)"
            strokeWidth={1.5}
          />
        ) : (
          values.map((v, i) => {
            if (v == null) return null;
            const heightPx = ((v - min) / range) * (h - 4);
            const y = h - heightPx - 2;
            const isLast = i === values.length - 1;
            return (
              <rect
                key={i}
                x={i * barW + 1}
                y={y}
                width={barW - 2}
                height={heightPx}
                rx={1}
                fill={isLast ? "var(--sw-success)" : "var(--sw-info)"}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

// ============================================================
// 盈利质量 / 现金流
// ============================================================
function QualityPanel({ quality }: { quality: QualityMetricsModel | null }) {
  if (!quality) {
    return (
      <div className="sw-panel">
        <div className="sw-panel__head">
          <h3>盈利质量 · 现金流</h3>
          <small>毛利率 · 现金流 · 杠杆</small>
        </div>
        <div className="sw-empty" style={{ padding: "var(--sw-sp-3)" }}>
          <strong style={{ fontSize: 12 }}>暂无盈利质量数据</strong>
          <span style={{ fontSize: 11 }}>需要同步利润表、资产负债表和现金流表</span>
        </div>
      </div>
    );
  }
  return (
    <div className="sw-panel">
      <div className="sw-panel__head">
        <h3>盈利质量 · 现金流</h3>
        <small>
          质量分{" "}
          <span className="sw-mono">
            {quality.score != null ? Math.round(quality.score * 100) : "-"}
          </span>
        </small>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "var(--sw-sp-3)",
        }}
      >
        {quality.metrics.map((metric) => (
          <div
            key={metric.key}
            style={{
              borderBottom: "1px dashed var(--sw-border-subtle)",
              paddingBottom: 8,
            }}
          >
            <span className="sw-faint" style={{ display: "block", fontSize: 11 }}>
              {metric.label}
            </span>
            <strong className={`sw-mono sw-tone-${metric.tone}`} style={{ fontSize: 15 }}>
              {formatQualityMetric(metric)}
            </strong>
          </div>
        ))}
      </div>
      {quality.flags.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginTop: "var(--sw-sp-3)" }}>
          {quality.flags.slice(0, 3).map((flag) => (
            <div
              key={flag.key}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "var(--sw-sp-2)",
                alignItems: "start",
                fontSize: 12,
              }}
            >
              <Pill tone={flag.tone}>{flag.label}</Pill>
              <span className="sw-muted">{flag.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatQualityMetric(metric: QualityMetricsModel["metrics"][number]) {
  if (metric.value == null) return "-";
  if (metric.unit === "currency") return fmtCompact(metric.value, 1);
  if (metric.unit === "score") return Math.round(metric.value * 100).toString();
  return fmtPct(metric.value, 1);
}

// ============================================================
// 持仓结构 / 筹码集中度
// ============================================================
function HoldingPanel({ holding }: { holding: HoldingConcentrationModel | null }) {
  if (!holding) {
    return (
      <div className="sw-panel">
        <div className="sw-panel__head">
          <h3>持仓结构 · 筹码</h3>
          <small>北向 · 公募 · 股东户数</small>
        </div>
        <div className="sw-empty" style={{ padding: "var(--sw-sp-3)" }}>
          <strong style={{ fontSize: 12 }}>暂无筹码集中度数据</strong>
          <span style={{ fontSize: 11 }}>可先运行持仓结构同步任务</span>
        </div>
      </div>
    );
  }
  return (
    <div className="sw-panel">
      <div className="sw-panel__head">
        <h3>持仓结构 · 筹码</h3>
        <small>
          集中度{" "}
          <span className="sw-mono">
            {holding.score != null ? Math.round(holding.score * 100) : "-"}
          </span>
        </small>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {holding.items.map((item) => (
          <div
            key={item.key}
            style={{
              display: "grid",
              gridTemplateColumns: "92px 1fr auto",
              gap: "var(--sw-sp-3)",
              alignItems: "center",
              paddingBottom: 8,
              borderBottom: "1px dashed var(--sw-border-subtle)",
              fontSize: 12,
            }}
          >
            <span className="sw-faint">{item.label}</span>
            <span className="sw-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.detail}
            </span>
            <strong className={`sw-mono sw-tone-${item.tone}`}>
              {formatHoldingItem(item)}
            </strong>
          </div>
        ))}
      </div>
      <div
        className="sw-faint"
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "var(--sw-sp-3)",
          fontSize: 11,
        }}
      >
        <span>公募重仓 {holding.fund_count != null ? `${holding.fund_count} 只` : "-"}</span>
        <span>股东户数 {holding.shareholder_count != null ? fmtCompact(holding.shareholder_count, 1) : "-"}</span>
      </div>
    </div>
  );
}

function formatHoldingItem(item: HoldingConcentrationModel["items"][number]) {
  if (item.value == null) return "-";
  return fmtPct(item.value, 1);
}

// ============================================================
// 公告 / 研报（A 级 — news_evidence 直接转换）
// ============================================================
const FILTERS: { label: string; tag?: Disclosure["tag"] }[] = [
  { label: "全部" },
  { label: "业绩", tag: "业绩" },
  { label: "研报", tag: "研报" },
  { label: "监管", tag: "监管" },
  { label: "评级", tag: "评级" },
  { label: "公告", tag: "公告" },
];

function DisclosurePanel({ items }: { items: Disclosure[] }) {
  const [activeTag, setActiveTag] = useState<Disclosure["tag"] | "全部">("全部");
  const filtered = activeTag === "全部" ? items : items.filter((it) => it.tag === activeTag);
  return (
    <div className="sw-panel">
      <div className="sw-panel__head">
        <h3>公告 · 研报 · 政策</h3>
        <small>{items.length} 条 · 近 30 日</small>
      </div>
      <div className="sw-disclosure-filters">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={`sw-chip${(f.tag ?? "全部") === activeTag ? " is-active" : ""}`}
            onClick={() => setActiveTag((f.tag ?? "全部") as Disclosure["tag"] | "全部")}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="sw-disclosure-list">
        {filtered.length === 0 && (
          <div className="sw-empty" style={{ padding: "var(--sw-sp-3)" }}>
            <strong style={{ fontSize: 12 }}>暂无{activeTag === "全部" ? "公告" : activeTag}</strong>
          </div>
        )}
        {filtered.slice(0, 12).map((it) => (
          <div className="sw-disclosure-row" key={`${it.date}-${it.title}`}>
            <span className="sw-date">{it.date.slice(5)}</span>
            <Pill tone={it.tone}>{it.tag}</Pill>
            <div className="sw-disclosure-main">
              {it.url ? (
                <a href={it.url} target="_blank" rel="noreferrer">
                  {it.title}
                </a>
              ) : (
                <strong>{it.title}</strong>
              )}
              {(it.summary || it.source || it.credibility != null) && (
                <small>
                  {it.summary || "暂无摘要"}
                  {it.source ? ` · 来源 ${it.source}` : ""}
                  {it.credibility != null ? ` · 可信度 ${fmtPct(it.credibility, 0)}` : ""}
                </small>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 机构动作 / 北向曲线
// ============================================================
function InstitutionalPanel({
  northbound,
  desks,
}: {
  northbound: NorthboundSeries;
  desks: InstitutionalDesk[];
}) {
  const hasSeries = northbound.series.length >= 2;
  const latest = northbound.series[northbound.series.length - 1];
  const first = northbound.series[0];
  const delta = hasSeries && latest != null && first != null ? latest - first : null;

  return (
    <div className="sw-panel">
      <div className="sw-panel__head">
        <h3>机构动作 · 北向</h3>
        <small>
          近 30 日 · 截至{" "}
          {northbound.end_date
            ? northbound.end_date
            : new Date().toISOString().slice(0, 10)}
        </small>
      </div>
      <div style={{ marginBottom: "var(--sw-sp-3)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--sw-text-secondary)",
            marginBottom: 4,
          }}
        >
          <span>北向累计净流入（近似持股变化）</span>
          {delta != null && (
            <span
              className={`sw-mono sw-tone-${delta >= 0 ? "success" : "danger"}`}
            >
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)} 亿 ({northbound.series.length}D)
            </span>
          )}
        </div>
        {hasSeries ? (
          <NorthboundChart values={northbound.series.filter((v): v is number => v != null)} />
        ) : (
          <div className="sw-empty" style={{ padding: "var(--sw-sp-3)" }}>
            <strong style={{ fontSize: 12 }}>暂无北向资金数据</strong>
            <span style={{ fontSize: 11 }}>请先同步该标的的资金流数据</span>
          </div>
        )}
      </div>

      <h4 className="sw-faint" style={{ fontSize: 11, marginTop: "var(--sw-sp-3)" }}>
        龙虎榜机构席位
      </h4>
      {desks.length === 0 ? (
        <div className="sw-empty" style={{ padding: "var(--sw-sp-3)", marginTop: 6 }}>
          <strong style={{ fontSize: 12 }}>暂无龙虎榜记录</strong>
          <span style={{ fontSize: 11 }}>近 30 日该标的未上榜，或数据尚未同步</span>
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          {desks.slice(0, 8).map((d) => (
            <div
              key={`${d.date}-${d.name}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "var(--sw-sp-3)",
                padding: "6px 0",
                borderBottom: "1px dashed var(--sw-border-subtle)",
                alignItems: "center",
                fontSize: 12,
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.name}
              </span>
              <Pill tone={d.tag === "北向" ? "success" : "info"}>{d.tag}</Pill>
              <span
                className={`sw-mono sw-tone-${(d.net ?? 0) >= 0 ? "success" : "danger"}`}
                style={{ fontWeight: 600 }}
              >
                {d.net != null
                  ? `${d.net >= 0 ? "+" : ""}${fmtCompact(d.net, 1)}`
                  : "-"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NorthboundChart({ values }: { values: number[] }) {
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const step = w / Math.max(values.length - 1, 1);
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)},${(h - ((v - min) / range) * (h - 2) - 1).toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${w},${h} L 0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 60, display: "block" }} aria-hidden>
      <defs>
        <linearGradient id="sw-nb-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--sw-success)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--sw-success)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sw-nb-grad)" />
      <path d={path} fill="none" stroke="var(--sw-success)" strokeWidth={1} />
    </svg>
  );
}
