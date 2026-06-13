# Symbol Workspace V2 — Codex 落地手册

> 这份文档面向 AI 编码 agent（Codex / Claude Code / Cursor）。
> **先读完整份再开始写代码。** 严格按照本文档的约束走，能减少 80% 的返工。

---

## 目录

1. [总体定位](#1-总体定位)
2. [输入材料](#2-输入材料)
3. [技术栈与硬约束](#3-技术栈与硬约束)
4. [Design Token 映射](#4-design-token-映射)
5. [组件落地清单（按 tab 拆）](#5-组件落地清单)
6. [数据契约与 API hooks](#6-数据契约与-api-hooks)
7. [四态实现规范](#7-四态实现规范)
8. [Sprint 切片建议](#8-sprint-切片建议)
9. [验收 checklist](#9-验收-checklist)
10. [禁止事项](#10-禁止事项)

---

## 1. 总体定位

本仓库下的 `Symbol Workspace V2.html` + `src/*.jsx` 是一份 **视觉 + 交互骨架原型**，目的是让团队对齐"成品长什么样、用户怎么用"。

它 **不是** 可以照搬的生产代码。原因：
- 全部用 mock data
- 状态只用 `useState`，没接真实 store
- K 线、Sparkline、催化剂时间线都是手画 SVG —— 落地后图表必须用 `lightweight-charts` + `Recharts`
- 颜色直接写了十六进制；落地后必须走 Tailwind theme token
- 没有 loading / empty / error / partial 四态

**你的任务**：把原型搬到生产代码库，过程中**复用现有原子组件**，**禁止重新造轮子**。

---

## 2. 输入材料

| 文件 | 用途 |
|---|---|
| `/uploads/2026-05-23-symbol-workspace-v2-design-brief-f45403bb.md` | 设计简报。规范层面的"圣经"。每个 token、每段文案的来源 |
| `Symbol Workspace V2.html` + `src/*.jsx` | 视觉原型。**只看不抄**，照抄的是结构 + 数据流，不是字符串 |
| `handoff/symbol-workspace.types.ts` | **数据契约**。所有组件 props 必须基于此类型。看不懂就回头读 |
| 现有代码库 `src/components/MarketWidgets.tsx` | 必须复用的原子组件 |
| 现有代码库 `src/types/market.ts` | 已有的市场数据类型；与 `symbol-workspace.types.ts` 对齐 |

---

## 3. 技术栈与硬约束

```
React 18 + TypeScript strict
Tailwind CSS (v3)
lightweight-charts (K 线)
Recharts (其它图表：柱图、面积图、Sparkline 改用 Recharts <Sparklines>)
lucide-react (icons)
Zustand (状态)        ← 若仓库已有别的 store，沿用
TanStack Query (数据)  ← 用于 useSymbolWorkspace 等 hook
```

硬约束：
- TypeScript **strict mode**，禁止 `any`、禁止 `// @ts-ignore`
- 所有颜色、间距、圆角、字号必须用 Tailwind theme token；**禁止任意值**（如 `text-[#22C55E]`、`p-[13px]`）
- 数字渲染统一用 `<Mono>{value}</Mono>` 包装，class 自带 `font-mono tabular-nums`
- 每个数据组件必须覆盖 4 态（见 §7）
- 所有交互元素**键盘可达** + `aria-label` 齐全 + 可见 focus ring + 对比度 ≥ 4.5:1

---

## 4. Design Token 映射

### 4.1 `tailwind.config.ts`（新建或合并）

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas:      "#0B0E14",
        surface:     "#11151E",
        "surface-2": "#161B26",
        hover:       "#1B2230",
        "border-subtle": "#1F2530",
        "border-strong": "#2A3140",
        fg: {
          DEFAULT:   "#E6EDF3",  // text-primary
          secondary: "#9AA5B1",
          tertiary:  "#5D6773",
          disabled:  "#3D4651",
        },
        tone: {
          success: "#22C55E",
          warning: "#F59E0B",
          danger:  "#EF4444",
          info:    "#3B82F6",
          neutral: "#64748B",
        },
      },
      backgroundColor: {
        "tone-success": "rgba(34,197,94,0.10)",
        "tone-warning": "rgba(245,158,11,0.10)",
        "tone-danger":  "rgba(239,68,68,0.10)",
        "tone-info":    "rgba(59,130,246,0.10)",
        "tone-neutral": "rgba(100,116,139,0.10)",
      },
      fontFamily: {
        sans: ['Inter', '"PingFang SC"', '"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"SF Mono"', "Menlo", "monospace"],
      },
      fontSize: {
        // 严格对照简报 §4.2
        "display-l": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: 600 }],
        "title-m":   ["18px", { lineHeight: "26px", fontWeight: 600 }],
        "title-s":   ["14px", { lineHeight: "20px", fontWeight: 600 }],
        "body-m":    ["14px", { lineHeight: "22px" }],
        "body-s":    ["13px", { lineHeight: "20px" }],
        "caption":   ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: 500 }],
        "metric-l":  ["28px", { lineHeight: "32px", fontWeight: 600 }],
        "metric-m":  ["18px", { lineHeight: "24px", fontWeight: 600 }],
        "metric-s":  ["14px", { lineHeight: "20px", fontWeight: 500 }],
      },
      borderRadius: { sm: "4px", md: "6px", lg: "8px" },
      maxWidth: { workspace: "1680px" },
    },
  },
  plugins: [],
} satisfies Config;
```

### 4.2 工具组件（在 `src/ui/` 下创建）

```tsx
// src/ui/Mono.tsx
export const Mono = ({ children, className = "" }: { children: React.ReactNode; className?: string }) =>
  <span className={`font-mono tabular-nums ${className}`}>{children}</span>;

// src/ui/Pill.tsx
import type { Tone } from "@/types/symbol-workspace";
const TONE_BG: Record<Tone, string> = {
  success: "bg-tone-success text-tone-success",
  warning: "bg-tone-warning text-tone-warning",
  danger:  "bg-tone-danger  text-tone-danger",
  info:    "bg-tone-info    text-tone-info",
  neutral: "bg-tone-neutral text-tone-neutral",
};
export const Pill = ({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) =>
  <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] font-semibold ${TONE_BG[tone]}`}>{children}</span>;

// src/ui/Dot.tsx, src/ui/Sparkline.tsx, src/ui/Segmented.tsx 同理
```

---

## 5. 组件落地清单

> 命名：路径 → 类型。**Props 类型必须 import 自 `@/types/symbol-workspace`，禁止重复定义**。

### 5.1 Shell & Chrome

| Prototype | New file | Props |
|---|---|---|
| `HeaderBar` | `src/pages/symbol/Header.tsx` | `{ header: SymbolHeader; onSearch: (q: string) => void }` |
| `ProfileStrip` | `src/pages/symbol/ProfileStrip.tsx` | `{ profile: SymbolProfile }` |
| `StatusBanner` | `src/pages/symbol/StatusBanner.tsx` | `{ status: DataStatus; onRetry: () => void }` |
| `NavRail` | `src/pages/symbol/NavRail.tsx` | `{ data: NavData; activeSymbol: string; onSelect: (s: string) => void }` |
| `ContextRail` | `src/pages/symbol/ContextRail.tsx` | `{ header: SymbolHeader; narrative: SymbolNarrative; riskFlags; ctaForTab }` |
| `TabBar` | `src/pages/symbol/TabBar.tsx` | `{ value: TabKey; onChange: (t: TabKey) => void }` |

> `TabKey = "pulse" | "chart" | "fundamentals" | "playbook"`

### 5.2 Tab 1: 现状速览

| Prototype | New file | 备注 |
|---|---|---|
| `HeroDecisionCard` | `Pulse/HeroDecisionCard.tsx` | 因子树用 CSS Grid，**不要**用 SVG 画树枝；模式切换 dispatch 到 store |
| `BullVsFalsifyCard` | `Pulse/NarrativeCards.tsx` | 已发生的 falsify 用 `<Dot tone="warning" pulse />` |
| `IndicatorMatrix` | `Pulse/IndicatorMatrix.tsx` | Sparkline 改用 Recharts `<LineChart>` mini-mode；hover tooltip 显示完整序列 |
| `RiskBudget` | `Pulse/RiskBudgetCalc.tsx` | 计算逻辑必须抽到 `utils/risk-budget.ts` 的纯函数，导出 `computeRiskBudget(inputs, ctx): RiskBudgetOutput` |

### 5.3 Tab 2: 图表与信号

| Prototype | New file | 备注 |
|---|---|---|
| `KLineChart` | `Chart/KLineChart.tsx` | **必须**用 `lightweight-charts`；overlay 通过 `addLineSeries` 添加；信号 marker 用 `setMarkers` |
| `CatalystTimeline` | `Chart/CatalystTimeline.tsx` | x 轴比例尺**必须暴露给父组件**，由父组件传 `xScale` 给子组件，保证与 K 线对齐 |
| `SubChart` | `Chart/SubChart.tsx` | 用 `lightweight-charts` 的第二个 chart 实例，sync 时间轴 |
| `ChartToolbar` | `Chart/ChartToolbar.tsx` | overlay 状态存 zustand，跨刷新保留 |

**对齐 x 轴是这个 tab 最容易翻车的地方**。建议在父组件 `ChartTab.tsx` 里维护一个 `timeScale`：

```tsx
const [xRange, setXRange] = useState<{ from: number; to: number }>();
// 把 setXRange 传给 KLineChart 的 timeScale().subscribeVisibleTimeRangeChange
// CatalystTimeline 和 SubChart 收到 xRange 后自己缩放
```

### 5.4 Tab 3: 基本面 & 催化剂

| Prototype | New file | 备注 |
|---|---|---|
| `ValuationCard` | `Fundamentals/ValuationCard.tsx` | 百分位条用纯 div + bg color；现价标记用 `absolute` |
| `FinancialsCard` | `Fundamentals/FinancialsCard.tsx` | 用 Recharts `<BarChart>`；高亮最末柱（current quarter） |
| `DisclosuresCard` | `Fundamentals/DisclosuresCard.tsx` | 筛选 chips 状态本地即可；分页支持「加载更多」 |
| `InstitutionsCard` | `Fundamentals/InstitutionsCard.tsx` | 北向曲线用 Recharts `<AreaChart>` |

### 5.5 Tab 4: 决策与复盘

| Prototype | New file | 备注 |
|---|---|---|
| `SignalDetailCard` | `Playbook/SignalDetailCard.tsx` | Agent 推理链 trace_url 在生产环境是真链接，点击新窗口打开 |
| `BacktestCard` | `Playbook/BacktestCard.tsx` | 累积收益曲线用 Recharts `<AreaChart>`；统计表用 grid |
| `NotesTimeline` | `Playbook/NotesTimeline.tsx` | 笔记走 `useAnalystNotes(symbol)` hook，自动按 symbol+date 落地；支持 optimistic update |

---

## 6. 数据契约与 API hooks

### 6.1 类型来源

**所有类型必须 import 自 `src/types/symbol-workspace.ts`**（即 `handoff/symbol-workspace.types.ts` 移过去）。

### 6.2 推荐 hook 拆分

```ts
// src/api/symbol-workspace.ts

// 关键路径 — 用户打开页面就要立刻拿到
export function useSymbolCritical(symbol: string) {
  return useQuery<{ header: SymbolHeader; profile: SymbolProfile; status: DataStatus }>(
    ["symbol", symbol, "critical"],
    () => fetchSymbolCritical(symbol),
    { staleTime: 5_000 }
  );
}

// Tab 1
export function useSymbolPulse(symbol: string, mode: StrategyMode) {
  return useQuery<{
    decision: DecisionVerdict;
    narrative: SymbolNarrative;
    indicators: IndicatorColumn[];
    risk_context: RiskBudgetContext;
    risk_flags: { text: string; tone: Tone }[];
  }>(["symbol", symbol, "pulse", mode], () => fetchSymbolPulse(symbol, mode));
}

// Tab 2、Tab 3、Tab 4 同理 lazy 拉
export function useSymbolChart(symbol: string, interval: "1D" | "1W" | "1M") { /* ... */ }
export function useSymbolFundamentals(symbol: string) { /* ... */ }
export function useSymbolPlaybook(symbol: string) { /* ... */ }

// 笔记单独走 — 频繁读写
export function useAnalystNotes(symbol: string) { /* useQuery + useMutation */ }

// 风险预算 — 纯前端计算，不发请求
import { computeRiskBudget } from "@/utils/risk-budget";
```

### 6.3 Mock 数据迁移

原型中 `src/data.jsx` 的所有字段在 `symbol-workspace.types.ts` 里都有对应类型。落地时：
1. 在 `__tests__/fixtures/symbol-workspace.fixture.ts` 复刻一份**带类型**的版本
2. 用 MSW (`mock service worker`) 拦截 API 返回这份 fixture
3. **不要**让组件直接 import fixture；走 hooks → MSW → fixture

---

## 7. 四态实现规范

> 简报 §8 强制要求。**每个数据组件必须实现这 4 态**，否则不予合并。

```tsx
const { data, status } = useSymbolPulse(symbol, mode);

if (status === "loading") return <PulseSkeleton />;            // shimmer 骨架，高度同最终
if (status === "empty")   return <PulseEmpty onGenerate={...} />; // 灰虚线框 + 居中图标 + CTA
if (status === "error")   return <PulseError onRetry={...} />;   // 黄边 + 错误原因 + 重试
// status = "ok" | "partial"
return (
  <>
    {status === "partial" && <PartialStrip missing={data.missing} />}
    <PulseContent data={data} />
  </>
);
```

抽一个 `<AsyncBoundary>` 高阶组件统一这一层，所有 tab 用它包：

```tsx
<AsyncBoundary state={pulseState} skeleton={<PulseSkeleton />}>
  {(data) => <PulseContent data={data} />}
</AsyncBoundary>
```

---

## 8. Sprint 切片建议

| Sprint | 范围 | 验收 |
|---|---|---|
| **S1 (1 周)** | Shell + Header + Profile + Nav + Right Rail（不接真数据，先用 fixture） | 视觉与原型对齐；切换 symbol 时左导航高亮跟随；Right Rail 笔记本地存储能跑 |
| **S2 (1 周)** | Tab 1 现状速览全部组件 + `computeRiskBudget` 纯函数 + 真实 API | 风险预算计算器与产品确认数学正确；hero card 4 态全实现 |
| **S3 (1.5 周)** | Tab 2 K 线 + 信号 + 催化剂时间线（这个最重） | x 轴严格对齐；overlay 切换不闪烁；信号 marker hover 详情卡完整 |
| **S4 (1 周)** | Tab 3 基本面 4 象限 | 估值百分位双轴；财务图 QoQ/YoY 标注准确 |
| **S5 (1 周)** | Tab 4 决策与复盘 + 全局 Agent 集成 | 笔记 timeline 支持 #标签搜索；后验图能切换标的查看 |
| **S6 (3 天)** | 浅色主题 + 响应式 + a11y 审计 | Lighthouse a11y ≥ 95；对比度全过 |

每个 sprint 自己能上线 — 不要让单个 PR 跨 sprint。

---

## 9. 验收 checklist

每个 PR 提交前自查：

- [ ] 所有颜色走 Tailwind theme（grep `#[0-9A-Fa-f]{3,6}` 应为 0 命中，除了 token 定义文件）
- [ ] 没有 `any`、`@ts-ignore`、`@ts-expect-error`
- [ ] 所有数字用 `<Mono>` 包装，跳价时无字宽抖动
- [ ] 4 态都有 storybook story 或 fixture-driven test
- [ ] 键盘 Tab 可遍历所有交互元素，焦点环可见
- [ ] 对比度 ≥ 4.5:1（用 axe-core 跑一遍）
- [ ] sparkline、K 线、催化剂时间线在窄屏 (1024px) 不重叠
- [ ] 切换 symbol 时整页 < 200ms 出骨架；< 1s 出关键数据

---

## 10. 禁止事项

🚫 **禁止使用渐变 / 玻璃拟态 / 阴影**（设计简报明确禁止）—— 阴影只在 popover/tooltip
🚫 **禁止圆角 > 8px**
🚫 **禁止鲜艳色 / 自创颜色**；只能用 5 个语义色
🚫 **禁止"卡片堆卡片"**；嵌套区块用 divider + 行布局，不要再套一层 border + bg
🚫 **禁止把指标按时间维度混在一张表里**（这是 V1 翻车的根本原因）
🚫 **禁止主 CTA 散落多处**；每屏只能有一个最显眼的 primary button
🚫 **禁止把 mock 数据 import 进组件文件**；走 hooks → MSW
🚫 **禁止把数学逻辑写在组件里**；风险预算、ATR 等抽到 `utils/`
🚫 **禁止重新实现已有的原子组件**；先 grep `src/components/MarketWidgets.tsx` 再动手
🚫 **禁止把字段名翻译成中文**；后端字段 `change_pct` 就叫 `change_pct`，渲染时翻译

---

## 11. 推荐的 AI agent prompt 头

把这段贴到 Codex / Claude Code 的 system prompt 顶部：

```
You are implementing Symbol Workspace V2 — a stock research workspace for buy-side analysts.

Before writing any code:
1. Read /docs/HANDOFF.md (this file) end to end.
2. Read /src/types/symbol-workspace.ts. Every component prop must use these types.
3. Read /design-prototype/Symbol Workspace V2.html for visual reference. DO NOT copy class names; map them to Tailwind tokens.
4. Read tailwind.config.ts. Use only theme tokens — no arbitrary values.

Constraints:
- TypeScript strict, no any
- All colors/spacing/fonts via Tailwind theme tokens
- Numbers always in <Mono>
- Every data component implements loading/empty/error/partial states
- Reuse src/components/* atomic components; do not recreate

Current task: <填入具体 sprint 任务>
```

---

完。有任何不确定的地方，**先读简报、再读类型**，再读原型。
