// Symbol Workspace V2 灰度切换 — Phase 5 PR-19
//
// 优先级：URL ?ws=v2|v1  >  localStorage 用户偏好  >  V2 灰度比例（按 symbol hash）
//
// 灰度比例：默认 50% 用户进 V2；可通过 .env / window.__ws_rollout__ 调整。
// 比例计算用 symbol 而不是用户 ID，原因：项目没有用户系统，但同一标的总走同一版本
// 能保证用户切换标的的体验一致。

const PREF_KEY = "tradingagents.symbol-workspace.preference";

export type WorkspaceVersion = "v1" | "v2";
type WsPref = WorkspaceVersion | "auto";

function readUrlChoice(): WorkspaceVersion | null {
  if (typeof window === "undefined") return null;
  try {
    const v = new URLSearchParams(window.location.search).get("ws");
    if (v === "v1" || v === "v2") return v;
    return null;
  } catch {
    return null;
  }
}

function readStoredChoice(): WsPref | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(PREF_KEY);
    if (v === "v1" || v === "v2" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function readRolloutPct(): number {
  if (typeof window === "undefined") return 0.5;
  // 优先 window 全局（运维注入）
  const g = (window as { __ws_rollout__?: unknown }).__ws_rollout__;
  if (typeof g === "number" && g >= 0 && g <= 1) return g;
  return 0.5;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 决定当前应该走 V1 还是 V2。返回 "v2" 时上层渲染 SymbolWorkspaceV2。 */
export function resolveWorkspaceVersion(symbol: string): WorkspaceVersion {
  const urlChoice = readUrlChoice();
  if (urlChoice) return urlChoice;
  const stored = readStoredChoice();
  if (stored === "v1" || stored === "v2") return stored;
  // 灰度比例：symbol hash 落在 [0, pct] 内走 V2
  const pct = readRolloutPct();
  const bucket = (hash(symbol) % 1000) / 1000;
  return bucket < pct ? "v2" : "v1";
}

/** 用户手动选择 V1/V2/Auto，写入 localStorage 供后续会话使用。 */
export function setPreference(pref: WsPref): void {
  try {
    window.localStorage.setItem(PREF_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function getPreference(): WsPref {
  return readStoredChoice() ?? "auto";
}

/** 构造切换 V1/V2 后的 URL，仅改 view/ws，保留 symbol/date/tab/mode 等上下文。 */
export function buildWorkspaceVersionUrl(
  currentHref: string,
  version: WorkspaceVersion,
): string {
  const url = new URL(currentHref);
  url.searchParams.set("view", "symbolWorkspace");
  url.searchParams.set("ws", version);
  return url.toString();
}

/** 立即切换工作台版本。用于页面内部无法直接改 App state 的入口。 */
export function switchWorkspaceVersion(version: WorkspaceVersion): void {
  if (typeof window === "undefined") return;
  setPreference(version);
  window.location.href = buildWorkspaceVersionUrl(window.location.href, version);
}
