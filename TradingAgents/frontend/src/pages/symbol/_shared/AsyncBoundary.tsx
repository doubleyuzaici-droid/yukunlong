// AsyncBoundary — 统一处理 loading/empty/error/partial/ok 五态
// 对应 bridge §6.3
import type { AsyncState } from "../../../types/symbol-workspace";
import { EmptyCard, ErrorCard, PartialStrip } from "./atoms";

export function AsyncBoundary<T>({
  state,
  skeleton,
  emptyTitle = "暂无数据",
  emptyHint,
  emptyCta,
  children,
}: {
  state: AsyncState<T>;
  skeleton: React.ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  emptyCta?: { label: string; onClick: () => void };
  children: (data: T, missing?: string[]) => React.ReactNode;
}) {
  if (state.status === "loading") return <>{skeleton}</>;
  if (state.status === "empty") {
    return (
      <EmptyCard
        title={emptyTitle}
        hint={emptyHint}
        cta={state.cta ?? emptyCta}
      />
    );
  }
  if (state.status === "error") {
    return <ErrorCard message={state.message} onRetry={state.retry} />;
  }
  // ok 或 partial
  const missing =
    state.status === "partial" ? state.missing : undefined;
  return (
    <>
      {state.status === "partial" && <PartialStrip missing={state.missing} />}
      {children(state.data, missing)}
    </>
  );
}
