// 风险预算计算器 — 纯函数
// 对应 bridge §5 RiskBudgetInputs/Context/Output + design brief Tab1 §7.1.4
//
// 落地原则：
// - entry 或 atr14（atr 算法时）缺失 → 返回 status: "missing_inputs"，不抛错
// - 输入非法 → 返回 status: "invalid"
// - 正常输出含整百取整后的 shares + 触发止损时的组合损失 %
import type {
  RiskBudgetContext,
  RiskBudgetInputs,
  RiskBudgetOutput,
} from "../types/symbol-workspace";

const DEFAULT_LOT_SIZE = 100; // A 股一手 = 100 股

export function computeStopPrice(
  inputs: RiskBudgetInputs,
  ctx: RiskBudgetContext
): number | null {
  if (ctx.entry == null || !Number.isFinite(ctx.entry)) return null;
  if (inputs.stop_method === "atr") {
    if (ctx.atr14 == null || !Number.isFinite(ctx.atr14)) return null;
    return ctx.entry - ctx.atr14 * 2.5;
  }
  if (inputs.stop_method === "support") {
    if (ctx.support_price == null) return null;
    return ctx.support_price;
  }
  // fixed_pct
  const pct = ctx.fixed_pct ?? 0.07;
  return ctx.entry * (1 - pct);
}

export function computeRiskBudget(
  inputs: RiskBudgetInputs,
  ctx: RiskBudgetContext
): RiskBudgetOutput {
  const empty: RiskBudgetOutput = {
    shares: 0,
    position_value: 0,
    position_pct: 0,
    stop_price: 0,
    stop_pct: 0,
    total_risk: 0,
    portfolio_loss_pct: 0,
    realized_loss: 0,
    status: "missing_inputs",
  };
  if (ctx.entry == null || !Number.isFinite(ctx.entry) || ctx.entry <= 0) {
    return { ...empty, message: "缺少入场参考价" };
  }
  if (inputs.capital <= 0) {
    return { ...empty, status: "invalid", message: "本金必须 > 0" };
  }
  if (inputs.risk_pct <= 0 || inputs.risk_pct > 1) {
    return { ...empty, status: "invalid", message: "单笔风险应在 (0, 1] 区间" };
  }
  const stopPrice = computeStopPrice(inputs, ctx);
  if (stopPrice == null) {
    return {
      ...empty,
      message:
        inputs.stop_method === "atr"
          ? "ATR14 缺失，无法用 ATR 算法"
          : "支撑位缺失",
    };
  }
  const stopDist = ctx.entry - stopPrice;
  if (stopDist <= 0) {
    return {
      ...empty,
      status: "invalid",
      message: "止损价必须低于入场价",
    };
  }
  const lot = ctx.lot_size ?? DEFAULT_LOT_SIZE;
  const totalRisk = inputs.capital * inputs.risk_pct;
  const rawShares = totalRisk / stopDist;
  const shares = Math.max(lot, Math.floor(rawShares / lot) * lot);
  const positionValue = shares * ctx.entry;
  const positionPct = positionValue / inputs.capital;
  const realizedLoss = shares * stopDist;
  const portfolioLossPct = -realizedLoss / inputs.capital;
  const stopPct = (stopPrice - ctx.entry) / ctx.entry;

  return {
    shares,
    position_value: positionValue,
    position_pct: positionPct,
    stop_price: stopPrice,
    stop_pct: stopPct,
    total_risk: totalRisk,
    portfolio_loss_pct: portfolioLossPct,
    realized_loss: realizedLoss,
    status: "ok",
  };
}
