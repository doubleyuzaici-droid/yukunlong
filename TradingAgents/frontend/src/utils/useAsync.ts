// useAsync — 60 行的 hook，替代 TanStack Query
// 对应 bridge §6.2，自带 AbortController + 请求版本号 race protection
//
// 它治了 V1 SymbolWorkspacePage 里的两个问题：
//   1) 切换标的时旧请求覆盖新数据
//   2) 初次加载触发两次请求
import { useEffect, useRef, useState } from "react";
import type { AsyncState } from "../types/symbol-workspace";

export interface UseAsyncOptions<T> {
  /** 返回 partial 用的 missing 列表 — 由 mapper 决定哪些字段缺失 */
  computePartial?: (data: T) => string[];
  /** 空判定 */
  isEmpty?: (data: T) => boolean;
  /** 跳过自动 fetch（外部按钮触发时用） */
  enabled?: boolean;
}

export interface UseAsyncResult<T> {
  state: AsyncState<T>;
  reload: () => void;
}

export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
  options: UseAsyncOptions<T> = {}
): UseAsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const reqId = useRef(0);
  const optsRef = useRef(options);
  optsRef.current = options;

  const run = () => {
    const id = ++reqId.current;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetcher(controller.signal)
      .then((data) => {
        if (id !== reqId.current) return; // race protection
        const opts = optsRef.current;
        if (opts.isEmpty?.(data)) {
          setState({ status: "empty" });
          return;
        }
        const missing = opts.computePartial?.(data) ?? [];
        setState(
          missing.length > 0
            ? { status: "partial", data, missing }
            : { status: "ok", data }
        );
      })
      .catch((err: unknown) => {
        if (id !== reqId.current) return;
        if (err instanceof Error && err.name === "AbortError") return;
        const msg =
          err instanceof Error && err.message ? err.message : "请求失败";
        setState({ status: "error", message: msg, retry: run });
      });
    return () => controller.abort();
  };

  useEffect(() => {
    if (options.enabled === false) return;
    return run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { state, reload: run };
}
