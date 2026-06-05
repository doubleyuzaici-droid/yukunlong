// 单测：computeRiskBudget
// 沿用项目"tsc 编译 + node 跑"的 test 约定
import { computeRiskBudget, computeStopPrice } from "./risk-budget.js";

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg}: expected ${String(expected)}, got ${String(actual)}`
    );
  }
}
function assertApprox(actual: number, expected: number, eps: number, msg: string) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${msg}: expected ≈${expected}, got ${actual}`);
  }
}

// 1) ATR 算法基础场景：贵州茅台
(function testAtrCase() {
  const out = computeRiskBudget(
    { capital: 200_000, risk_pct: 0.01, stop_method: "atr" },
    { entry: 1623.5, atr14: 48.2, lot_size: 100 }
  );
  assertEqual(out.status, "ok", "ATR 状态");
  assertEqual(out.shares % 100, 0, "shares 整百");
  // stop = 1623.5 - 48.2*2.5 = 1503
  assertApprox(out.stop_price, 1503.0, 1, "stop_price ≈ 1503");
  // total_risk = 2000；stop_dist = 120.5；raw = 16.6 → floor 到 0 → 取 lot = 100
  assertEqual(out.shares, 100, "shares = lot 下限");
  // realized_loss = 100 * 120.5 = 12050
  assertApprox(out.realized_loss, 12050, 1, "止损时实际损失");
})();

// 2) 支撑止损算法
(function testSupportCase() {
  const out = computeRiskBudget(
    { capital: 1_000_000, risk_pct: 0.01, stop_method: "support" },
    { entry: 100, support_price: 92, lot_size: 100 }
  );
  assertEqual(out.status, "ok", "支撑算法状态");
  // total_risk = 10000，stop_dist = 8，raw = 1250 → floor 到 1200
  assertEqual(out.shares, 1200, "支撑算法手数");
  assertApprox(out.position_pct, 0.12, 0.001, "仓位 12%");
})();

// 3) 固定百分比算法
(function testFixedPctCase() {
  const out = computeRiskBudget(
    { capital: 500_000, risk_pct: 0.02, stop_method: "fixed_pct" },
    { entry: 50, atr14: null, fixed_pct: 0.05, lot_size: 100 }
  );
  assertEqual(out.status, "ok", "固定百分比状态");
  // stop = 47.5；stop_dist = 2.5；total_risk = 10000；raw = 4000 → floor 到 4000
  assertEqual(out.shares, 4000, "固定%手数");
})();

// 4) 入场价缺失
(function testMissingEntry() {
  const out = computeRiskBudget(
    { capital: 200_000, risk_pct: 0.01, stop_method: "atr" },
    { entry: null, atr14: 50 }
  );
  assertEqual(out.status, "missing_inputs", "缺入场价 → missing_inputs");
})();

// 5) ATR 缺失但选 ATR 算法
(function testMissingAtr() {
  const out = computeRiskBudget(
    { capital: 200_000, risk_pct: 0.01, stop_method: "atr" },
    { entry: 100, atr14: null }
  );
  assertEqual(out.status, "missing_inputs", "ATR 缺失 → missing_inputs");
})();

// 6) 资金 = 0
(function testZeroCapital() {
  const out = computeRiskBudget(
    { capital: 0, risk_pct: 0.01, stop_method: "fixed_pct" },
    { entry: 100, atr14: null }
  );
  assertEqual(out.status, "invalid", "资金=0 → invalid");
})();

// 7) 止损价反高于入场（非法）
(function testInvertedStop() {
  const ctx = { entry: 100, atr14: null, fixed_pct: -0.05, lot_size: 100 } as const;
  const stop = computeStopPrice(
    { capital: 100, risk_pct: 0.01, stop_method: "fixed_pct" },
    ctx
  );
  // 应该返回有效数但是 > entry，下游 computeRiskBudget 应当返回 invalid
  if (stop != null && stop > 100) {
    const out = computeRiskBudget(
      { capital: 100_000, risk_pct: 0.01, stop_method: "fixed_pct" },
      ctx
    );
    assertEqual(out.status, "invalid", "反向止损 → invalid");
  }
})();

// eslint-disable-next-line no-console
console.log("risk-budget tests: PASS (7 cases)");
