// V2 共用 formatter — 与 V1 utils/formatters 区分（V2 严格 null 处理）
// 数字格式规范见 copy-review.md §2

export const fmtPrice = (v: number | null, digits = 2) =>
  v == null ? "-" : `¥${v.toFixed(digits)}`;

export const fmtNumber = (v: number | null, digits = 2) =>
  v == null ? "-" : v.toFixed(digits);

export const fmtSignedNumber = (v: number | null, digits = 2) => {
  if (v == null) return "-";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;
};

export const fmtPct = (v: number | null, digits = 1) => {
  if (v == null) return "-";
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;
};

export const fmtCompact = (v: number | null, digits = 1) => {
  if (v == null) return "-";
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(digits)} 亿`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(digits)} 万`;
  return v.toFixed(0);
};

export const fmtCny = (v: number | null) =>
  v == null ? "-" : `¥${Math.round(v).toLocaleString("zh-CN")}`;

// ============================================================
// 规范化 formatter — 强制统一单位/精度
// ============================================================

/** 市值（元 → 亿） */
export const fmtMarketCap = (v: number | null) => {
  if (v == null) return "-";
  const yi = v / 1e8;
  if (Math.abs(yi) >= 10_000) return `${(yi / 10_000).toFixed(2)} 万亿`;
  if (Math.abs(yi) >= 100)    return `${yi.toFixed(0)} 亿`;
  return `${yi.toFixed(2)} 亿`;
};

/** 比率（0..1 浮点）→ "X.XX%" 或 "X.XX‰"（小于 0.1% 用千分号）*/
export const fmtRatio = (v: number | null, digits = 2) => {
  if (v == null) return "-";
  const pct = v * 100;
  if (Math.abs(pct) < 0.1 && pct !== 0) {
    return `${(v * 1000).toFixed(digits)}‰`;
  }
  return `${pct.toFixed(digits)}%`;
};

/** 换手率（0..1）→ "X.XX%" */
export const fmtTurnover = (v: number | null) => fmtRatio(v, 2);

/** 股息率（0..1）→ "X.XX%" */
export const fmtDividendYield = (v: number | null) => fmtRatio(v, 2);

/** 倍数 → "XX.X×" */
export const fmtMultiple = (v: number | null, digits = 1) =>
  v == null ? "-" : `${v.toFixed(digits)}×`;

/** PE/PB/PS 等估值倍数 — 不加×（行业惯例直接写数字） */
export const fmtValuation = (v: number | null, digits = 1) =>
  v == null ? "-" : v.toFixed(digits);

/** 百分位 (0..1) → "P68" 形式（更直观） */
export const fmtPercentile = (v: number | null) => {
  if (v == null) return "-";
  return `P${Math.round(v * 100)}`;
};

/** 股数 → "5,300 股 (53 手)"。lotSize=1（港股有零碎股）时不显示手数。 */
export const fmtShares = (shares: number, lotSize = 100) => {
  const formatted = shares.toLocaleString("zh-CN");
  if (lotSize <= 1) return `${formatted} 股`;
  const lots = Math.floor(shares / lotSize);
  return lots > 0 ? `${formatted} 股 (${lots} 手)` : `${formatted} 股`;
};

/** A 股红涨绿跌 — 返回 CSS class 名（不再用 success/danger 语义色）
 * 解决 readability-review P0-1：色彩双语义冲突
 */
export const classOfChange = (v: number | null | undefined): string => {
  if (v == null) return "sw-flat";
  if (v > 0) return "sw-rise";
  if (v < 0) return "sw-fall";
  return "sw-flat";
};

/** @deprecated 用 classOfChange 替代以避免与 success/danger 语义冲突 */
import type { Tone } from "../../types/symbol-workspace";
export const toneOfChange = (v: number | null | undefined): Tone => {
  if (v == null) return "neutral";
  if (v > 0) return "danger";
  if (v < 0) return "success";
  return "neutral";
};

/** 中文格式化时间相对字段 */
export const fmtRelativeTime = (iso: string): string => {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  const diff = Date.now() - ts;
  if (diff < 0) return iso;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return iso.slice(0, 16).replace("T", " ");
};
