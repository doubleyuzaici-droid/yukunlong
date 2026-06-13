# AlphaTrend K 线主图接入设计

## 背景

用户希望把 TradingView Pine Script 指标 AlphaTrend 加入个股工作台的 K 线图。当前个股工作台 `图表信号` 页签复用 `TradingSignalKlinePanel`，并且工作区已有 TradingView Lightweight Charts 迁移中的新组件 `TradingViewKlineChart`。AlphaTrend 是主图趋势指标，依赖 OHLCV、ATR、MFI/RSI，可用现有前端 K 线数据本地计算。

## 目标

- 在个股工作台 K 线主图新增 AlphaTrend 主图叠加层。
- 尽量贴近原 Pine Script：显示 AlphaTrend 当前线、2 根 K 前延迟线、趋势填充、BUY/SELL 信号。
- 支持参数：周期默认 14、倍数默认 1。
- 有有效成交量时使用 MFI 判断趋势；成交量缺失时自动回退 RSI。
- 不新增后端接口，不新增依赖，不改变现有策略信号语义。

## 交互设计

- 高级主图工具区增加 `AlphaTrend` 开关。
- 参数面板增加 `AT周期` 和 `AT倍数`。
- 默认关闭，避免主图信息过载；`全量` 指标预设打开。
- BUY/SELL 信号使用主图 marker，和现有信号点共存。
- AlphaTrend hover 读数可先通过线条标题和现有 K 线读数间接确认，后续再扩展专门读数。

## 技术方案

采用前端 helper + Lightweight Charts 渲染的方式：

- 在 `TradingSignalKline.helpers.ts` 中新增纯函数计算 AlphaTrend 序列。
- 计算逻辑复刻 Pine Script：
  - `ATR = SMA(TR, period)`。
  - `upT = low - ATR * multiplier`。
  - `downT = high + ATR * multiplier`。
  - 有成交量时使用 MFI 大于等于 50，否则使用 RSI 大于等于 50。
  - 按递推规则生成 AlphaTrend。
  - 当前线与 `AlphaTrend[2]` 交叉生成 BUY/SELL。
- 在 `TradingViewKlineChart.tsx` 中新增两条 line series 和趋势区间填充。
- 在 `MarketWidgets.tsx` 接入开关和参数，传递给 `TradingViewKlineChart`。

## 非目标

- 不把 AlphaTrend 纳入后端策略评分。
- 不新增告警系统。
- 不改已有 MA、BOLL、策略价位线和旧 SVG 逻辑。
- 不处理 TradingView Pine Script 的授权展示，仅实现等价计算逻辑。

## 验收标准

- Helper 单测覆盖 AlphaTrend 序列、无量回退 RSI、BUY/SELL 交叉信号。
- `AlphaTrend` 开关可控制主图叠加层。
- 参数面板能调整周期和倍数。
- `npm run test` 通过。
- `npm run build` 通过。
