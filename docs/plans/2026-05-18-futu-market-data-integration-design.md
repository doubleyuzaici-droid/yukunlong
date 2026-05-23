# 富途行情源接入设计

## 背景

当前工作台的历史行情主要来自本地 `daily_bars` 缓存，研究同步链路支持 `akshare`、`tushare` 和 `auto`；准实时行情由 `realtime_market.py` 通过腾讯公开源拉取，并在失败时回退本地日线。用户希望将行情获取接口切换到富途 OpenAPI。

富途 OpenAPI 不是普通 HTTP 报价接口。官方文档要求先运行 OpenD 网关，再由 SDK 连接 `OpenQuoteContext(host='127.0.0.1', port=11111)`。行情接口中可用于本项目的能力包括：

- `get_market_snapshot`：获取实时/准实时市场快照。
- `request_history_kline`：获取历史 K 线。
- `get_rt_data`：获取分时数据。

参考：

- https://openapi.futunn.com/futu-api-doc/quote/overview.html
- https://openapi.futunn.com/futu-api-doc/quote/base.html
- https://openapi.futunn.com/futu-api-doc/en/quote/request-history-kline.html

## 目标

- 增加完整 `source=futu` 行情源，覆盖历史日线同步和实时快照。
- 保留现有 `akshare`、`tushare`、`auto` 和本地缓存回退。
- OpenD 未启动、SDK 未安装、账号无行情权限或富途接口失败时，返回可解释错误并回退现有源。
- 在 API 和前端可信度文案中明确披露数据源为富途或本地回退。

## 非目标

- 不接入真实交易、账户、下单或持仓。
- 不接入 Level 2 摆盘、逐笔、经纪队列。
- 不把富途 SDK 作为默认必装依赖。
- 不改现有策略语义、信号算法或回测执行规则。

## 推荐架构

采用“富途可选主源 + 本地缓存兜底”。

新增 `tradingagents.dataflows.futu_market` 作为富途适配层，隔离 SDK 导入、OpenD 连接、代码格式转换和字段映射。研究同步层 `data_sync.py` 增加 `futu` 数据源：当用户指定 `source=futu` 或环境变量 `TRADINGAGENTS_DATA_SOURCE=futu` 时，使用富途 `request_history_kline` 拉取历史日线并写入 `daily_bars`。实时层 `realtime_market.py` 根据 `TRADINGAGENTS_QUOTE_PROVIDER=futu` 优先调用富途快照；失败后沿用本地日线回退。

## 配置

新增环境变量：

- `TRADINGAGENTS_QUOTE_PROVIDER=futu`：准实时行情优先使用富途。默认继续使用现有腾讯公开源。
- `TRADINGAGENTS_DATA_SOURCE=futu`：研究同步和历史日线同步使用富途。默认仍为 `akshare`。
- `TRADINGAGENTS_FUTU_HOST=127.0.0.1`：OpenD 主机。
- `TRADINGAGENTS_FUTU_PORT=11111`：OpenD 端口。
- `TRADINGAGENTS_FUTU_TIMEOUT=10`：SDK 请求超时兜底语义，适配器内部用于错误提示；SDK 本身不一定支持逐请求 timeout。

依赖采用可选组：

```toml
[project.optional-dependencies]
futu = ["futu-api>=9.4.0"]
```

这样普通安装不强制拉取富途 SDK，需要富途行情时安装：

```bash
uv pip install -e ".[futu]"
```

## 代码格式映射

内部代码保持项目现有规范：

- 港股：`01024.HK`
- A 股：`600519.SH`、`000001.SZ`
- 美股：`AAPL`

富途格式：

- 港股：`HK.01024`
- A 股：`SH.600519`、`SZ.000001`
- 美股：`US.AAPL`

适配器只在边界转换，不改变数据库、前端或策略里的内部代码。

## 数据映射

历史日线 `request_history_kline` 映射到 `daily_bars`：

- `time_key` -> `date`
- `code` -> 内部 `symbol`
- `open`、`high`、`low`、`close`
- `volume`
- `turnover` -> `amount`
- `source` 固定为 `futu_history_kline`

实时快照 `get_market_snapshot` 映射到现有 `RealtimeQuote` 形状：

- `last_price` -> `price`
- `prev_close_price` -> `prev_close`
- `open_price`、`high_price`、`low_price`
- `volume`
- `turnover` -> `amount`
- `update_time` -> `timestamp` / `trade_date` / `trade_time`
- `source` 固定为 `futu_snapshot`
- `provider` 固定为 `futu`
- `status` 为 `live`

## 错误处理

适配器将 SDK 不存在、OpenD 未连接、接口返回非 `RET_OK`、字段缺失等统一转换为 `FutuMarketDataError`。上层保持已有行为：

- 历史同步：记录质量问题并继续处理其他标的。
- 实时行情：若允许 fallback，则回退本地日线；否则返回不可用。
- API 响应不暴露账号、路径、认证细节，只展示可操作原因，例如“富途 OpenD 未连接或无行情权限”。

## 测试策略

使用 monkeypatch 构造假的富途 SDK 和 DataFrame，不依赖真实 OpenD 或网络：

- 代码格式转换测试。
- 历史 K 线字段映射测试。
- 数据源解析支持 `futu` 测试。
- 实时快照走富途 provider 测试。
- 富途失败后回退本地日线测试。
- API `/api/research/sources` 展示 `futu` 可选源测试。

## 验收标准

- `fetch_daily_bars(..., source="futu")` 返回 `source=futu_history_kline` 的日线 DataFrame。
- `sync_watchlist_bars(..., source="futu")` 能写入 `daily_bars`。
- `TRADINGAGENTS_QUOTE_PROVIDER=futu` 时 `/api/market/realtime/quotes` 返回 `provider=futu`。
- 富途不可用时，实时行情仍可回退本地日线。
- `npm test`、`npm run build` 和相关 Python 测试通过。
