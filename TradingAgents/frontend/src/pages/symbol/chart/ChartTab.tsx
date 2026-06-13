// Tab 2 拼装：K 线 + 催化剂时间线
// K 线复用 V1 TradingSignalKlinePanel（已经成熟，避免重写）
import { useEffect, useState } from "react";
import { Skeleton } from "../_shared/atoms";
import { AsyncBoundary } from "../_shared/AsyncBoundary";
import { CatalystTimeline } from "./CatalystTimeline";
import { SectorSnapshotStrip } from "./SectorSnapshotStrip";
import type { StrategyMode, SymbolChartPayload } from "../../../types/symbol-workspace";
import { defaultKlineStart } from "../../../api/symbol-workspace/fetchers";
import { useSymbolChart } from "../../../api/symbol-workspace/hooks";
import {
  RealtimeMarketPanel,
  TradingSignalKlinePanel,
  type ChartSignalMarker,
  type StrategyKlineAnalysis,
  type StrategyKlineBacktest,
} from "../../../components/MarketWidgets";
import { buildKlineEvidenceEvents } from "../../SymbolWorkspacePage.helpers";
import type { IntradayPayload, RealtimeQuote } from "../../../types/market";

interface Props {
  symbol: string;
  date: string;
  mode: StrategyMode;
  onModeChange: (mode: StrategyMode) => void;
}

function ChartSkeleton() {
  return (
    <>
      <Skeleton height={36} />
      <Skeleton height={420} />
      <Skeleton height={120} />
    </>
  );
}

function toChartSignals(data: SymbolChartPayload): ChartSignalMarker[] {
  return data.raw_signals.map((signal) => ({
    signal_id: signal.signal_id,
    date: signal.date,
    signal_name: signal.signal_name,
    signal_level: signal.signal_level,
    direction: signal.direction,
    entry_date: signal.event_return?.entry_date,
    entry_price: signal.event_return?.entry_price,
    score: signal.score,
    review_count: signal.review_count,
    ret_5d: signal.event_return?.ret_5d,
    ret_20d: signal.event_return?.ret_20d,
    ret_60d: signal.event_return?.ret_60d,
    max_adverse_20d: signal.event_return?.max_adverse_20d,
  }));
}

export function ChartTab({ symbol, date, mode, onModeChange }: Props) {
  const { state, reload } = useSymbolChart(symbol, date, mode);
  const [realtimePayload, setRealtimePayload] = useState<{
    quote: RealtimeQuote | null;
    intraday: IntradayPayload | null;
  }>({ quote: null, intraday: null });
  const [strategyBacktest, setStrategyBacktest] = useState<StrategyKlineBacktest | null>(null);
  const [strategyBusy, setStrategyBusy] = useState(false);
  const [strategyActionMessage, setStrategyActionMessage] = useState("");

  useEffect(() => {
    setRealtimePayload({ quote: null, intraday: null });
    setStrategyBacktest(null);
    setStrategyActionMessage("");
  }, [symbol, date, mode]);

  const createStrategySignal = async () => {
    setStrategyBusy(true);
    setStrategyActionMessage("正在写入 V2 策略信号");
    try {
      const response = await fetch("/api/strategies/resonance-v2/signal", { // copy-lint:ignore API 调用，非用户文案
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          start: defaultKlineStart(date),
          end: date,
          mode,
          capital: 1_000_000,
          persist: true,
        }),
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: { signal?: { signal_level?: string; direction?: string }; persisted?: boolean };
        error?: string | null;
      };
      if (payload.success) {
        setStrategyActionMessage(
          payload.data?.persisted
            ? `已写入 ${payload.data.signal?.signal_level || "-"} 级${payload.data.signal?.direction || ""}信号`
            : "已生成信号但未写入",
        );
        reload();
      } else {
        setStrategyActionMessage(payload.error || "V2 信号写入失败");
      }
    } catch {
      setStrategyActionMessage("V2 信号服务未连接");
    }
    setStrategyBusy(false);
  };

  const runStrategyBacktest = async () => {
    setStrategyBusy(true);
    setStrategyActionMessage("正在运行 V2 专属回测");
    try {
      const response = await fetch("/api/strategies/resonance-v2/backtest", { // copy-lint:ignore API 调用，非用户文案
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          start: defaultKlineStart(date),
          end: date,
          mode,
          initial_cash: 1_000_000,
          risk_pct: 0.01,
        }),
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: StrategyKlineBacktest;
        error?: string | null;
      };
      if (payload.success && payload.data) {
        setStrategyBacktest(payload.data);
        setStrategyActionMessage(`V2 回测完成 ${payload.data.backtest_id.slice(0, 8)}`);
      } else {
        setStrategyActionMessage(payload.error || "V2 回测失败");
      }
    } catch {
      setStrategyActionMessage("V2 回测服务未连接");
    }
    setStrategyBusy(false);
  };

  return (
    <AsyncBoundary<SymbolChartPayload>
      state={state}
      skeleton={<ChartSkeleton />}
      emptyTitle="暂无 K 线数据"
      emptyHint="行情服务可能未连接，请稍后重试"
    >
      {(data) => (
        <div className="sw-chart-stack">
          <SectorSnapshotStrip symbol={symbol} date={date} />
          <RealtimeMarketPanel symbol={symbol} onDataChange={setRealtimePayload} />
          <TradingSignalKlinePanel
            bars={data.history?.bars || []}
            drawingScope={data.history?.symbol || symbol}
            evidenceEvents={buildKlineEvidenceEvents({
              history: data.history,
              readiness: data.readiness as never,
              signals: data.raw_signals as never,
              strategyAnalysis: data.strategy_analysis as never,
            })}
            factorRows={data.context?.factor_series || []}
            fundFlowRows={data.context?.fund_flow_series || []}
            intradayPoints={realtimePayload.intraday?.points || []}
            intradaySource={realtimePayload.intraday?.source || null}
            realtimeQuote={realtimePayload.intraday?.quote || realtimePayload.quote}
            signals={toChartSignals(data)}
            strategyAnalysis={data.strategy_analysis as StrategyKlineAnalysis | null}
            strategyControls={{
              mode,
              loading: strategyBusy,
              actionMessage: strategyActionMessage,
              backtest: strategyBacktest,
              onModeChange,
              onCreateSignal: createStrategySignal,
              onRunBacktest: runStrategyBacktest,
            }}
          />

          <CatalystTimeline
            past={data.catalysts.past}
            future={data.catalysts.future}
            futureWindowDays={data.catalysts.future_window_days}
          />
        </div>
      )}
    </AsyncBoundary>
  );
}
