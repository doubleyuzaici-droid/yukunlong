// V2 API Hooks — 基于 useAsync
// 拆 5 个 hook 对应 5 个 Tab payload，按需懒拉
import { useAsync } from "../../utils/useAsync";
import type {
  StrategyMode,
  SymbolChartPayload,
  SymbolCriticalPayload,
  SymbolFundamentalsPayload,
  SymbolPlaybookPayload,
  SymbolPulsePayload,
} from "../../types/symbol-workspace";
import * as F from "./fetchers";
import * as M from "./mappers";

function defaultStart(end: string, years = 1): string {
  const dt = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) {
    return new Date(Date.now() - years * 365 * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  dt.setUTCFullYear(dt.getUTCFullYear() - years);
  return dt.toISOString().slice(0, 10);
}

// ============================================================
// useSymbolCritical — 关键路径
// ============================================================
export function useSymbolCritical(symbol: string, date: string) {
  const start = F.defaultKlineStart(date);
  return useAsync<SymbolCriticalPayload & { bars: import("../../types/market").MarketHistoryBar[] }>(
    async (signal) => {
      const [history, context, readiness, realtime, signals, watchlist] =
        await Promise.all([
          F.fetchHistory(symbol, start, date, signal).catch(() => null),
          F.fetchContext(symbol, start, date, signal).catch(() => null),
          F.fetchReadiness(symbol, date, signal).catch(() => null),
          F.fetchRealtime(symbol, signal).catch(() => null),
          F.fetchSignalHistory(symbol, start, date, signal).catch(() => null),
          fetch("/api/research/watchlist", { signal })
            .then((r) => r.json())
            .then((b) =>
              b?.success
                ? (b.data as { symbol: string; name?: string | null }[])
                : []
            )
            .catch(() => [] as { symbol: string; name?: string | null }[]),
        ]);

      const rtQuote = realtime?.quotes?.[0] ?? null;
      const headerOut = M.mapHeader({ history, realtime: rtQuote });
      const profileOut = M.mapProfile({
        history,
        context,
        fundamentals: null, // critical 路径不拉 fundamentals
      });
      const status = M.mapDataStatus(readiness);
      const navigation = M.mapNavData({
        currentSymbol: symbol,
        watchlist,
        signals: signals?.signals ?? [],
        recent: readRecent(),
      });

      return {
        header: headerOut.data,
        profile: profileOut.data,
        status,
        navigation,
        bars: history?.bars ?? [],
      };
    },
    [symbol, date],
    {
      computePartial: (d) => {
        const m: string[] = [];
        if (d.header.price == null) m.push("header.price");
        if (d.profile.market_cap_yi == null) m.push("profile.market_cap");
        if (d.profile.pe_ttm == null) m.push("profile.pe_ttm");
        if (d.status.kind === "partial" || d.status.kind === "stale")
          m.push("data_status.partial");
        return m;
      },
    }
  );
}

// ============================================================
// useSymbolPulse — Tab 1
// ============================================================
export function useSymbolPulse(
  symbol: string,
  date: string,
  mode: StrategyMode
) {
  const start = defaultStart(date, 1);
  return useAsync<SymbolPulsePayload>(
    async (signal) => {
      // #2/#3：pulse 增拉 backtest（regime 胜率）+ valuation（三维合一）
      // 两者失败不阻塞主流程，对应 context 走 null
      const [history, context, analysis, backtest, valuation] = await Promise.all([
        F.fetchHistory(symbol, start, date, signal).catch(() => null),
        F.fetchContext(symbol, start, date, signal).catch(() => null),
        F.fetchStrategy(symbol, start, date, mode, signal).catch(() => null),
        F.fetchBacktestSummary(symbol, signal).catch(() => null),
        F.fetchValuationPercentile(symbol, date, signal).catch(() => null),
      ]);

      const decision = M.mapDecision({ analysis, mode });
      const narrative = M.mapNarrative({ analysis });
      const indicators = M.mapIndicators({ context, history });
      const riskCtx = M.mapRiskBudgetContext({ history, context });

      const riskFlags = [
        ...(analysis?.data_quality?.blocking_reasons ?? []).map((t) => ({
          text: t,
          tone: "danger" as const,
        })),
        ...(analysis?.data_quality?.warnings ?? []).map((t) => ({
          text: t,
          tone: "warning" as const,
        })),
      ].slice(0, 5);

      // #2: 当前市场状态 → 来自 market context 的 market_state.regime
      const currentRegime =
        (context as unknown as { market_state?: { regime?: string } } | null)
          ?.market_state?.regime ?? null;
      const regimeContext = M.buildRegimeContext(backtest, currentRegime);

      // #3: 三维合一（估值分位 × 决策语气）
      const tripleContext = M.buildTripleContext(valuation, decision.data.tone);

      return {
        decision: decision.data,
        narrative: narrative.data,
        indicators: indicators.data,
        risk_context: riskCtx,
        risk_flags: riskFlags,
        regime_context: regimeContext,
        triple_context: tripleContext,
      };
    },
    [symbol, date, mode],
    {
      computePartial: (d) => {
        const m: string[] = [];
        if (d.decision.score == null) m.push("decision.score");
        if (d.risk_context.entry == null) m.push("risk.entry");
        if (d.risk_context.atr14 == null) m.push("risk.atr14");
        if (d.indicators[2]?.items[0]?.value === "待接入")
          m.push("indicators.long");
        if (d.regime_context == null) m.push("regime.history");
        if (d.triple_context == null) m.push("valuation.context");
        return m;
      },
      isEmpty: (d) => !d.decision || d.indicators.length === 0,
    }
  );
}

// ============================================================
// useSymbolChart — Tab 2
// ============================================================
export function useSymbolChart(
  symbol: string,
  date: string,
  mode: StrategyMode = "conservative"
) {
  const start = F.defaultKlineStart(date);
  return useAsync<SymbolChartPayload>(
    async (signal) => {
      const [history, context, signals, news, catalystsResp, analysis, readiness] = await Promise.all([
        F.fetchHistory(symbol, start, date, signal).catch(() => null),
        F.fetchContext(symbol, start, date, signal).catch(() => null),
        F.fetchSignalHistory(symbol, start, date, signal).catch(() => null),
        F.fetchNews(symbol, defaultStart(date, 0.2), date, signal).catch(
          () => null
        ),
        F.fetchCatalysts(symbol, date, signal).catch(() => null),
        F.fetchStrategy(symbol, start, date, mode, signal).catch(() => null),
        F.fetchReadiness(symbol, date, signal).catch(() => null),
      ]);
      const candles = M.mapCandles(history);
      const markers = M.mapSignalMarkers(
        signals?.signals ?? [],
        candles.map((c) => ({ trading_date: c.trading_date }))
      );
      // Phase 2 起优先用 BE-3；未接入时 fallback 到 news
      const catalysts = catalystsResp
        ? M.mapCatalysts(catalystsResp, date)
        : M.mapCatalystsFromNews(news, date);
      return {
        kline: candles,
        signals: markers,
        catalysts: {
          past: catalysts.past,
          future: catalysts.future,
          future_window_days: 30,
        },
        history,
        context,
        raw_signals: signals?.signals ?? [],
        strategy_analysis: analysis,
        readiness,
      };
    },
    [symbol, date, mode],
    {
      computePartial: (d) => {
        const m: string[] = [];
        if (d.catalysts.future.length === 0) m.push("catalysts.future");
        if (!d.context) m.push("market.context");
        if (!d.strategy_analysis) m.push("strategy.analysis");
        return m;
      },
      isEmpty: (d) => d.kline.length === 0,
    }
  );
}

// ============================================================
// useSymbolFundamentals — Tab 3
// ============================================================
export function useSymbolFundamentals(symbol: string, date: string) {
  const start = defaultStart(date, 0.2);
  return useAsync<SymbolFundamentalsPayload>(
    async (signal) => {
      const [
        fundamentals,
        quarterly,
        valuation,
        news,
        context,
        desks,
        consensus,
        quality,
        holding,
      ] =
        await Promise.all([
          F.fetchFundamentals(symbol, date, signal).catch(() => null),
          F.fetchFundamentalsQuarterly(symbol, date, signal, 8).catch(() => null),
          F.fetchValuationPercentile(symbol, date, signal).catch(() => null),
          F.fetchNews(symbol, start, date, signal).catch(() => null),
          F.fetchContext(symbol, defaultStart(date, 0.1), date, signal).catch(
            () => null
          ),
          F.fetchInstitutionalDesks(symbol, date, signal).catch(() => null),
          F.fetchConsensus(symbol, date, signal).catch(() => null),
          F.fetchQualityMetrics(symbol, date, signal).catch(() => null),
          F.fetchHoldingConcentration(symbol, date, signal).catch(() => null),
        ]);
      // 注入 BE-1 的 quarterly_series 字段到 fundamentals 对象
      const mergedFundamentals = fundamentals
        ? { ...fundamentals, quarterly_series: quarterly?.quarterly_series }
        : quarterly
          ? ({ quarterly_series: quarterly.quarterly_series } as never)
          : null;
      const financials =
        M.mapFinancialSeries(mergedFundamentals) ?? {
          quarters: [],
          revenue: [],
          net_profit: [],
          roe: [],
        };
      return {
        valuation: M.mapValuationPercentile(valuation),
        financials,
        disclosures: M.mapDisclosures(news),
        northbound: M.mapNorthboundSeries(context) ?? {
          series: [],
          dates: [],
          start_date: "",
          end_date: "",
          source: "cumulative_inflow",
        },
        institutional: M.mapInstitutionalDesks(desks),
        consensus: M.mapConsensus(consensus),
        quality: M.mapQualityMetrics(quality),
        holding: M.mapHoldingConcentration(holding),
      };
    },
    [symbol, date],
    {
      computePartial: (d) => {
        const m: string[] = [];
        if (d.valuation.length === 0) m.push("valuation.percentile");
        if (d.financials.quarters.length === 0) m.push("financials.series");
        if (d.northbound.series.length === 0) m.push("northbound.series");
        if (d.institutional.length === 0) m.push("institutional.desks");
        if (d.consensus == null) m.push("consensus.reports");
        if (d.quality == null) m.push("quality.metrics");
        if (d.holding == null) m.push("holding.concentration");
        return m;
      },
    }
  );
}

// ============================================================
// useSymbolPlaybook — Tab 4
// ============================================================
export function useSymbolPlaybook(
  symbol: string,
  date: string,
  selectedSignalId?: string | null
) {
  const start = defaultStart(date, 1);
  return useAsync<SymbolPlaybookPayload>(
    async (signal) => {
      // 增拉 context 取当前 regime，用于标记后验表里"当前所处市场状态"
      const [signalsResp, history, context] = await Promise.all([
        F.fetchSignalHistory(symbol, start, date, signal).catch(() => null),
        F.fetchHistory(symbol, start, date, signal).catch(() => null),
        F.fetchContext(symbol, defaultStart(date, 0.1), date, signal).catch(
          () => null
        ),
      ]);
      const currentRegime =
        (context as unknown as { market_state?: { regime?: string } } | null)
          ?.market_state?.regime ?? null;
      const historyModel = M.mapPlaybookHistory({
        signals: signalsResp?.signals ?? [],
        bars: history?.bars ?? [],
      });
      const topSignal =
        signalsResp?.signals?.find((item) => item.signal_id === selectedSignalId) ??
        signalsResp?.signals?.[0] ??
        null;
      type ExplainShape = Parameters<typeof M.mapSignalDetail>[1];
      let explain: ExplainShape = null;
      if (topSignal) {
        try {
          const r = await fetch(
            `/api/professional/signal-explain?signal_id=${encodeURIComponent(
              topSignal.signal_id
            )}`,
            { signal }
          );
          const body = (await r.json()) as { success: boolean; data?: unknown };
          if (body.success && body.data) {
            explain = body.data as ExplainShape;
          }
        } catch {
          /* ignore */
        }
      }
      const backtestResp = await F.fetchBacktestSummary(symbol, signal).catch(
        () => null
      );

      const notes = readNotes(symbol, date);
      return {
        signal_detail: M.mapSignalDetail(topSignal, explain),
        backtest: backtestResp
          ? {
              n: backtestResp.n,
              win: backtestResp.win,
              loss: backtestResp.loss,
              win_rate: backtestResp.win_rate,
              avg_5d: backtestResp.avg_5d,
              avg_20d: backtestResp.avg_20d,
              avg_60d: backtestResp.avg_60d,
              max_adverse: backtestResp.max_adverse,
              curve: backtestResp.curve,
              curve_start: backtestResp.curve_dates[0] ?? "",
              curve_end:
                backtestResp.curve_dates[backtestResp.curve_dates.length - 1] ??
                "",
              sample_quality: backtestResp.sample_quality,
              // #2: 当前 regime 由 Hero 的 regime_context 负责高亮，这里展示全部桶
              by_regime: M.mapRegimeWinRates(backtestResp, currentRegime),
            }
          : null,
        selected_signal_id: topSignal?.signal_id ?? null,
        history_signals: historyModel.signals,
        recent_bars: historyModel.recentBars,
        notes,
      };
    },
    [symbol, date, selectedSignalId],
    {
      computePartial: (d) => {
        const m: string[] = [];
        if (!d.signal_detail) m.push("signal_detail");
        if (!d.backtest) m.push("backtest.summary");
        if (d.history_signals.length === 0) m.push("history.signals");
        if (d.recent_bars.length === 0) m.push("history.recent_bars");
        return m;
      },
    }
  );
}

// ============================================================
// 本地持久化辅助
// ============================================================

const RECENT_KEY = "tradingagents.symbol-workspace-v2.recentSymbols";

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function rememberRecent(symbol: string) {
  try {
    const list = readRecent();
    const next = [symbol, ...list.filter((x) => x !== symbol)].slice(0, 8);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

const NOTES_KEY = (symbol: string, date: string) =>
  `tradingagents.symbol-workspace-v2.notes.${symbol}.${date}`;

function readNotes(symbol: string, date: string) {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY(symbol, date));
    return raw
      ? (JSON.parse(raw) as {
          id: string;
          timestamp: string;
          body: string;
          pinned: boolean;
          tags: string[];
        }[])
      : [];
  } catch {
    return [];
  }
}

export function writeNotes(
  symbol: string,
  date: string,
  notes: {
    id: string;
    timestamp: string;
    body: string;
    pinned: boolean;
    tags: string[];
  }[]
) {
  try {
    window.localStorage.setItem(NOTES_KEY(symbol, date), JSON.stringify(notes));
  } catch {
    /* ignore */
  }
}
