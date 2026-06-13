import type { ReactNode } from "react";

export interface TrustItem {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}

export interface TrustAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export function DataTrustPanel({
  title = "数据可信度",
  summary,
  items,
  warnings = [],
  disclaimer,
  actions = [],
  compact = false,
}: {
  title?: string;
  summary?: string;
  items: TrustItem[];
  warnings?: string[];
  disclaimer?: string;
  actions?: TrustAction[];
  compact?: boolean;
}) {
  const blockingCount = warnings.filter((warning) => /缺|失败|不可用|阻断|missing|failed/i.test(warning)).length;
  const tone = blockingCount > 0 ? "warn" : "good";

  return (
    <div className={`data-trust-panel ${compact ? "compact" : ""} ${tone}`}>
      <div className="data-trust-head">
        <div>
          <span className="eyebrow">Trust & Audit</span>
          <h2>{title}</h2>
          {summary && <p>{summary}</p>}
        </div>
        <span className={`status-badge ${tone === "good" ? "freshness-fresh" : "freshness-delayed"}`}>
          {tone === "good" ? "可用于研究" : `${blockingCount} 项需关注`}
        </span>
      </div>

      <div className="data-trust-grid">
        {items.map((item) => (
          <div className={`data-trust-item ${item.tone || "neutral"}`} key={`${item.label}-${item.value}`}>
            <span>{item.label}</span>
            <strong>{item.value || "-"}</strong>
          </div>
        ))}
      </div>

      {(warnings.length > 0 || disclaimer || actions.length > 0) && (
        <div className="data-trust-foot">
          {warnings.length > 0 && (
            <div className="warning-list compact-warning-list">
              {warnings.slice(0, 4).map((warning) => (
                <p key={warning}>
                  <strong>数据提示</strong>
                  <span>{warning}</span>
                </p>
              ))}
            </div>
          )}
          {disclaimer && <p className="muted">{disclaimer}</p>}
          {actions.length > 0 && <div className="data-trust-actions">{renderActions(actions)}</div>}
        </div>
      )}
    </div>
  );
}

function renderActions(actions: TrustAction[]): ReactNode {
  return actions.map((action) => {
    if (action.href) {
      return (
        <a className="button-link mini" href={action.href} key={action.label}>
          {action.label}
        </a>
      );
    }
    return (
      <button className="mini" key={action.label} onClick={action.onClick} type="button">
        {action.label}
      </button>
    );
  });
}
