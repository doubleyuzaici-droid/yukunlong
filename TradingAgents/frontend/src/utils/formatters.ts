export function parseJsonList(value?: string | string[] | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
    if (parsed) return [String(parsed)];
  } catch {
    return [value];
  }
  return [];
}

export function formatPercent(value?: number | null, digits = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${(value * 100).toFixed(digits)}%`
    : "-";
}

export function formatSignedPercent(value?: number | null, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatSignedNumber(value?: number | null, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

export function formatNumber(value?: number | null, digits = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "-";
}

export function formatMoney(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactNumber(value?: number | null, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(digits)}K`;
  return value.toFixed(0);
}

export function quoteTone(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "flat";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "flat";
}

export function freshnessTone(status?: string | null) {
  if (status === "fresh") return "fresh";
  if (status === "delayed") return "delayed";
  if (status === "stale") return "stale";
  return "missing";
}
