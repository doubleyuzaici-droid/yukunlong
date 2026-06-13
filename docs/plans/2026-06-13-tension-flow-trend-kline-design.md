# Tension Flow Trend K 线主图接入设计

## 背景

用户希望把 TradingView 指标 `Tension Flow Trend [BigBeluga] - Historical RR` 接入个股工作台。当前个股工作台已使用 React、TypeScript、Vite 和 TradingView Lightweight Charts，并已经通过 `TradingSignalKline.helpers.ts`、`TradingViewKlineChart.tsx`、`MarketWidgets.tsx` 接入 SuperTrend 与 AlphaTrend。

源指标标注为 Creative Commons Attribution-NonCommercial-ShareAlike 4.0。实现不直接复制 Pine Script，而按指标行为重新实现，并在产品侧作为研究展示和模拟统计使用。

## 目标

在个股工作台 K 线主图加入可开关、可调参的 TFT 图层：

- HMA 趋势基准线。
- ATR 宽度趋势 ribbon。
- 多空 START 信号。
- Z-Score 张力状态。
- 最近 N 笔固定 RR 的历史胜负统计。

## 方案

采用前端纯计算方案，不新增后端接口。原因是所有输入都来自当前 K 线 OHLC 数据，指标是图表展示层逻辑，且当前 ST/AT 已采用同样架构。

数据流：

1. `MarketWidgets.tsx` 管理 TFT 开关和参数。
2. `TradingSignalKline.helpers.ts` 计算 HMA、Z-Score、ribbon、START 信号、RR 历史统计。
3. `TradingViewKlineChart.tsx` 渲染趋势线、上下 ribbon、START 标记和 hover 读数。
4. 工作台摘要区显示 TFT 张力与 RR 表现卡片。

## 参数

默认参数对齐原指标语义：

- `tensionFlowHmaLength`: 50
- `tensionFlowZScoreLength`: 50
- `tensionFlowRibbonWidth`: 0.5
- `tensionFlowSignalGap`: 30
- `tensionFlowAtrStopMultiplier`: 2
- `tensionFlowRiskReward`: 1
- `tensionFlowMaxTrades`: 100

## UI

主图工具栏新增 `TFT` 开关。参数面板新增 TFT 参数输入。趋势预设和全量预设启用 TFT，图层摘要显示 `TFT`。

图表使用克制的行情终端风格：

- HMA 线随趋势显示绿色或红色分段。
- ribbon 使用上下边界线和轻透明填充。
- START 标记进入现有 marker 系统，hover 展示信号价格。
- hover 读数补充 `TFT 多头/空头` 与 Z-Score。

## 测试

新增 helper 测试覆盖：

- 无效 OHLC 被忽略。
- HMA 和 ribbon 数据在足够样本后产生。
- START 信号遵守 signalGap。
- RR 统计生成 wins、losses、winRate。
- 偏好、参数预设、图层摘要包含 TFT。

## 风险

- Pine Script 在同一根 K 线同时触发 TP 和 SL 时会偏向先统计 TP；前端实现将保持同样的简化图表统计口径，并在卡片文案中称为“模拟”。
- HMA 与 ATR 在前几根 K 线样本不足时会返回空值，图表不会渲染这些点。
- 此功能只用于研究展示，不构成交易建议，也不替代完整 strategy 回测。
