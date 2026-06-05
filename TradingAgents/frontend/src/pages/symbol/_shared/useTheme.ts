// 浅色/深色主题切换 hook
// Phase 4 PR-15。持久化到 localStorage，初始读取尊重 prefers-color-scheme。
import { useCallback, useEffect, useState } from "react";

const THEME_KEY = "tradingagents.symbol-workspace-v2.theme";

export type SymbolTheme = "dark" | "light";

function readInitialTheme(): SymbolTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* ignore */
  }
  // 跟随系统偏好（默认仍然 dark，与现有 V1 一致）
  try {
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    return mql.matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useTheme(): {
  theme: SymbolTheme;
  toggle: () => void;
  setTheme: (next: SymbolTheme) => void;
} {
  const [theme, setThemeState] = useState<SymbolTheme>(() => readInitialTheme());

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((next: SymbolTheme) => setThemeState(next), []);
  const toggle = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    []
  );
  return { theme, toggle, setTheme };
}
