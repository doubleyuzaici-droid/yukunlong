# Symbol Workspace V2 — High-Fidelity Design Brief

> **用途**：将本文件粘贴到 v0.dev、Lovable、Bolt.new 或 Figma Make，生成个股分析工作台 V2 的高保真原型。
> **文档结构**：第 1–11 节是上下文与规范，第 12 节是可直接复制的 **Master Prompt**（已自包含所有要点）。
> 如果工具有字符限制，只发第 12 节即可。

---

## 0. TL;DR

为一个**专业 A 股/港股投研工作台**重做"个股工作台"页面，受众是 buy-side 研究员 / 个人专业投资者。

核心目标：让用户在打开一只股票的 **30 秒内**完成"是谁 → 当前状态 → 多头/空头叙事 → 该做什么"的认知闭环。
关键差异化：标的画像条 + 催化剂时间线 + 证伪条件可视化 + 集成式风险预算计算。

视觉：**Bloomberg Terminal 的数据密度 + Linear 的呼吸感 + Stripe Dashboard 的层级清晰**，深色主题为主、浅色可选。

---

## 1. Product Context

- **产品名**：TradingAgents · 个股工作台 V2
- **场景**：研究员每天打开 5–30 只候选股，每只标的停留 1–5 分钟做"看 / 评 / 写笔记 / 进入复盘"的决策动作。
- **数据源**：日线、分时、L1 行情、北向资金、龙虎榜、研报、公告、自研多因子、V2 共振策略信号、Agent 审查结论。
- **现状痛点**（V1 暴露的问题）：
  1. 6 个 tab 命名含义重叠，用户分不清"行情分析"和"图表信号"
  2. 多个评分体系并存（信号评分 / 买卖强度 / 完整度），权重关系不明
  3. 时间维度（短/中/长线）混在一张指标矩阵里
  4. 缺催化剂（事件）时间线
  5. 右栏与中栏信息重复，主 CTA 散落 6 处
  6. 颜色语义不统一（>13 种 tone）

---

## 2. Target User & Jobs To Be Done

| 用户类型 | 核心 Job-To-Be-Done | 衡量成功的标准 |
|---|---|---|
| Buy-side 研究员 | "10 秒判断这只票今天值不值得花时间研究" | 标的画像条 + 当前状态卡 |
| 量化策略员 | "看 V2 策略对此票的信号强度和历史胜率" | 评分树 + 嵌入式回测摘要 |
| 个人专业投资者 | "我的持仓票今天出风险了吗？是否要止损？" | 风险旗标 + 仓位/止损面板 + 反向证据高亮 |
| 复盘者 | "上次系统给的信号事后表现如何？" | 历史信号后验 + 笔记痕迹 |

---

## 3. Visual Direction & References

- **主要参考**：
  - Bloomberg Terminal（数据密度、键盘操作友好、深色专业感）
  - Linear（间距与呼吸感、微动效）
  - Stripe Dashboard（清晰的层级、合理的留白）
  - TradingView（K 线区的视觉权重、事件 marker）
- **情绪关键词**：专业、冷静、可信、信息密度大但不焦虑、深色为主
- **避免**：
  - 圆角过大（>12px 显得消费级）
  - 渐变 / 玻璃拟态（不专业）
  - 鲜艳色（饱和度统一压低 8–12%）
  - "卡片堆卡片"（多用 divider + 行级排布）

---

## 4. Design Tokens

### 4.1 Color (Dark theme primary)

```
--bg-canvas:      #0B0E14   /* 页面底色 */
--bg-surface:     #11151E   /* 一级区块 */
--bg-surface-2:   #161B26   /* 嵌套区块 */
--bg-hover:       #1B2230
--border-subtle:  #1F2530
--border-strong:  #2A3140

--text-primary:   #E6EDF3
--text-secondary: #9AA5B1
--text-tertiary:  #5D6773
--text-disabled:  #3D4651

/* Semantic — 五色规范，禁止扩张 */
--success: #22C55E   /* opportunity / bullish / ready */
--warning: #F59E0B   /* caution / partial / warn */
--danger:  #EF4444   /* risk / blocked / bearish */
--info:    #3B82F6   /* neutral but informative */
--neutral: #64748B   /* missing / unknown */

/* Tone variants (10% alpha for backgrounds) */
--success-bg: rgba(34,197,94,0.10)
--warning-bg: rgba(245,158,11,0.10)
--danger-bg:  rgba(239,68,68,0.10)
--info-bg:    rgba(59,130,246,0.10)
```

### 4.2 Typography

```
font-family: "Inter", "PingFang SC", "Noto Sans SC", -apple-system, sans-serif
mono:        "JetBrains Mono", "SF Mono", monospace   /* 价格、数字 */

# Type Scale
display-xl:  32px / 40 / 600 / -0.02em    /* 极少用 */
display-l:   24px / 32 / 600 / -0.01em    /* 页面 H1 */
title-m:     18px / 26 / 600              /* 区块 H2 */
title-s:     14px / 20 / 600              /* 卡片 H3 */
body-m:      14px / 22 / 400
body-s:      13px / 20 / 400
caption:     12px / 16 / 500 / +0.02em / uppercase   /* eyebrow 标签 */
metric-l:    28px / 32 / 600 / mono       /* 主价 */
metric-m:    18px / 24 / 600 / mono       /* 指标值 */
metric-s:    14px / 20 / 500 / mono       /* 列表数字 */
```

### 4.3 Spacing & Layout

- 4px 基础栅格，常用 step：4 / 8 / 12 / 16 / 20 / 24 / 32 / 48
- 圆角：sm=4px、md=6px、lg=8px（卡片最大 8px）
- 描边：1px subtle 默认、2px strong（focus / 选中）
- 阴影：极少用；只在 popover/tooltip：`0 4px 16px rgba(0,0,0,0.4)`
- 整体页面最大宽度 1680px，居中

### 4.4 Iconography

- Lucide Icons（线性、stroke 1.5）
- 图标尺寸：14px (inline) / 16px (button) / 20px (section head)

---

## 5. Information Architecture

### 5.1 整体页面结构（从上到下）

```
┌─────────────────────────────────────────────────────────────┐
│  A. Symbol Header Bar     (sticky, 56px)                    │
├─────────────────────────────────────────────────────────────┤
│  B. Symbol Profile Strip  (64px, 标的画像条)                │
├─────────────────────────────────────────────────────────────┤
│  C. Data Status Banner    (条件渲染：blocked 时红色横幅)    │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│  D. Left │  E. Main Tabbed Workspace        │  F. Right     │
│  Nav     │                                  │  Context Rail │
│  Rail    │  (4 tabs: 现状速览 / 图表与信号  │               │
│  240px   │   基本面&催化剂 / 决策与复盘)    │  320px        │
│          │                                  │               │
└──────────┴──────────────────────────────────┴───────────────┘
```

### 5.2 Tab 重设（6 → 4）

| Tab Key | 中文名 | 一句话定位 | 主回答 |
|---|---|---|---|
| `pulse` | **现状速览** | 30 秒看懂这只票现在是什么状态 | "现在能不能进，为什么？" |
| `chart` | **图表与信号** | 全屏 K 线 + 信号 + 催化剂时间线 | "技术面怎么走，事件如何影响？" |
| `fundamentals` | **基本面 & 催化剂** | 三表、估值、研报、公告、龙虎榜 | "这家公司值多少钱、近期有什么事？" |
| `playbook` | **决策与复盘** | 信号详情、Agent 审查、历史后验、笔记 | "若进场怎么打、上次表现如何？" |

---

## 6. Page Layout (Grid Detail)

- **A. Symbol Header Bar (sticky, 56px)**
  - 左：股票代码输入框（autocomplete，含历史、自选）+ 日期范围 picker
  - 中：标的简称 + 代码 + 当前价 + 涨跌幅（color-coded）+ 数据时效徽章（live / 延迟 15min / 收盘）
  - 右：操作按钮组 — `加入自选` | `创建笔记` | `分享链接` | `刷新`

- **B. Symbol Profile Strip (64px)**
  - 8 列网格，每列一个 KV：`行业` / `市值` / `自由流通额` / `换手率` / `TTM PE (行业百分位)` / `PB` / `股息率` / `状态旗标(ST/停牌/次新/上市天数)`
  - 每个值的字号 14px metric-m，标签 12px caption text-secondary
  - 整条 1px border-bottom，无背景

- **D. Left Nav Rail (240px, sticky)**
  - 顶部搜索 + "+ 新建监控组"按钮
  - 四组可折叠：`自选 (12)` / `今日机会 (5)` / `风险升高 (3)` / `最近查看 (8)`
  - 每行：`<指示点(tone)>` `<简称>` `<代码 text-tertiary>` `<尾部 metric: 涨跌幅或评分>`
  - 当前选中项：左侧 2px accent border + 浅色背景

- **F. Right Context Rail (320px, sticky)**
  - 只放"跨 tab 不变的常驻摘要"：
    1. 价格大数 (metric-l) + 涨跌幅
    2. 单一最重要 **CTA** 按钮（动态：根据当前状态变化，如"写入 V2 信号" / "进入复盘" / "查看风险"）
    3. **多头/空头叙事** 折叠卡（2 段文字）
    4. **风险旗标** 列表（≤5 条，红/黄分色）
    5. **分析师笔记** 区（textarea，按 symbol+date 自动落地）
  - 不重复中间区域的指标矩阵

---

## 7. Key Components — Detailed Specs

### 7.1 Tab: 现状速览 (`pulse`)

布局：**三段式纵向流**（不是网格）—— 引导用户按"判断 → 证据 → 行动"顺序读。

#### 7.1.1 决策结论卡 (Hero Card)

- 高度 ~160px，full width，背景 surface-2
- 左侧：
  - eyebrow: `V2 共振策略 · 保守模式 · 2026-05-23`
  - H2 (24px): **"观察等待，趋势确认中"** （动态：opportunity/risk/warn/neutral）
  - 一句话理由：`MACD 顶部钝化，北向连续 2 日净流出，等待回踩 EMA89 后再评估`
- 右侧：评分树可视化
  ```
   信号评分 76
   ├─ 趋势 0.82  ✓
   ├─ 动能 0.41  ⚠
   ├─ 量能 0.55  ✓
   ├─ 大盘 0.30  ✗
   └─ 资金 0.68  ✓
   完整度 82%（这个评分可信）
  ```
- 左下：mode 切换分段控件 `[ 保守 | 激进 ]` + tooltip："切到激进模式：买入阈值 0.55→0.45，仓位上限 8%→15%"

#### 7.1.2 多头叙事 vs 证伪条件（并排两栏）

```
┌──── 多头叙事 ─────────┬──── 若以下任一发生即证伪 ──────┐
│ ✓ EMA21/89 多头排列   │ ✗ 跌破 EMA89                    │
│ ✓ 行业排名进前 15%    │ ✗ 北向连续 3 日净流出           │
│ ✓ 主力 5 日净流入 2.3 │ ✗ 行业指数跌破 60 日线          │
│   亿                  │ ⚠ 已发生：MACD 顶背离 5 天      │
└───────────────────────┴─────────────────────────────────┘
```

- 已发生的反向证据用 `--warning` 高亮 + 闪烁点
- 整块用 `--success-bg` / `--danger-bg` 极淡背景区分

#### 7.1.3 指标矩阵（按时间维度分栏）

```
┌─ 短线 5-20D ──┬─ 中线 1-3M ──┬─ 长线 季度+ ──┐
│ 决定进出场     │ 决定持有       │ 决定配置        │
├──────────────┼──────────────┼──────────────┤
│ RSI14    67.3 │ EMA21/89  ✓  │ ROE 18.4%      │
│ KDJ      78   │ 行业 RS  +3% │ PE 行业 35%位  │
│ 量比     1.4× │ 北向 5D  +2亿│ 自由现金流 ↑   │
│ MACD     ⚠   │ 相对沪深 +5% │                │
└──────────────┴──────────────┴──────────────┘
```

- 每栏顶部一行小字写明"这一栏决定什么动作"
- 每个指标右侧带迷你 sparkline (20 个点)
- 鼠标 hover：tooltip 显示完整时间序列 + 阈值线

#### 7.1.4 风险预算计算器（交互式）

```
┌── 风险预算 ────────────────────────────────────┐
│ 假设我投入  [200,000 ▾]   单笔风险 [1.0% ▾]   │
│                                                │
│ 建议手数      5,300 股                         │
│ 建议仓位      5.3%   ← 占组合                  │
│ 入场参考      ¥41.50                           │
│ 止损价        ¥38.42   (距入场 -7.4%)          │
│ 最大亏损      ¥2,000   (相当于组合 -0.10%)     │
│                                                │
│ 止损依据：ATR14 × 2.5  [换算法 ▾]              │
└────────────────────────────────────────────────┘
```

- 资金本金可输入（默认从用户 portfolio 配置拉）
- 滑块或下拉调单笔风险 (0.5% / 1% / 2%)
- 止损算法可切换：ATR / 支撑位 / 固定百分比
- 显示一次"如果触发止损，组合损失 X 个 bps"

### 7.2 Tab: 图表与信号 (`chart`)

#### 7.2.1 主 K 线区（60% 高度）

- TradingView 风格，支持 1D/1W/1M 切换 + 复权按钮
- 可叠加 overlay：MA20/60/120、EMA21/89、BOLL、VWAP、行业指数
- 右侧浮动工具条：画线工具
- **信号 marker**：在对应日期上方 / 下方放彩色三角，hover 弹卡片显示信号详情

#### 7.2.2 催化剂时间线（K 线正下方，120px）

```
   过去 ←─────────────────●今天●─────────────────→ 未来 30D
   |   |   |    |    |    |    |    |    |    |
   财报 研报 政策 龙虎榜    |    披露 解禁  分红  行业会议
   ●   ●   ●    ●        ●    ◯    ◯    ◯    ◯
```

- 实心 ● 表示已发生事件，hover 显示标题 + 摘要
- 空心 ◯ 表示已知未来事件
- 颜色 tone：好消息绿、坏消息红、中性灰
- 与上方 K 线**严格对齐 x 轴**

#### 7.2.3 副图区（下方 30%，多 tab 切换）

`成交量 | 资金流 | 北向 | RSI | MACD | KDJ | OBV | 自定义`
副图共享 K 线 x 轴。

### 7.3 Tab: 基本面 & 催化剂 (`fundamentals`)

四象限布局：
- **左上**：估值定位（PE / PB / PS / EV-EBITDA 的行业百分位条 + 历史百分位条，让用户一眼看到"贵不贵 / 现在贵不贵于自己"）
- **右上**：核心财务三张图（营收、净利润、ROE 的 8 季度柱状图，环比同比标注）
- **左下**：最新公告 / 研报列表（≤10 条，按时间倒序，标签：业绩 / 重组 / 监管 / 评级调整）
- **右下**：龙虎榜与机构动作（最近 N 次上榜、机构席位净买入、北向持股变化曲线）

### 7.4 Tab: 决策与复盘 (`playbook`)

- 左：当前选中信号详情卡（证据 / 风险 / 失效 / Agent 审查结论）
- 右：**该标的过去 N 次同类信号的后验表现**（折线图 + 表格：5D / 20D / 60D 收益分布、胜率、最大不利）
- 底部：**分析师笔记历史**（按时间倒序，可编辑、可置顶、支持 #标签）

---

## 8. Interaction States

每个数据相关组件必须实现 4 态：

| 状态 | 视觉 | 内容 |
|---|---|---|
| **loading** | 骨架屏（shimmer），高度与最终一致 | "读取中..." 不要出现 |
| **empty** | 灰色虚线边框 + 居中图标 + 一句话 + 操作按钮 | "暂无 V2 信号 · [生成 V2 分析]" |
| **error** | 黄色边框 + 错误图标 + 错误原因 + 重试按钮 | "策略服务未连接 · [重试]" |
| **partial** | 顶部黄条 + 部分数据 + 提示 | "因子数据缺失 3 项，已用近似值替代" |

---

## 9. Sample Data (for the AI to render realistic content)

```json
{
  "symbol": "600519.SH",
  "name": "贵州茅台",
  "price": 1623.50,
  "change": -14.50,
  "change_pct": -0.0089,
  "freshness": "2026-05-23 14:32 · 延迟 3 分钟",

  "profile": {
    "industry": "白酒",
    "sub_industry": "高端白酒",
    "market_cap_yi": 20384,
    "free_float_yi": 13260,
    "turnover_pct": 0.0042,
    "pe_ttm": 26.4,
    "pe_industry_pct": 0.42,
    "pb": 9.1,
    "dividend_yield": 0.024,
    "flags": ["上市15年"]
  },

  "decision": {
    "title": "观察等待，趋势确认中",
    "tone": "neutral",
    "reason": "MACD 顶部钝化，北向连续 2 日净流出，等待回踩 EMA89 后再评估",
    "mode": "conservative",
    "score": 0.76,
    "factors": {
      "趋势": 0.82,
      "动能": 0.41,
      "量能": 0.55,
      "大盘": 0.30,
      "资金": 0.68
    },
    "readiness": 0.82
  },

  "bull_narrative": [
    "EMA21/89 多头排列",
    "行业排名进前 15%",
    "主力 5 日净流入 2.3 亿"
  ],
  "falsification": [
    {"text": "跌破 EMA89", "occurred": false},
    {"text": "北向连续 3 日净流出", "occurred": false},
    {"text": "行业指数跌破 60 日线", "occurred": false},
    {"text": "MACD 顶背离 5 天", "occurred": true}
  ],

  "indicators_short": [
    {"label": "RSI14", "value": "67.3", "tone": "warn"},
    {"label": "KDJ-K", "value": "78", "tone": "warn"},
    {"label": "量比", "value": "1.4×", "tone": "success"},
    {"label": "MACD", "value": "顶背离", "tone": "warn"}
  ],
  "indicators_mid": [
    {"label": "EMA21/89", "value": "多头", "tone": "success"},
    {"label": "行业 RS", "value": "+3%", "tone": "success"},
    {"label": "北向 5D", "value": "+2 亿", "tone": "success"},
    {"label": "相对沪深", "value": "+5%", "tone": "success"}
  ],
  "indicators_long": [
    {"label": "ROE", "value": "18.4%", "tone": "success"},
    {"label": "PE 行业位", "value": "35%", "tone": "success"},
    {"label": "自由现金流", "value": "↑ 8 季度", "tone": "success"}
  ],

  "risk_flags": [
    "MACD 顶背离持续 5 天",
    "北向连续 2 日净流出 1.1 亿",
    "次日深交所龙虎榜上榜"
  ],

  "position_calc": {
    "capital": 200000,
    "risk_pct": 0.01,
    "shares": 5300,
    "position_pct": 0.053,
    "entry": 41.50,
    "stop": 38.42,
    "stop_pct": -0.074,
    "max_loss": 2000,
    "portfolio_loss_pct": -0.001,
    "stop_method": "ATR14 × 2.5"
  },

  "catalysts_past": [
    {"date": "2026-04-29", "type": "earnings", "title": "2026 Q1 财报", "tone": "success"},
    {"date": "2026-05-10", "type": "research", "title": "中金给买入", "tone": "success"},
    {"date": "2026-05-15", "type": "lhb", "title": "深股通净买入 1.2 亿", "tone": "success"}
  ],
  "catalysts_future": [
    {"date": "2026-06-10", "type": "disclosure", "title": "中期业绩预披露窗口"},
    {"date": "2026-06-20", "type": "unlock", "title": "限售解禁 0.4 亿股"},
    {"date": "2026-07-05", "type": "industry", "title": "白酒行业秋糖会"}
  ]
}
```

---

## 10. Responsive Behavior

| 断点 | 布局变化 |
|---|---|
| ≥1440px | 三栏完整布局（左 240 + 中 弹性 + 右 320） |
| 1024–1439 | 左导航折叠为顶部下拉 + 右栏宽度收到 280 |
| 768–1023 | 取消右栏，内容下沉为底部可滑动 sheet |
| <768 (iPad/手机) | 单栏堆叠；Symbol Profile Strip 横向滚动；K 线区高度自动调整 |

---

## 11. Tech Constraints

- **框架**：React 18 + TypeScript（项目栈一致）
- **样式**：Tailwind CSS（v0 / Lovable 友好），用 CSS variables 落地 token
- **图表库**：建议 lightweight-charts（K 线）+ Recharts（其它）
- **图标**：Lucide
- **状态**：纯组件 + props 驱动，不引入额外状态库
- **深色为默认**，浅色可切换（顶部用户菜单）
- **可访问性**：所有交互元素键盘可达、`aria-label` 齐全、对比度 ≥ 4.5:1

---

## 12. The Master Prompt — 直接粘贴到 v0.dev / Lovable

> 把下面这段从 `===` 之间整段拷贝走即可。已经自包含设计 token、布局、组件、样本数据。

```
===

Build a high-fidelity React + Tailwind CSS prototype of a professional stock
research workspace named "Symbol Workspace V2" for buy-side analysts trading
China A-shares. Use a dark theme with these exact tokens:

COLORS
- bg-canvas #0B0E14, bg-surface #11151E, bg-surface-2 #161B26, bg-hover #1B2230
- border-subtle #1F2530, border-strong #2A3140
- text-primary #E6EDF3, text-secondary #9AA5B1, text-tertiary #5D6773
- success #22C55E, warning #F59E0B, danger #EF4444, info #3B82F6, neutral #64748B
- Use 10% alpha of each semantic color for tinted backgrounds

TYPOGRAPHY
- Inter + PingFang SC; mono = JetBrains Mono for all numbers/prices
- H1 24px/600, H2 18px/600, body 14px/22, caption 12px uppercase tracking 0.02
- Metric-L 28px mono 600, Metric-M 18px mono 600

LAYOUT (max width 1680px centered)
A. Sticky 56px header: ticker autocomplete input, date range picker, symbol name
   + price (mono 28px) + change% (color coded), freshness badge, action buttons
   (Add to Watchlist, Note, Share, Refresh).
B. Profile Strip (64px, 8 columns, 1px bottom border, no card bg):
   Industry, Market Cap, Free Float, Turnover%, PE TTM (industry %tile),
   PB, Dividend Yield, Status Flags.
C. Three column body: Left 240px nav rail (sticky), Center flexible, Right 320px
   context rail (sticky).
D. Left Nav: collapsible groups "自选 12 / 今日机会 5 / 风险升高 3 / 最近 8".
   Each row has a colored dot, short name, code (text-tertiary), trailing metric.
   Active row has 2px accent left border + bg-hover.
E. Center: 4 tabs with active underline (no boxes):
   现状速览 / 图表与信号 / 基本面&催化剂 / 决策与复盘.
F. Right rail: large price (metric-L), one prominent CTA button (full width),
   then collapsible cards for Bull Narrative, Risk Flags, Analyst Notes textarea.
   DO NOT repeat content from the center area.

TAB 1 "现状速览" content (top to bottom):

1) Hero Decision Card (160px, bg-surface-2, no shadow):
   - Left: eyebrow "V2 共振策略 · 保守模式 · 2026-05-23", H2 "观察等待，趋势确认中",
     subline "MACD 顶部钝化，北向连续 2 日净流出，等待回踩 EMA89 后再评估"
   - Right: a 5-row factor tree with values 趋势 0.82 ✓, 动能 0.41 ⚠, 量能 0.55 ✓,
     大盘 0.30 ✗, 资金 0.68 ✓, plus "完整度 82%" below as a small caption
   - Bottom-left: segmented control [保守 | 激进] with a tooltip explaining
     threshold differences

2) Two-column "Bull Narrative vs Falsification" (equal width, 8px gap):
   - Left (tinted success bg): "多头叙事" header + 3 checkmark rows:
     "EMA21/89 多头排列", "行业排名进前 15%", "主力 5 日净流入 2.3 亿"
   - Right (tinted danger bg): "若以下任一发生即证伪" header + 4 rows:
     "跌破 EMA89", "北向连续 3 日净流出", "行业指数跌破 60 日线",
     plus one warning row "MACD 顶背离持续 5 天" with a pulsing yellow dot
     indicating it has already occurred

3) Time-Horizon Indicator Matrix (3 columns):
   Column headers with subtitles:
     "短线 5-20D · 决定进出场"
     "中线 1-3M · 决定持有"
     "长线 季度+ · 决定配置"
   Each column shows 3-4 indicators in monospace, with a tiny 20-point sparkline
   to the right of each row. Use this data:
   Short: RSI14 67.3 (warn), KDJ-K 78 (warn), 量比 1.4× (success), MACD 顶背离 (warn)
   Mid:   EMA21/89 多头 (success), 行业 RS +3% (success), 北向 5D +2 亿 (success),
          相对沪深 +5% (success)
   Long:  ROE 18.4% (success), PE 行业 35%位 (success), 自由现金流 ↑8 季度 (success)

4) Risk Budget Calculator (bg-surface-2, interactive form):
   Inputs row: 资金 [200,000 ▾]  单笔风险 [1.0% ▾]  止损算法 [ATR14×2.5 ▾]
   Output grid (4 columns):
     建议手数 5,300 股 | 建议仓位 5.3% | 入场参考 ¥41.50 | 止损价 ¥38.42 (-7.4%)
   Footer line: "若触发止损：组合损失 -0.10% (¥2,000)"

TAB 2 "图表与信号" content:
- 60% height TradingView-style candlestick chart with toolbar (1D/1W/1M, 复权,
  draw tools on right). Overlay buttons: MA20/60/120, EMA21/89, BOLL, VWAP, 行业指数.
  Show 3 triangle signal markers on the chart with hover tooltips.
- Just below the chart, a 120px horizontal CATALYST TIMELINE strictly aligned to
  the x-axis. Past events (filled circles, color-coded green/red/gray):
    2026-04-29 财报, 2026-05-10 中金买入, 2026-05-15 龙虎榜
  Future events (open circles, gray):
    2026-06-10 业绩预披露, 2026-06-20 解禁, 2026-07-05 秋糖会
  A vertical "今天" line through the middle separates past and future.
- Below timeline, a 30% height subchart tabset:
  成交量 | 资金流 | 北向 | RSI | MACD | KDJ | OBV

TAB 3 "基本面&催化剂" — 2x2 grid:
- Top-Left: Valuation percentile bars (PE/PB/PS/EV-EBITDA), each with industry
  percentile + historical self percentile shown as horizontal bars
- Top-Right: 3 small bar charts of Revenue / Net Profit / ROE over 8 quarters
- Bottom-Left: Recent disclosures/research list, max 10 rows with tag chips
  (业绩/重组/监管/评级)
- Bottom-Right: Northbound holdings line chart + institutional desk net buys table

TAB 4 "决策与复盘":
- Left 60%: Current signal detail card with sections 证据 / 风险 / 失效条件 /
  Agent 审查结论 (each as a list with checkmarks/X)
- Right 40%: A backtest summary card titled "该标的过去 N 次同类信号的后验表现"
  showing a line chart of cumulative return distribution + a small stats table
  (胜率 / 平均 5D / 20D / 60D / 最大不利)
- Below both: Analyst Notes timeline (reverse chronological, supports # tags,
  has pin button)

INTERACTION STATES every data card must have:
- loading: shimmer skeleton, same height as final
- empty: dashed gray border + center icon + one-sentence + action button
- error: yellow border + retry button
- partial: top yellow strip with fallback notice

GENERAL RULES
- Do not use gradients, glassmorphism, or saturated colors.
- Border radius max 8px on cards, 4px on inline pills.
- Use dividers and row layouts more than nested cards.
- Numbers always in monospace.
- Keep one and only one primary CTA visible per screen at any time.
- All interactive elements keyboard accessible with visible focus rings.
- Page should look like a fusion of Bloomberg Terminal data density and Linear's
  breathing room and Stripe Dashboard's hierarchy.

Output: a single self-contained React page component using Tailwind + lucide-react
icons. Mock all data inline using the values above. Make tabs actually switchable.
Make the risk budget calculator inputs actually update the outputs reactively.

===
```

---

## 13. 使用建议

1. **第一次提交给 v0.dev**：把第 12 节整段贴进去，让它先出"现状速览" tab 的完整版本。
2. **后续 follow-up prompt**（在 v0 对话里继续追问）：
   - "现在把 Tab 2 图表与信号也实现出来，K 线用模拟数据，催化剂时间线严格对齐 x 轴"
   - "把右侧 Context Rail 的 Analyst Notes 改成可输入、自动保存到 localStorage"
   - "增加浅色主题切换按钮，浅色版色板：bg-canvas #FAFBFC, surface #FFFFFF, text-primary #0F172A"
3. **拿到 v0 输出后**：
   - 复制核心 JSX 与 Tailwind class 名
   - 对照本文 §4 设计 token，把 v0 的临时颜色 / 字号统一到 token
   - 把 mock data 换成你们 `MarketContextPayload` / `ResonanceV2Analysis` 真实类型

## 14. 后续可生成的配套文档

如果你需要，我还可以补：
- 一份用于设计师评审的 **Figma 注释 PDF**（每个组件标注 spec）
- 一份给前端落地的 **组件拆分清单**（哪些是新组件、哪些复用现有 `MarketWidgets.tsx`）
- 一份**实施计划**：3 个 sprint 的推荐切片（先现状速览 → 图表催化剂 → 决策复盘 → 设计统一）

只需告诉我要哪一份。
