// V2 Status Banner — partial/blocked/stale 时显示横幅，ok 时不渲染
import { Dot } from "../_shared/atoms";
import type { DataStatus } from "../../../types/symbol-workspace";

interface Props {
  status: DataStatus;
  onRetry: () => void;
}

// 标题（陈述事实） + 默认副文案（指引动作）
const KIND_TEXT: Record<
  DataStatus["kind"],
  { title: string; hint: string }
> = {
  ok:      { title: "数据已就绪",       hint: "" },
  partial: { title: "部分数据缺失",     hint: "已用最新可用值替代，决策需关注影响范围" },
  blocked: { title: "核心数据缺失",     hint: "决策可靠性低，建议先同步数据再做判断" },
  stale:   { title: "数据已过期",       hint: "建议刷新或同步最新数据" },
};

const RETRY_LABEL: Record<DataStatus["kind"], string> = {
  ok: "重新加载",
  partial: "重新加载",
  blocked: "同步数据",
  stale: "立即刷新",
};

export function StatusBanner({ status, onRetry }: Props) {
  if (status.kind === "ok") return null;
  const className = `sw-status-banner sw-status-banner--${status.kind}`;
  const tone =
    status.kind === "blocked" ? "danger" : status.kind === "stale" ? "warning" : "warning";
  const meta = KIND_TEXT[status.kind];
  return (
    <div className={className} role="status">
      <Dot tone={tone} />
      <div className="sw-status-banner__msg">
        <strong>{meta.title}</strong>
        {status.message ? `：${status.message}` : meta.hint ? `：${meta.hint}` : ""}
        {status.affected.length > 0 ? `（影响：${status.affected.slice(0, 3).join(" · ")}）` : ""}
      </div>
      {status.can_retry && (
        <button type="button" className="sw-btn sw-btn--mini" onClick={onRetry}>
          {RETRY_LABEL[status.kind]}
        </button>
      )}
    </div>
  );
}
