// Tab 1 拼装：Hero + Narrative + Matrix + RiskBudget
import { Skeleton } from "../_shared/atoms";
import { AsyncBoundary } from "../_shared/AsyncBoundary";
import type {
  StrategyMode,
  SymbolPulsePayload,
} from "../../../types/symbol-workspace";
import { useSymbolPulse } from "../../../api/symbol-workspace/hooks";
import { HeroDecisionCard } from "./HeroDecisionCard";
import { IndicatorMatrix } from "./IndicatorMatrix";
import { NarrativeCards } from "./NarrativeCards";
import { RiskBudgetCalc } from "./RiskBudgetCalc";

interface Props {
  symbol: string;
  date: string;
  mode: StrategyMode;
  onModeChange: (m: StrategyMode) => void;
}

function PulseSkeleton() {
  return (
    <>
      <Skeleton height={160} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Skeleton height={180} />
        <Skeleton height={180} />
      </div>
      <Skeleton height={220} />
      <Skeleton height={180} />
    </>
  );
}

export function PulseTab({ symbol, date, mode, onModeChange }: Props) {
  const { state } = useSymbolPulse(symbol, date, mode);
  return (
    <AsyncBoundary<SymbolPulsePayload>
      state={state}
      skeleton={<PulseSkeleton />}
      emptyTitle="暂无策略分析"
      emptyHint="策略服务暂不可用或该标的数据不足"
    >
      {(data) => (
        <>
          <HeroDecisionCard
            decision={data.decision}
            regimeContext={data.regime_context}
            tripleContext={data.triple_context}
            onModeChange={onModeChange}
          />
          <NarrativeCards narrative={data.narrative} />
          <IndicatorMatrix columns={data.indicators} />
          <RiskBudgetCalc context={data.risk_context} />
        </>
      )}
    </AsyncBoundary>
  );
}
