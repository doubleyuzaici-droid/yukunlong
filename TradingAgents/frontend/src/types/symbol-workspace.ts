// Symbol Workspace V2 — 数据契约 (TypeScript)
// 来源：~/Downloads/handoff/symbol-workspace.types.ts
// 修改：按 docs/plans/2026-05-23-symbol-workspace-v2-handoff-bridge.md §8
//       把数字字段 relax 为 `| null`，与 src/types/market.ts 对齐
//
// 落地原则：
// - 数字字段一律允许 null（缺失即 null，不允许塞 0 假装有数据）
// - UI 渲染 null 时统一走 "-" / partial 态
// - 后端无字段时，mapper 必须返回 null + 在 AsyncState 的 missing 里记录

import type { MarketContextPayload, MarketHistoryPayload } from "./market";

// =============================================================================
// 0. Atoms
// =============================================================================

/** 语义色调 — 全站只允许这 5 个，不要新增 */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** 决策结论的整体倾向 */
export type DecisionTone = "opportunity" | "neutral" | "warn" | "risk";

/** V2 策略模式 */
export type StrategyMode = "conservative" | "aggressive";

/** 数据时效 */
export type DataFreshness = "live" | "delayed" | "closed";

/** 时间维度 — 用于指标矩阵分栏 */
export type TimeHorizon = "short" | "mid" | "long";

/** 复权方式 */
export type AdjustMode = "forward" | "none" | "back";

// =============================================================================
// 1. Symbol Profile (顶部画像条)
// =============================================================================

export interface SymbolProfile {
  industry: string;            // "白酒 · 高端白酒"
  sub_industry?: string;
  market_cap_yi: number | null;       // 单位：亿
  free_float_yi: number | null;
  turnover_pct: number | null;        // 0..1
  pe_ttm: number | null;
  pe_industry_pct: number | null;     // 0..1 行业百分位
  pb: number | null;
  dividend_yield: number | null;      // 0..1
  flags: string[];             // ["ST"], ["停牌"], ["次新"], ["上市15年"]…
}

export interface SymbolHeader {
  symbol: string;              // "600519.SH"
  name: string;                // "贵州茅台"
  price: number | null;
  change: number | null;       // 绝对值
  change_pct: number | null;   // 0..±1
  freshness_label: string;     // "2026-05-23 14:32 · 延迟 3 分钟"
  freshness: DataFreshness;
  intraday: {
    open: number | null;
    high: number | null;
    low: number | null;
    prev_close: number | null;
  };
}

// =============================================================================
// 2. Decision Card (Tab 1 现状速览 - Hero)
// =============================================================================

export interface FactorScore {
  key: string;                 // "趋势" | "动能" | "量能" | "大盘" | "资金"
  value: number | null;        // 0..1
  tone: Tone;                  // 来自后端阈值判定，不在前端硬编码
}

export interface DecisionVerdict {
  eyebrow: string;             // "多指标共振策略 · 保守模式 · 2026-05-23"
  title: string;               // "观察等待，趋势确认中"
  tone: DecisionTone;
  /** 推荐动作 — 动词 + 宾语，研究员 2 秒内可识别。
   *  例："等待回踩 ¥1,580 (EMA89) 再评估" / "进入审查并设置 ¥38 止损" */
  action?: string;
  /** 动作的支撑理由 — 简短列表，每条一行 */
  rationale?: string[];
  /** @deprecated 旧 schema 兜底字段，前端在 action 缺失时回落到此 */
  reason: string;
  mode: StrategyMode;
  /** 买入强度 0..100，null = 数据不足 */
  score: number | null;
  factors: FactorScore[];      // 5 项；不要在前端补全
  /** 因子完整度 0..1 — 影响"评分是否可信"的提示 */
  readiness: number | null;
}

// =============================================================================
// 3. Narrative (多头叙事 / 证伪条件)
// =============================================================================

export interface FalsifyClause {
  /** 触发条件原文。语法应与 bull 镜像，例：
   *    bull:    "EMA21/89 多头排列"
   *    falsify: "EMA21 跌破 EMA89"
   */
  text: string;
  occurred: boolean;
  /** 已发生的话，持续了几天 */
  occurred_for_days?: number;
  /** 对应的 bull 句序号（用于 UI 强对仗展示） */
  mirror_of?: number;
}

export interface SymbolNarrative {
  bull: string[];              // ≤ 5 条；过多请截断并显示「+N 条」
  falsify: FalsifyClause[];
}

// =============================================================================
// 4. Indicator Matrix (按时间维度)
// =============================================================================

export interface IndicatorRow {
  label: string;               // "RSI14"
  value: string;               // 已格式化的字符串，含单位（"67.3" / "+2 亿"）
  tone: Tone;
  /** 20 个点的时间序列，用于 sparkline；缺失时不画 */
  spark?: number[];
  /** hover 时显示的完整序列 + 阈值线 */
  tooltip?: {
    series: { t: string; v: number }[];
    thresholds?: { label: string; value: number; tone: Tone }[];
  };
}

export interface IndicatorColumn {
  horizon: TimeHorizon;
  title: string;               // "短线 5–20D"
  subtitle: string;            // "决定进出场"
  items: IndicatorRow[];
}

// =============================================================================
// 5. Risk Budget Calculator
// =============================================================================

export type StopMethod = "atr" | "support" | "fixed_pct";

export interface RiskBudgetInputs {
  capital: number;             // 组合资金 ¥
  risk_pct: number;            // 单笔风险 0..1
  stop_method: StopMethod;
}

export interface RiskBudgetContext {
  entry: number | null;        // 入场参考价
  atr14?: number | null;       // ATR14 — 仅 atr 算法必填
  support_price?: number | null; // 支撑止损算法用
  fixed_pct?: number;          // 固定百分比算法用，默认 0.07
  lot_size?: number;           // 每手股数，A 股默认 100
}

/** 这是一个 *纯函数* 的输出 — 实现于 utils/risk-budget.ts */
export interface RiskBudgetOutput {
  shares: number;              // 整百
  position_value: number;      // shares * entry
  position_pct: number;        // position_value / capital
  stop_price: number;
  stop_pct: number;            // (stop - entry) / entry，负数
  total_risk: number;          // capital * risk_pct
  portfolio_loss_pct: number;  // -total_risk / capital
  realized_loss: number;       // shares * (entry - stop_price)
  risk_reward_ratio?: number;  // 若给了目标价，可算
  /** 若 entry/atr14 缺失返回 null 状态 */
  status: "ok" | "missing_inputs" | "invalid";
  message?: string;
}

// =============================================================================
// 6. K-line + Signals + Catalysts (Tab 2)
// =============================================================================

export interface Candle {
  /** 交易日序号，对应 trading_date */
  i: number;
  trading_date: string;        // "2026-05-23"
  open: number | null;
  close: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
}

export interface SignalMarker {
  /** 落在哪一根 K 线上 */
  i: number;
  kind: "buy" | "sell" | "warn" | "reduce" | "add";
  label: string;               // "V2 买入 (62)"
  score?: number | null;       // 0..1
  /** hover 详情 */
  detail?: {
    rationale: string;
    factors: FactorScore[];
  };
}

export interface ChartSignalHistoryRow {
  signal_id: string;
  date: string;
  symbol: string;
  signal_name: string;
  signal_level?: string;
  direction?: string;
  evidence_json?: string;
  risk_json?: string;
  invalid_json?: string;
  score?: number | null;
  review_count?: number;
  event_return?: {
    entry_date?: string | null;
    entry_price?: number | null;
    ret_5d?: number | null;
    ret_20d?: number | null;
    ret_60d?: number | null;
    max_adverse_20d?: number | null;
  } | null;
}

export type CatalystType =
  | "earnings"        // 财报
  | "research"        // 研报
  | "policy"          // 政策
  | "lhb"             // 龙虎榜
  | "disclosure"      // 业绩预披露
  | "unlock"          // 解禁
  | "industry"        // 行业事件
  | "dividend"
  | "meeting";

export interface Catalyst {
  date: string;                // ISO 日期
  /** 距今天的偏移天数；负数=过去，正数=未来。也可在前端从 date 算 */
  offset_days: number;
  type: CatalystType;
  title: string;
  tone: Tone;
  /** 已发生事件 = true；未来事件 = false */
  occurred: boolean;
  note?: string;               // 一行摘要，hover 显示
  source_url?: string;
}

export interface CatalystTimeline {
  past: Catalyst[];            // occurred=true
  future: Catalyst[];          // occurred=false
  /** 未来事件展示窗口（天）— 默认 30 */
  future_window_days: number;
}

// =============================================================================
// 7. Fundamentals (Tab 3)
// =============================================================================

export interface ValuationPercentile {
  name: "PE TTM" | "PB" | "PS" | "EV/EBITDA";
  value: string;               // 已格式化
  raw_value: number | null;    // 原始数值，用于排序/对比
  industry_pct: number | null; // 0..1
  history_pct: number | null;  // 0..1
}

export interface FinancialSeries {
  quarters: string[];          // ["24Q2", ..., "26Q1"]
  revenue: (number | null)[];  // 亿
  net_profit: (number | null)[]; // 亿
  roe: (number | null)[];      // 0..100
  /** 还可扩展：fcf, gross_margin 等 */
}

export interface Disclosure {
  date: string;
  /** 用于筛选 chips */
  tag: "业绩" | "研报" | "评级" | "公告" | "监管" | "重组";
  tone: Tone;
  title: string;
  source?: string;
  credibility?: number | null;
  summary?: string | null;
  /** 点击跳转 */
  url?: string;
}

export interface InstitutionalDesk {
  name: string;                // "中金公司·上海分公司"
  /** 净买入金额，单位元 */
  net: number | null;
  /** 北向 vs 普通机构席位 */
  tag: "北向" | "机构";
  date: string;
}

export interface NorthboundSeries {
  /** 累计净流入序列，亿 — 末位即最新 */
  series: (number | null)[];
  dates: string[];             // 与 series 等长
  start_date: string;
  end_date: string;
  /** 是 inflow 累加（近似）还是实际持股 */
  source: "cumulative_inflow" | "actual_holding";
}

// =============================================================================
// 8. Playbook (Tab 4 决策与复盘)
// =============================================================================

export interface AgentReview {
  verdict: string;             // "观察等待" | "建议进场" | "暂缓"
  tone: Tone;
  summary: string;             // ≤ 100 字
  issued_at: string;
  /** Agent 推理链；点击展开 */
  trace_url?: string;
}

export interface SignalDetail {
  id: string;                  // "V2-RES-0523"
  title: string;
  issued_at: string;
  score: number | null;        // 0..1
  evidence: string[];
  risks: string[];
  invalidate: string[];        // 失效条件
  agent: AgentReview | null;
}

/** #2: 单个市场状态(regime)下的后验统计 */
export interface RegimeWinRate {
  regime: string;              // 原始 regime 标识（如 "range_bound"）
  label: string;               // 中文标签（如 "震荡市"）
  n: number;
  win_rate: number | null;
  avg_20d: number | null;
  /** 是否是当前所处的市场状态 */
  is_current: boolean;
}

export interface BacktestSummary {
  n: number;
  win: number;
  loss: number;
  win_rate: number | null;     // 0..1
  avg_5d: number | null;       // 0..±1
  avg_20d: number | null;
  avg_60d: number | null;
  max_adverse: number | null;  // MAE，负数
  profit_factor?: number | null;
  /** 累积收益曲线 — N 个采样点，X 由 start/end 算 */
  curve: number[];
  curve_start: string;
  curve_end: string;
  /** 样本质量等级 — 用于在样本不足时降级提示 */
  sample_quality: "A" | "B" | "C" | "insufficient";
  /** #2: 按市场状态切分的胜率 */
  by_regime: RegimeWinRate[];
}

export interface PlaybookSignalRow {
  id: string;
  date: string;
  name: string;
  level?: string;
  direction?: string;
  score: number | null;
  review_count: number;
  ret20d: number | null;
  max_adverse20d: number | null;
}

export interface PlaybookRecentBar {
  date: string;
  close: number | null;
  change_pct: number | null;
  volume: number | null;
}

export interface AnalystNote {
  id: string;
  timestamp: string;           // ISO；前端格式化为「2 分钟前」等
  body: string;                // 支持 #标签，渲染时正则提取
  pinned: boolean;
  tags: string[];              // 从 body 自动提取
  author_id?: string;
}

// =============================================================================
// 9. Watchlist (左导航)
// =============================================================================

export type NavGroupKind = "favorites" | "opportunities" | "risks" | "recent";

export interface NavItem {
  symbol: string;              // "600519.SH"
  name: string;
  tone: Tone;                  // 决定圆点颜色
  /** 尾部 metric — 根据组类型不同 */
  trailing:
    | { kind: "change_pct"; value: number | null }
    | { kind: "score"; value: number | null }
    | { kind: "flag"; text: string }
    | { kind: "viewed_at"; text: string };
  active?: boolean;
}

export interface NavData {
  favorites: NavItem[];
  opportunities: NavItem[];
  risks: NavItem[];
  recent: NavItem[];
}

// =============================================================================
// 10. Status Banner (顶部数据状态横幅)
// =============================================================================

export interface DataStatus {
  kind: "ok" | "partial" | "blocked" | "stale";
  message?: string;            // "龙虎榜数据 5/22 未刷新；已用 5/21 数据近似替代"
  affected: string[];          // ["lhb", "northbound"]
  can_retry: boolean;
}

// =============================================================================
// 11. 顶层 Payload (拆分 critical / lazy)
// =============================================================================

export interface SymbolCriticalPayload {
  header: SymbolHeader;
  profile: SymbolProfile;
  status: DataStatus;
  navigation: NavData;
}

/** #2: 当前市场状态下该策略的有效性提示（注入 Hero）*/
export interface RegimeContext {
  /** 当前市场状态中文标签，如 "震荡市" */
  label: string;
  /** 该 regime 下历史胜率 0..1，null = 样本不足 */
  regime_win_rate: number | null;
  /** 该 regime 历史样本数 */
  regime_n: number;
  /** 全样本胜率，用于对比 */
  overall_win_rate: number | null;
  /** 提示语气：good=该策略此环境历史好 / warn=偏弱 / neutral=样本不足 */
  tone: Tone;
}

/** #3: 估值×技术×时机三维上下文（注入 Hero）*/
export interface TripleContext {
  /** 估值历史百分位 0..1（取 PE 优先），null = 缺 */
  valuation_pct: number | null;
  /** 估值文字，如 "PE 历史 P82" */
  valuation_label: string;
  /** 是否高位（估值 >= 0.8）且技术看多 → 高位金叉警告 */
  high_valuation_long_warning: boolean;
}

export interface SymbolPulsePayload {
  decision: DecisionVerdict;
  narrative: SymbolNarrative;
  indicators: IndicatorColumn[]; // 长度 = 3
  risk_context: RiskBudgetContext;
  risk_flags: { text: string; tone: Tone }[];
  /** #2: regime 有效性，缺数据时为 null */
  regime_context: RegimeContext | null;
  /** #3: 三维合一，缺估值时为 null */
  triple_context: TripleContext | null;
}

export interface SymbolChartPayload {
  kline: Candle[];
  signals: SignalMarker[];
  catalysts: CatalystTimeline;
  history: MarketHistoryPayload | null;
  context: MarketContextPayload | null;
  raw_signals: ChartSignalHistoryRow[];
  strategy_analysis: unknown | null;
  readiness: unknown | null;
}

/** #4: 卖方一致预期 */
export interface ConsensusModel {
  total_reports: number;
  org_count: number;
  recent_30d_count: number;
  rating_distribution: { rating: string; count: number }[];
  eps_consensus: number | null;
  target_price_avg: number | null;
  /** 预期修正方向（需历史快照，首版可能 null）*/
  revision_hint: string | null;
}

export interface QualityMetric {
  key: string;
  label: string;
  value: number | null;
  tone: Tone;
  unit: "ratio" | "currency" | "score";
}

export interface QualityFlag {
  key: string;
  label: string;
  value: number | null;
  tone: Tone;
  detail: string;
}

export interface QualityMetricsModel {
  available: boolean;
  score: number | null;
  metrics: QualityMetric[];
  flags: QualityFlag[];
}

export interface HoldingConcentrationModel {
  available: boolean;
  score: number | null;
  northbound_float_pct: number | null;
  fund_float_pct: number | null;
  fund_count: number | null;
  shareholder_count: number | null;
  shareholder_count_delta_pct: number | null;
  top10_holder_pct: number | null;
  items: QualityFlag[];
}

export interface SymbolFundamentalsPayload {
  valuation: ValuationPercentile[];
  financials: FinancialSeries;
  disclosures: Disclosure[];
  northbound: NorthboundSeries;
  institutional: InstitutionalDesk[];
  /** #4: 卖方一致预期，缺数据时为 null */
  consensus: ConsensusModel | null;
  quality: QualityMetricsModel | null;
  holding: HoldingConcentrationModel | null;
}

export interface SymbolPlaybookPayload {
  signal_detail: SignalDetail | null;
  backtest: BacktestSummary | null;
  selected_signal_id: string | null;
  history_signals: PlaybookSignalRow[];
  recent_bars: PlaybookRecentBar[];
  notes: AnalystNote[];
}

// =============================================================================
// 12. UI 状态机 — 每个数据组件都必须覆盖
// 修正自 bridge §6.1：missing 在 partial 顶层（不是 data 内）
// =============================================================================

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "empty"; cta?: { label: string; onClick: () => void } }
  | { status: "error"; message: string; retry: () => void }
  | { status: "partial"; data: T; missing: string[] }
  | { status: "ok"; data: T };

// =============================================================================
// 13. 全局上下文
// =============================================================================

export interface WorkspaceContext {
  mode: StrategyMode;
  setMode: (m: StrategyMode) => void;
  symbol: string;
  setSymbol: (s: string) => void;
  /** 用户的组合配置 — 影响风险预算计算器的默认值 */
  portfolio: {
    capital: number;
    default_risk_pct: number;
    default_stop_method: StopMethod;
  };
  theme: "dark" | "light";
}

/** Tab 路由 key */
export type TabKey = "pulse" | "chart" | "fundamentals" | "playbook";
