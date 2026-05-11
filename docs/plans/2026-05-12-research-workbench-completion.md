# 投研工作台实施计划完成记录

## 本轮补齐项

- 新增 `compute-factors` CLI，支持把 watchlist 日线指标计算并写入 `factor_daily`。
- 新增 `factor_pipeline.py`，沉淀可复用的指标落库入口。
- 组合回测补齐 A 股涨跌停约束、港股低流动性过滤、最大回撤、胜率和盈亏比。
- Agent 审查补齐 keep/reject 等 action 的后验表现统计，并提供 API。
- 策略调优补齐失败归因、消融检查和样本外 walk-forward 切分。
- 前端信号审查 action 按“升级/保留/降级/拒绝”展示。

## 验收说明

- 新增测试全部使用本地 fixture 或临时 SQLite，不依赖外部网络。
- 规则信号、回测、Agent 审查和调优链路均保持 research/simulation 范围。
- 禁止文案仅保留在 prompt 约束和测试断言中，新增用户可见输出不包含交易导向表述。
