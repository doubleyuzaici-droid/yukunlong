// Tab 1 Risk Budget Calculator — 实时联动
// 计算走 utils/risk-budget.ts，纯函数。
import { useState } from "react";
import { Dot, HelpDot, Mono } from "../_shared/atoms";
import type {
  RiskBudgetContext,
  StopMethod,
} from "../../../types/symbol-workspace";
import { computeRiskBudget } from "../../../utils/risk-budget";
import { fmtCny, fmtNumber, fmtPct } from "../formatters";
import { buildRiskBudgetTooltip } from "../../../components/TradingSignalKline.helpers";

interface Props {
  context: RiskBudgetContext;
  defaultCapital?: number;
}

export function RiskBudgetCalc({ context, defaultCapital = 200_000 }: Props) {
  const [capital, setCapital] = useState(defaultCapital);
  const [riskPct, setRiskPct] = useState(0.01);
  const [method, setMethod] = useState<StopMethod>("atr");

  const out = computeRiskBudget(
    { capital, risk_pct: riskPct, stop_method: method },
    context
  );

  const renderMissing = out.status !== "ok";
  const riskTooltip = buildRiskBudgetTooltip({
    method,
    lotSize: context.lot_size ?? 100,
  });

  return (
    <section className="sw-risk">
      <div className="sw-risk__head">
        <div className="sw-risk__title sw-help-title">
          <h3>风险预算 · 单笔交易</h3>
          <HelpDot label="风险预算解释" tooltip={riskTooltip} />
        </div>
        <span className="sw-faint" style={{ fontSize: 11 }}>
          实时估算 · 入场参考 {fmtNumber(context.entry, 2)} / ATR14{" "}
          {fmtNumber(context.atr14 ?? null, 2)}
        </span>
      </div>

      <div className="sw-risk__inputs">
        <div className="sw-risk__input">
          <label htmlFor="rb-capital">投入本金 (¥)</label>
          <input
            id="rb-capital"
            type="number"
            min={0}
            step={10_000}
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value) || 0)}
          />
        </div>
        <div className="sw-risk__input">
          <label htmlFor="rb-risk">单笔风险</label>
          <select
            id="rb-risk"
            value={String(riskPct)}
            onChange={(e) => setRiskPct(Number(e.target.value))}
          >
            <option value="0.005">0.5%</option>
            <option value="0.01">1.0%</option>
            <option value="0.015">1.5%</option>
            <option value="0.02">2.0%</option>
          </select>
        </div>
        <div className="sw-risk__input">
          <div className="sw-risk__label-row">
            <label htmlFor="rb-stop">止损算法</label>
            <HelpDot label="止损算法解释" tooltip={riskTooltip} />
          </div>
          <select
            id="rb-stop"
            value={method}
            onChange={(e) => setMethod(e.target.value as StopMethod)}
          >
            <option value="atr">ATR14 × 2.5</option>
            <option value="support">
              {context.support_price != null
                ? `支撑位 (¥${context.support_price.toFixed(2)})`
                : "支撑位（缺失）"}
            </option>
            <option value="fixed_pct">固定百分比 -7%</option>
          </select>
        </div>
      </div>

      <div className="sw-risk__output">
        <Cell label="建议手数" value={`${out.shares.toLocaleString("zh-CN")} 股`} sub="按 100 股一手" />
        <Cell
          label="建议仓位"
          value={fmtPct(out.position_pct, 1)}
          sub={fmtCny(out.position_value)}
        />
        <Cell
          label="止损价"
          value={out.stop_price > 0 ? `¥${out.stop_price.toFixed(2)}` : "-"}
          sub={`距入场 ${fmtPct(out.stop_pct, 1)}`}
        />
        <Cell
          label="触发止损时"
          value={out.realized_loss > 0 ? `¥-${Math.round(out.realized_loss).toLocaleString("zh-CN")}` : "-"}
          sub={`组合损失 ${fmtPct(out.portfolio_loss_pct, 2)}`}
          danger
        />
      </div>

      {renderMissing && (
        <div className="sw-risk__warn" role="status">
          {out.message ?? "缺少必要输入，输出仅供参考"}
        </div>
      )}

      <div className="sw-risk__footer">
        <Dot tone="info" />
        调整左侧参数将自动重算仓位与止损。
        {context.lot_size !== 100 && (
          <Mono> · 每手 {context.lot_size}</Mono>
        )}
      </div>
    </section>
  );
}

function Cell({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub: string;
  danger?: boolean;
}) {
  return (
    <div className={`sw-risk__cell${danger ? " is-danger" : ""}`}>
      <span className="sw-lbl">{label}</span>
      <Mono className="sw-val">{value}</Mono>
      <Mono className="sw-sub">{sub}</Mono>
    </div>
  );
}
