// 价格相对位置条 — readability-review §3 缺失 4
// 显示：52 周高低区间 + 当前位置百分位 + 距 MA 偏离 + 振幅
// 纯前端计算，不依赖新后端字段
import type { MarketHistoryBar } from "../../../types/market";
import type { SymbolHeader } from "../../../types/symbol-workspace";
import { Mono } from "../_shared/atoms";
import { classOfChange, fmtPct, fmtPrice } from "../formatters";

interface Props {
  header: SymbolHeader;
  bars: MarketHistoryBar[]; // 用最近 252 日（约 1 年）计算 52W 高低
}

function finite(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function calcEMA(closes: number[], period: number): number | null {
  if (closes.length === 0) return null;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

export function PricePositionBar({ header, bars }: Props) {
  const price = header.price;
  if (price == null) return null;

  // 取最近 252 个交易日（约 52 周）
  const window = bars.slice(-252);
  const closes = window
    .map((b) => finite(b.close))
    .filter((v): v is number => v !== null);
  if (closes.length < 5) return null;

  const highs = window.map((b) => finite(b.high) ?? finite(b.close) ?? 0);
  const lows = window.map((b) => finite(b.low) ?? finite(b.close) ?? Infinity);
  const high52w = Math.max(...highs);
  const low52w = Math.min(...lows);
  const range = high52w - low52w || 1;
  const pctilPosition = (price - low52w) / range; // 0..1

  const ma20 = calcMA(closes, 20);
  const ma60 = calcMA(closes, 60);
  const ma120 = calcMA(closes, 120);

  const deltaToMA = (ma: number | null) =>
    ma == null ? null : (price - ma) / ma;

  const todayBar = bars[bars.length - 1];
  const amp =
    todayBar && finite(todayBar.high) != null && finite(todayBar.low) != null && finite(todayBar.open) != null
      ? (todayBar.high! - todayBar.low!) / (todayBar.open || 1)
      : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 1.4fr) repeat(4, minmax(0, 1fr))",
        gap: "var(--sw-sp-4)",
        alignItems: "center",
        padding: "var(--sw-sp-3) var(--sw-sp-6)",
        background: "var(--sw-bg-surface)",
        borderBottom: "1px solid var(--sw-border-subtle)",
        fontSize: 12,
      }}
      role="region"
      aria-label="价格相对位置"
    >
      {/* 52W 高低区间条 */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "var(--sw-text-tertiary)",
            fontSize: 11,
            marginBottom: 4,
          }}
        >
          <span>52 周低</span>
          <span>
            P{Math.round(pctilPosition * 100)} 位
          </span>
          <span>52 周高</span>
        </div>
        <div
          style={{
            position: "relative",
            height: 8,
            background: "var(--sw-bg-input)",
            borderRadius: 999,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${pctilPosition * 100}%`,
              background:
                "linear-gradient(90deg, var(--sw-fall) 0%, var(--sw-flat) 50%, var(--sw-rise) 100%)",
              borderRadius: 999,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `calc(${pctilPosition * 100}% - 3px)`,
              top: -3,
              width: 6,
              height: 14,
              background: "var(--sw-text-primary)",
              borderRadius: 2,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
            fontFamily: "var(--sw-font-mono)",
            fontSize: 11,
            color: "var(--sw-text-secondary)",
          }}
        >
          <span>{fmtPrice(low52w)}</span>
          <Mono className="sw-tone-info">{fmtPrice(price)}</Mono>
          <span>{fmtPrice(high52w)}</span>
        </div>
      </div>

      <DeltaCell label="距 MA20" delta={deltaToMA(ma20)} />
      <DeltaCell label="距 MA60" delta={deltaToMA(ma60)} />
      <DeltaCell label="距 MA120" delta={deltaToMA(ma120)} />
      <DeltaCell label="今日振幅" delta={amp} signed={false} />
    </div>
  );
}

function DeltaCell({
  label,
  delta,
  signed = true,
}: {
  label: string;
  delta: number | null;
  signed?: boolean;
}) {
  const cls = signed && delta != null ? classOfChange(delta) : "sw-flat";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, color: "var(--sw-text-tertiary)" }}>{label}</span>
      <span
        className={`sw-mono ${cls}`}
        style={{ fontSize: 14, fontWeight: 600 }}
      >
        {delta == null
          ? "-"
          : signed
            ? fmtPct(delta, 1)
            : `${(delta * 100).toFixed(2)}%`}
      </span>
    </div>
  );
}
