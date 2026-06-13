// API → V2 Payload Mappers
// 严格按 docs/plans/2026-05-23-symbol-workspace-v2-handoff-bridge.md §5 实现
//
// 红线：
//   - 数据缺失 → 返回 null，不塞 0
//   - 每个 mapper 都返回 missing[] (在 hooks.ts 里聚合到 partial)
import type {
  MarketContextPayload,
  MarketHistoryBar,
  MarketHistoryPayload,
  MarketQuote,
  RealtimeQuote,
} from "../../types/market";
import type {
  Candle,
  Catalyst,
  CatalystType,
  DataStatus,
  DecisionVerdict,
  Disclosure,
  FactorScore,
  FinancialSeries,
  HoldingConcentrationModel,
  IndicatorColumn,
  IndicatorRow,
  InstitutionalDesk,
  NavData,
  NavItem,
  NorthboundSeries,
  PlaybookRecentBar,
  PlaybookSignalRow,
  QualityMetricsModel,
  RiskBudgetContext,
  SignalDetail,
  SignalMarker,
  StrategyMode,
  SymbolHeader,
  SymbolNarrative,
  SymbolProfile,
  Tone,
  ValuationPercentile,
} from "../../types/symbol-workspace";
import type {
  AnalysisReadinessPayloadShape,
  BacktestSummaryPayloadShape,
  CatalystsPayloadShape,
  FundamentalsPayloadShape,
  HoldingConcentrationPayloadShape,
  InstitutionalDesksPayloadShape,
  NewsEvidencePayloadShape,
  QualityMetricsPayloadShape,
  ResonanceV2AnalysisShape,
  SignalHistoryPayloadShape,
  ValuationPercentilePayloadShape,
} from "./fetchers";

// ============================================================
// 工具
// ============================================================

const finiteOrNull = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const safeArray = <T>(v: T[] | null | undefined): T[] => v ?? [];

const asTone = (value: string | null | undefined): Tone =>
  value === "success" ||
  value === "warning" ||
  value === "danger" ||
  value === "info" ||
  value === "neutral"
    ? value
    : "neutral";

const parseJsonList = (s: string | null | undefined): string[] => {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    /* ignore */
  }
  return [];
};

const classifyTone = (
  value: number | null,
  threshold: number,
  direction: "higher" | "lower" = "higher"
): Tone => {
  if (value == null) return "neutral";
  if (direction === "higher") {
    if (value > threshold * 1.2) return "success";
    if (value > threshold) return "info";
    if (value < threshold * 0.8) return "danger";
    return "warning";
  } else {
    if (value < threshold * 0.8) return "success";
    if (value < threshold) return "info";
    if (value > threshold * 1.2) return "danger";
    return "warning";
  }
};

// ============================================================
// 1) mapHeader — V2 SymbolHeader
// ============================================================

export interface MapHeaderInput {
  history: MarketHistoryPayload | null;
  realtime: RealtimeQuote | null;
}

export function mapHeader({ history, realtime }: MapHeaderInput): {
  data: SymbolHeader;
  missing: string[];
} {
  const missing: string[] = [];
  const hq = history?.quote ?? null;

  const price = finiteOrNull(realtime?.price ?? hq?.price ?? null);
  if (price == null) missing.push("price");

  const change = finiteOrNull(realtime?.change ?? hq?.change ?? null);
  const changePct = finiteOrNull(realtime?.change_pct ?? hq?.change_pct ?? null);

  const isRealtime = realtime?.is_realtime === true || realtime?.status === "live";
  const freshnessLabel =
    (isRealtime ? realtime?.status_text : hq?.freshness_text) ||
    (hq?.trade_date ? `数据时间 ${hq.trade_date}` : "未知");

  const freshness: SymbolHeader["freshness"] =
    isRealtime
      ? "live"
      : (hq?.freshness_status === "fresh" || hq?.freshness_status === "delayed")
        ? "delayed"
        : "closed";

  const data: SymbolHeader = {
    symbol: history?.symbol ?? "-",
    name: history?.name ?? history?.display_name ?? history?.symbol ?? "-",
    price,
    change,
    change_pct: changePct,
    freshness_label: freshnessLabel,
    freshness,
    intraday: {
      open: finiteOrNull(realtime?.open ?? hq?.open ?? null),
      high: finiteOrNull(realtime?.high ?? hq?.high ?? null),
      low: finiteOrNull(realtime?.low ?? hq?.low ?? null),
      prev_close: finiteOrNull(realtime?.prev_close ?? hq?.prev_close ?? null),
    },
  };

  return { data, missing };
}

// ============================================================
// 2) mapProfile — V2 SymbolProfile
// ============================================================

export interface MapProfileInput {
  history: MarketHistoryPayload | null;
  context: MarketContextPayload | null;
  fundamentals: FundamentalsPayloadShape | null;
}

export function mapProfile({
  history,
  context,
  fundamentals,
}: MapProfileInput): { data: SymbolProfile; missing: string[] } {
  const missing: string[] = [];
  const ctxIndustry =
    (context as unknown as { industry?: { name?: string; sub_name?: string } } | null)
      ?.industry ?? null;
  const profile = fundamentals?.security_profile ?? null;

  const industry =
    ctxIndustry?.name ?? profile?.industry ?? null;
  const sub = ctxIndustry?.sub_name ?? profile?.sub_industry ?? undefined;

  const valuation = fundamentals?.valuation_snapshot ?? null;
  const tradingRules =
    (context as unknown as { trading_rules?: Record<string, unknown> } | null)
      ?.trading_rules ?? null;

  const marketCapRaw = finiteOrNull(profile?.market_cap ?? null);
  const marketCapYi = marketCapRaw != null ? marketCapRaw / 1e8 : null;
  if (marketCapYi == null) missing.push("market_cap");

  const freeFloatRaw = finiteOrNull(profile?.free_float_market_cap ?? null);
  const freeFloatYi = freeFloatRaw != null ? freeFloatRaw / 1e8 : null;

  const turnover = finiteOrNull(
    (context?.factor_snapshot as unknown as { turnover_pct?: number | null })
      ?.turnover_pct ?? null
  );

  const peTtm = finiteOrNull(valuation?.pe_ttm ?? null);
  if (peTtm == null) missing.push("pe_ttm");

  const peIndustryPct = finiteOrNull(
    (ctxIndustry as unknown as { pe_percentile?: number | null })?.pe_percentile ?? null
  );

  const pb = finiteOrNull(valuation?.pb ?? null);
  const dividendYield = finiteOrNull(valuation?.dividend_yield ?? null);

  const flags: string[] = [];
  if (tradingRules) {
    const r = tradingRules as Record<string, boolean>;
    if (r.is_st) flags.push("ST");
    if (r.is_suspended) flags.push("停牌");
    if (r.is_limit_up) flags.push("涨停");
    if (r.is_limit_down) flags.push("跌停");
    if (r.is_first_five_listing_days) flags.push("上市前 5 日");
  }

  return {
    data: {
      industry: industry || "-",
      sub_industry: sub,
      market_cap_yi: marketCapYi,
      free_float_yi: freeFloatYi,
      turnover_pct: turnover,
      pe_ttm: peTtm,
      pe_industry_pct: peIndustryPct,
      pb,
      dividend_yield: dividendYield,
      flags,
    },
    missing,
  };
}

// ============================================================
// 3) mapDecision — V2 DecisionVerdict
// ============================================================

export interface MapDecisionInput {
  analysis: ResonanceV2AnalysisShape | null;
  mode: StrategyMode;
}

const decisionToneOf = (tone: string | undefined): DecisionVerdict["tone"] => {
  if (!tone) return "neutral";
  const t = tone.toLowerCase();
  if (t.includes("opportunity") || t.includes("bullish") || t.includes("buy"))
    return "opportunity";
  if (t.includes("risk") || t.includes("danger") || t.includes("bearish"))
    return "risk";
  if (t.includes("warn") || t.includes("caution")) return "warn";
  return "neutral";
};

const factorKeyMap: Record<string, { label: string }> = {
  trend: { label: "趋势" },
  momentum: { label: "动能" },
  oversold: { label: "超卖" },
  volume: { label: "量能" },
  market: { label: "大盘" },
  money: { label: "资金" },
};

const buyThresholdOf = (mode: StrategyMode) => (mode === "aggressive" ? 45 : 55);

const modeNameOf = (mode: StrategyMode) => (mode === "aggressive" ? "激进模式" : "保守模式");

const actionPhraseOf = (analysis: ResonanceV2AnalysisShape, mode: StrategyMode): string => {
  const explicit = analysis.decision.action_phrase;
  if (explicit) return explicit;

  const action = analysis.decision.action;
  const label = analysis.decision.label || "";
  if (action === "reduce") return "暂停开新仓，已有仓位按规则减仓";
  if (action === "exit") return "停止买入，按风控规则退出";
  if (action === "buy_allowed") return mode === "aggressive" ? "小仓位试探建仓" : "按计划分批建仓";
  if (action === "buy_watch") return "接近买点，等待触发确认";
  if (action === "hold") return "继续观察持有，不追价加仓";
  if (action === "observe") {
    if (label.includes("数据")) return "暂不开新仓，先补齐数据后再评估";
    if (label.includes("趋势")) return "暂不开新仓，等待趋势重新转强";
    if (label.includes("大盘")) return "暂不开新仓，等待大盘过滤通过";
    return "暂不开新仓，等待信号确认";
  }

  return analysis.decision.label || analysis.trend_state?.action || "等待更多信号确认";
};

const fallbackRationaleOf = (
  analysis: ResonanceV2AnalysisShape,
  score: number | null,
  mode: StrategyMode
): string[] => {
  const action = analysis.decision.action;
  if (action === "reduce" || action === "exit") {
    const reasons: string[] = [];
    if (score != null) {
      reasons.push(`买入强度 ${score}，低于${modeNameOf(mode)}买入门槛 ${buyThresholdOf(mode)}`);
    }
    const weakFactors = Object.entries(analysis.buy_signal?.factors ?? {})
      .filter(([, value]) => {
        const n = finiteOrNull(value);
        return n != null && n < 0.4;
      })
      .map(([key]) => factorKeyMap[key]?.label ?? key);
    if (weakFactors.length > 0) {
      reasons.push(`${weakFactors.slice(0, 4).join("、")}因子偏弱`);
    }
    const warningAction = analysis.sell_signal?.warning_level?.action;
    reasons.push(warningAction ? `卖出风险升温，风控动作：${warningAction}` : "卖出风险升温，优先控制仓位");
    return reasons.slice(0, 3);
  }

  return safeArray(analysis.market_filter?.drivers).slice(0, 3);
};

export function mapDecision({ analysis, mode }: MapDecisionInput): {
  data: DecisionVerdict;
  missing: string[];
} {
  const missing: string[] = [];
  if (!analysis) {
    return {
      data: {
        eyebrow: `V2 共振策略 · ${mode === "aggressive" ? "激进" : "保守"}模式`,
        title: "策略读取中",
        tone: "neutral",
        reason: "-",
        mode,
        score: null,
        factors: [],
        readiness: null,
      },
      missing: ["decision", "factors"],
    };
  }
  const modeLabel = mode === "aggressive" ? "激进模式" : "保守模式";
  const date = analysis.latest_bar?.date ?? "-";
  // 内部代号 V2 不暴露给用户
  const friendlyStrategyName = (analysis.strategy_name || "").replace(/\bV2\b/i, "").trim() || "多指标共振策略";
  const eyebrow = `${friendlyStrategyName} · ${modeLabel} · ${date}`;

  const score = (() => {
    const raw = finiteOrNull(analysis.buy_signal?.score ?? null);
    if (raw == null) {
      missing.push("score");
      return null;
    }
    return Math.round(raw * 100);
  })();

  const factors: FactorScore[] = Object.entries(analysis.buy_signal?.factors ?? {})
    .slice(0, 5)
    .map(([key, value]) => ({
      key: factorKeyMap[key]?.label ?? key,
      value: finiteOrNull(value),
      tone: classifyTone(finiteOrNull(value), 0.5, "higher"),
    }));
  if (factors.length === 0) missing.push("factors");

  // readiness 从 bar_count 反推（与 V1 helpers 兼容；BE-2 后改走 readiness 服务）
  const bars = analysis.data_quality?.bar_count ?? 0;
  const readiness = bars > 0 ? Math.min(1, bars / 250) : null;

  // action / rationale 优先用后端新字段；缺失则从旧字段拼装一个"凑合可读"的版本
  const action = actionPhraseOf(analysis, mode);
  const rationale =
    safeArray(analysis.decision.rationale).length > 0
      ? safeArray(analysis.decision.rationale)
      : fallbackRationaleOf(analysis, score, mode);

  return {
    data: {
      eyebrow,
      title: analysis.decision.label || "策略观察中",
      tone: decisionToneOf(analysis.decision.tone),
      action,
      rationale,
      // @deprecated 旧字段，渲染层会优先用 action
      reason: rationale[0] || action,
      mode,
      score,
      factors,
      readiness,
    },
    missing,
  };
}

// ============================================================
// 4) mapNarrative — V2 SymbolNarrative
// ============================================================

export function mapNarrative({
  analysis,
}: {
  analysis: ResonanceV2AnalysisShape | null;
}): { data: SymbolNarrative; missing: string[] } {
  if (!analysis) {
    return { data: { bull: [], falsify: [] }, missing: ["narrative"] };
  }
  // bull = drivers + checklist.passed=true 的 label
  const drivers = safeArray(analysis.market_filter?.drivers);
  const passedChecks = safeArray(analysis.checklist)
    .filter((c) => c.passed)
    .map((c) => c.label);
  const bull = Array.from(new Set([...drivers, ...passedChecks])).slice(0, 5);

  // falsify：优先用后端新字段 falsify_conditions（与 bull 真镜像）
  // fallback：兼容旧字段 data_quality.warnings/blocking_reasons
  let falsify: SymbolNarrative["falsify"];
  if (analysis.falsify_conditions && analysis.falsify_conditions.length > 0) {
    falsify = analysis.falsify_conditions.map((f) => ({
      text: f.text,
      occurred: Boolean(f.occurred),
      occurred_for_days: f.occurred_for_days,
      mirror_of: f.mirror_of,
    }));
  } else {
    const warnings = safeArray(analysis.data_quality?.warnings).map((text) => ({
      text,
      occurred: false,
    }));
    const blockers = safeArray(analysis.data_quality?.blocking_reasons).map((text) => ({
      text,
      occurred: true,
    }));
    falsify = [...blockers, ...warnings];
  }

  return {
    data: { bull, falsify },
    missing: bull.length === 0 ? ["narrative.bull"] : [],
  };
}

// ============================================================
// 5) mapIndicators — V2 IndicatorColumn[]
// ============================================================

export interface MapIndicatorsInput {
  context: MarketContextPayload | null;
  history: MarketHistoryPayload | null;
}

const fmt = (v: number | null, digits = 2) =>
  v == null ? "-" : v.toFixed(digits);
const fmtPct = (v: number | null, digits = 1) =>
  v == null ? "-" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;

export function mapIndicators({
  context,
}: MapIndicatorsInput): { data: IndicatorColumn[]; missing: string[] } {
  const missing: string[] = [];
  const fs = context?.factor_snapshot ?? null;
  const series = safeArray(context?.factor_series);

  const sparkOf = (key: keyof NonNullable<typeof context>["factor_series"][number]) =>
    series.slice(-20).map((row) => {
      const v = row[key as keyof typeof row] as number | null | undefined;
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }).filter((v): v is number => v !== null);

  const short: IndicatorRow[] = [
    {
      label: "RSI14",
      value: fmt(finiteOrNull(fs?.rsi14 ?? null), 1),
      tone: classifyTone(finiteOrNull(fs?.rsi14 ?? null), 70, "lower"),
      spark: sparkOf("rsi14" as never),
    },
    {
      label: "量比 20D",
      value: fmt(finiteOrNull(fs?.volume_ratio20 ?? null), 2) + "×",
      tone: classifyTone(finiteOrNull(fs?.volume_ratio20 ?? null), 1, "higher"),
      spark: sparkOf("volume_ratio20" as never),
    },
    {
      label: "ATR14",
      value: fmt(finiteOrNull(fs?.atr14 ?? null), 2),
      tone: "neutral",
    },
    {
      label: "20 日收益",
      value: fmtPct(finiteOrNull(fs?.ret20 ?? null), 1),
      tone: classifyTone(finiteOrNull(fs?.ret20 ?? null), 0, "higher"),
      spark: sparkOf("ret20" as never),
    },
  ];

  const mid: IndicatorRow[] = [
    {
      label: "MA20 / 60 / 120",
      value: `${fmt(finiteOrNull(fs?.ma20 ?? null), 1)} / ${fmt(
        finiteOrNull(fs?.ma60 ?? null),
        1
      )} / ${fmt(finiteOrNull(fs?.ma120 ?? null), 1)}`,
      tone: "neutral",
    },
    {
      label: "行业 RS",
      value: fmtPct(finiteOrNull(fs?.rel_strength_industry20 ?? null), 1),
      tone: classifyTone(finiteOrNull(fs?.rel_strength_industry20 ?? null), 0, "higher"),
      spark: sparkOf("rel_strength_industry20" as never),
    },
    {
      label: "相对沪深",
      value: fmtPct(finiteOrNull(fs?.rel_strength_index20 ?? null), 1),
      tone: classifyTone(finiteOrNull(fs?.rel_strength_index20 ?? null), 0, "higher"),
      spark: sparkOf("rel_strength_index20" as never),
    },
    {
      label: "北向 5D",
      value: (() => {
        const v = finiteOrNull(fs?.northbound_inflow_5d ?? null);
        if (v == null) return "-";
        const yi = v / 1e8;
        return `${yi >= 0 ? "+" : ""}${yi.toFixed(1)} 亿`;
      })(),
      tone: classifyTone(
        finiteOrNull(fs?.northbound_inflow_5d ?? null),
        0,
        "higher"
      ),
    },
  ];

  // 长线列：Phase 1 不接基本面，只占位
  const long: IndicatorRow[] = [
    {
      label: "长线指标",
      value: "待接入",
      tone: "neutral",
    },
  ];
  missing.push("indicators.long");

  if (short.every((row) => row.value === "-")) missing.push("indicators.short");
  if (mid.every((row) => row.value === "-")) missing.push("indicators.mid");

  return {
    data: [
      { horizon: "short", title: "短线 5–20D", subtitle: "决定进出场", items: short },
      { horizon: "mid", title: "中线 1–3M", subtitle: "决定持有", items: mid },
      { horizon: "long", title: "长线 季度+", subtitle: "决定配置", items: long },
    ],
    missing,
  };
}

// ============================================================
// 6) mapDataStatus — V2 DataStatus
// ============================================================

export function mapDataStatus(
  readiness: AnalysisReadinessPayloadShape | null
): DataStatus {
  if (!readiness) {
    return {
      kind: "blocked",
      message: "分析完整度服务未连接",
      affected: [],
      can_retry: true,
    };
  }
  const kind: DataStatus["kind"] =
    readiness.level === "ready"
      ? "ok"
      : readiness.level === "blocked"
        ? "blocked"
        : "partial";
  const affected = safeArray(readiness.categories)
    .filter((c) => c.status !== "ready")
    .map((c) => c.key);
  const message = safeArray(readiness.next_actions)[0]?.label ?? undefined;
  return {
    kind,
    message,
    affected,
    can_retry: kind !== "blocked",
  };
}

// ============================================================
// 衍生 mapper：风险预算上下文
// ============================================================

export function mapRiskBudgetContext({
  history,
  context,
}: {
  history: MarketHistoryPayload | null;
  context: MarketContextPayload | null;
}): RiskBudgetContext {
  const quote = history?.quote ?? null;
  const fs = context?.factor_snapshot ?? null;
  // support_price = 近 60 日 low 中的最低
  const bars = safeArray(history?.bars).slice(-60);
  const lows = bars
    .map((b) => (typeof b.low === "number" ? b.low : null))
    .filter((v): v is number => v !== null);
  const supportPrice = lows.length > 0 ? Math.min(...lows) : null;
  return {
    entry: finiteOrNull(quote?.price ?? null),
    atr14: finiteOrNull(fs?.atr14 ?? null),
    support_price: supportPrice,
    fixed_pct: 0.07,
    lot_size: 100,
  };
}

// ============================================================
// 衍生：信号 → K线 marker
// ============================================================

export function mapSignalMarkers(
  signals: SignalHistoryPayloadShape["signals"],
  bars: { trading_date: string }[]
): SignalMarker[] {
  if (!signals.length || !bars.length) return [];
  const dateIndex = new Map(bars.map((b, i) => [b.trading_date, i]));
  const out: SignalMarker[] = [];
  for (const s of signals) {
    const i = dateIndex.get(s.date);
    if (i == null) continue;
    const dir = (s.direction || "").toLowerCase();
    const kind: SignalMarker["kind"] =
      dir === "buy" || dir === "long"
        ? "buy"
        : dir === "sell" || dir === "short"
          ? "sell"
          : dir === "reduce"
            ? "reduce"
            : dir === "add"
              ? "add"
              : "warn";
    out.push({
      i,
      kind,
      label: `${s.signal_name} (${s.signal_level || "-"})`,
      score: finiteOrNull(s.score ?? null),
    });
  }
  return out;
}

// ============================================================
// 衍生：bars → Candle[]
// ============================================================

export function mapCandles(history: MarketHistoryPayload | null): Candle[] {
  return safeArray(history?.bars).map((b, i) => ({
    i,
    trading_date: b.date,
    open: finiteOrNull(b.open ?? null),
    close: finiteOrNull(b.close ?? null),
    high: finiteOrNull(b.high ?? null),
    low: finiteOrNull(b.low ?? null),
    volume: finiteOrNull(b.volume ?? null),
  }));
}

// ============================================================
// 衍生：watchlist + signals → NavData
// ============================================================

export function mapNavData({
  currentSymbol,
  watchlist,
  signals,
  recent,
}: {
  currentSymbol: string;
  watchlist: { symbol: string; name?: string | null }[];
  signals: SignalHistoryPayloadShape["signals"];
  recent: string[];
}): NavData {
  const mark = (it: NavItem): NavItem =>
    it.symbol === currentSymbol ? { ...it, active: true } : it;

  const favorites: NavItem[] = watchlist.slice(0, 12).map((w) =>
    mark({
      symbol: w.symbol,
      name: w.name || w.symbol,
      tone: "neutral",
      trailing: { kind: "change_pct", value: null },
    })
  );

  const opportunities: NavItem[] = signals
    .filter((s) => /buy|long|opportunity/i.test(s.direction || ""))
    .slice(0, 5)
    .map((s) =>
      mark({
        symbol: s.symbol,
        name: s.signal_name,
        tone: "success",
        trailing: { kind: "score", value: finiteOrNull(s.score ?? null) },
      })
    );

  const risks: NavItem[] = signals
    .filter((s) =>
      /sell|short|risk|warn/i.test(`${s.direction || ""} ${s.signal_level || ""}`)
    )
    .slice(0, 5)
    .map((s) =>
      mark({
        symbol: s.symbol,
        name: s.signal_name,
        tone: "danger",
        trailing: { kind: "flag", text: s.signal_level || "警示" },
      })
    );

  const recentItems: NavItem[] = recent.slice(0, 8).map((symbol) =>
    mark({
      symbol,
      name: symbol,
      tone: "neutral",
      trailing: { kind: "viewed_at", text: "最近" },
    })
  );

  return { favorites, opportunities, risks, recent: recentItems };
}

// ============================================================
// 衍生：news → Disclosure[]
// ============================================================

const tagFromHeadline = (h: string): Disclosure["tag"] => {
  if (/财报|业绩|净利|营收|超预期/.test(h)) return "业绩";
  // 评级要先于研报，因为 "中金给买入评级" 同时含两个关键字
  if (/上调|下调|目标价|买入评级|卖出评级|增持|减持|跑赢|跑输/.test(h))
    return "评级";
  if (/研报/.test(h)) return "研报";
  if (/监管|关注函|问询|处罚/.test(h)) return "监管";
  if (/重组|并购|收购/.test(h)) return "重组";
  return "公告";
};

const toneFromSentiment = (s: string | undefined): Tone => {
  if (!s) return "neutral";
  const t = s.toLowerCase();
  if (t.includes("positive") || t.includes("bull")) return "success";
  if (t.includes("negative") || t.includes("bear")) return "danger";
  return "neutral";
};

export function mapDisclosures(news: NewsEvidencePayloadShape | null): Disclosure[] {
  return safeArray(news?.items).map((n) => ({
    date: n.date,
    tag: tagFromHeadline(n.headline),
    tone: toneFromSentiment(n.sentiment),
    title: n.headline,
    source: n.source || undefined,
    credibility: finiteOrNull(n.credibility),
    summary: n.summary ?? null,
    url: n.url || undefined,
  }));
}

export function mapPlaybookHistory({
  bars,
  signals,
}: {
  bars: MarketHistoryBar[];
  signals: SignalHistoryPayloadShape["signals"];
}): { signals: PlaybookSignalRow[]; recentBars: PlaybookRecentBar[] } {
  const signalRows = safeArray(signals).map((signal) => ({
    id: signal.signal_id,
    date: signal.date,
    name: signal.signal_name,
    level: signal.signal_level,
    direction: signal.direction,
    score: finiteOrNull(signal.score ?? null),
    review_count: signal.review_count || 0,
    ret20d: finiteOrNull(signal.event_return?.ret_20d ?? null),
    max_adverse20d: finiteOrNull(signal.event_return?.max_adverse_20d ?? null),
  }));
  const recentBars = safeArray(bars)
    .slice(-12)
    .reverse()
    .map((bar, index, rows) => {
      const prev = rows[index + 1]?.close ?? null;
      const close = finiteOrNull(bar.close ?? null);
      return {
        date: bar.date,
        close,
        change_pct: close != null && prev ? (close - prev) / Math.abs(prev) : null,
        volume: finiteOrNull(bar.volume ?? null),
      };
    });
  return { signals: signalRows, recentBars };
}

// ============================================================
// 衍生：news → past Catalysts（B 级未启用时的兜底）
// ============================================================

const catalystTypeFromHeadline = (h: string): CatalystType => {
  if (/财报|业绩|净利|营收/.test(h)) return "earnings";
  if (/研报|评级|目标价/.test(h)) return "research";
  if (/龙虎榜/.test(h)) return "lhb";
  if (/政策|监管|关注函/.test(h)) return "policy";
  if (/解禁/.test(h)) return "unlock";
  if (/分红|派息|股息/.test(h)) return "dividend";
  if (/股东大会|发布会|路演/.test(h)) return "meeting";
  return "disclosure";
};

export function mapCatalystsFromNews(
  news: NewsEvidencePayloadShape | null,
  asOf: string
): { past: Catalyst[]; future: Catalyst[] } {
  const items = safeArray(news?.items);
  const today = new Date(`${asOf}T00:00:00Z`).getTime();
  const past: Catalyst[] = items.map((n) => {
    const eventTs = new Date(`${n.date}T00:00:00Z`).getTime();
    return {
      date: n.date,
      offset_days: Math.round((eventTs - today) / 86_400_000),
      type: catalystTypeFromHeadline(n.headline),
      title: n.headline,
      tone: toneFromSentiment(n.sentiment),
      occurred: true,
      note: n.summary ?? undefined,
      source_url: n.url ?? undefined,
    };
  });
  return { past, future: [] };
}

// ============================================================
// B 级 / Phase 2 接入：mapper 扩展
// ============================================================

export function mapValuationPercentile(
  payload: ValuationPercentilePayloadShape | null
): ValuationPercentile[] {
  if (!payload) return [];
  return safeArray(payload.items).map((it) => ({
    name: (it.name as ValuationPercentile["name"]) ?? "PE TTM",
    value: it.value == null ? "-" : it.value.toFixed(2),
    raw_value: finiteOrNull(it.value),
    industry_pct: finiteOrNull(it.industry_pct),
    history_pct: finiteOrNull(it.history_pct),
  }));
}

export function mapFinancialSeries(
  payload: FundamentalsPayloadShape | null
): FinancialSeries | null {
  const series = payload?.quarterly_series;
  if (!series || !series.quarters || series.quarters.length === 0) return null;
  return {
    quarters: series.quarters,
    revenue: series.revenue,
    net_profit: series.net_income,
    roe: series.roe,
  };
}

export function mapCatalysts(
  payload: CatalystsPayloadShape | null,
  asOf: string
): { past: Catalyst[]; future: Catalyst[] } {
  if (!payload) return { past: [], future: [] };
  const today = new Date(`${asOf}T00:00:00Z`).getTime();
  const toCat = (c: { date: string; type: string; title: string; tone: string; source_url?: string; note?: string }, occurred: boolean): Catalyst => {
    const eventTs = new Date(`${c.date}T00:00:00Z`).getTime();
    return {
      date: c.date,
      offset_days: Math.round((eventTs - today) / 86_400_000),
      type: (c.type as CatalystType) || "disclosure",
      title: c.title,
      tone: (c.tone as Tone) || "neutral",
      occurred,
      note: c.note,
      source_url: c.source_url,
    };
  };
  return {
    past: safeArray(payload.past).map((c) => toCat(c, true)),
    future: safeArray(payload.future).map((c) => toCat(c, false)),
  };
}

export function mapNorthboundSeries(
  context: MarketContextPayload | null
): NorthboundSeries | null {
  const rows = safeArray(context?.fund_flow_series);
  if (rows.length === 0) return null;
  // 累计净流入近似（不是真实持股市值）
  let acc = 0;
  const series: number[] = [];
  const dates: string[] = [];
  rows.forEach((r) => {
    const v = finiteOrNull((r as unknown as { northbound_net_inflow?: number | null }).northbound_net_inflow ?? null);
    acc += v != null ? v / 1e8 : 0;
    series.push(Number(acc.toFixed(2)));
    dates.push((r as { date: string }).date);
  });
  return {
    series,
    dates,
    start_date: dates[0] ?? "",
    end_date: dates[dates.length - 1] ?? "",
    source: "cumulative_inflow",
  };
}

export function mapBacktestSummary(
  payload: BacktestSummaryPayloadShape | null
): { data: BacktestSummaryPayloadShape; missing: string[] } | null {
  if (!payload) return null;
  return { data: payload, missing: payload.n < 5 ? ["sample_quality"] : [] };
}

// ============================================================
// #2: regime（市场状态）中文映射 + 上下文构建
// ============================================================

/** 把后端 regime 原始标识映射为中文标签。未知值回退到"未知市况"。 */
export function regimeLabel(regime: string | null | undefined): string {
  if (!regime) return "未知市况";
  const r = regime.toLowerCase();
  if (/(trend.*up|uptrend|bull|多头|上行)/.test(r)) return "上行趋势";
  if (/(trend.*down|downtrend|bear|空头|下行)/.test(r)) return "下行趋势";
  if (/(range|sideway|neutral|震荡|盘整)/.test(r)) return "震荡市";
  if (/(volatile|high.*vol|剧烈|高波)/.test(r)) return "高波动";
  if (/(unknown|未知)/.test(r)) return "未知市况";
  return regime; // 保留原值，避免吞掉后端新枚举
}

/** 把当前市场状态字符串归一化（用于和 by_regime 的 regime 比较）。 */
function normalizeRegimeKey(label: string): string {
  return regimeLabel(label);
}

/**
 * #2: 构建 regime 有效性上下文。
 * @param backtest 后验聚合（含 by_regime）
 * @param currentRegimeRaw 当前市场状态原始标识（来自 market context 的 market_state.regime）
 */
export function buildRegimeContext(
  backtest: BacktestSummaryPayloadShape | null,
  currentRegimeRaw: string | null
): import("../../types/symbol-workspace").RegimeContext | null {
  if (!backtest || !currentRegimeRaw) return null;
  const currentLabel = regimeLabel(currentRegimeRaw);
  const buckets = safeArray(backtest.by_regime);
  // 用中文标签做匹配，兼容 event_return.regime 与 context.regime 命名不同
  const matched = buckets.find(
    (b) => regimeLabel(b.regime) === currentLabel
  );
  const overall = finiteOrNull(backtest.win_rate);

  if (!matched || matched.n < 5) {
    // 样本不足：只报当前市况，不给可能误导的胜率
    return {
      label: currentLabel,
      regime_win_rate: null,
      regime_n: matched?.n ?? 0,
      overall_win_rate: overall,
      tone: "neutral",
    };
  }
  const regimeWr = finiteOrNull(matched.win_rate);
  // 该 regime 胜率显著低于全样本 → warn
  const tone: Tone =
    regimeWr == null
      ? "neutral"
      : regimeWr < 0.45
        ? "warning"
        : regimeWr >= 0.6
          ? "success"
          : "info";
  return {
    label: currentLabel,
    regime_win_rate: regimeWr,
    regime_n: matched.n,
    overall_win_rate: overall,
    tone,
  };
}

/**
 * 把后端 by_regime 转成前端 RegimeWinRate[]（带中文标签 + is_current 标记）。
 */
export function mapRegimeWinRates(
  backtest: BacktestSummaryPayloadShape | null,
  currentRegimeRaw: string | null
): import("../../types/symbol-workspace").RegimeWinRate[] {
  if (!backtest) return [];
  const currentLabel = currentRegimeRaw ? regimeLabel(currentRegimeRaw) : null;
  return safeArray(backtest.by_regime).map((b) => {
    const label = regimeLabel(b.regime);
    return {
      regime: b.regime,
      label,
      n: b.n,
      win_rate: finiteOrNull(b.win_rate),
      avg_20d: finiteOrNull(b.avg_20d),
      is_current: currentLabel != null && label === currentLabel,
    };
  });
}

// ============================================================
// #3: 估值×技术×时机 三维上下文
// ============================================================

/**
 * 构建三维合一上下文。
 * @param valuation 估值百分位 payload（取 PE 优先）
 * @param decisionTone 决策语气（用于判断是否"技术看多"）
 */
export function buildTripleContext(
  valuation: ValuationPercentilePayloadShape | null,
  decisionTone: DecisionVerdict["tone"]
): import("../../types/symbol-workspace").TripleContext | null {
  if (!valuation) return null;
  const items = safeArray(valuation.items);
  // 取 PE 优先，其次 PB，作为"估值贵不贵"的代理
  const pe = items.find((i) => /pe/i.test(i.name));
  const pb = items.find((i) => /pb/i.test(i.name));
  const ref = pe ?? pb ?? items[0];
  if (!ref) return null;
  const histPct = finiteOrNull(ref.history_pct);
  if (histPct == null) {
    return {
      valuation_pct: null,
      valuation_label: "估值历史百分位缺失",
      high_valuation_long_warning: false,
    };
  }
  const refName = /pe/i.test(ref.name) ? "PE" : /pb/i.test(ref.name) ? "PB" : ref.name;
  const isLongBias = decisionTone === "opportunity";
  return {
    valuation_pct: histPct,
    valuation_label: `${refName} 历史 P${Math.round(histPct * 100)}`,
    // 高位金叉警告：估值在历史 P80+ 且技术看多
    high_valuation_long_warning: histPct >= 0.8 && isLongBias,
  };
}

/** #4：卖方一致预期 → ConsensusModel */
export function mapConsensus(
  payload: import("./fetchers").ConsensusPayloadShape | null
): import("../../types/symbol-workspace").ConsensusModel | null {
  if (!payload || payload.total_reports === 0) return null;
  return {
    total_reports: payload.total_reports,
    org_count: payload.org_count,
    recent_30d_count: payload.recent_30d_count,
    rating_distribution: safeArray(payload.rating_distribution),
    eps_consensus: finiteOrNull(payload.eps_consensus),
    target_price_avg: finiteOrNull(payload.target_price_avg),
    revision_hint: payload.revision_hint ?? null,
  };
}

/** P0：盈利质量 / 现金流 → QualityMetricsModel */
export function mapQualityMetrics(
  payload: QualityMetricsPayloadShape | null
): QualityMetricsModel | null {
  if (!payload || !payload.available) return null;
  return {
    available: payload.available,
    score: finiteOrNull(payload.quality_score),
    metrics: [
      {
        key: "gross_margin",
        label: "毛利率",
        value: finiteOrNull(payload.gross_margin),
        tone: classifyTone(finiteOrNull(payload.gross_margin), 0.3, "higher"),
        unit: "ratio",
      },
      {
        key: "net_margin",
        label: "净利率",
        value: finiteOrNull(payload.net_margin),
        tone: classifyTone(finiteOrNull(payload.net_margin), 0.1, "higher"),
        unit: "ratio",
      },
      {
        key: "ocf_to_net_income",
        label: "现金流/净利",
        value: finiteOrNull(payload.ocf_to_net_income),
        tone: classifyTone(finiteOrNull(payload.ocf_to_net_income), 1, "higher"),
        unit: "ratio",
      },
      {
        key: "free_cashflow",
        label: "自由现金流",
        value: finiteOrNull(payload.free_cashflow),
        tone: classifyTone(finiteOrNull(payload.free_cashflow), 0, "higher"),
        unit: "currency",
      },
      {
        key: "debt_to_assets",
        label: "资产负债率",
        value: finiteOrNull(payload.debt_to_assets),
        tone: classifyTone(finiteOrNull(payload.debt_to_assets), 0.5, "lower"),
        unit: "ratio",
      },
      {
        key: "roe",
        label: "ROE",
        value: finiteOrNull(payload.roe),
        tone: classifyTone(finiteOrNull(payload.roe), 0.15, "higher"),
        unit: "ratio",
      },
    ],
    flags: safeArray(payload.flags).map((flag) => ({
      key: flag.key,
      label: flag.label,
      value: finiteOrNull(flag.value),
      tone: asTone(flag.tone),
      detail: flag.detail,
    })),
  };
}

/** P0：筹码集中度 → HoldingConcentrationModel */
export function mapHoldingConcentration(
  payload: HoldingConcentrationPayloadShape | null
): HoldingConcentrationModel | null {
  if (!payload || !payload.available) return null;
  return {
    available: payload.available,
    score: finiteOrNull(payload.concentration_score),
    northbound_float_pct: finiteOrNull(payload.northbound_float_pct),
    fund_float_pct: finiteOrNull(payload.fund_float_pct),
    fund_count: finiteOrNull(payload.fund_count),
    shareholder_count: finiteOrNull(payload.shareholder_count),
    shareholder_count_delta_pct: finiteOrNull(payload.shareholder_count_delta_pct),
    top10_holder_pct: finiteOrNull(payload.top10_holder_pct),
    items: safeArray(payload.items).map((item) => ({
      key: item.key,
      label: item.label,
      value: finiteOrNull(item.value),
      tone: asTone(item.tone),
      detail: item.detail,
    })),
  };
}

/** BE-7：龙虎榜机构席位 → InstitutionalDesk[] */
export function mapInstitutionalDesks(
  payload: InstitutionalDesksPayloadShape | null
): InstitutionalDesk[] {
  if (!payload) return [];
  return safeArray(payload.items).map((it) => ({
    name: it.name,
    tag: (it.tag === "北向" || it.tag === "机构") ? it.tag : "机构",
    net: finiteOrNull(it.net),
    date: it.date,
  }));
}

// ============================================================
// 衍生：signal → SignalDetail
// ============================================================

export function mapSignalDetail(
  signal: SignalHistoryPayloadShape["signals"][number] | null,
  explain: {
    review?: {
      decision_status?: string;
      summary?: string | null;
      confidence?: string | null;
      risk_flags?: string[];
    };
    layers?: {
      decision?: { next_step?: string; action?: string };
      explain?: {
        evidence?: string[];
        risks?: string[];
        invalidations?: string[];
      };
      audit?: { generated_at?: string };
    };
  } | null
): SignalDetail | null {
  if (!signal) return null;
  const evidence =
    explain?.layers?.explain?.evidence ?? parseJsonList(signal.evidence_json);
  const risks =
    explain?.layers?.explain?.risks ?? parseJsonList(signal.risk_json);
  const invalidate =
    explain?.layers?.explain?.invalidations ??
    parseJsonList(signal.invalid_json);
  const agent = explain?.review
    ? {
        verdict: explain.review.decision_status ?? "pending",
        tone: (explain.review.decision_status?.includes("watch")
          ? "warning"
          : explain.review.decision_status?.includes("buy")
            ? "success"
            : "neutral") as Tone,
        summary: explain.review.summary ?? "审查待生成",
        issued_at: explain.layers?.audit?.generated_at ?? "",
      }
    : null;
  return {
    id: signal.signal_id,
    title: signal.signal_name,
    issued_at: signal.date,
    score: finiteOrNull(signal.score ?? null),
    evidence,
    risks,
    invalidate,
    agent,
  };
}
