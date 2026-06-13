// Symbol Workspace V2 — Atomic UI components
// 全部由 tokens.css 提供视觉，组件本身只是结构。
import type { Tone } from "../../../types/symbol-workspace";

export const Mono = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => <span className={`sw-mono ${className}`}>{children}</span>;

export const Pill = ({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) => <span className={`sw-pill sw-pill--${tone}`}>{children}</span>;

export const Dot = ({
  tone = "neutral",
  pulse = false,
}: {
  tone?: Tone;
  pulse?: boolean;
}) => (
  <span
    className={`sw-dot sw-dot--${tone}${pulse ? " sw-dot--pulse" : ""}`}
    aria-hidden="true"
  />
);

export const HelpDot = ({
  label,
  tooltip,
  className = "",
}: {
  label: string;
  tooltip: string;
  className?: string;
}) => (
  <button
    className={`sw-help-dot ${className}`}
    type="button"
    aria-label={`${label}：${tooltip}`}
    title={tooltip}
  >
    ?
    <span role="tooltip">{tooltip}</span>
  </button>
);

/** 简易 SVG sparkline */
export const Sparkline = ({
  values,
  tone = "info",
  width = 80,
  height = 20,
}: {
  values: (number | null | undefined)[];
  tone?: Tone;
  width?: number;
  height?: number;
}) => {
  const finite = values
    .map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null))
    .filter((v): v is number => v !== null);
  if (finite.length < 2) {
    return (
      <span
        className="sw-faint"
        style={{
          fontSize: 10,
          display: "inline-block",
          width,
          textAlign: "right",
        }}
      >
        —
      </span>
    );
  }
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  const colorVar =
    tone === "success"
      ? "var(--sw-success)"
      : tone === "warning"
      ? "var(--sw-warning)"
      : tone === "danger"
      ? "var(--sw-danger)"
      : tone === "info"
      ? "var(--sw-info)"
      : "var(--sw-neutral)";
  const pts: string[] = [];
  values.forEach((v, i) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return;
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width={width}
      height={height}
      aria-hidden="true"
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={colorVar}
        strokeWidth="1.4"
      />
    </svg>
  );
};

/** 分段控件（受控） */
export const Segmented = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  ariaLabel?: string;
}) => (
  <div
    className="sw-segmented"
    role="radiogroup"
    aria-label={ariaLabel}
  >
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        className={value === opt.value ? "is-active" : ""}
        onClick={() => onChange(opt.value)}
        role="radio"
        aria-checked={value === opt.value}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

export const Skeleton = ({
  height = 40,
  width = "100%",
}: {
  height?: number | string;
  width?: number | string;
}) => (
  <div
    className="sw-skeleton"
    style={{ height, width }}
    aria-hidden="true"
  />
);

export const EmptyCard = ({
  title,
  hint,
  cta,
}: {
  title: string;
  hint?: string;
  cta?: { label: string; onClick: () => void };
}) => (
  <div className="sw-empty" role="status">
    <strong style={{ fontSize: 13, color: "var(--sw-text-primary)" }}>
      {title}
    </strong>
    {hint && <span style={{ fontSize: 12 }}>{hint}</span>}
    {cta && (
      <button
        type="button"
        className="sw-btn sw-btn--mini"
        onClick={cta.onClick}
        style={{ marginTop: 8 }}
      >
        {cta.label}
      </button>
    )}
  </div>
);

export const ErrorCard = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => {
  // 把后端常见错误翻译为面向用户的诊断说明
  const diagnosis = diagnoseError(message);
  return (
    <div className="sw-error" role="alert" style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--sw-sp-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sw-sp-2)" }}>
        <Dot tone="warning" />
        <strong style={{ flex: 1, fontSize: 13 }}>{diagnosis.title}</strong>
      </div>
      <p style={{ fontSize: 12, color: "var(--sw-text-secondary)", margin: 0, lineHeight: "18px" }}>
        {diagnosis.hint}
      </p>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button type="button" className="sw-btn sw-btn--mini" onClick={onRetry}>
          重新加载
        </button>
        {diagnosis.docLink && (
          <a
            href={diagnosis.docLink}
            target="_blank"
            rel="noreferrer"
            className="sw-btn sw-btn--mini"
            style={{ textDecoration: "none" }}
          >
            查看说明
          </a>
        )}
        <button
          type="button"
          className="sw-btn sw-btn--mini"
          onClick={() => {
            try {
              window.localStorage.setItem("tradingagents.symbol-workspace.preference", "v1");
            } catch {
              /* ignore */
            }
            const url = new URL(window.location.href);
            url.searchParams.set("ws", "v1");
            window.location.href = url.toString();
          }}
        >
          切回旧版
        </button>
      </div>
      <details style={{ marginTop: 4 }}>
        <summary style={{ fontSize: 11, color: "var(--sw-text-tertiary)", cursor: "pointer" }}>
          诊断详情
        </summary>
        <pre
          style={{
            fontSize: 11,
            fontFamily: "var(--sw-font-mono)",
            color: "var(--sw-text-tertiary)",
            background: "var(--sw-bg-input)",
            padding: "var(--sw-sp-2) var(--sw-sp-3)",
            borderRadius: 4,
            marginTop: 4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {message}
        </pre>
      </details>
    </div>
  );
};

/** 把后端错误信息翻译为用户友好的诊断 */
function diagnoseError(raw: string): { title: string; hint: string; docLink?: string } {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("策略") || msg.includes("resonance")) {
    return {
      title: "策略服务暂不可用",
      hint: "策略后端可能未启动。请确认本地服务运行中（默认 8100 端口），或稍后重试。",
    };
  }
  if (msg.includes("行情") || msg.includes("market")) {
    return {
      title: "无法获取行情数据",
      hint: "行情服务连接失败。可能是网络问题或后端数据同步未完成。",
    };
  }
  if (msg.includes("信号")) {
    return {
      title: "信号数据加载失败",
      hint: "信号库可能尚未生成该标的的信号。可在信号工作台手动生成。",
    };
  }
  if (msg.includes("基本面") || msg.includes("fundamental")) {
    return {
      title: "基本面数据未就绪",
      hint: "请先在基本面同步页运行同步任务，或确认该标的有公开财报。",
    };
  }
  if (msg.includes("催化剂") || msg.includes("catalyst")) {
    return {
      title: "催化剂日历未就绪",
      hint: "近 60 日的事件需要外部数据同步。请稍后重试。",
    };
  }
  if (msg.includes("分析完整度") || msg.includes("readiness")) {
    return {
      title: "数据完整度检查失败",
      hint: "后端可能未启动。多个数据源可能同时不可用。",
    };
  }
  if (msg.includes("fetch") || msg.includes("network")) {
    return {
      title: "网络请求失败",
      hint: "无法连接后端。请检查本地服务是否运行（默认 8100 端口）。",
    };
  }
  // fallback
  return {
    title: "数据加载失败",
    hint: raw || "未知错误，请重试或切回旧版工作台。",
  };
}

export const PartialStrip = ({ missing }: { missing: string[] }) => {
  if (missing.length === 0) return null;
  return (
    <div className="sw-partial-strip" role="status">
      <Dot tone="warning" />
      <span>
        部分数据缺失：<Mono>{missing.slice(0, 3).join(" · ")}</Mono>
        {missing.length > 3 && <span> · +{missing.length - 3} 项</span>}
      </span>
    </div>
  );
};
