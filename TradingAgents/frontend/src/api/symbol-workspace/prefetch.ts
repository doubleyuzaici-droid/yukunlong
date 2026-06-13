// Tab 数据预取 — Phase 4 PR-18
//
// 思路：用户停留在 pulse tab 时，hover 其它 tab 按钮 / 鼠标移近 ≥ 80ms 触发后台预拉，
// 真正点击切换时数据已 warm，骨架时间 < 200ms。
//
// 由于我们的 hooks 用 useAsync（每个组件独立的 in-flight），预取不能直接共享
// React state。这里走最朴素的 HTTP cache：在 fetcher 上加一个 60s 的内存 Promise cache，
// 命中即返回已有 Promise，浏览器层面 fetch 也会自动复用。
import * as F from "./fetchers";

interface CacheEntry {
  promise: Promise<unknown>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.promise as Promise<T>;
  const promise = factory().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { promise, expiresAt: now + TTL_MS });
  return promise;
}

/** 给定 symbol + date，预拉 chart / fundamentals / playbook 三个 tab 共需要的接口。 */
export function prefetchTabData(symbol: string, date: string): void {
  if (!symbol || !date) return;
  const start = (() => {
    const dt = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return date;
    dt.setUTCFullYear(dt.getUTCFullYear() - 1);
    return dt.toISOString().slice(0, 10);
  })();
  const ac = new AbortController();
  // chart tab
  void getOrSet(`history:${symbol}:${start}:${date}`, () =>
    F.fetchHistory(symbol, start, date, ac.signal)
  );
  void getOrSet(`signals:${symbol}:${start}:${date}`, () =>
    F.fetchSignalHistory(symbol, start, date, ac.signal)
  );
  void getOrSet(`catalysts:${symbol}:${date}`, () =>
    F.fetchCatalysts(symbol, date, ac.signal)
  );
  // fundamentals tab
  void getOrSet(`fundamentals:${symbol}:${date}`, () =>
    F.fetchFundamentals(symbol, date, ac.signal)
  );
  void getOrSet(`fund-q:${symbol}:${date}`, () =>
    F.fetchFundamentalsQuarterly(symbol, date, ac.signal, 8)
  );
  void getOrSet(`val-pct:${symbol}:${date}`, () =>
    F.fetchValuationPercentile(symbol, date, ac.signal)
  );
  // playbook tab
  void getOrSet(`backtest:${symbol}`, () =>
    F.fetchBacktestSummary(symbol, ac.signal)
  );
}

/** 切换 symbol 时清理上一个标的的 cache，避免内存泄漏 */
export function invalidatePrefetch(): void {
  cache.clear();
}
