// Tab 1 Hero — 决策结论卡 + 5 因子评分树
import { HelpDot, Mono, Segmented } from "../_shared/atoms";
import type {
  DecisionVerdict,
  RegimeContext,
  StrategyMode,
  Tone,
  TripleContext,
} from "../../../types/symbol-workspace";
import { fmtNumber, fmtPct } from "../formatters";
import {
  buildStrategyFactorTooltip,
  buildStrategyScoreTooltip,
} from "../../../components/TradingSignalKline.helpers";

interface Props {
  decision: DecisionVerdict;
  regimeContext?: RegimeContext | null;
  tripleContext?: TripleContext | null;
  onModeChange: (m: StrategyMode) => void;
}

const TONE_TO_HERO: Record<DecisionVerdict["tone"], string> = {
  opportunity: "sw-hero--opportunity",
  warn: "sw-hero--warn",
  risk: "sw-hero--risk",
  neutral: "sw-hero--neutral",
};

const factorTone = (v: number | null): Tone => {
  if (v == null) return "neutral";
  if (v >= 0.7) return "success";
  if (v >= 0.4) return "warning";
  return "danger";
};

const checkSymbol = (tone: Tone): string => {
  if (tone === "success") return "✓";
  if (tone === "warning") return "⚠";
  if (tone === "danger") return "✗";
  return "·";
};

export function HeroDecisionCard({
  decision,
  regimeContext,
  tripleContext,
  onModeChange,
}: Props) {
  // 动作前置：优先展示具体动作短语，理由作为附属列表
  const action = decision.action || decision.reason;
  const scoreTooltip = buildStrategyScoreTooltip({
    score: decision.score,
    mode: decision.mode,
    readiness: decision.readiness,
  });
  const rationale = decision.rationale && decision.rationale.length > 0
    ? decision.rationale
    : decision.reason
      ? [decision.reason]
      : [];
  return (
    <div className={`sw-hero ${TONE_TO_HERO[decision.tone]}`}>
      <div className="sw-hero__left">
        <span className="sw-eyebrow">{decision.eyebrow}</span>
        <h2 className="sw-hero__title">{decision.title}</h2>
        <div
          style={{
            background: "var(--sw-info-bg)",
            border: "1px solid var(--sw-info-border)",
            borderRadius: "var(--sw-r-md)",
            padding: "var(--sw-sp-2) var(--sw-sp-3)",
            margin: "var(--sw-sp-1) 0",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--sw-info)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            推荐动作
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: "20px" }}>
            {action}
          </div>
        </div>

        {/* #3: 高位金叉警告 — 技术看多但估值在历史顶部，最易套人 */}
        {tripleContext?.high_valuation_long_warning && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--sw-danger-bg)",
              border: "1px solid var(--sw-danger-border)",
              borderRadius: "var(--sw-r-md)",
              padding: "var(--sw-sp-2) var(--sw-sp-3)",
              fontSize: 12,
              color: "var(--sw-danger)",
              lineHeight: "18px",
            }}
          >
            <span aria-hidden>⚠</span>
            <span>
              <strong>高位风险</strong>：技术面看多，但估值已处{" "}
              {tripleContext.valuation_label}（历史高位），警惕"高位金叉"接盘
            </span>
          </div>
        )}

        {rationale.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
            aria-label="动作的支撑理由"
          >
            <li
              style={{
                fontSize: 11,
                color: "var(--sw-text-tertiary)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              支撑理由
            </li>
            {rationale.slice(0, 3).map((r, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12,
                  color: "var(--sw-text-secondary)",
                  display: "grid",
                  gridTemplateColumns: "16px 1fr",
                  gap: 6,
                  lineHeight: "18px",
                }}
              >
                <span aria-hidden style={{ color: "var(--sw-info)" }}>·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="sw-hero__controls">
          <Segmented<StrategyMode>
            value={decision.mode}
            options={[
              { value: "conservative", label: "保守模式" },
              { value: "aggressive", label: "激进模式" },
            ]}
            onChange={onModeChange}
            ariaLabel="策略模式"
          />
          <span className="sw-faint" style={{ fontSize: 11 }}>
            激进模式：买入门槛更低（0.45）、单笔仓位上限更高（15%）
          </span>
        </div>
      </div>

      <div className="sw-hero__right">
        <span className="sw-eyebrow sw-help-title">
          5 因子评分 · 弱 &lt; 0.4 &lt; 中 &lt; 0.7 &lt; 强
          <HelpDot label="5 因子评分解释" tooltip={scoreTooltip} />
        </span>
        <div className="sw-score-tree">
          {decision.factors.length === 0 ? (
            <span className="sw-faint" style={{ gridColumn: "1 / -1" }}>
              评分数据缺失，等策略服务恢复
            </span>
          ) : (
            decision.factors.map((f) => {
              const tone = factorTone(f.value);
              const pct = f.value != null ? Math.max(2, f.value * 100) : 0;
              return (
                <Row
                  key={f.key}
                  label={f.key}
                  value={f.value}
                  tone={tone}
                  pct={pct}
                  check={checkSymbol(tone)}
                  tooltip={buildStrategyFactorTooltip({ label: f.key, buy: f.value })}
                />
              );
            })
          )}
        </div>
        <div className="sw-score-summary">
          <div className="sw-score-summary__big">
            <span className="sw-score-summary__score">
              <Mono>
                <strong>{decision.score ?? "-"}</strong>
              </Mono>
              <HelpDot label="买入强度解释" tooltip={scoreTooltip} />
            </span>
            <span>
              买入强度 / 100 · {decision.mode === "aggressive" ? "激进" : "保守"}模式
              买入门槛{" "}
              <Mono>{decision.mode === "aggressive" ? "45" : "55"}</Mono>
            </span>
          </div>
          <div className="sw-score-summary__hint">
            因子完整度{" "}
            <Mono>
              <b className={decision.readiness != null && decision.readiness > 0.7 ? "sw-tone-success" : "sw-tone-warning"}>
                {decision.readiness != null ? `${Math.round(decision.readiness * 100)}%` : "-"}
              </b>
            </Mono>
            <br />
            <span className="sw-faint">
              {decision.readiness == null
                ? "因子数据不足"
                : decision.readiness > 0.7
                  ? "数据覆盖完整，评分参考价值高"
                  : "因子数据不全，决策仅作参考"}
            </span>
          </div>
        </div>

        {/* #2: 当前市场状态下该策略的历史有效性 */}
        {regimeContext && (
          <div
            style={{
              marginTop: "var(--sw-sp-3)",
              paddingTop: "var(--sw-sp-3)",
              borderTop: "1px solid var(--sw-border-subtle)",
              fontSize: 12,
              lineHeight: "18px",
            }}
          >
            <span className="sw-faint">当前市场状态：</span>
            <strong className={`sw-tone-${regimeContext.tone}`}>{regimeContext.label}</strong>
            {regimeContext.regime_win_rate != null ? (
              <span className="sw-muted">
                {" "}· 该策略在此环境历史胜率{" "}
                <Mono className={`sw-tone-${regimeContext.tone}`}>
                  {fmtPct(regimeContext.regime_win_rate, 0)}
                </Mono>
                （{regimeContext.regime_n} 样本
                {regimeContext.overall_win_rate != null && (
                  <>，全样本 {fmtPct(regimeContext.overall_win_rate, 0)}</>
                )}
                ）
                {regimeContext.tone === "warning" && (
                  <span className="sw-tone-warning"> · 此环境策略偏弱，谨慎</span>
                )}
              </span>
            ) : (
              <span className="sw-faint"> · 此环境历史样本不足，胜率不显著</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  pct,
  check,
  tooltip,
}: {
  label: string;
  value: number | null;
  tone: Tone;
  pct: number;
  check: string;
  tooltip: string;
}) {
  return (
    <>
      <span className="sw-score-tree__label">
        <span>{label}</span>
        <HelpDot label={`${label}因子解释`} tooltip={tooltip} />
      </span>
      <div className="sw-score-tree__bar">
        <i className={`sw-tone-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="sw-score-tree__value">{fmtNumber(value, 2)}</span>
      <span className={`sw-score-tree__check sw-tone-${tone}`}>{check}</span>
    </>
  );
}
