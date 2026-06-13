# SuperTrend K 线叠加设计

## 目标

在个股工作台 K 线主图上增加 SuperTrend 指标，并显示趋势翻转的 Buy/Sell 标记。实现按 SuperTrend 公式独立编写，不复制 TradingView Pine Script 源码。

## 范围

- 默认开启 SuperTrend 主图叠加。
- 默认参数为 ATR 周期 10、倍数 3。
- 指标参数跟随现有 K 线参数面板保存到本地偏好。
- 主图工具栏增加 ST 开关。
- Lightweight Charts 主图显示绿色多头趋势线、红色空头趋势线。
- 趋势从空转多显示 Buy 标记，趋势从多转空显示 Sell 标记。

## 非目标

- 不接入自动交易或下单。
- 不复刻 TradingView 脚本 UI。
- 不改后端行情接口。
- 不重写旧 SVG 图层系统。

## 技术方案

在 `TradingSignalKline.helpers.ts` 新增 SuperTrend 计算函数，输入有效 OHLC 序列，输出上升线、下降线和翻转信号。ATR 使用 Wilder RMA 口径，第一段 ATR 用 TR 的简单均值初始化；之后按 `(prevAtr * (period - 1) + tr) / period` 平滑。

`TradingViewKlineChart.tsx` 使用 helper 输出的数据创建两条主图 LineSeries，并把翻转信号合并进 candle series markers。`MarketWidgets.tsx` 负责持久化开关和参数，把 `supertrend`、`superTrendAtrPeriod`、`superTrendMultiplier` 传入图表组件。

## 验证

- 在 helper 测试中覆盖趋势线生成、Buy/Sell 翻转信号和无效 OHLC 过滤。
- 运行 `npm run test`。
- 运行 `npm run build`。
