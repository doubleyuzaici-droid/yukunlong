# Symbol Workspace V2 — 优化执行计划（数据源可行性版）

> **目的**：把 design brief / handoff / bridge / prototype 收敛成一份按"数据可行性"排序的、可派 ticket 的优化计划。
> **配套文档**：[design-brief](2026-05-23-symbol-workspace-v2-design-brief.md) · [handoff-bridge](2026-05-23-symbol-workspace-v2-handoff-bridge.md) · [prototype.html](2026-05-23-symbol-workspace-v2-prototype.html)
> **核心原则**：先做能做的，明确等谁的，标注假数据风险。**绝不让前端塞 0 假装有数据**。

---

## 0. TL;DR

- 整个落地 **5 个 Phase / 4–5 个 Sprint / 约 6 周**完成（不含浅色主题与 a11y 加固）
- 新增 npm 依赖**只有 1 个**（`lightweight-charts`）
- 新增后端路由 **4 个**（view-only 聚合，零外部数据源依赖）
- 真正需要外部数据接入的只有 **2 项**（公司事件 + 龙虎榜机构席位），都可降级或推迟
- 关键路径：**Phase 1（4 个 PR）今天就能开工**，与后端工作完全解耦

---

## 1. 数据源现状盘点（V2 → 真实来源）

下表逐字段映射到现有 DB 表/API 路由，标注**今天能用 / 改一下能用 / 需后端新增 / 需外部数据源**四个等级。

### 1.1 Tab 1：现状速览

| V2 组件 | 字段 | 现状 | 来源 | 等级 |
|---|---|---|---|---|
| Hero Decision | title / tone / reason | ✅ 已用 | `ResonanceV2Analysis.decision` + `buildReadableSymbolStrategyCopy()` | A |
| Hero Decision | 5 因子评分 | ✅ 已用 | `ResonanceV2Analysis.buy_signal.factors`（trend/momentum/oversold/volume/market） | A |
| Hero Decision | 完整度 | ✅ 已用 | `AnalysisReadinessPayload.score` | A |
| Bull / Falsify | bull 条目 | ⚙️ 已用但需重构 | `analysis.market_filter.drivers` + `analysis.checklist.passed=true` | A |
| Bull / Falsify | falsify 条目（含已发生标记） | ⚙️ 后端字段未区分 | `data_quality.blocking_reasons`（=已发生）+ `warnings`（=未发生） | A |
| Indicator Matrix · 短线 | RSI14 / KDJ / 量比 / MACD | ✅ 已用 | `factor_daily.rsi14` / `volume_ratio20` + `deriveOverviewIndicators` 已算 MACD/KDJ | A |
| Indicator Matrix · 中线 | EMA21/89 / 行业 RS / 北向 5D / 相对沪深 | ✅ 已用 | `factor_daily.ma20/60` + `rel_strength_industry20` + `northbound_inflow_5d` + `rel_strength_index20` | A |
| Indicator Matrix · 长线 | ROE TTM / PE 行业百分位 / 自由现金流趋势 | ⚠️ ROE 标量有、百分位+现金流缺 | `fundamental_snapshot.roe` 有；百分位需新算；FCF 完全缺 | B / C |
| Risk Budget | entry / atr14 | ✅ 已用 | `factor_daily.atr14` + `history.quote.price` | A |
| Risk Budget | support_price | ⚠️ 缺 | 可由近 60D 低点近似 | A（前端） |
| Sparkline (每行) | 20-point 时间序列 | ✅ 已用 | `MarketContextPayload.factor_series[]` | A |

### 1.2 Tab 2：图表与信号

| V2 组件 | 字段 | 现状 | 来源 | 等级 |
|---|---|---|---|---|
| K 线 | Candle[]（90 根） | ✅ 已用 | `MarketHistoryPayload.bars` | A |
| K 线 overlay | EMA21/89 | ⚙️ 前端计算 | `bars.close` + EMA 函数（helpers 已有 `emaSeries`） | A |
| K 线 overlay | MA20/60/120 / BOLL / VWAP | ✅ MA 已用、BOLL 已算 | factor_daily / helpers | A |
| Signal markers | i / kind / label / score | ✅ 已用 | `SignalHistoryRow` 转换 | A |
| 副图 | 成交量 | ✅ 已用 | `bars.volume` | A |
| 副图 | 资金流 / 北向 / MACD / KDJ / RSI / OBV | ✅ 已用 | factor_series + helpers 已算 | A |
| **催化剂时间线（过去）** | earnings / research / lhb / policy | ⚙️ news_evidence 已有但需分类 | `news_evidence` 表 + 新分类逻辑 | **B** |
| **催化剂时间线（未来）** | 业绩预披露 / 解禁 / 分红 / 行业会议 | ❌ 完全缺 | 需外部数据源（Tushare/AKShare） | **D** |

### 1.3 Tab 3：基本面 & 催化剂

| V2 组件 | 字段 | 现状 | 来源 | 等级 |
|---|---|---|---|---|
| Valuation Percentile | PE TTM 标量 / PB 标量 | ✅ 已用 | `fundamental_snapshot.pe_ttm / pb` | A |
| Valuation Percentile | **industry_pct / history_pct** | ❌ 缺百分位 | 数据已在表里，**需新算法路由** | **B** |
| Valuation Percentile | PS / EV-EBITDA | ❌ 标量都缺 | 需扩展 fundamental_snapshot 字段 | **C** |
| Financial Series · revenue/net_profit/roe | 标量 latest | ✅ 已用 | fundamental_snapshot 有 latest | A |
| Financial Series · **8 季度** | quarters[8] + 序列 | ⚙️ 数据已在 financial_statement，只查 latest | **需扩展 /fundamentals 加 quarters 参数** | **B** |
| Disclosures | date / tag / tone / title / url | ✅ 已用 | `news_evidence` 表 + 标签分类 | A |
| Northbound 30D series | 持股市值时间序列 | ⚠️ 只有 net_inflow，可累加近似 | `fund_flow_daily.northbound_net_inflow` 累加 | **B** |
| Institutional Desks | 龙虎榜机构席位明细 | ❌ 完全缺 | 需外部数据源 | **D** |

### 1.4 Tab 4：决策与复盘

| V2 组件 | 字段 | 现状 | 来源 | 等级 |
|---|---|---|---|---|
| Signal Detail · evidence / risks / invalidate | string[] | ✅ 已用 | `signal_log.evidence_json / risk_json / invalid_json` | A |
| Agent Review | verdict / summary / trace_url | ✅ 已用 | `agent_decision_log` + `/api/professional/signal-explain` | A |
| Backtest Summary · win_rate / avg_5d / avg_20d / avg_60d / max_adverse | 已聚合 | ⚙️ 数据有，需聚合查询 | `event_return` 表 group by symbol | **B** |
| Backtest Curve | 累积收益时间序列 | ⚙️ 已有 equity_curve（按 strategy_version），需按 symbol 维度 | `equity_curve` | **B** |
| Analyst Notes | id / body / timestamp / tags / pinned | ❌ 后端无 | 前端 localStorage（S1）→ 后期表 | A（前端） |

### 1.5 Chrome & Rails

| V2 组件 | 字段 | 现状 | 来源 | 等级 |
|---|---|---|---|---|
| Header · symbol / price / change_pct / freshness | 全字段 | ✅ 已用 | `MarketHistoryPayload.quote` + `RealtimeQuotePayload` | A |
| Profile Strip · industry / market_cap / PE / PB / dividend / 状态旗标 | 全字段 | ⚙️ 部分有 | security_master + fundamental_snapshot + trading_rules | **B**（拼装） |
| Status Banner · kind / message / affected | 全字段 | ✅ 已用 | `AnalysisReadinessPayload.level` 映射 | A |
| Nav Rail · watchlist / opportunities / risks / recent | 4 组列表 | ✅ 已用 | `/api/research/watchlist` + 信号扫描 + localStorage | A |
| Context Rail · narrative / risk_flags / notes | 全字段 | ✅ 已用 | 同 Tab 1 + localStorage | A |

### 1.6 等级图例

- **A** = 今天就能用，前端 mapper 即可
- **B** = 后端写 view-only 路由/扩展现有路由（数据已在 DB）
- **C** = 后端需要数据接入（akshare/Tushare/yfinance），单接口可解
- **D** = 后端需要新数据源（同花顺/Wind 等），有可能拿不到

---

## 2. 关键洞察

### 2.1 等级分布

```
A (今天可做) ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 22 项 / 65%
B (后端聚合)  ▓▓▓▓▓▓▓▓ 8 项 / 23%
C (单接口数据) ▓▓ 2 项 / 6%
D (外部源新接) ▓▓ 2 项 / 6%
```

**结论**：65% 的 V2 落地工作量是前端 mapper + 组件，与后端解耦。

### 2.2 后端关键路径

只有 4 个新路由 / 扩展（全部 view-only，零新数据源依赖）：

1. **扩展** `GET /api/professional/fundamentals` 加 `?quarters=8`（财务序列）
2. **新增** `GET /api/professional/valuation-percentile?symbol=&date=`（PE/PB 行业 + 历史百分位）
3. **新增** `GET /api/professional/catalysts?symbol=&past_days=60&future_days=30`（聚合 news_evidence + 财报日历）
4. **新增** `GET /api/professional/backtest-summary?symbol=&strategy=` (该标的同类信号 N 次后验聚合)

### 2.3 真正阻塞项（D 级）只有 2 个，且可降级

- **公司事件未来时间线**（解禁、分红、股东大会、行业会议）—— **降级方案**：仅显示 past catalysts，future timeline 显示 empty state "未来事件接入中"
- **龙虎榜机构席位明细** —— **降级方案**：右下面板显示北向 30D 曲线 + empty "机构席位待接入"

---

## 3. 落地阶段

| Phase | 名称 | 工期 | 依赖 | 可独立上线 |
|---|---|---|---|---|
| **Phase 0** | 基础设施搬迁 | 0.5 周 | — | ✅ |
| **Phase 1** | 全 A 级组件（前端独立） | 1.5 周 | Phase 0 | ✅ |
| **Phase 2** | B 级后端聚合 + 前端接入 | 1.5 周 | Phase 0 | ✅ |
| **Phase 3** | C/D 级数据接入 + 完整时间线 | 1.5 周 | Phase 2 | ✅ |
| **Phase 4** | 浅色主题 / 响应式 / a11y | 1 周 | Phase 3 | ✅ |
| **Phase 5** | 灰度切换 + V1 下线 | 0.5 周 | Phase 4 | ✅ |

每个 Phase 独立可上线 —— 出问题可单独回滚。

### Phase 0 · 基础设施搬迁（0.5 周 / 3 PR）

复用 [bridge §9](2026-05-23-symbol-workspace-v2-handoff-bridge.md) 的 3 个 PR：
- PR-0: handoff/types 文件搬入 `TradingAgents/frontend/src/types/symbol-workspace.ts` + null-safety relax
- PR-1: tokens.css + `_shared/{Mono,Pill,Dot,Sparkline,Segmented,AsyncBoundary}.tsx` + `useAsync.ts` + `risk-budget.ts` 纯函数 + 单测
- PR-2: 6 个 API mapper（按 bridge §5 表，**仅 A 级字段**，B 级字段返回 null + missing）

**验收**：tsc 通过；mapper 单测全绿；scripts/lint-symbol-tokens.sh 命中 0；现有 SymbolWorkspacePage.tsx 一行不动。

### Phase 1 · A 级组件（1.5 周 / 5 PR）

**只渲染数据 A 级的部分**，B/C/D 级字段统一走 empty state 占位（带"接入中"提示）。

| PR | 范围 | 涉及组件 | 数据等级 |
|---|---|---|---|
| PR-3 | Shell + Header + Profile + Nav + Right Rail | header / profile-strip / nav-rail / context-rail | A |
| PR-4 | Tab 1 完整版（占长线列 empty） | Hero / Bull-Falsify / Indicator Matrix · 短/中线 / Risk Budget | A |
| PR-5 | Tab 2 K 线 + signals + 副图 | KLineChart / SubChart / ChartToolbar | A |
| PR-6 | Tab 4 信号详情 + Agent + Notes (localStorage) | SignalDetail / AgentReview / NotesTimeline | A |
| PR-7 | 集成测试 + V1/V2 切换开关 | URL `?ws=v2` 启用 V2 | — |

> 引入 `lightweight-charts ^4.2`（PR-5 时唯一新增 npm 依赖）。
> 催化剂时间线 PR-5 留位置但只渲染 past（来自 news_evidence），future 显示占位。

**Phase 1 完成时即可灰度发布**：现状速览 + K 线信号 + 决策复盘三个核心 tab 全部可用，基本面 tab 只展示估值标量 + 公告列表（无百分位、无 8 季度图）。

### Phase 2 · B 级后端聚合（1.5 周 / 4 PR）

后端先做，前端再升级。两侧可并行。

#### 后端 ticket（4 个，可并行）

| ID | 路由 | 工作量 | 数据来源 | 阻塞 |
|---|---|---|---|---|
| BE-1 | 扩展 `GET /api/professional/fundamentals` 加 `?quarters=8` | S | financial_statement 表，多查 8 行+JSON 解析 | 无 |
| BE-2 | 新增 `GET /api/professional/valuation-percentile` | M | fundamental_snapshot 跨 symbol 聚合 + 历史序列 | 无 |
| BE-3 | 新增 `GET /api/professional/catalysts` | M | news_evidence + 自定义分类规则 | 无 |
| BE-4 | 新增 `GET /api/professional/backtest-summary` | M | event_return 表 group by + equity_curve | 无 |

#### 前端 ticket

| PR | 范围 | 升级点 |
|---|---|---|
| PR-8 | Tab 3 估值百分位双轴 bar | 接 BE-2 |
| PR-9 | Tab 3 8 季度财务图（营收/净利润/ROE） | 接 BE-1 |
| PR-10 | Tab 2 催化剂时间线（past 部分填实） | 接 BE-3 |
| PR-11 | Tab 4 同类信号后验图 + 统计表 | 接 BE-4 |

**Phase 2 完成 = 基本面 tab 80% 可用 + 催化剂时间线一半可用 + 后验复盘完整**。

### Phase 3 · C/D 级外部数据（1.5 周）

#### 后端 ticket

| ID | 工作 | 工作量 | 数据源 | 降级方案 |
|---|---|---|---|---|
| BE-5 | 接入公司事件 API（解禁/分红/股东大会） | M-L | Tushare（已有依赖检查）或 AKShare | 无外部数据则 future timeline 留 empty |
| BE-6 | 接入 PS / EV-EBITDA 字段 | M | yfinance 或 Tushare 扩展 fundamental_snapshot | 仅展示 PE/PB |
| BE-7 | 接入龙虎榜机构席位明细 | L | AKShare `stock_lhb_detail_em` | 表内空态 |

#### 前端 ticket

| PR | 范围 |
|---|---|
| PR-12 | Tab 2 催化剂时间线 future 部分 |
| PR-13 | Tab 3 估值条扩展到 4 项（PE/PB/PS/EV-EBITDA） |
| PR-14 | Tab 3 机构席位详情面板 |

**Phase 3 完成 = V2 全功能上线**。

### Phase 4 · 体验加固（1 周）

| PR | 范围 |
|---|---|
| PR-15 | 浅色主题（CSS Variables 切换 + 用户偏好 localStorage） |
| PR-16 | 响应式（≤1024px 折叠右栏 / ≤768px 单栏） |
| PR-17 | a11y 加固（焦点环、对比度 4.5:1、键盘导航 trap、aria-* 完善） |
| PR-18 | 性能（K 线虚拟化 / 切 tab 预取 / 切换 symbol 骨架时延 < 200ms） |

### Phase 5 · 灰度与下线（0.5 周）

| PR | 范围 |
|---|---|
| PR-19 | A/B 切换：50% 用户走 V2、50% V1，两周后看留存与时长 |
| PR-20 | V1 下线：删除 SymbolWorkspacePage.tsx + helpers，仅保留 V2 |

---

## 4. 后端 Ticket 清单（汇总）

按优先级排序，**每个 ticket 都不阻塞 Phase 1**：

| 优先级 | ID | 路由 / 工作 | 阻塞的前端 PR | 复杂度 |
|---|---|---|---|---|
| P0 | BE-1 | 扩展 `/fundamentals?quarters=8` | PR-9 | S |
| P0 | BE-3 | 新增 `/catalysts`（past 部分） | PR-10 | M |
| P0 | BE-4 | 新增 `/backtest-summary` | PR-11 | M |
| P1 | BE-2 | 新增 `/valuation-percentile` | PR-8 | M |
| P1 | BE-5 | 公司事件外部源接入 | PR-12 | M-L |
| P2 | BE-6 | PS/EV-EBITDA 接入 | PR-13 | M |
| P2 | BE-7 | 龙虎榜机构席位接入 | PR-14 | L |

### Ticket 模板：BE-3 catalysts（示例）

```yaml
# BE-3 · GET /api/professional/catalysts
Path: /api/professional/catalysts
Query:
  symbol: str (required)
  date: str (default today)
  past_days: int (default 60)
  future_days: int (default 30)
Returns:
  past: Catalyst[]   # 来自 news_evidence + 财报日历推断
  future: Catalyst[] # 留空，Phase 3 接入
  future_window_days: int

数据来源:
  - news_evidence WHERE symbol=? AND date BETWEEN ? AND ?
  - 通过 headline 关键字 + sentiment 推断 catalyst type:
      "财报"|"业绩" → earnings
      "评级"|"研报" → research
      "龙虎榜" → lhb
      "解禁" → unlock
      "分红"|"派息" → dividend
      其它 → industry / disclosure

Catalyst 字段映射:
  date         = news_evidence.date
  type         = 上述分类逻辑
  title        = news_evidence.headline
  tone         = sentiment → success/danger/neutral
  occurred     = true (past) / false (future)
  source_url   = news_evidence.url
  note         = news_evidence.summary

验收:
  - 600519.SH 近 60 天能拿到 ≥5 条 catalysts
  - 分类正确率 sample 抽 20 条 ≥18 条
  - 接口 P95 < 200ms
```

---

## 5. 风险与回滚

### 5.1 数据风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| `fundamental_snapshot` 在某些标的数据为空 | 高 | 估值/财务 tab 空态 | mapper 返回 null + UI partial 态明确提示"未落库" |
| `news_evidence` 分类规则误判 | 中 | 催化剂类型错 | 第一轮只用 6 种粗分类，加 source_url 让用户点过去自查 |
| `event_return` 该标的样本不足（<5 条） | 中 | 后验图过稀疏 | 后端在 backtest-summary 返回 `sample_quality` 字段，< 5 显示 "样本不足，仅供参考" |
| 北向流入累加 ≠ 实际持股市值 | 高 | 曲线偏离真实持股 | 图标题改为"北向累计净流入"，不写"持股市值"；待外部源接入再换 |
| ATR14 缺失 | 低 | 风险预算计算无法用 ATR 法 | 自动降级到固定百分比 7% + 顶部提示 |

### 5.2 工程风险

| 风险 | 缓解 |
|---|---|
| K 线 `lightweight-charts` 引入失败 / 与现有 SVG 实现冲突 | 保留 V1 的 `TradingSignalKlinePanel` 作为 fallback；feature flag 控制 |
| Phase 2 后端 ticket 慢于前端 | Phase 1 已能独立上线，前端可继续 Phase 4 体验工作不阻塞 |
| 旧 V1 用户切换不适应 | Phase 5 灰度 + 双向切换按钮保留 4 周 |
| localStorage 笔记跨设备不同步 | 接受。Phase 6+ 考虑后端 notes 表（不在本计划内） |

### 5.3 回滚

每个 PR 独立 feature flag：
- `?ws=v1` 强制 V1
- `?ws=v2` 强制 V2
- 默认走 A/B（Phase 5 之后）

Phase 0-4 任何 PR 出问题，feature flag 一关回到 V1。

---

## 6. 验收清单

### 6.1 Phase 0 验收
- [ ] `tsc --noEmit` 通过
- [ ] `scripts/lint-symbol-tokens.sh` 在 `pages/symbol/` 域内 hex 命中数 = 0（tokens.css 除外）
- [ ] 6 个 mapper 单测全绿（完整 / 部分 null / 完全缺失 三 case 各 1）
- [ ] `risk-budget.ts` 单测：ATR/支撑/固定三种止损算法各 1 case + 边界（capital=0、stop>entry）

### 6.2 Phase 1 验收（"V2 alpha 可用"）
- [ ] `?ws=v2` 进入工作台，首屏出骨架 < 200ms、关键数据 < 1s
- [ ] 切换 symbol 时无 race（连续点 3 只 ≤ 2s，最终展示的是最后点的那只）
- [ ] Tab 1 / 2 / 4 三个 tab 都有真实数据；Tab 3 显示 partial 态 + "估值百分位接入中"占位
- [ ] 笔记 ⌘+S 落地 localStorage，刷新仍在
- [ ] 风险预算 4 输出与原型计算一致（手算 600519.SH 验证 1 case）
- [ ] 评估问卷：3 个 PM + 2 个研究员试用 30 分钟，主观打分 ≥ 4/5

### 6.3 Phase 2 验收
- [ ] Tab 3 基本面 4 个面板全部有数据
- [ ] 后验图至少 5 个样本，胜率与历史人工统计一致
- [ ] 催化剂时间线 past 部分 ≥ 5 条事件、分类正确率 ≥ 90%

### 6.4 Phase 3 验收
- [ ] 催化剂 future 部分能看到至少 2 个未来事件（解禁/分红/财报预披）
- [ ] PS / EV-EBITDA 显示
- [ ] 龙虎榜机构席位面板有数据

### 6.5 Phase 4 验收
- [ ] Lighthouse a11y ≥ 95
- [ ] axe-core 跑过，对比度 ≥ 4.5:1
- [ ] 1024px / 768px / 375px 三个断点不破板
- [ ] 浅色主题切换无闪烁

---

## 7. 假数据红线（红线必读）

V2 永远不会出现以下行为：

❌ 用 0 假装有数据（如 PE=0 / 涨跌=0%）
❌ 用近似值不标注（如北向"持股市值"实际是累计净流入）
❌ 用过期数据不提示（factor_daily 距今 > 3 天必须显示 stale 徽章）
❌ 用随机生成的 mock 顶替真实接口（即使是 demo）
❌ "全屏 loading 旋转" —— 必须骨架屏 + 区块级 4 态

✅ 一律返回 `null` + UI 走 partial 态 + 标注下一步动作

---

## 8. 时间线甘特图

```
Week 1    Week 2     Week 3     Week 4     Week 5     Week 6
┌──────────────────────────────────────────────────────────────┐
│P0│▓▓│                                                          │ Phase 0 基础设施
├──┼──┴──────┴───────────────────────────────────────────────────┤
│  │P1▓▓▓▓▓▓▓▓▓│                                                 │ Phase 1 A 级前端
├──┼──────────┼────────────────────────────────────────────────┤
│  │BE 并行▓▓▓▓▓▓▓▓│                                              │ 后端 BE-1..4 并行
├──┼──────────┴──────┬──────────────────────────────────────────┤
│  │                 │P2▓▓▓▓▓▓▓▓▓│                                │ Phase 2 B 级接入
├──┼─────────────────┴───────────┼──────────────────────────────┤
│  │                             │P3▓▓▓▓▓▓▓▓▓│                    │ Phase 3 外部数据
├──┼─────────────────────────────┴─────────────┼────────────────┤
│  │                                           │P4▓▓▓▓▓▓│        │ Phase 4 体验加固
├──┼───────────────────────────────────────────┴──────┬─────────┤
│  │                                                   │P5▓▓▓│   │ Phase 5 灰度下线
└──────────────────────────────────────────────────────────────┘
```

---

## 9. 给后端的 README

放在每个后端 ticket 的描述顶部：

```
Symbol Workspace V2 后端工作总览：见
docs/plans/2026-05-23-symbol-workspace-v2-optimization-plan.md §4

本 ticket 是 V2 的 N 个后端 ticket 之一，特点：
- view-only 聚合，不引入新数据源（BE-5/6/7 例外）
- 路由命名规范：/api/professional/* 与现有保持一致
- ApiResponse 包裹（success/data/error），保持现有约定
- 字段 null-safe，禁止默认 0
- 必带 sample_quality / data_quality 字段说明可信度
- 单测：现有标的 600519.SH / 000001.SZ / 沪深 300 三个 case 必过

落地后请通知前端在 PR-X 中接入，并在合并前对接联调一遍。
```

---

## 10. 相关文档索引

| 文档 | 角色 | 路径 |
|---|---|---|
| 设计简报 | 视觉与产品规范 | [2026-05-23-symbol-workspace-v2-design-brief.md](2026-05-23-symbol-workspace-v2-design-brief.md) |
| Handoff Bridge | 工程落地约束 | [2026-05-23-symbol-workspace-v2-handoff-bridge.md](2026-05-23-symbol-workspace-v2-handoff-bridge.md) |
| 高保真原型 | 设计对照物 | [2026-05-23-symbol-workspace-v2-prototype.html](2026-05-23-symbol-workspace-v2-prototype.html) |
| **本计划** | 执行总览 | 本文 |
| 原始 handoff | Codex 落地手册（理想） | `~/Downloads/handoff/HANDOFF.md`（Phase 0 PR-0 搬入仓库） |
| 数据契约 | V2 类型定义 | `~/Downloads/handoff/symbol-workspace.types.ts`（Phase 0 PR-0 搬入仓库） |
| 现有 V1 代码 | 被替换目标 | `TradingAgents/frontend/src/pages/SymbolWorkspacePage.tsx` |
| 现有 API 路由 | 数据来源真相源 | `TradingAgents/tradingagents/api/professional_routes.py` |
| 现有数据库表 | 字段最终来源 | `TradingAgents/tradingagents/research/db.py` |

完。
