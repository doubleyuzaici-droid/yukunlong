type MarketQuoteLike = {
  price?: number | null;
  prev_close?: number | null;
  change?: number | null;
  change_pct?: number | null;
  high?: number | null;
  low?: number | null;
  amount?: number | null;
  trade_date?: string | null;
  freshness_status?: string | null;
  freshness_text?: string | null;
  delay_policy?: string | null;
};

type MarketBarLike = {
  date: string;
  close?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  amount?: number | null;
};

type FactorLike = {
  ma20?: number | null;
  ma60?: number | null;
  ma120?: number | null;
  rsi14?: number | null;
  atr14?: number | null;
  volume_ratio20?: number | null;
  ret20?: number | null;
  ret60?: number | null;
  rel_strength_index20?: number | null;
  rel_strength_industry20?: number | null;
  main_net_inflow_ratio20?: number | null;
  northbound_inflow_5d?: number | null;
};

type MarketContextLike = {
  factor_snapshot?: FactorLike | null;
  fund_flow_snapshot?: {
    main_net_inflow?: number | null;
  } | null;
  market_state?: {
    label?: string | null;
  } | null;
  relative_strength?: {
    rank?: number | null;
    total?: number | null;
  } | null;
  data_coverage?: {
    factor_rows?: number | null;
    fund_flow_rows?: number | null;
  } | null;
};

type ReadinessLike = {
  date?: string | null;
  score?: number | null;
  level?: string | null;
  summary?: {
    ready_count?: number | null;
    warn_count?: number | null;
    blocker_count?: number | null;
  } | null;
  categories?: {
    key?: string | null;
    label?: string | null;
    status?: string | null;
    impact?: string | null;
    next_step?: string | null;
  }[];
};

type SignalLike = {
  signal_id?: string | null;
  date?: string | null;
  symbol?: string | null;
  direction?: string | null;
  score?: number | null;
  signal_name?: string | null;
  signal_level?: string | null;
  review_count?: number | null;
  evidence_json?: string | string[] | null;
  risk_json?: string | string[] | null;
  invalid_json?: string | string[] | null;
  event_return?: {
    ret_20d?: number | null;
    max_adverse_20d?: number | null;
  } | null;
};

type StrategyLike = {
  latest_bar?: {
    date?: string | null;
    close?: number | null;
  } | null;
  decision?: {
    action?: string | null;
    label?: string | null;
    tone?: string | null;
  } | null;
  trend_state?: {
    action?: string | null;
  } | null;
  buy_signal?: {
    mode_signal?: boolean | null;
  } | null;
  market_filter?: {
    passed?: boolean | null;
    status?: string | null;
    benchmark_symbol?: string | null;
  } | null;
  sell_signal?: {
    regular_exit?: boolean | null;
    emergency?: boolean | null;
    warning_level?: {
      level?: number | null;
      label?: string | null;
      action?: string | null;
    } | null;
  } | null;
  data_quality?: {
    warnings?: string[];
    blocking_reasons?: string[];
  } | null;
};

export type MarketAnalysisTone = "opportunity" | "risk" | "warn" | "neutral" | "missing" | "good";

export type KlineEvidenceEventKind = "evidence" | "risk" | "invalid" | "review" | "readiness" | "strategy" | "market";
export type KlineEvidenceEventTone = "good" | "warn" | "risk" | "neutral";

export interface KlineEvidenceEvent {
  id: string;
  date: string;
  original_date?: string;
  kind: KlineEvidenceEventKind;
  tone: KlineEvidenceEventTone;
  label: string;
  title: string;
  detail: string;
  signal_id?: string | null;
}

export interface MarketAnalysisItem {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: MarketAnalysisTone;
  nextStep?: string;
}

export interface MarketAnalysisSparkPoint {
  date: string;
  value: number;
  tone?: MarketAnalysisTone;
}

export interface MarketAnalysisTechnicalChart {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: MarketAnalysisTone;
  points: MarketAnalysisSparkPoint[];
  scaleMin?: number;
  scaleMax?: number;
}

export interface MarketAnalysisOverviewModel {
  radar: MarketAnalysisItem[];
  indicators: MarketAnalysisItem[];
  chartFeatures: MarketAnalysisItem[];
  technicalCharts: MarketAnalysisTechnicalChart[];
  evidence: MarketAnalysisItem[];
  nextSteps: string[];
  summary: {
    title: string;
    subtitle: string;
    tone: MarketAnalysisTone;
  };
}

export interface MarketAnalysisOverviewInput {
  history: {
    bar_count?: number;
    quote?: MarketQuoteLike | null;
    bars?: MarketBarLike[];
  } | null;
  context: MarketContextLike | null;
  signals: SignalLike[];
  readiness: ReadinessLike | null;
  strategyAnalysis: StrategyLike | null;
}

export function buildKlineEvidenceEvents({
  history,
  signals,
  readiness,
  strategyAnalysis,
}: Pick<MarketAnalysisOverviewInput, "history" | "signals" | "readiness" | "strategyAnalysis">): KlineEvidenceEvent[] {
  const bars = [...(history?.bars || [])]
    .filter((bar) => bar.date)
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestDate = strategyAnalysis?.latest_bar?.date || readiness?.date || bars[bars.length - 1]?.date || "";
  const events: KlineEvidenceEvent[] = [];

  signals.forEach((signal) => {
    if (!signal.date) return;
    const signalId = signal.signal_id || `${signal.date}-${signal.signal_name || "signal"}`;
    const signalTitle = signal.signal_name || "信号证据";
    const evidence = parseEvidenceList(signal.evidence_json);
    const risks = parseEvidenceList(signal.risk_json);
    const invalidations = parseEvidenceList(signal.invalid_json);

    if (evidence.length > 0) {
      events.push({
        id: `${signalId}-evidence`,
        date: signal.date,
        kind: "evidence",
        tone: signal.direction === "opportunity" ? "good" : "neutral",
        label: "证",
        title: `${signalTitle} · 证据`,
        detail: evidence[0],
        signal_id: signal.signal_id,
      });
    }
    if (risks.length > 0) {
      events.push({
        id: `${signalId}-risk`,
        date: signal.date,
        kind: "risk",
        tone: "risk",
        label: "险",
        title: `${signalTitle} · 风险`,
        detail: risks[0],
        signal_id: signal.signal_id,
      });
    }
    if (invalidations.length > 0) {
      events.push({
        id: `${signalId}-invalid`,
        date: signal.date,
        kind: "invalid",
        tone: "warn",
        label: "失",
        title: `${signalTitle} · 失效条件`,
        detail: invalidations[0],
        signal_id: signal.signal_id,
      });
    }
    if ((signal.review_count || 0) > 0) {
      events.push({
        id: `${signalId}-review`,
        date: signal.date,
        kind: "review",
        tone: "good",
        label: "审",
        title: `${signalTitle} · Agent审查`,
        detail: `${signal.review_count || 0} 次审查 · ${signal.signal_level || "-"}级 · 评分 ${formatNumber(signal.score, 1)}`,
        signal_id: signal.signal_id,
      });
    }
  });

  (readiness?.categories || [])
    .filter((category) => category.status && category.status !== "ready")
    .slice(0, 4)
    .forEach((category) => {
      const date = readiness?.date || latestDate;
      if (!date) return;
      events.push({
        id: `readiness-${category.key || category.label || category.status}`,
        date,
        kind: "readiness",
        tone: category.status === "blocker" ? "risk" : "warn",
        label: category.status === "blocker" ? "缺" : "待",
        title: `${category.label || "分析完整度"} · ${category.status}`,
        detail: category.next_step || category.impact || "补齐数据后再做结论。",
      });
    });

  const strategyDate = strategyAnalysis?.latest_bar?.date || latestDate;
  if (strategyDate) {
    (strategyAnalysis?.data_quality?.blocking_reasons || []).slice(0, 3).forEach((detail, index) => {
      events.push({
        id: `strategy-blocker-${index}`,
        date: strategyDate,
        kind: "strategy",
        tone: "risk",
        label: "阻",
        title: "V2策略阻断",
        detail,
      });
    });
    (strategyAnalysis?.data_quality?.warnings || []).slice(0, 3).forEach((detail, index) => {
      events.push({
        id: `strategy-warning-${index}`,
        date: strategyDate,
        kind: "strategy",
        tone: "warn",
        label: "数",
        title: "V2数据提示",
        detail,
      });
    });
    if (strategyAnalysis?.market_filter && strategyAnalysis.market_filter.passed === false) {
      events.push({
        id: "strategy-market-filter",
        date: strategyDate,
        kind: "market",
        tone: "risk",
        label: "盘",
        title: "大盘过滤未通过",
        detail: `${strategyAnalysis.market_filter.benchmark_symbol || "-"} · ${strategyAnalysis.market_filter.status || "未通过"}`,
      });
    }
  }

  return events
    .filter((event) => event.date && event.detail)
    .sort((left, right) => left.date.localeCompare(right.date) || eventToneRank(left.tone) - eventToneRank(right.tone));
}

export function classifyIndicatorTone(
  value?: number | null,
  threshold = 0,
  direction: "higher" | "lower" = "higher",
): MarketAnalysisTone {
  if (typeof value !== "number" || !Number.isFinite(value)) return "missing";
  const spread = direction === "higher" ? value - threshold : threshold - value;
  if (spread > Math.max(Math.abs(threshold) * 0.1, 0.02)) return "opportunity";
  if (spread < -Math.max(Math.abs(threshold) * 0.1, 0.02)) return "risk";
  return "neutral";
}

export function buildMarketAnalysisOverview({
  history,
  context,
  signals,
  readiness,
  strategyAnalysis,
}: MarketAnalysisOverviewInput): MarketAnalysisOverviewModel {
  const quote = history?.quote || null;
  const factor = context?.factor_snapshot || null;
  const bars = [...(history?.bars || [])]
    .filter((bar) => bar.date && typeof bar.close === "number")
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestBar = bars[bars.length - 1];
  const latestClose = quote?.price ?? latestBar?.close ?? factor?.ma20 ?? null;
  const derived = deriveOverviewIndicators(bars);
  const latestSignal = signals[0] || null;
  const readinessGaps = readiness?.categories?.filter((item) => item.status !== "ready") || [];
  const strategyBlocks = [
    ...(strategyAnalysis?.data_quality?.blocking_reasons || []),
    ...(strategyAnalysis?.data_quality?.warnings || []),
  ];
  const trendTone = trendIndicatorTone(latestClose, factor);
  const strategyTone = strategyAnalysis ? strategyDecisionToneForOverview(strategyAnalysis) : "missing";
  const blockerCount = readiness?.summary?.blocker_count || 0;
  const warningCount = readiness?.summary?.warn_count || 0;
  const summaryTone: MarketAnalysisTone =
    blockerCount > 0 || strategyBlocks.length > 0
      ? "risk"
      : strategyTone === "opportunity" || trendTone === "opportunity"
        ? "opportunity"
        : warningCount > 0
          ? "warn"
          : "neutral";
  const nextSteps = buildOverviewNextSteps({
    history,
    context,
    readiness,
    strategyAnalysis,
    latestSignal,
    readinessGaps,
  });

  return {
    summary: {
      title: strategyAnalysis?.decision?.label || (latestSignal?.signal_name ? `${latestSignal.signal_name}观察` : "行情分析待确认"),
      subtitle: strategyAnalysis?.trend_state?.action || context?.market_state?.label || "先确认行情、指标、资金和证据覆盖。",
      tone: summaryTone,
    },
    radar: [
      {
        key: "last",
        label: "最新价",
        value: formatNumber(latestClose, 2),
        detail: `${formatSignedNumber(quote?.change, 2)} / ${formatSignedPercent(quote?.change_pct)}`,
        tone: quoteToneForOverview(quote?.change_pct),
      },
      {
        key: "amplitude",
        label: "振幅",
        value: formatSignedPercent(amplitudePct(quote)),
        detail: `高低 ${formatNumber(quote?.high, 2)} / ${formatNumber(quote?.low, 2)}`,
        tone: typeof amplitudePct(quote) === "number" && (amplitudePct(quote) || 0) > 0.06 ? "warn" : "neutral",
      },
      {
        key: "amount",
        label: "成交额",
        value: formatMoney(quote?.amount ?? latestBar?.amount),
        detail: `量比 ${formatNumber(factor?.volume_ratio20 ?? derived.volumeRatio, 2)}`,
        tone: classifyIndicatorTone(factor?.volume_ratio20 ?? derived.volumeRatio, 1, "higher"),
      },
      {
        key: "return",
        label: "20/60日收益",
        value: `${formatSignedPercent(factor?.ret20)} / ${formatSignedPercent(factor?.ret60)}`,
        detail: `相对指数 ${formatSignedPercent(factor?.rel_strength_index20)}`,
        tone: classifyIndicatorTone(factor?.ret20, 0, "higher"),
      },
      {
        key: "freshness",
        label: "行情新鲜度",
        value: quote?.freshness_text || quote?.trade_date || "-",
        detail: quote?.delay_policy || "本地研究行情，不代表实时可交易盘口。",
        tone: quote?.freshness_status === "fresh" ? "good" : quote ? "warn" : "missing",
      },
    ],
    indicators: [
      {
        key: "trend",
        label: "趋势均线",
        value: `${formatNumber(factor?.ma20, 2)} / ${formatNumber(factor?.ma60, 2)} / ${formatNumber(factor?.ma120, 2)}`,
        detail: trendIndicatorDetail(latestClose, factor),
        tone: trendTone,
        nextStep: "切到图表信号页查看 MA/EMA/VWAP/BOLL 叠加。",
      },
      {
        key: "macd",
        label: "MACD 动能",
        value: `${formatNumber(derived.macdDif, 2)} / ${formatNumber(derived.macdDea, 2)}`,
        detail: `柱 ${formatNumber(derived.macdHistogram, 2)}，用于观察趋势扩散或背离。`,
        tone: classifyIndicatorTone(derived.macdHistogram, 0, "higher"),
        nextStep: "结合成交量和周线趋势确认，不单独作为动作依据。",
      },
      {
        key: "rsi",
        label: "RSI 强弱",
        value: formatNumber(factor?.rsi14 ?? derived.rsi14, 1),
        detail: rsiIndicatorDetail(factor?.rsi14 ?? derived.rsi14),
        tone: rsiIndicatorTone(factor?.rsi14 ?? derived.rsi14),
      },
      {
        key: "kdj",
        label: "KDJ 摆动",
        value: `${formatNumber(derived.kdjK, 1)} / ${formatNumber(derived.kdjD, 1)} / ${formatNumber(derived.kdjJ, 1)}`,
        detail: "用于观察短线钝化和反转风险。",
        tone: kdjIndicatorTone(derived.kdjJ),
      },
      {
        key: "boll",
        label: "BOLL 位置",
        value: `${formatNumber(derived.bollLower, 2)} / ${formatNumber(derived.bollMid, 2)} / ${formatNumber(derived.bollUpper, 2)}`,
        detail: bollIndicatorDetail(latestClose, derived.bollLower, derived.bollMid, derived.bollUpper),
        tone: bollIndicatorTone(latestClose, derived.bollLower, derived.bollMid, derived.bollUpper),
      },
      {
        key: "atr_obv",
        label: "ATR / OBV",
        value: `${formatNumber(factor?.atr14 ?? derived.atr14, 2)} / ${formatCompactNumber(derived.obv)}`,
        detail: "ATR 衡量波动，OBV 辅助确认量价方向。",
        tone: factor?.atr14 || derived.atr14 ? "neutral" : "missing",
      },
      {
        key: "fund_flow",
        label: "资金流",
        value: formatMoney(context?.fund_flow_snapshot?.main_net_inflow),
        detail: `主力强度 ${formatNumber(factor?.main_net_inflow_ratio20, 2)}，北向5日 ${formatMoney(factor?.northbound_inflow_5d)}`,
        tone: classifyIndicatorTone(factor?.main_net_inflow_ratio20, 0, "higher"),
        nextStep: context?.data_coverage?.fund_flow_rows ? undefined : "同步主力/北向资金流后再判断量价背离。",
      },
      {
        key: "relative_strength",
        label: "相对强弱",
        value: context?.relative_strength?.rank ? `${context.relative_strength.rank}/${context.relative_strength.total}` : "-",
        detail: `指数 ${formatSignedPercent(factor?.rel_strength_index20)}，行业 ${formatSignedPercent(factor?.rel_strength_industry20)}`,
        tone: classifyIndicatorTone(factor?.rel_strength_index20, 0, "higher"),
      },
    ],
    chartFeatures: [
      {
        key: "indicator_stack",
        label: "指标叠加",
        value: "已接入",
        detail: "MA / EMA / BOLL / VWAP / VOL / MACD / RSI / KDJ / ATR / OBV / 相对强弱",
        tone: history?.bar_count ? "good" : "missing",
      },
      {
        key: "period_zoom",
        label: "周期与缩放",
        value: "日/周/月",
        detail: "60/120/260/520/780/全部区间，支持滚轮缩放、拖拽平移、测距。",
        tone: "good",
      },
      {
        key: "signal_layer",
        label: "信号层",
        value: `${signals.length} 条`,
        detail: "信号点、入场连线、hover 解释、策略价位线和右侧审查联动。",
        tone: signals.length ? "good" : "warn",
      },
      {
        key: "unavailable_depth",
        label: "盘口逐笔",
        value: "未接入",
        detail: "当前不展示真实盘口、逐笔和券商交易控件，避免误导为实盘能力。",
        tone: "missing",
      },
    ],
    technicalCharts: buildOverviewTechnicalCharts(bars),
    evidence: [
      {
        key: "strategy",
        label: "V2 策略",
        value: strategyAnalysis?.decision?.label || "-",
        detail: strategyAnalysis?.trend_state?.action || "等待策略分析结果。",
        tone: strategyTone,
      },
      {
        key: "readiness",
        label: "分析完整度",
        value: typeof readiness?.score === "number" ? `${Math.round(readiness.score * 100)}%` : "-",
        detail: readiness ? `${readiness.summary?.ready_count || 0} ready / ${readiness.summary?.warn_count || 0} warn / ${readiness.summary?.blocker_count || 0} blocker` : "等待完整度诊断。",
        tone: blockerCount ? "risk" : warningCount ? "warn" : readiness ? "good" : "missing",
      },
      {
        key: "agent_review",
        label: "Agent 审查",
        value: latestSignal ? `${latestSignal.review_count || 0} 次` : "-",
        detail: latestSignal ? `${latestSignal.signal_name} · ${latestSignal.signal_level || "-"}` : "当前区间暂无信号审查入口。",
        tone: latestSignal?.review_count ? "good" : latestSignal ? "warn" : "missing",
      },
      {
        key: "attribution",
        label: "后验表现",
        value: latestSignal ? formatSignedPercent(latestSignal.event_return?.ret_20d) : "-",
        detail: latestSignal ? `最大不利 ${formatSignedPercent(latestSignal.event_return?.max_adverse_20d)}` : "等待信号归因或更长观察窗口。",
        tone: classifyIndicatorTone(latestSignal?.event_return?.ret_20d, 0, "higher"),
      },
    ],
    nextSteps,
  };
}

export function buildOverviewTechnicalCharts(bars: MarketBarLike[]): MarketAnalysisTechnicalChart[] {
  const orderedBars = [...(bars || [])]
    .filter((bar) => bar.date && typeof bar.close === "number" && Number.isFinite(bar.close))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (orderedBars.length === 0) {
    return [
      missingTechnicalChart("ma-distance", "MA20 偏离"),
      missingTechnicalChart("macd", "MACD 柱"),
      missingTechnicalChart("rsi", "RSI14"),
      missingTechnicalChart("kdj-j", "KDJ J"),
      missingTechnicalChart("boll-position", "BOLL %B"),
      missingTechnicalChart("atr-volatility", "ATR 波动"),
      missingTechnicalChart("obv-trend", "OBV 趋势"),
    ];
  }

  const closes = orderedBars.map((bar) => Number(bar.close));
  const highs = orderedBars.map((bar) => Number(bar.high ?? bar.close ?? 0));
  const lows = orderedBars.map((bar) => Number(bar.low ?? bar.close ?? 0));
  const volumes = orderedBars.map((bar) => Number(bar.volume || 0));
  const ma20 = movingAverageSeries(closes, 20);
  const maDistancePoints = orderedBars.flatMap((bar, index) => {
    const average = ma20[index];
    const close = closes[index];
    if (average == null || average === 0) return [];
    const value = close / average - 1;
    return [{ date: bar.date, value, tone: classifyIndicatorTone(value, 0, "higher") }];
  }).slice(-32);

  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const difSeries = closes.map((_, index) => ema12[index] - ema26[index]);
  const deaSeries = emaSeries(difSeries, 9);
  const macdPoints = orderedBars.map((bar, index) => {
    const value = (difSeries[index] - deaSeries[index]) * 2;
    return {
      date: bar.date,
      value,
      tone: value > 0 ? "good" as MarketAnalysisTone : value < 0 ? "risk" as MarketAnalysisTone : "neutral" as MarketAnalysisTone,
    };
  }).slice(-32);

  const rsiPoints = rsiSeries(closes, 14).flatMap((value, index) => {
    if (value == null) return [];
    return [{
      date: orderedBars[index].date,
      value: Math.max(0, Math.min(100, value)),
      tone: rsiIndicatorTone(value),
    }];
  }).slice(-32);
  const kdjPoints = kdjSeries(highs, lows, closes, 9).map((value, index) => ({
    date: orderedBars[index].date,
    value: Math.max(0, Math.min(100, value.j)),
    tone: kdjIndicatorTone(value.j),
  })).slice(-32);
  const bollPositionPoints = bollPositionSeries(closes, 20, 2).flatMap((value, index) => {
    if (value == null) return [];
    const bounded = Math.max(0, Math.min(100, value));
    return [{
      date: orderedBars[index].date,
      value: bounded,
      tone: bounded >= 88 ? "warn" as MarketAnalysisTone : bounded <= 12 ? "risk" as MarketAnalysisTone : bounded >= 50 ? "opportunity" as MarketAnalysisTone : "neutral" as MarketAnalysisTone,
    }];
  }).slice(-32);
  const atrVolatilityPoints = atrSeries(highs, lows, closes, 14).flatMap((value, index) => {
    const close = closes[index];
    if (value == null || !Number.isFinite(close) || close === 0) return [];
    const volatilityPct = Math.abs(value / close);
    return [{
      date: orderedBars[index].date,
      value: volatilityPct,
      tone: volatilityPct >= 0.06 ? "warn" as MarketAnalysisTone : volatilityPct <= 0.018 ? "neutral" as MarketAnalysisTone : "opportunity" as MarketAnalysisTone,
    }];
  }).slice(-32);
  const obvPoints = obvSeries(closes, volumes).map((value, index) => ({
    date: orderedBars[index].date,
    value,
    tone: value >= 0 ? "good" as MarketAnalysisTone : "risk" as MarketAnalysisTone,
  })).slice(-32);

  const latestDistance = maDistancePoints[maDistancePoints.length - 1]?.value ?? null;
  const latestMacd = macdPoints[macdPoints.length - 1]?.value ?? null;
  const latestRsi = rsiPoints[rsiPoints.length - 1]?.value ?? null;
  const latestKdjJ = kdjPoints[kdjPoints.length - 1]?.value ?? null;
  const latestBollPosition = bollPositionPoints[bollPositionPoints.length - 1]?.value ?? null;
  const latestAtrVolatility = atrVolatilityPoints[atrVolatilityPoints.length - 1]?.value ?? null;
  const latestObv = obvPoints[obvPoints.length - 1]?.value ?? null;

  return [
    {
      key: "ma-distance",
      label: "MA20 偏离",
      value: formatSignedPercent(latestDistance),
      detail: maDistancePoints.length ? "价格相对 MA20 的偏离，辅助判断趋势惯性和回撤空间。" : "至少需要 20 根 K 线计算 MA20 偏离。",
      tone: maDistancePoints.length ? classifyIndicatorTone(latestDistance, 0, "higher") : "missing",
      points: maDistancePoints,
    },
    {
      key: "macd",
      label: "MACD 柱",
      value: formatNumber(latestMacd, 2),
      detail: "柱体高低观察动能扩散、收敛和潜在背离。",
      tone: classifyIndicatorTone(latestMacd, 0, "higher"),
      points: macdPoints,
    },
    {
      key: "rsi",
      label: "RSI14",
      value: formatNumber(latestRsi, 1),
      detail: "70/30 为常用强弱阈值，结合趋势和成交量确认。",
      tone: rsiIndicatorTone(latestRsi),
      points: rsiPoints,
      scaleMin: 0,
      scaleMax: 100,
    },
    {
      key: "kdj-j",
      label: "KDJ J",
      value: formatNumber(latestKdjJ, 1),
      detail: "J 值捕捉短线摆动和钝化，80/20 附近重点观察反转风险。",
      tone: kdjIndicatorTone(latestKdjJ),
      points: kdjPoints,
      scaleMin: 0,
      scaleMax: 100,
    },
    {
      key: "boll-position",
      label: "BOLL %B",
      value: formatNumber(latestBollPosition, 1),
      detail: "%B 表示价格在布林通道中的位置，靠近上下沿时注意突破或回落。",
      tone: latestBollPosition == null ? "missing" : latestBollPosition >= 88 ? "warn" : latestBollPosition <= 12 ? "risk" : latestBollPosition >= 50 ? "opportunity" : "neutral",
      points: bollPositionPoints,
      scaleMin: 0,
      scaleMax: 100,
    },
    {
      key: "atr-volatility",
      label: "ATR 波动",
      value: formatSignedPercent(latestAtrVolatility),
      detail: "ATR/收盘价衡量近期波动强度，过高时降低仓位和追价权重。",
      tone: latestAtrVolatility == null ? "missing" : latestAtrVolatility >= 0.06 ? "warn" : "neutral",
      points: atrVolatilityPoints,
      scaleMin: 0,
    },
    {
      key: "obv-trend",
      label: "OBV 趋势",
      value: formatCompactNumber(latestObv),
      detail: "OBV 观察成交量是否支持价格方向，用于辅助确认量价背离。",
      tone: classifyIndicatorTone(latestObv, 0, "higher"),
      points: obvPoints,
    },
  ];
}

function missingTechnicalChart(key: string, label: string): MarketAnalysisTechnicalChart {
  return {
    key,
    label,
    value: "-",
    detail: "同步历史行情和因子样本后显示技术指标走势。",
    tone: "missing",
    points: [],
  };
}

function formatNumber(value?: number | null, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function parseEvidenceList(value?: string | string[] | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    if (parsed) return [String(parsed)];
  } catch {
    return [value].filter(Boolean);
  }
  return [];
}

function eventToneRank(tone: KlineEvidenceEventTone) {
  if (tone === "risk") return 0;
  if (tone === "warn") return 1;
  if (tone === "good") return 2;
  return 3;
}

function formatSignedNumber(value?: number | null, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function formatSignedPercent(value?: number | null, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

function formatCompactNumber(value?: number | null, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(digits)}K`;
  return value.toFixed(0);
}

function quoteToneForOverview(value?: number | null): MarketAnalysisTone {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  if (value > 0) return "opportunity";
  if (value < 0) return "risk";
  return "neutral";
}

function amplitudePct(quote?: MarketQuoteLike | null) {
  if (!quote?.prev_close || typeof quote.high !== "number" || typeof quote.low !== "number") return null;
  return (quote.high - quote.low) / quote.prev_close;
}

function deriveOverviewIndicators(bars: MarketBarLike[]) {
  const closes = bars.map((bar) => Number(bar.close || 0));
  const highs = bars.map((bar) => Number(bar.high ?? bar.close ?? 0));
  const lows = bars.map((bar) => Number(bar.low ?? bar.close ?? 0));
  const volumes = bars.map((bar) => Number(bar.volume || 0));
  if (closes.length === 0) {
    return {
      macdDif: null,
      macdDea: null,
      macdHistogram: null,
      rsi14: null,
      kdjK: null,
      kdjD: null,
      kdjJ: null,
      bollLower: null,
      bollMid: null,
      bollUpper: null,
      atr14: null,
      obv: null,
      volumeRatio: null,
    };
  }
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const difSeries = closes.map((_, index) => ema12[index] - ema26[index]);
  const deaSeries = emaSeries(difSeries, 9);
  const macdDif = lastNumber(difSeries);
  const macdDea = lastNumber(deaSeries);
  const macdHistogram = typeof macdDif === "number" && typeof macdDea === "number" ? (macdDif - macdDea) * 2 : null;
  const boll = bollSnapshot(closes, 20, 2);
  const kdj = kdjSnapshot(highs, lows, closes, 9);
  const atr14 = atrSnapshot(highs, lows, closes, 14);
  const obv = obvSnapshot(closes, volumes);
  const recentVolume = volumes[volumes.length - 1];
  const volumeBase = averageNumbers(volumes.slice(Math.max(0, volumes.length - 20)));
  return {
    macdDif,
    macdDea,
    macdHistogram,
    rsi14: rsiSnapshot(closes, 14),
    kdjK: kdj.k,
    kdjD: kdj.d,
    kdjJ: kdj.j,
    bollLower: boll.lower,
    bollMid: boll.mid,
    bollUpper: boll.upper,
    atr14,
    obv,
    volumeRatio: volumeBase ? recentVolume / volumeBase : null,
  };
}

function lastNumber(values: number[]) {
  const value = values[values.length - 1];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function emaSeries(values: number[], period: number) {
  if (values.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const result = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result.push(values[index] * multiplier + result[index - 1] * (1 - multiplier));
  }
  return result;
}

function averageNumbers(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function movingAverageSeries(values: number[], period: number): (number | null)[] {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    return averageNumbers(values.slice(index - period + 1, index + 1));
  });
}

function rsiSeries(values: number[], period: number): (number | null)[] {
  return values.map((_, index) => {
    if (index < period) return null;
    return rsiSnapshot(values.slice(0, index + 1), period);
  });
}

function kdjSeries(highs: number[], lows: number[], closes: number[], period: number) {
  let k = 50;
  let d = 50;
  return closes.map((close, index) => {
    const start = Math.max(0, index - period + 1);
    const high = Math.max(...highs.slice(start, index + 1));
    const low = Math.min(...lows.slice(start, index + 1));
    const rsv = high === low ? 50 : ((close - low) / (high - low)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    return { k, d, j: 3 * k - 2 * d };
  });
}

function bollPositionSeries(values: number[], period: number, multiplier: number): (number | null)[] {
  return values.map((close, index) => {
    if (index + 1 < period) return null;
    const boll = bollSnapshot(values.slice(0, index + 1), period, multiplier);
    if (boll.lower == null || boll.upper == null || boll.upper === boll.lower) return null;
    return ((close - boll.lower) / (boll.upper - boll.lower)) * 100;
  });
}

function atrSeries(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const trueRanges = highs.map((high, index) => {
    if (index === 0) return high - lows[index];
    const previousClose = closes[index - 1];
    return Math.max(high - lows[index], Math.abs(high - previousClose), Math.abs(lows[index] - previousClose));
  });
  return trueRanges.map((_, index) => {
    if (index + 1 < period) return null;
    return averageNumbers(trueRanges.slice(index - period + 1, index + 1));
  });
}

function obvSeries(closes: number[], volumes: number[]) {
  let obv = 0;
  return closes.map((close, index) => {
    if (index > 0) {
      if (close > closes[index - 1]) obv += volumes[index] || 0;
      else if (close < closes[index - 1]) obv -= volumes[index] || 0;
    }
    return obv;
  });
}

function rsiSnapshot(values: number[], period: number) {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta >= 0) gain += delta;
    else loss += Math.abs(delta);
  }
  if (loss === 0 && gain === 0) return 50;
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

function bollSnapshot(values: number[], period: number, multiplier: number) {
  if (values.length < period) return { lower: null, mid: null, upper: null };
  const slice = values.slice(values.length - period);
  const mid = averageNumbers(slice);
  if (mid == null) return { lower: null, mid: null, upper: null };
  const variance = slice.reduce((sum, value) => sum + (value - mid) ** 2, 0) / slice.length;
  const width = Math.sqrt(variance) * multiplier;
  return { lower: mid - width, mid, upper: mid + width };
}

function kdjSnapshot(highs: number[], lows: number[], closes: number[], period: number) {
  if (closes.length === 0) return { k: null, d: null, j: null };
  let k = 50;
  let d = 50;
  closes.forEach((close, index) => {
    const start = Math.max(0, index - period + 1);
    const high = Math.max(...highs.slice(start, index + 1));
    const low = Math.min(...lows.slice(start, index + 1));
    const rsv = high === low ? 50 : ((close - low) / (high - low)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
  });
  return { k, d, j: 3 * k - 2 * d };
}

function atrSnapshot(highs: number[], lows: number[], closes: number[], period: number) {
  if (closes.length < period) return null;
  const trueRanges = highs.map((high, index) => {
    if (index === 0) return high - lows[index];
    const previousClose = closes[index - 1];
    return Math.max(high - lows[index], Math.abs(high - previousClose), Math.abs(lows[index] - previousClose));
  });
  return averageNumbers(trueRanges.slice(trueRanges.length - period));
}

function obvSnapshot(closes: number[], volumes: number[]) {
  if (closes.length === 0) return null;
  let obv = 0;
  for (let index = 1; index < closes.length; index += 1) {
    if (closes[index] > closes[index - 1]) obv += volumes[index] || 0;
    else if (closes[index] < closes[index - 1]) obv -= volumes[index] || 0;
  }
  return obv;
}

function trendIndicatorTone(close?: number | null, factor?: FactorLike | null): MarketAnalysisTone {
  if (!factor || typeof close !== "number" || !Number.isFinite(close)) return "missing";
  const { ma20, ma60, ma120 } = factor;
  if (typeof ma20 !== "number" || typeof ma60 !== "number") return "missing";
  if (close >= ma20 && ma20 >= ma60 && (typeof ma120 !== "number" || ma60 >= ma120)) return "opportunity";
  if (close < ma20 && ma20 < ma60) return "risk";
  return "neutral";
}

function trendIndicatorDetail(close?: number | null, factor?: FactorLike | null) {
  if (!factor || typeof close !== "number") return "缺少收盘价或均线因子，无法判断趋势排列。";
  if (trendIndicatorTone(close, factor) === "opportunity") return "价格位于中短期均线上方，均线呈多头排列。";
  if (trendIndicatorTone(close, factor) === "risk") return "价格跌破短中期均线，趋势转弱风险上升。";
  return "均线尚未形成清晰排列，优先观察价格与 MA20/MA60 的相对位置。";
}

function rsiIndicatorTone(value?: number | null): MarketAnalysisTone {
  if (typeof value !== "number" || !Number.isFinite(value)) return "missing";
  if (value >= 78) return "risk";
  if (value >= 68 || value <= 32) return "warn";
  if (value >= 45 && value <= 65) return "opportunity";
  return "neutral";
}

function rsiIndicatorDetail(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "缺少 RSI，等待因子计算或更多 K 线样本。";
  if (value >= 78) return "RSI 进入高位钝化区，追高风险需要降权。";
  if (value <= 32) return "RSI 接近弱势/超卖区，等待止跌确认。";
  return "RSI 位于常规强弱区，需结合趋势和成交量。";
}

function kdjIndicatorTone(value?: number | null): MarketAnalysisTone {
  if (typeof value !== "number" || !Number.isFinite(value)) return "missing";
  if (value >= 95) return "risk";
  if (value >= 80 || value <= 20) return "warn";
  if (value > 50) return "opportunity";
  return "neutral";
}

function bollIndicatorTone(
  close?: number | null,
  lower?: number | null,
  mid?: number | null,
  upper?: number | null,
): MarketAnalysisTone {
  if ([close, lower, mid, upper].some((value) => typeof value !== "number" || !Number.isFinite(value))) return "missing";
  if (Number(close) > Number(upper)) return "warn";
  if (Number(close) < Number(lower)) return "risk";
  if (Number(close) > Number(mid)) return "opportunity";
  return "neutral";
}

function bollIndicatorDetail(
  close?: number | null,
  lower?: number | null,
  mid?: number | null,
  upper?: number | null,
) {
  const tone = bollIndicatorTone(close, lower, mid, upper);
  if (tone === "missing") return "缺少 BOLL 样本，至少需要 20 根有效 K 线。";
  if (tone === "warn") return "价格突破上轨，确认趋势延续前要关注回落风险。";
  if (tone === "risk") return "价格跌破下轨，波动风险或弱势延续。";
  if (tone === "opportunity") return "价格位于中轨上方，趋势结构相对健康。";
  return "价格在中轨下方或通道中部，等待方向选择。";
}

function strategyDecisionToneForOverview(analysis: StrategyLike): MarketAnalysisTone {
  const text = [
    analysis.decision?.action,
    analysis.decision?.label,
    analysis.decision?.tone,
    analysis.sell_signal?.warning_level?.action,
    analysis.sell_signal?.warning_level?.label,
  ].filter(Boolean).join(" ");
  if (
    analysis.sell_signal?.emergency ||
    analysis.sell_signal?.regular_exit ||
    (analysis.sell_signal?.warning_level?.level || 0) > 0 ||
    /danger|warn|risk|卖|减|禁|风险|预警|sell|exit|reduce/i.test(text)
  ) {
    return "risk";
  }
  if (analysis.buy_signal?.mode_signal || /positive|opportunity|买|加|机会|buy|entry/i.test(text)) {
    return "opportunity";
  }
  return "neutral";
}

function buildOverviewNextSteps({
  history,
  context,
  readiness,
  strategyAnalysis,
  latestSignal,
  readinessGaps,
}: {
  history: MarketAnalysisOverviewInput["history"];
  context: MarketContextLike | null;
  readiness: ReadinessLike | null;
  strategyAnalysis: StrategyLike | null;
  latestSignal: SignalLike | null;
  readinessGaps: NonNullable<ReadinessLike["categories"]>;
}) {
  if (!history?.bar_count) return ["同步历史行情和最新交易日数据，再查看 K 线指标。"];
  const steps: string[] = [];
  if (!context?.data_coverage?.factor_rows) steps.push("运行因子计算，补齐 MA、RSI、ATR、相对强弱。");
  if (!context?.data_coverage?.fund_flow_rows) steps.push("同步资金流，确认成交放大是否有主力/北向支持。");
  if (!strategyAnalysis) steps.push("运行 V2 多指标共振分析，生成策略价位线和 M1-M5 检查。");
  if (!latestSignal) steps.push("运行策略扫描或写入 V2 信号，让信号点落到 K 线上。");
  const firstGapStep = readinessGaps.find((item) => item.next_step)?.next_step;
  if (firstGapStep) {
    steps.push(firstGapStep);
  } else if (readiness && readiness.level !== "ready") {
    steps.push("按分析完整度面板补齐 warn/blocker 项。");
  }
  if (steps.length === 0) steps.push("进入图表信号页放大 K 线，复核指标、信号和策略价位线。");
  return Array.from(new Set(steps)).slice(0, 4);
}
