# SuperTrend Enhanced Filter Design

## Goal

Add an optional SuperTrend enhanced backtest comparison to the individual stock workbench. The feature should help users see whether stricter entry confirmation improves hit rate without changing the original SuperTrend line on the chart.

## Design

The enhanced filter uses the existing SuperTrend buy/sell signals as the base signal engine. A buy signal starts a pending long candidate. While SuperTrend remains bullish, the candidate is accepted only after a later bar satisfies all of these conditions:

- Close is above MA120.
- MA120 is not lower than it was 20 bars earlier.
- Close breaks above the previous 20-bar high.

Sell signals remain unchanged: an accepted long position exits on the next SuperTrend sell signal, using the same next-open execution convention as the existing SuperTrend backtest. If a sell signal arrives before confirmation, the pending buy candidate is cancelled.

## UI

Add a `ST增强` toggle beside the existing `ST` chart layer toggle. Turning on `ST增强` also turns on `ST`, because the enhanced statistics depend on the SuperTrend layer context.

When enabled, the existing `ST回测` block shows an additional `增强ST` card with:

- Cumulative return.
- Win rate.
- Trade count.
- Tooltip with filter rule, drawdown, and buy-hold comparison.

The card is a comparison statistic only. It does not replace charted SuperTrend lines or original buy/sell markers.

## Testing

Add helper tests for `buildSuperTrendBacktestSummary(..., { entryFilter: "trendBreakout" })` to prove the filter rejects an early weak buy and keeps a later confirmed breakout. Run frontend tests and production build.
