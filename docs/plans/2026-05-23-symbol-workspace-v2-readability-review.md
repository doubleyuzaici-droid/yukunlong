# Symbol Workspace V2 — 信息可读性 + 投研体验审查报告

> **范围**：审查 `TradingAgents/frontend/src/pages/symbol/**` 及 V2 全部展示组件，从两个角度同时看：
> - **专业投研分析师**：买方研究员、量化策略员、个人专业投资者真正关心的内容
> - **UX**：信息密度 vs 认知负担、错读风险、可执行性
> **不实现代码**，只列发现 + ROI 排序的优化清单。

---

## 0. TL;DR

| 维度 | 评分 | 短评 |
|---|---|---|
| **信息密度 vs 认知负担** | **7 / 10** | 三栏 + 4 tab 的结构合理，但首屏元素 ≥ 14 个，无视觉权重梯度 |
| **投研专业度** | **8 / 10** | 核心要素覆盖完整（决策/多空/指标矩阵/估值/催化剂/后验），但缺**同板块联动 / 集中度 / 一致预期** 三个买方研究员高频用项 |
| **UX 可用性** | **6 / 10** | 缺 URL 状态同步、缺键盘快捷键、错误提示笼统、首屏认知压力大 |

**最严重的 3 个问题（必须修）**：
1. 🔴 **红绿色彩双语义系统冲突**：`toneOfChange`（A 股红涨绿跌）与 `classifyTone`（指标好=绿 / 坏=红）并存，余光扫读会**直接误读**
2. 🔴 **数字单位与精度参差**：亿/万/元、% 写法不统一，并排时无法对比
3. 🔴 **Bull vs Falsify 不是真镜像**：bull 来自 drivers + passed checklist，falsify 来自 warnings / blocking_reasons，**两侧语义不对仗**

**建议优先级**：先做"P0 修补"（1 周）→ 投研补强 Top 3（1.5 周）→ UX P1（1 周）。

---

## 1. 整体评估

### 1.1 V2 在做对的事 ✅

1. **决策驱动而非数据驱动的首屏**：Hero Decision Card 直接给"观察等待 / 进场 / 风险"，不是从一堆数字让用户自己拼判断
2. **多空对照设计**：Bull Narrative vs Falsify Clauses 双栏并列，强迫研究员同时思考多头与反向证据
3. **风险预算计算器内嵌**：从"该不该进"直接连到"进多少仓位、止损多少"，闭环到可执行动作
4. **时间维度分层指标矩阵**：短/中/长三栏分别对应进出场/持有/配置决策，符合投研思维流程
5. **不塞 0 假装有数据**：null + partial 态 + 显式 missing[] 列表 — 这是真正专业的数据处理纪律
6. **催化剂时间线对齐 K 线**：past + future 形成事件驱动叙事
7. **A/B 灰度可逆**：双向切换按钮 + URL 强制 + localStorage 偏好，留有退路

### 1.2 V2 还差什么

- 第一眼**没有视觉锚点**：用户一上来不知道先看哪
- **重数据呈现，轻数据解读**：5 因子评分 0.82 是好是坏？读者要自己脑补阈值
- **缺少"相对位置"**：缺横向（同行/同板块）和纵向（历史百分位）的对比锚点
- **错误恢复路径模糊**：用户看到 "策略服务未连接" 不知道下一步该做什么

---

## 2. 信息可读性问题（按严重程度）

### 2.1 P0 严重（必须修）

#### P0-1 🔴 红绿色彩双语义系统冲突

**问题**：V2 同时存在两套色彩语义：

| 系统 A：A 股价格 | 系统 B：指标健康度 |
|---|---|
| `toneOfChange()`：涨 → `danger`（红）/ 跌 → `success`（绿） | `classifyTone()`：好 → `success`（绿）/ 坏 → `danger`（红） |
| 用于：Header 价格、ContextRail 大价格、NavRail 涨跌幅 | 用于：Indicator Matrix、Bull/Falsify tone、5 因子评分 |

具体出错场景：
- [Header.tsx:37](TradingAgents/frontend/src/pages/symbol/chrome/Header.tsx#L37) `const tone = toneOfChange(header.change_pct)` → 股价上涨时整个价格区**红色**
- [HeroDecisionCard.tsx:34](TradingAgents/frontend/src/pages/symbol/pulse/HeroDecisionCard.tsx) 5 因子评分 0.82 是 `success` → **绿色**
- 用户余光扫读：左上"红色（涨）" + 右下"绿色（好）"——视觉冲突，看错概率高

**修复方向**：
- **方案 A（推荐）**：拆 token，价格涨跌用 `--sw-rise / --sw-fall`（独立颜色），指标用 `--sw-success / --sw-danger`，二者绝不复用
- **方案 B**：跟从国际惯例（涨绿跌红），加用户偏好开关。但 A 股本土化习惯重，**不推荐**
- **方案 C**：在涨跌幅旁边永远带↑↓符号 + 文字 "+0.89%"，靠形而非色避免误读

**影响范围**：[formatters.ts:31](TradingAgents/frontend/src/pages/symbol/formatters.ts#L31)、`tokens.css` 加新变量、所有用 `toneOfChange` 的组件

---

#### P0-2 🔴 数字单位与精度不一致

**问题**：同一画面上不同尺度数字并排，难对比。

例：[ProfileStrip.tsx](TradingAgents/frontend/src/pages/symbol/chrome/ProfileStrip.tsx) 一行 8 个 cell：

| 字段 | 值 | 单位 | 问题 |
|---|---|---|---|
| 市值 | 20,384 | 亿 | OK |
| 自由流通 | 13,260 | 亿 | 也是亿，但有时是万亿——尺度跨度大 |
| 换手率 | 0.42 | % | 小数 vs 百分号风格不一致 |
| PE TTM | 26.4 | - | 倍数无单位 |
| 股息率 | 2.4 | % | 同换手率 |

同时 [IndicatorMatrix](TradingAgents/frontend/src/pages/symbol/pulse/IndicatorMatrix.tsx) 里：
- `量比 1.4×` （× 符号）
- `+2.0 亿`（中文单位）
- `+3.0%`（百分号）
- `78.0`（无单位）

**Risk Budget Calculator** [RiskBudgetCalc.tsx](TradingAgents/frontend/src/pages/symbol/pulse/RiskBudgetCalc.tsx)：
- 输出 4 列同等视觉权重，但 "5,300 股" / "5.3%" / "¥1,503" / "¥-2,000" **完全不同尺度**

**修复方向**：
- 建立"数字格式手册"，强制使用：
  - 价格：`¥XX.XX`（保留 2 位）
  - 涨跌幅：`+0.89%`（带正负号、1 位小数）
  - 大金额：`X.XX 亿` / `X.XX 万`（自动选用单位）
  - 比率：统一 `0.XX×` 或 `XX.X%`，不混用
  - 股数：`X,XXX 股`（整百对齐）
- 把现有 [formatters.ts](TradingAgents/frontend/src/pages/symbol/formatters.ts) 扩成单元测试覆盖的规范库

---

#### P0-3 🔴 数据时效碎片化

**问题**：用户问"我看到的是几点的数据？"，V2 的答案散在 3 个地方：

| 位置 | 显示什么 |
|---|---|
| [Header.tsx](TradingAgents/frontend/src/pages/symbol/chrome/Header.tsx) | "延迟 3 min · 2026-05-23 14:32" |
| [StatusBanner.tsx](TradingAgents/frontend/src/pages/symbol/chrome/StatusBanner.tsx) | "部分数据缺失（fund_flow / lhb）" |
| [FundamentalsTab](TradingAgents/frontend/src/pages/symbol/fundamentals/FundamentalsTab.tsx) 内部各面板 | 不显示数据日期 |

用户的高频问题在 V2 无法直接看到：
- 这个 PE 是什么时候的？
- 北向是收盘后更新还是实时？
- 龙虎榜 5/22 已出还是要等 5/23 收盘后？
- 估值百分位是用 N 年历史算的？

**修复方向**：
- 每个 Panel 顶部 `panel__head` 加 `as-of` 标签：`<small>截至 2026-05-23 收盘</small>` / `<small>历史样本 1,247 天</small>`
- StatusBanner 升级：不只是"partial"，列出每个数据源的最后更新时间表

---

#### P0-4 🔴 Bull vs Falsify 不是真镜像关系

**问题**：[NarrativeCards.tsx](TradingAgents/frontend/src/pages/symbol/pulse/NarrativeCards.tsx) 设计是"多空对照"，但实际数据：
- **bull[]** ← `analysis.market_filter.drivers` + `analysis.checklist.passed=true.label`（驱动因素 + 已通过检查）
- **falsify[]** ← `analysis.data_quality.warnings` + `blocking_reasons`（**数据质量警告** ≠ 反向证据！）

举例：当前 V2 可能呈现：
```
✓ 多头叙事             ✗ 若以下任一发生即证伪
  EMA21/89 多头排列       MACD 顶背离 5 天
  行业 RS 前 15%          北向连续 2 日净流出
  主力 5D 净流入          沪深 300 跌破 60 日线
```

但实际后端逻辑里 falsify 的语义其实是"数据警告 + 阻断原因"，不是真正与 bull 对仗的"反向触发条件"。

**修复方向**：
- 后端 `/api/strategies/resonance-v2/analyze` 增加 `falsify_conditions: { text, occurred, since? }[]` 字段，明确返回**镜像的反向触发条件**
- 前端 mapper [mappers.ts:333](TradingAgents/frontend/src/api/symbol-workspace/mappers.ts) 改成读这个字段，不再从 data_quality 推断
- bull / falsify 应该用同一套语法："EMA21 在 89 上方" ↔ "EMA21 跌破 89"

---

#### P0-5 🔴 评分缺少阈值参照

**问题**：[HeroDecisionCard.tsx](TradingAgents/frontend/src/pages/symbol/pulse/HeroDecisionCard.tsx) 显示：
- 综合评分 `76 / 100`
- 5 因子：趋势 0.82 ✓ / 动能 0.41 ⚠ / 量能 0.55 ✓ / 大盘 0.30 ✗ / 资金 0.68 ✓

**用户不知道**：
- 76 算高还是低？买入阈值是多少？
- 0.41 是临界值还是远低于阈值？
- ✓ ⚠ ✗ 的临界点是 0.5 / 0.7 还是动态阈值？

**修复方向**：
- 评分条上加阈值刻度线（如绿区 ≥ 0.7、黄区 0.4-0.7、红区 < 0.4）
- 综合评分加 "保守模式买入阈值 ≥ 55 / 当前 76（高于阈值）" 一行解释
- Tooltip 显示"该因子近 12 个月分布：均值 0.55 / 标准差 0.18 / 当前在 P82"

---

### 2.2 P1 重要（影响决策质量）

#### P1-6 长线列空态占用视觉权重

[IndicatorMatrix.tsx](TradingAgents/frontend/src/pages/symbol/pulse/IndicatorMatrix.tsx) 第三列 `horizon: "long"` 在没数据时显示 "长线指标 待接入"，与短/中两列等宽，**给用户的提示是"这里本来该有东西"**。但项目 6 周内大概率不会接入基本面长线指标。

**修复方向**：
- 短期：默认 2 栏（短 + 中），长线作为可展开折叠区，"接入 ROE 趋势后再展示"
- 长期：接入基本面后再回到 3 栏

#### P1-7 Sparkline 缺坐标语义

[atoms.tsx Sparkline](TradingAgents/frontend/src/pages/symbol/_shared/atoms.tsx) 是 80×20 px 的纯线，**没有 X/Y 坐标、没有 0 线**。

用户看到：
- RSI14 的 sparkline 一路向上 → 是好还是坏？（70 以上是超买）
- ret20 的 sparkline 在 0 上下波动 → 是穿过 0 几次？

**修复方向**：
- 关键阈值（RSI 70/30、ret 0、KDJ 80/20）加水平线
- hover 弹完整时间序列 tooltip（已在 IndicatorRow.tooltip 字段预留，但未渲染）

#### P1-8 Hero 一句话 reason 信息密度过低

[HeroDecisionCard.tsx](TradingAgents/frontend/src/pages/symbol/pulse/HeroDecisionCard.tsx) 中 `decision.reason` 显示：
> MACD 顶部钝化、北向连续 2 日净流出 1.1 亿，建议等待回踩 EMA89（约 ¥1,580）后再评估买点。

这个还行。但 mapper [mappers.ts:287](TradingAgents/frontend/src/api/symbol-workspace/mappers.ts) 实际取的是：
```typescript
reason: safeArray(analysis.market_filter?.drivers)[0] ||
        analysis.trend_state?.action ||
        analysis.decision.label ||
        "等待更多信号确认"
```

第一个 fallback 是 drivers[0] —— 那是一个驱动因子描述，不是"决策理由"。容易看到"行业排名进前 15%"作为 reason，这不是给用户的解释。

**修复方向**：
- 后端 `decision` 字段加 `reason: string` —— 由策略生成"为什么是这个动作"的一句话
- 前端不再 fallback 拼装

#### P1-9 Right Rail CTA 含义模糊

[SymbolWorkspaceV2.tsx](TradingAgents/frontend/src/pages/symbol/SymbolWorkspaceV2.tsx) 主 CTA 的动态文案：
- 当前 tab pulse → "→ 切到图表确认"
- 当前 tab chart → "→ 查看决策"
- 其它 → "→ 写入信号"

问题：**"→ 切到图表确认"是什么意思？确认什么？**

**修复方向**：把 CTA 与 decision.tone 关联：
- tone=opportunity → "进入信号审查（执行清单）"
- tone=warn → "查看证伪条件 + 设置提醒"
- tone=risk → "查看仓位与止损建议"
- tone=neutral → "进入图表寻找入场点"

#### P1-10 风险旗标无优先级 / 时效

[ContextRail.tsx](TradingAgents/frontend/src/pages/symbol/chrome/ContextRail.tsx) 风险旗标列出 4 项：
- MACD 顶背离 5 天
- 北向连续 2 日净流出
- 大盘环境转弱
- 6-20 解禁

**用户该按什么顺序处理？哪些是"立刻"哪些是"长期监控"？**

**修复方向**：
- 分级：`即刻处理 / 短期观察 / 长期监控` 三档
- 每项右侧加首次发生时间："2026-05-19 起" / "5/15 起"
- 排序：immediate > short-term > long-term

#### P1-11 NavRail 涨跌幅缺少时效

[NavRail.tsx](TradingAgents/frontend/src/pages/symbol/chrome/NavRail.tsx) 列出"自选 12 只"，每行右边 `-0.89%` 涨跌幅。

**问题**：这是当日还是 5 日？刷新频率？

**修复方向**：在 NavRail group 头部加"截至 14:32"标签，刷新逻辑文档化

#### P1-12 Tab 4 后验图无与基准对比

[PlaybookTab.tsx](TradingAgents/frontend/src/pages/symbol/playbook/PlaybookTab.tsx) 显示"累积收益曲线"，但**没有对比基准**：
- 没有沪深 300 同期曲线作对照
- 没有"同样信号在同类标的的平均表现"

**修复方向**：
- 后端 `/backtest-summary` 增加 `benchmark_curve: number[]`（基准指数同期表现）
- 前端叠加两条曲线对比

#### P1-13 笔记区两个入口可能造成混淆

V2 笔记功能在两处：
- [ContextRail.tsx](TradingAgents/frontend/src/pages/symbol/chrome/ContextRail.tsx) 右栏：单条 textarea，每次覆盖上一条
- [PlaybookTab.tsx](TradingAgents/frontend/src/pages/symbol/playbook/PlaybookTab.tsx) 笔记 Timeline：append 模式 + 历史列表

两个 localStorage key 也不同（`...notes.{symbol}.{date}` 但内部数据结构不同），**用户搞不清楚自己写在哪里了**。

**修复方向**：
- 右栏笔记改成 Timeline 缩略图（显示最近 1 条 + "查看全部 N 条 →"）
- 双向同步同一 localStorage 来源

#### P1-14 移动端没有搜索

[tokens.css](TradingAgents/frontend/src/pages/symbol/tokens.css) `@media (max-width: 767px)` 直接 `.sw-header__search { display: none }`，**用户不能切换标的了**。

**修复方向**：移动端把搜索做成全屏 modal，由 header 一个图标按钮触发

---

### 2.3 P2 加分项（不紧急）

#### P2-15 价格相对位置无显示

[Header.tsx](TradingAgents/frontend/src/pages/symbol/chrome/Header.tsx) 只显示当前价 + 涨跌幅，**没有**：
- 距 52 周高/低多少
- 距主要均线（MA20/60/120）的偏离度
- 振幅 = (high - low) / prev_close

#### P2-16 K 线 overlay 没有 52 周高/低标注

[ChartTab.tsx](TradingAgents/frontend/src/pages/symbol/chart/ChartTab.tsx) 复用 V1 PriceHistoryChart，缺水平线标注关键位（年线、52W 高低、压力支撑）

#### P2-17 缺少同行业 / 同板块联动

V2 没有任何"这只票动的时候同板块在动吗"的视图。当前只有 `rel_strength_industry20`（标量数字）。

#### P2-18 信号详情卡的"下一步动作"是占位

[PlaybookTab.tsx](TradingAgents/frontend/src/pages/symbol/playbook/PlaybookTab.tsx) 第四列 "下一步动作" 当 `agent` 为 null 时显示一行 "进入 Agent 审查后生成下一步建议" —— 不可执行

#### P2-19 缺少历史"相似日"对比

A 股专业分析常做"今天这种状态过去出现过吗？后续 N 天平均表现如何？"

#### P2-20 缺少打印 / 截屏 / PDF 导出

研究员习惯把分析截图发到群里讨论

---

## 3. 专业投研维度补强

### 3.1 现有覆盖盘点

| 投研要素 | V2 现状 | 评分 |
|---|---|---|
| 行情快照 | Header + Profile Strip | ✅ A |
| 多空叙事 | Bull / Falsify 双栏 | ✅ B+（缺真镜像，见 P0-4）|
| 时间维度指标 | 短/中/长分栏矩阵 | ✅ B（长线列空）|
| 技术面 K 线 | TradingSignalKlinePanel 复用 V1 | ✅ B |
| 资金面 | 主力/北向 在指标矩阵 + 北向曲线 + 龙虎榜机构席位 | ✅ B+ |
| 基本面估值 | PE/PB 标量 + 行业 + 历史百分位 | ✅ B+ |
| 基本面盈利质量 | 8 季度营收/净利/ROE 柱图 | ✅ B（缺现金流 / 毛利率 / 增速对比）|
| 催化剂 | past + future 双向时间线 | ✅ A |
| 风险预算 | 实时联动计算器（3 算法）| ✅ A+ |
| 信号详情 + Agent 审查 | SignalDetail + AgentReview | ✅ B |
| 后验 | 胜率 + 5/20/60D 平均收益 + 曲线 | ✅ B（缺基准对比，见 P1-12）|
| 分析师笔记 | localStorage 持久化 + #标签 | ✅ B |

### 3.2 高价值缺失项（按价值排序）

#### 🌟 缺失 1：同板块 / 同行业联动视图

**为什么重要**：买方研究员决策的第一道闸门是"这是个股逻辑还是板块逻辑"——如果整个板块在涨，单股的 alpha 才有意义。

**建议**：在 Tab 2 K 线区上方加一条 mini-strip：
```
该股 +1.2%  ▍  申万白酒指数 +0.8%  ▍  沪深 300 -0.3%  ▍  Beta 1.4
```
点击展开同板块前 5 只标的当日表现。

**数据可行性**：
- 现有 `MarketContextPayload.relative_strength` 有标量，但缺时间序列
- 需要后端补 `/api/professional/sector-snapshot?symbol=&date=` 返回同板块小样本

**ROI**：高价值 / 中等 effort

---

#### 🌟 缺失 2：股权集中度 + 持仓结构

**为什么重要**：A 股 buy-side 必看"筹码集中度"——基金重仓占流通 / 北向占流通 / 大股东持股变化。集中度高 = 容易暴动；集中度低 = 流动性好。

**建议**：在 Tab 3 加 "持仓结构" 面板，含：
- 北向持股占流通：12.4%（↑ 0.8 pp / 30D）
- 公募基金重仓：8.7%（↑ 1.2 pp / Q）
- 沪股通买入家数 / 卖出家数（top10 席位）
- 大股东持股变动：5/10 减持 0.2%

**数据可行性**：
- akshare 有 `stock_hk_ggt_components_em` / `stock_em_fund_position`
- 需要新增数据源 + 表

**ROI**：高价值 / 大 effort（需新表）

---

#### 🌟 缺失 3：卖方一致预期 + 评级动作

**为什么重要**：一致预期（consensus）的"预期差"是 alpha 的重要来源。
- 一致预期目标价 vs 当前价 → "潜在上行空间"
- 近 N 个月评级上调 / 下调家数 → 卖方情绪

**建议**：Tab 3 加 "卖方观点" 面板：
```
一致预期目标价   ¥1,820   +12.1% 上行空间   样本 18 家
评级分布         强烈推荐 8 / 推荐 7 / 中性 3 / 卖出 0
近 30D 动作      上调 3 / 下调 1 / 新增覆盖 1
```

**数据可行性**：
- akshare `stock_research_report_em` + tushare `dc.report_rc`
- 现有 news_evidence 偶有研报但未结构化

**ROI**：高价值 / 中等 effort

---

#### 缺失 4：价格相对位置全景

**为什么重要**：单看"¥1,623.50 +0.89%" 信息密度低。一行紧凑统计能多给 5 个维度。

**建议**：在 Header 下面、Profile Strip 上面，加一条"价格区间条"：
```
52W 低   ¥1,420  ▮▮▮▮▮▮▮▮◉▮▮  ¥1,820  52W 高     | 当前 P68 |
        距均线: MA20 +1.2% / MA60 +5.8% / MA120 +12.4% | 振幅 1.5%
```

**数据可行性**：已有数据，前端计算即可（无后端工作）

**ROI**：中等价值 / 小 effort

---

#### 缺失 5：大股东动作

**为什么重要**：减持、质押、股权激励是 A 股的高频"反转信号"，一条 1% 的减持公告能让股价跌 5%。

**建议**：Tab 3 的"机构动作"面板下方加"大股东行为 30D"：
- 5/10 大股东 A 减持 0.2%（套现 ¥4 亿）
- 5/3 实控人股权质押 1%（累计质押率 23%）

**数据可行性**：akshare `stock_em_yjyc` / `stock_em_zh_a_gdhs`

**ROI**：中等价值 / 中等 effort

---

#### 缺失 6：季节性 / 历史相似日

**为什么重要**：A 股有日历效应（春季躁动、半年报、年底主题等）。

**建议**：可选 panel：
- "该股票近 5 年同月平均收益分布"
- "当前 5 因子打分 0.76 类似的日子 N 个，后 20D 平均 +X%"

**ROI**：低价值 / 大 effort（数据科学工作量）—— **建议放最后**

---

## 4. UX 优化点

### 4.1 P0 严重

#### UX-P0-1 首屏元素过多，缺视觉锚点

**现象**：首屏看到 14+ 个独立信息块：
- Header（5 个内部元素）
- Profile Strip（8 cell）
- Status Banner（可能）
- Nav Rail（4 组）
- Tab Bar（4 tab）
- Hero（2 区）
- Bull / Falsify（2 卡）
- Indicator Matrix（3 列）
- Risk Budget（2 区）
- Context Rail（4 卡）

**修复方向**：
- **视觉权重梯度**：Hero Title 用 22px / 600，其它二级标题 14px / 600，三级 12px / 500 — 现状已部分做到但 Profile Strip 与 Tab 标题视觉权重接近
- **降噪默认**：Profile Strip 默认折叠为 4 cell（行业 / 市值 / PE / 状态），点击展开 8 cell；StatusBanner 仅在 partial/blocked/stale 才显示，已做到 ✓
- **首屏可视区限定 Hero + Narrative**：让用户进来 1 秒就看到"观察等待 + 多空对照"，指标矩阵和风险预算往下滚才出现

#### UX-P0-2 Tab / mode / symbol 状态不同步到 URL

**现象**：刷新页面回到 pulse tab + 保守模式，所有上下文丢失。

**修复方向**：用 React Router 或者轻量手写 URL state：
```
?ws=v2&symbol=600519.SH&date=2026-05-23&tab=chart&mode=aggressive
```
可被书签、可分享给同事、刷新不丢

**修改位置**：[SymbolWorkspaceV2.tsx](TradingAgents/frontend/src/pages/symbol/SymbolWorkspaceV2.tsx) 顶部加 `useUrlState()` hook

#### UX-P0-3 Notes 双入口语义不一致（同 P1-13）

ContextRail 与 PlaybookTab 都是笔记，但实现不同步

---

### 4.2 P1 重要

#### UX-P1-4 缺少键盘快捷键

专业用户期望：
- `⌘K` 打开搜索
- `1 / 2 / 3 / 4` 切 tab（现已支持 ArrowLeft/Right 在 TabBar 内）
- `[` / `]` 切前后标的（在自选列表中）
- `R` 刷新
- `T` 切主题
- `N` 跳到笔记
- `?` 显示快捷键面板

**修复方向**：在 [SymbolWorkspaceV2.tsx](TradingAgents/frontend/src/pages/symbol/SymbolWorkspaceV2.tsx) 加全局 `useEffect(keydown)` 监听

#### UX-P1-5 错误提示笼统，无诊断指引

**现象**：所有 fetcher 在失败时返回 "策略服务未连接" / "行情服务未连接"，用户**不知道**：
- 是后端没启动？
- 是数据库空？
- 是这个 symbol 有问题？

**修复方向**：
- AsyncBoundary 的 error state 加诊断按钮：[查看接口响应] / [复制 cURL 重试] / [切换到 mock 数据]
- 错误信息附 4 个动作选项：重试 / 切换 V1 / 报告问题 / 跳过

#### UX-P1-6 风险预算计算器隐藏在 Tab 1 底部

用户决定执行时常需要复算仓位，但每次要滚到 Pulse Tab 底部。

**修复方向**：
- 在 Header 加一个 "🧮" 图标，点击弹 modal 显示风险预算计算器
- 或者在 Tab 切换时保持计算器 sticky 在 Tab 内容右侧

#### UX-P1-7 Onboarding 缺失

第一次进 V2 的用户不知道：
- 评分 76 是什么算法
- 5 因子如何组合
- A/B 灰度切换按钮在哪
- 笔记保存在哪

**修复方向**：第一次访问加 5 步 tour（基于现有的 `localStorage` 持久化 dismissed state）

#### UX-P1-8 自选股 + 信号列表无多选 / 对比

当用户研究茅台时想顺手看下五粮液，必须切换 symbol → 上下文丢失

**修复方向**：左 Nav 长按 / Shift+Click 多选 → Pulse Tab 顶部出现迷你对比视图（缩略 Hero）

---

### 4.3 P2 加分项

#### UX-P2-9 / 10 / 11

- 缺少"打印优化布局"（@media print 样式）
- 缺少截图导出（html2canvas）
- 缺少 Onboarding 视频 / 文档链接
- 自选股池没有"添加到投资组合"流程闭环

---

## 5. Top 10 优化清单（按 ROI 排序）

| # | 优化项 | 价值 | Effort | 修改文件 |
|---|---|---|---|---|
| 1 | **拆开"价格涨跌"与"指标好坏"色彩 token**（P0-1） | 🔥 极高 | 0.5d | `tokens.css` + 全文件搜索 `tone-` 替换 |
| 2 | **统一数字格式手册 + formatter 单测**（P0-2） | 🔥 高 | 1d | `formatters.ts` |
| 3 | **每个 Panel 加 `as-of` 时效标签**（P0-3） | 🔥 高 | 0.5d | 8 个组件 |
| 4 | **后端补 `falsify_conditions` 字段 + 前端 mapper 改造**（P0-4） | 🔥 高 | 1.5d | strategy api + mapper |
| 5 | **评分条加阈值刻度 + 综合分加解释行**（P0-5） | 🔥 高 | 1d | `HeroDecisionCard.tsx` |
| 6 | **URL 状态同步**（UX-P0-2） | 🌟 高 | 1d | `SymbolWorkspaceV2.tsx` + 加 `useUrlState` hook |
| 7 | **缺失 1：同板块联动 mini-strip**（投研缺失 1） | 🌟 高 | 2.5d | 后端新增 + 新组件 |
| 8 | **键盘快捷键 + 帮助面板**（UX-P1-4） | 🌟 中 | 1d | 全局 keydown |
| 9 | **价格相对位置条**（缺失 4） | 🌟 中 | 0.5d | 新组件 |
| 10 | **Bull/Falsify 真镜像 + 用户提醒触发**（P0-4 衍生） | 🌟 中 | 1.5d | 策略服务 |

**合计 effort：约 11 天 / 2 周一个迭代**

---

## 6. 推荐迭代节奏

### Sprint A（1 周）—— P0 修补
- #1 色彩 token 拆分
- #2 数字格式规范
- #3 时效标签
- #5 评分阈值参照
- #10 Bull/Falsify 镜像（前端部分）

**验收**：随机找 3 个非 V2 设计者的同事盲测，10 秒内判断"是否上涨"和"是否健康"的正确率 ≥ 95%

### Sprint B（1.5 周）—— 投研补强
- #7 同板块联动
- #9 价格相对位置
- 缺失 2 集中度（如果数据源就绪）

**验收**：研究员盲测—用 V2 完成 3 个标的"是否建仓"决策的平均时间 ≤ 2 分钟

### Sprint C（1 周）—— UX 加固
- #6 URL 同步
- #8 键盘快捷键
- UX-P1-5 错误诊断
- UX-P1-6 风险预算快捷入口

**验收**：键盘可达所有 P0 操作（搜索 / 切 tab / 切 mode / 刷新）

### Sprint D（视后端进度）—— 高价值缺失项
- 缺失 3 一致预期（需要新数据源）
- 缺失 5 大股东动作

---

## 7. 反清单（不该做的）

写优化清单容易陷入"加更多"，列一些**不该做**的：

❌ **不要把决策性数据藏在 hover/tooltip 里**
- 当前 IndicatorRow.tooltip 字段预留但未渲染，看起来"高级"，但首屏一眼看不到的东西等于不存在
- 改进方向：tooltip 仅作"为什么这样判定"的补充说明，不放主要数值

❌ **不要让 Sparkline 变 full chart**
- Sparkline 的价值是"形状"而不是"精确数值"
- 想看精确就跳到 Tab 2 K 线

❌ **不要在 Tab 1 加更多 panel**
- Tab 1 已 4 个区块（Hero + Narrative + Matrix + Risk Budget），再加就破坏"30 秒看懂"
- 新需求优先考虑放进 Tab 2/3/4 或 Context Rail

❌ **不要为了"专业"加更多评分**
- 现有 5 因子已经够多了，再加"行业评分""估值评分""舆情评分"会让首屏沦为"评分扎堆"
- 优先把现有 5 因子讲清楚（阈值 + 历史百分位 + 趋势）

❌ **不要把 V1 删掉**
- 灰度未完结前 V1 是 V2 的退路
- 至少跑完 4 周 A/B 收集真实留存数据再考虑

❌ **不要做"多语言"**
- 当前用户 100% 中文背景，i18n 是无效复杂度
- 等出海再做

---

## 8. 整体感受

V2 的**底层架构是对的**：
- 三栏 + 4 tab 框架与现代专业终端（Bloomberg / TradingView Pro / Tradytics）对齐
- 数据流（mapper + AsyncState + null-safe）是工程团队能长期维护的形态
- 不塞假数据的纪律稀有且珍贵

需要改进的是**表层呈现**：
- 用色更克制（拆双语义）
- 数字更统一（格式规范）
- 时效更显眼（每 panel 都标）
- 评分更可解释（阈值 + 历史位）
- 多空更对仗（语义真镜像）

完成 Sprint A + B（2.5 周）后，V2 可以达到 **9/10** 的整体水准；如果再补 D 级一致预期和大股东动作，对标"国内顶级买方研究终端"无 gap。

---

## 9. 相关文档索引

| 文档 | 用途 |
|---|---|
| [design-brief](2026-05-23-symbol-workspace-v2-design-brief.md) | 设计简报 |
| [handoff-bridge](2026-05-23-symbol-workspace-v2-handoff-bridge.md) | 工程约束 |
| [optimization-plan](2026-05-23-symbol-workspace-v2-optimization-plan.md) | 5-6 周落地计划 |
| [prototype.html](2026-05-23-symbol-workspace-v2-prototype.html) | 高保真原型 |
| **本文档** | **可读性 + 投研体验审查** |
| 实际 V2 实现 | `TradingAgents/frontend/src/pages/symbol/**` |

完。
