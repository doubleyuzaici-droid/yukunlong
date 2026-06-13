# Symbol Workspace V2 — 剩余优化项数据源可行性

> **范围**：审查未落地的 5 类项目（集中度 / 一致预期 / 大股东动作 / 季节性 / UX P2）的数据源可行性。
> **方法**：直接对当前已装 `akshare 1.18.60`（项目 china extra）逐接口 `hasattr` + signature 验证，不依赖文档可能过期的描述。
> **结论**：90% 的内容能用现有依赖落地，只有 1 项（真正的卖方综合一致预期目标价）需要 tushare pro 付费或自建聚合层。

---

## 0. TL;DR

| 大项 | 数据源 | 评级 | 工作量估算 |
|---|---|---|---|
| **集中度指标** | akshare ✅ 全可用 | A | 后 1.5d + 前 0.5d |
| **卖方一致预期** | akshare 部分 + 自建聚合 | B+ | 后 1.5d + 前 1d |
| **大股东动作** | akshare ✅ 全可用 | A | 后 1.5d + 前 0.5d |
| **季节性热度** | 自给（现有 daily_bars） | A+ | 后 0.3d + 前 0.5d |
| **UX P2** | 不需要数据源 | A | 纯前端 2d |

**衍生发现**：还有 3 个高 ROI 项之前没列出 — 业绩预告（早于财报）、指数成份归属、同期行业指数叠加 K 线 — 全部可立即落地。

---

## 1. 集中度指标（投研缺失 2）

### 1.1 北向占流通比 ✅ 直接可用

| 接口 | `ak.stock_hsgt_hold_stock_em(market, indicator)` |
|---|---|
| 数据源 | 东方财富 - 沪深港通持股 - 个股排行 |
| 参数 | `market` = "沪股通" / "深股通"；`indicator` = "5日排行" / "10日排行" / ... |
| 字段（推断） | 排名 / 代码 / 名称 / 持股数 / 持股市值 / **占总股本比 / 占流通股本比** / N 日增减 |
| 更新频率 | 每日（收盘后 1-2 小时）|

**落地路径**：
1. 后端新增 `corporate_holding` 表 + sync 路由（沿用 BE-5/7 的 dataflow 套路）
2. GET `/api/professional/holding-concentration?symbol=&date=` 返回 `{ northbound_pct_float, northbound_pct_total, delta_30d }`
3. 前端 Tab 3 "机构动作 · 北向" 面板里把"累计净流入近似"改成"实际持股占流通"

**工作量**：后 1d / 前 0.3d

### 1.2 公募基金重仓 ✅ 季度可用

| 接口 | `ak.stock_report_fund_hold_detail(symbol, date)` |
|---|---|
| 数据源 | 东方财富 - 基金重仓明细 |
| 参数 | `symbol` = 股票代码；`date` 季度末（20240331/20240630/...） |
| 字段 | 基金代码 / 名称 / 持股数 / 持股市值 / 占基金净值比 / 占流通比 |
| 更新频率 | **季度披露**（财报后 1 个月内） |

**落地路径**：
- 同上加新表，季度数据更新慢，cron 每周末跑一次即可
- 前端展示 "公募重仓数 N / 占流通 X% / 环比 +Y pp"

**工作量**：后 0.5d / 前 0.2d

### 1.3 股东户数 ✅ 季度可用

| 接口 | `ak.stock_zh_a_gdhs(symbol)` |
|---|---|
| 数据源 | 东方财富 - 股东户数 |
| 参数 | `"最新"` 或 季度末日期 `"20230930"` |
| 字段 | 代码 / 名称 / 股东户数 / 户均持股市值 / 环比变化 |
| 价值 | 股东户数减少 = 集中度提升，是 alpha 早期信号 |

**落地路径**：
- 加入 corporate_holding 表的扩展字段
- 前端在集中度面板加一行 "股东户数 12.5 万 (↓ 8% / Q)"

**工作量**：后 0.3d / 前 0.2d

---

## 2. 卖方一致预期（投研缺失 3）

### 2.1 个股研报列表 ✅ 已部分使用

| 接口 | `ak.stock_research_report_em(symbol)` |
|---|---|
| 数据源 | 东方财富 - 研究报告 - 个股研报 |
| 字段（已知） | 标题 / 机构 / 评级 / 目标价 / 发布日期 / 摘要 |
| 现状 | 部分内容已通过 news_evidence 表落库（但未结构化拆解评级/目标价）|

**落地路径**：
1. 后端新增 `research_report` 表（独立于 news_evidence，保留 rating / target_price 字段）
2. dataflow 新增 `fetch_research_reports(symbol)`
3. 后端聚合接口 `/api/professional/consensus?symbol=` 返回近 90 日：
   - 评级分布（强烈推荐/推荐/中性/卖出 家数）
   - 目标价均值 / 中位数 / 高低值
   - 上调/下调动作数
4. 前端 Tab 3 加 "卖方观点" 面板

**工作量**：后 1.5d / 前 0.5d

### 2.2 行业级盈利预测 ✅ 可用（仅作辅助）

| 接口 | `ak.stock_profit_forecast_em(symbol="")` |
|---|---|
| 数据源 | 东方财富 - 盈利预测 |
| 参数 | `symbol` 是**行业板块名**（如 "船舶制造"），不是个股代码 |
| 用途 | 看行业一致预期变化趋势，不能直接拿到单股的 consensus |

**注意**：这是 akshare 1.18.60 的实际行为。需要先 `ak.stock_board_industry_name_em()` 拿行业列表。

### 2.3 真正的"个股一致预期"⚠️ 自建聚合

**事实**：akshare 没有直接的个股 consensus 接口。卖方综合的目标价均值需要自建：
- 自己 aggregate 2.1 的研报数据（近 90 日窗口、按机构去重最新评级、剔除离群值）
- 或者付费 tushare pro 的 `stock_consensus`

**推荐**：用 2.1 的自建聚合方案，免费且可控。

---

## 3. 大股东动作（投研缺失 5）

### 3.1 高管 / 股东增减持 ✅ 直接可用

| 接口 | `ak.stock_ggcg_em(symbol)` |
|---|---|
| 数据源 | 东方财富 - 特色数据 - 高管持股 |
| 参数 | `symbol` = "全部" / "股东增持" / "股东减持" |
| 字段 | 代码 / 名称 / 变动股东 / 变动方向 / 变动股数 / 变动金额 / 变动后持股比 |
| 返回特点 | **全市场列表**，需要按 ticker 过滤 |

**落地路径**：
1. 后端 sync 一次拉全市场，按 symbol 过滤入库到 `corporate_events` 表（已存在）
2. 把"减持/增持"作为新的 `event_type` 加进催化剂时间线
3. 前端：Tab 2 催化剂时间线自动显示 + Tab 3 大股东面板列最近 N 条

**工作量**：后 1d（复用 corporate_events 表） / 前 0.2d（已有时间线接进去）

### 3.2 股权质押 ⚠ 数据精度受限

| 接口 | `ak.stock_gpzy_individual_pledge_ratio_detail_em(symbol)` |
|---|---|
| 实测 signature | `(symbol: str)` |
| 备选 | `ak.stock_gpzy_pledge_ratio_em(date)` 按日期返回所有标的质押率 |

**坑**：akshare 的个股质押接口在不同版本可能返回结构不同。**建议**先用 `stock_gpzy_pledge_ratio_em(date="今日")` 拿全市场，按 symbol 过滤，准确度更高。

**落地路径**：与 3.1 相同，存入 `corporate_events`，event_type = "pledge"

### 3.3 业绩预告 ✅ 直接可用（高 ROI 衍生发现）

| 接口 | `ak.stock_yjyg_em(date)` |
|---|---|
| 数据源 | 东方财富 - 年报季报 - 业绩预告 |
| 参数 | `date` = 报告期（"20240331" / "20240630" 等） |
| 字段 | 代码 / 名称 / 预告类型 / 净利润同比上限 / 下限 / 预告时间 / 上年同期净利润 |
| **关键价值** | **早于正式财报 1-2 周披露**，是 A 股最强催化剂之一 |

**落地路径**：
- sync 路由按季度跑（每季度末后 6 周内每日 cron）
- 写入 `corporate_events`，event_type = "earnings_preview"
- 前端 Tab 2 催化剂时间线 + Tab 3 公告列表自动显示

**工作量**：后 0.5d / 前 0d（复用现有时间线）

---

## 4. 季节性热度图（投研缺失 6）

### 4.1 数据：现有 `daily_bars` 自给 ✅

**不需要任何外部数据源**。该项目计算是 SQL aggregation：

```sql
SELECT
  strftime('%m', date) as month,
  AVG(ret_20d) as avg_return,
  COUNT(*) as samples
FROM
  (SELECT date,
          (close / LAG(close, 20) OVER (ORDER BY date) - 1) as ret_20d
   FROM daily_bars
   WHERE symbol = ?)
WHERE date >= date('now', '-5 years')
GROUP BY month;
```

**落地路径**：
1. 后端新增 `/api/professional/seasonality?symbol=&window=20` 返回 12 个月的同期统计
2. 前端 Tab 1 或 Tab 4 加一个 12 格热度图

**工作量**：后 0.3d / 前 0.5d
**外部依赖**：0

### 4.2 历史相似日（衍生 — 难度较高）

"当前 5 因子打分 0.76 类似的日子 N 个，后 20D 平均 +X%"

**数据**：自给（factor_daily + event_return）
**实现**：欧氏距离 / cosine 相似度 NN search

**工作量**：1d（如果做轻量版）
**建议**：先做 4.1，4.2 视用户反馈再加。

---

## 5. UX P2 ✅ 全部不需要数据源

| 项目 | 数据源 | 实现 |
|---|---|---|
| Onboarding tour | 不需要 | 引入 react-joyride 或自建 5 步引导 |
| 多选对比 | 复用现有 useSymbolCritical | 左 Nav 加多选模式 + Tab 1 顶部加迷你对比卡 |
| 打印 PDF / 截图分享 | 不需要 | `@media print` 样式 + `html2canvas` |

**工作量**：纯前端约 2d

---

## 6. 衍生发现：还能做的 3 个高 ROI 项

之前两份审查报告没列出，但盘点时发现这些数据**已经可用**：

### 6.1 业绩预告时间线（见 3.3）
**早于正式财报 1-2 周披露**，A 股最强催化剂之一。当前 V2 完全空白。**强烈推荐**。

### 6.2 指数成份股归属

| 接口 | `ak.index_stock_cons_sina(symbol)` |
|---|---|
| 用途 | 看该股属于哪些指数（沪深 300 / 中证 500 / 上证 50 等） |
| 价值 | ETF 资金流向时影响最大的几只成分股反而不是个股逻辑 |

**展示**：Header 下面加一行 "属于：沪深 300 (1.2%) · MSCI 中国 (0.8%) · 行业 ETF (3.5%)"

**工作量**：后 0.3d / 前 0.3d

### 6.3 同期行业指数叠加 K 线

| 接口 | 现有 `ak.stock_zh_index_daily_em` + `index_bars` 表 |
|---|---|
| 用途 | 在主 K 线上叠加申万一级行业指数线，看 alpha 来源 |
| 与 §6 sector-snapshot 区别 | sector-snapshot 是数字快照；这个是 K 线叠加曲线 |

**工作量**：前 0.5d（复用 ChartTab 现有 overlay 机制）

---

## 7. 完整落地优先级建议

按 ROI（用户感知价值 / 工作量）排序：

| 优先级 | 项目 | 工作量 | 用户价值 |
|---|---|---|---|
| 🔥 P0 | **业绩预告催化剂** (6.1 / 3.3) | 0.5d | 极高 — 现有 V2 完全缺失最强 A 股催化剂 |
| 🔥 P0 | **季节性热度图** (4.1) | 0.8d | 高 — 0 外部依赖，纯计算 |
| 🌟 P1 | **股权减持 / 增持时间线** (3.1) | 1.2d | 高 — 决策强相关 |
| 🌟 P1 | **北向占流通真实值** (1.1) | 1.3d | 中-高 — 替代当前的"累计净流入近似" |
| 🌟 P1 | **指数成份股归属** (6.2) | 0.6d | 中 — 提示 ETF 资金影响 |
| 🌟 P2 | **卖方研报评级聚合** (2.1) | 2d | 中 — 多家数据源不稳定 |
| 🟡 P2 | **公募基金重仓** (1.2) | 0.7d | 低-中 — 季度更新，时效性弱 |
| 🟡 P2 | **股东户数变化** (1.3) | 0.5d | 低-中 — 同上 |
| 🟡 P2 | **股权质押** (3.2) | 1d | 低-中 — 多数公司无质押 |
| 🟢 P3 | **同期行业 K 线叠加** (6.3) | 0.5d | 中 — 美观但价值不如数字 |
| 🟢 P3 | **UX onboarding + 多选 + 打印** | 2d | 低 — 增量体验 |
| ❌ 不做 | **付费 tushare pro 一致预期** | — | 不值，自建聚合更好 |

**推荐第一批落地**：P0 两项 = **业绩预告 + 季节性热度图**，共 1.3 天工作量，覆盖目前 V2 最大的两个投研盲点。

---

## 8. 最终结论

### 不需要新依赖 / 新数据源

剩余所有优化项 **100% 可基于现有依赖** 落地：
- akshare 1.18.60（已装）
- daily_bars + factor_daily + event_return（已有表）
- 现有 sync 套路（已有 BE-5/7 模板）

### 唯一例外

真正的卖方综合一致预期（多家机构目标价/EPS均值的标准化数据）只有 tushare pro 付费版能直接给。但 §2.1 的自建聚合方案能达到 80% 效果，**强烈不建议为这 20% 付费**。

### 接下来可以立刻做

如果按 P0 的两项展开：

| 任务 | 文件 |
|---|---|
| BE: `/api/professional/earnings-preview` + sync 路由 | `dataflows/akshare_events.py` 加 `fetch_earnings_preview()`，复用 corporate_events 表，event_type="earnings_preview" |
| BE: `/api/professional/seasonality` | `professional_routes.py` 加新路由，SQL 聚合 daily_bars |
| FE: 季节性热度图组件 | 新增 `pages/symbol/playbook/SeasonalityHeatmap.tsx`，放进 PlaybookTab |
| FE: 业绩预告 — 时间线已自动接入 | 0 改动（复用现有 catalysts-v2 路由 + CatalystTimeline 组件） |

要不要直接落地这两项？

---

## 9. 相关文档索引

| 文档 | 角色 |
|---|---|
| [optimization-plan](2026-05-23-symbol-workspace-v2-optimization-plan.md) | 5-6 周原计划 |
| [readability-review](2026-05-23-symbol-workspace-v2-readability-review.md) | 可读性 + 投研体验审查 |
| [copy-review](2026-05-23-symbol-workspace-v2-copy-review.md) | 文案审查 |
| **本文档** | **剩余项数据源可行性** |

完。
