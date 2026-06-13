import { useEffect, useMemo, useRef, useState } from "react";
import {
  BaselineSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type BaselineData,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { MarketHistoryBar } from "../types/market";
import {
  buildLightweightTrendHoverReadouts,
  buildLightweightAlphaTrendSeries,
  buildLightweightPriceLines,
  buildLightweightChartSeries,
  buildLightweightMaPeriodKey,
  buildLightweightSuperTrendSeries,
  buildLightweightTensionFlowTrendSeries,
  buildLightweightVisibleLogicalRange,
  buildTradingViewTradeMarkerReadout,
  tradingViewTradeMarkerColor,
  toLightweightChartTime,
  type LightweightChartBarLike,
  type LightweightChartLinePoint,
  type LightweightChartTime,
  type LightweightAlphaTrendSignal,
  type LightweightPriceLineInput,
  type LightweightSuperTrendSignal,
  type LightweightTensionFlowTrendSignal,
  type LightweightTrendHoverReadout,
  type TradingViewTradeMarkerReadout,
} from "./TradingSignalKline.helpers";
import { formatCompactNumber, formatNumber, formatSignedNumber, formatSignedPercent } from "../utils/formatters";

export interface TradingViewSignalMarkerLike {
  signal_id: string;
  date: string;
  signal_name: string;
  signal_level?: string;
  direction?: string;
  entry_price?: number | null;
  score?: number | null;
}

export interface TradingViewEvidenceEventLike {
  id: string;
  date: string;
  kind?: string;
  tone?: "good" | "warn" | "risk" | "neutral";
  label: string;
  title?: string;
  detail?: string;
  signal_id?: string | null;
}

export interface TradingViewKlineChartProps {
  bars: MarketHistoryBar[];
  signals?: TradingViewSignalMarkerLike[];
  events?: TradingViewEvidenceEventLike[];
  maPeriods?: number[];
  bollPeriod?: number;
  bollMultiplier?: number;
  showMa?: boolean;
  showBoll?: boolean;
  showSuperTrend?: boolean;
  showAlphaTrend?: boolean;
  showTensionFlowTrend?: boolean;
  showVolume?: boolean;
  showSignals?: boolean;
  showEvents?: boolean;
  superTrendAtrPeriod?: number;
  superTrendMultiplier?: number;
  alphaTrendPeriod?: number;
  alphaTrendMultiplier?: number;
  alphaTrendNoVolumeData?: boolean;
  tensionFlowHmaLength?: number;
  tensionFlowZScoreLength?: number;
  tensionFlowRibbonWidth?: number;
  tensionFlowSignalGap?: number;
  latestPrice?: number | null;
  priceLines?: LightweightPriceLineInput[];
  rightOffset?: number;
  visibleCount?: number | "all";
  onHoverDate?: (date: string | null) => void;
  onSelectSignal?: (signalId: string) => void;
}

interface HoverReadout {
  x: number;
  y: number;
  bar: LightweightChartBarLike;
  change: number | null;
  changePct: number | null;
  cursorPrice: number | null;
  marker: TradingViewTradeMarkerReadout | null;
  trendReadouts: LightweightTrendHoverReadout[];
}

export function TradingViewKlineChart({
  bars,
  signals = [],
  events = [],
  maPeriods = [5, 20, 60],
  bollPeriod = 20,
  bollMultiplier = 2,
  showMa = true,
  showBoll = true,
  showSuperTrend = false,
  showAlphaTrend = false,
  showTensionFlowTrend = false,
  showVolume = true,
  showSignals = true,
  showEvents = true,
  superTrendAtrPeriod = 10,
  superTrendMultiplier = 3,
  alphaTrendPeriod = 14,
  alphaTrendMultiplier = 1,
  alphaTrendNoVolumeData = false,
  tensionFlowHmaLength = 50,
  tensionFlowZScoreLength = 50,
  tensionFlowRibbonWidth = 0.5,
  tensionFlowSignalGap = 30,
  latestPrice = null,
  priceLines = [],
  rightOffset = 0,
  visibleCount = "all",
  onHoverDate,
  onSelectSignal,
}: TradingViewKlineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const signalIdByMarkerId = useRef<Map<string, string>>(new Map());
  const markerReadoutByMarkerId = useRef<Map<string, TradingViewTradeMarkerReadout>>(new Map());
  const onHoverDateRef = useRef(onHoverDate);
  const onSelectSignalRef = useRef(onSelectSignal);
  const [hover, setHover] = useState<HoverReadout | null>(null);
  const maPeriodKey = buildLightweightMaPeriodKey(maPeriods);
  const stableMaPeriods = useMemo(
    () => maPeriodKey.split(",").map((value) => Number(value)).filter((value) => Number.isFinite(value)),
    [maPeriodKey],
  );
  const series = useMemo(
    () =>
      buildLightweightChartSeries(bars, {
        bollMultiplier,
        bollPeriod,
        maPeriods: stableMaPeriods,
      }),
    [bars, bollMultiplier, bollPeriod, maPeriodKey, stableMaPeriods],
  );
  const superTrend = useMemo(
    () =>
      buildLightweightSuperTrendSeries(bars, {
        atrPeriod: superTrendAtrPeriod,
        multiplier: superTrendMultiplier,
      }),
    [bars, superTrendAtrPeriod, superTrendMultiplier],
  );
  const alphaTrend = useMemo(
    () =>
      buildLightweightAlphaTrendSeries(bars, {
        multiplier: alphaTrendMultiplier,
        noVolumeData: alphaTrendNoVolumeData,
        period: alphaTrendPeriod,
      }),
    [alphaTrendMultiplier, alphaTrendNoVolumeData, alphaTrendPeriod, bars],
  );
  const tensionFlowTrend = useMemo(
    () =>
      buildLightweightTensionFlowTrendSeries(bars, {
        hmaLength: tensionFlowHmaLength,
        ribbonWidth: tensionFlowRibbonWidth,
        signalGap: tensionFlowSignalGap,
        zScoreLength: tensionFlowZScoreLength,
      }),
    [bars, tensionFlowHmaLength, tensionFlowRibbonWidth, tensionFlowSignalGap, tensionFlowZScoreLength],
  );
  const sourceByTime = useMemo(() => {
    const next = new Map<string, LightweightChartBarLike>();
    series.candles.forEach((candle, index) => {
      const source = series.sourceBars[index];
      if (source) next.set(timeKey(candle.time), source);
    });
    return next;
  }, [series.candles, series.sourceBars]);
  const previousCloseByTime = useMemo(() => {
    const next = new Map<string, number | null>();
    series.candles.forEach((candle, index) => {
      next.set(timeKey(candle.time), series.candles[index - 1]?.close ?? null);
    });
    return next;
  }, [series.candles]);
  const logicalRange = useMemo(
    () =>
      buildLightweightVisibleLogicalRange({
        total: series.candles.length,
        visibleCount,
        rightOffset,
      }),
    [rightOffset, series.candles.length, visibleCount],
  );
  const chartPriceLines = useMemo(
    () =>
      buildLightweightPriceLines([
        ...(typeof latestPrice === "number" && Number.isFinite(latestPrice)
          ? [{
              axisLabelVisible: true,
              id: "latest",
              label: "最新",
              price: latestPrice,
              style: "dotted" as const,
              tone: "good" as const,
            }]
          : []),
        ...priceLines,
      ]),
    [latestPrice, priceLines],
  );

  useEffect(() => {
    onHoverDateRef.current = onHoverDate;
  }, [onHoverDate]);

  useEffect(() => {
    onSelectSignalRef.current = onSelectSignal;
  }, [onSelectSignal]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (series.candles.length === 0) {
      setHover(null);
      onHoverDateRef.current?.(null);
      return;
    }

    const chart = createChart(container, {
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "#070b12" },
        textColor: "#9ca3af",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      grid: {
        horzLines: { color: "rgba(148, 163, 184, 0.10)" },
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        horzLine: { color: "rgba(226, 232, 240, 0.52)", labelBackgroundColor: "#111827" },
        vertLine: { color: "rgba(226, 232, 240, 0.52)", labelBackgroundColor: "#111827" },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.22)",
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.24 : 0.08 },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.22)",
        rightOffset: 8,
        barSpacing: 8,
        minBarSpacing: 2,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: {
        axisDoubleClickReset: true,
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        horzTouchDrag: true,
        mouseWheel: true,
        pressedMouseMove: true,
        vertTouchDrag: true,
      },
      localization: {
        priceFormatter: (price: number) => formatNumber(price, 2),
      },
    });

    const resize = () => {
      const width = Math.max(320, container.clientWidth);
      const height = Math.max(360, container.clientHeight);
      chart.applyOptions({ width, height });
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const candleSeries = chart.addSeries(CandlestickSeries, {
      borderDownColor: "#ef4444",
      borderUpColor: "#10b981",
      downColor: "#ef4444",
      priceLineColor: "rgba(226, 232, 240, 0.45)",
      wickDownColor: "#ef4444",
      wickUpColor: "#10b981",
      upColor: "#10b981",
    });
    candleSeries.setData(series.candles as CandlestickData<Time>[]);

    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "rgba(96, 165, 250, 0.32)",
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      });
      volumeSeries.setData(series.volume as HistogramData<Time>[]);
    }

    if (showMa) {
      const maColors = ["#facc15", "#60a5fa", "#c4b5fd", "#f97316", "#2dd4bf"];
      series.maLines.forEach((line, index) => {
        if (line.data.length === 0) return;
        const lineSeries = chart.addSeries(LineSeries, {
          color: maColors[index % maColors.length],
          lineWidth: index === 0 ? 2 : 1,
          priceLineVisible: false,
          lastValueVisible: false,
          title: `MA${line.period}`,
        });
        lineSeries.setData(line.data as LineData<Time>[]);
      });
    }

    if (showBoll) {
      [
        { data: series.boll.upper, color: "rgba(248, 250, 252, 0.78)", title: "BOLL U" },
        { data: series.boll.mid, color: "rgba(52, 211, 153, 0.66)", title: "BOLL M" },
        { data: series.boll.lower, color: "rgba(248, 250, 252, 0.78)", title: "BOLL L" },
      ].forEach((item) => {
        if (item.data.length === 0) return;
        const bollSeries = chart.addSeries(LineSeries, {
          color: item.color,
          lineStyle: 2,
          lineWidth: item.title === "BOLL M" ? 1 : 1,
          priceLineVisible: false,
          lastValueVisible: false,
          title: item.title,
        });
        bollSeries.setData(item.data as LineData<Time>[]);
      });
    }

    if (showSuperTrend) {
      addSegmentedLineSeries({
        chart,
        candles: series.candles,
        color: "#22c55e",
        data: superTrend.up,
        title: "SuperTrend Buy",
      });
      addSegmentedLineSeries({
        chart,
        candles: series.candles,
        color: "#fb7185",
        data: superTrend.down,
        title: "SuperTrend Sell",
      });
    }

    if (showTensionFlowTrend) {
      addSegmentedLineSeries({
        chart,
        candles: series.candles,
        color: "#00ffbb",
        data: tensionFlowTrend.baselineUp,
        title: "Tension Flow HMA",
      });
      addSegmentedLineSeries({
        chart,
        candles: series.candles,
        color: "#ff0055",
        data: tensionFlowTrend.baselineDown,
        title: "Tension Flow HMA",
      });
      [
        { data: tensionFlowTrend.upperRibbon, color: "rgba(0, 255, 187, 0.32)", title: "TFT Upper" },
        { data: tensionFlowTrend.lowerRibbon, color: "rgba(255, 0, 85, 0.32)", title: "TFT Lower" },
      ].forEach((item) => {
        if (item.data.length === 0) return;
        const ribbonSeries = chart.addSeries(LineSeries, {
          color: item.color,
          lineStyle: LineStyle.Dotted,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          title: item.title,
        });
        ribbonSeries.setData(item.data as LineData<Time>[]);
      });
    }

    if (showAlphaTrend && alphaTrend.current.length > 0) {
      const latestFillBase = alphaTrend.fill[alphaTrend.fill.length - 1]?.baseValue;
      if (typeof latestFillBase === "number" && Number.isFinite(latestFillBase)) {
        const fillSeries = chart.addSeries(BaselineSeries, {
          baseLineVisible: false,
          baseValue: { type: "price", price: latestFillBase },
          bottomFillColor1: "rgba(128, 0, 11, 0.18)",
          bottomFillColor2: "rgba(128, 0, 11, 0.03)",
          bottomLineColor: "rgba(128, 0, 11, 0)",
          lastValueVisible: false,
          lineWidth: 1,
          priceLineVisible: false,
          relativeGradient: false,
          topFillColor1: "rgba(0, 230, 15, 0.20)",
          topFillColor2: "rgba(0, 230, 15, 0.04)",
          topLineColor: "rgba(0, 230, 15, 0)",
          title: "AT Fill",
        });
        fillSeries.setData(alphaTrend.current as BaselineData<Time>[]);
      }

      const alphaTrendSeries = chart.addSeries(LineSeries, {
        color: "#0022fc",
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false,
        title: `AlphaTrend ${alphaTrend.source.toUpperCase()}`,
      });
      alphaTrendSeries.setData(alphaTrend.current as LineData<Time>[]);

      if (alphaTrend.lag.length > 0) {
        const lagSeries = chart.addSeries(LineSeries, {
          color: "#fc0400",
          lineWidth: 3,
          priceLineVisible: false,
          lastValueVisible: false,
          title: "AlphaTrend[2]",
        });
        lagSeries.setData(alphaTrend.lag as LineData<Time>[]);
      }
    }

    const markers = buildTradingViewMarkers({
      alphaTrendSignals: showAlphaTrend ? alphaTrend.signals : [],
      events: showEvents ? events : [],
      signals: showSignals ? signals : [],
      sourceByTime,
      superTrendSignals: showSuperTrend ? superTrend.signals : [],
      tensionFlowTrendSignals: showTensionFlowTrend ? tensionFlowTrend.signals : [],
    });
    signalIdByMarkerId.current = markers.signalIdByMarkerId;
    markerReadoutByMarkerId.current = markers.markerReadoutByMarkerId;
    createSeriesMarkers(candleSeries, markers.markers, { autoScale: true });

    chartPriceLines.forEach((line) => {
      candleSeries.createPriceLine({
        axisLabelVisible: line.axisLabelVisible,
        color: line.color,
        lineStyle: lineStyleFor(line.lineStyle),
        lineWidth: 1,
        price: line.price,
        title: line.title,
      });
    });

    const handleCrosshair = (param: MouseEventParams<Time>) => {
      if (!param.time || !param.point) {
        setHover(null);
        onHoverDateRef.current?.(null);
        return;
      }
      const objectId = param.hoveredInfo?.objectId ?? param.hoveredObjectId;
      const marker = typeof objectId === "string"
        ? markerReadoutByMarkerId.current.get(objectId) ?? null
        : null;
      const key = timeKey(param.time);
      const source = sourceByTime.get(key);
      if (!source) {
        setHover(null);
        onHoverDateRef.current?.(null);
        return;
      }
      const cursorPrice = candleSeries.coordinateToPrice(param.point.y);
      const priceChange = buildHoverPriceChange(source, previousCloseByTime.get(key) ?? null);
      setHover({
        x: clampNumber(param.point.x + 14, 8, Math.max(8, container.clientWidth - 245)),
        y: clampNumber(param.point.y + 14, 8, Math.max(8, container.clientHeight - 214)),
        bar: source,
        change: priceChange.change,
        changePct: priceChange.changePct,
        cursorPrice: typeof cursorPrice === "number" && Number.isFinite(cursorPrice) ? cursorPrice : null,
        marker,
        trendReadouts: buildLightweightTrendHoverReadouts({
          alphaTrend,
          showAlphaTrend,
          showSuperTrend,
          showTensionFlowTrend,
          superTrend,
          tensionFlowTrend,
          time: key,
        }),
      });
      onHoverDateRef.current?.(source.date || null);
    };
    const handleClick = (param: MouseEventParams<Time>) => {
      const objectId = param.hoveredInfo?.objectId ?? param.hoveredObjectId;
      if (typeof objectId !== "string") return;
      const signalId = signalIdByMarkerId.current.get(objectId);
      if (signalId) onSelectSignalRef.current?.(signalId);
    };
    chart.subscribeCrosshairMove(handleCrosshair);
    chart.subscribeClick(handleClick);
    if (logicalRange) {
      chart.timeScale().setVisibleLogicalRange(logicalRange);
    } else {
      chart.timeScale().fitContent();
    }

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshair);
      chart.unsubscribeClick(handleClick);
      chart.remove();
    };
  }, [
    alphaTrend,
    bollPeriod,
    chartPriceLines,
    events,
    latestPrice,
    logicalRange,
    priceLines,
    previousCloseByTime,
    rightOffset,
    series,
    showBoll,
    showAlphaTrend,
    showEvents,
    showMa,
    showSignals,
    showSuperTrend,
    showTensionFlowTrend,
    showVolume,
    signals,
    sourceByTime,
    superTrend,
    tensionFlowTrend,
    visibleCount,
  ]);

  if (series.candles.length === 0) {
    return (
      <div className="tradingview-kline-shell empty">
        <div className="tradingview-kline-empty">
          <strong>暂无可绘制 K 线</strong>
          <span>当前周期没有有效 OHLC 数据</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tradingview-kline-shell">
      <div className="tradingview-kline-canvas" ref={containerRef} />
      {hover && (
        <div
          className={`tradingview-kline-tooltip ${hover.marker ? "marker-active" : ""}`}
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.marker && (
            <div className={`tradingview-kline-marker-readout ${hover.marker.tone}`}>
              <strong>{hover.marker.title}</strong>
              <span>{hover.marker.subtitle}</span>
              <span>信号日期 {hover.marker.date}</span>
              <span>信号价格 {formatNumber(hover.marker.price, 2)}</span>
            </div>
          )}
          <div className="tradingview-kline-bar-readout">
            <strong>日期 {hover.bar.period_label || hover.bar.date || "-"}</strong>
            <span>光标价 {formatNumber(hover.cursorPrice, 2)}</span>
            <span>收盘价 {formatNumber(hover.bar.close, 2)}</span>
            <span>开 {formatNumber(hover.bar.open, 2)} 高 {formatNumber(hover.bar.high, 2)}</span>
            <span>低 {formatNumber(hover.bar.low, 2)} 量 {formatCompactNumber(hover.bar.volume)}</span>
            <span className={`tradingview-kline-price-change ${hoverPriceChangeTone(hover.change)}`}>
              涨跌 {formatSignedNumber(hover.change, 2)} / {formatSignedPercent(hover.changePct)}
            </span>
            {hover.trendReadouts.map((readout) => (
              <span className={`tradingview-kline-trend-readout ${readout.tone}`} key={readout.key}>
                {readout.label} {formatNumber(readout.value, 2)}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="tradingview-kline-badge">
        TradingView Lightweight Charts · 拖拽平移 · 滚轮缩放
      </div>
    </div>
  );
}

function buildTradingViewMarkers({
  signals,
  events,
  superTrendSignals,
  alphaTrendSignals,
  tensionFlowTrendSignals,
  sourceByTime,
}: {
  signals: TradingViewSignalMarkerLike[];
  events: TradingViewEvidenceEventLike[];
  superTrendSignals: LightweightSuperTrendSignal[];
  alphaTrendSignals: LightweightAlphaTrendSignal[];
  tensionFlowTrendSignals: LightweightTensionFlowTrendSignal[];
  sourceByTime: Map<string, LightweightChartBarLike>;
}): {
  markerReadoutByMarkerId: Map<string, TradingViewTradeMarkerReadout>;
  markers: SeriesMarker<Time>[];
  signalIdByMarkerId: Map<string, string>;
} {
  const signalIdByMarkerId = new Map<string, string>();
  const markerReadoutByMarkerId = new Map<string, TradingViewTradeMarkerReadout>();
  const markers: SeriesMarker<Time>[] = [];
  signals.forEach((signal) => {
    const time = toSeriesTime(signal.date);
    if (!time) return;
    const direction = String(signal.direction || signal.signal_level || "").toLowerCase();
    const isRisk = direction.includes("sell") || direction.includes("risk") || direction.includes("减") || direction.includes("卖");
    const markerId = `signal:${signal.signal_id}`;
    const source = sourceByTime.get(timeKey(time));
    signalIdByMarkerId.set(markerId, signal.signal_id);
    const markerReadout = buildTradingViewTradeMarkerReadout({
      date: signal.date || source?.period_label || source?.date,
      fallbackPrice: source?.close ?? null,
      label: signal.signal_name,
      prefix: "交易信号",
      price: signal.entry_price ?? null,
      side: direction || signal.signal_level || (isRisk ? "sell" : "buy"),
    });
    if (markerReadout) markerReadoutByMarkerId.set(markerId, markerReadout);
    markers.push({
      id: markerId,
      time,
      position: isRisk ? "aboveBar" : "belowBar",
      shape: isRisk ? "arrowDown" : "arrowUp",
      color: tradingViewTradeMarkerColor(isRisk ? "sell" : "buy"),
      size: 1.45,
      text: signalMarkerText(signal),
    });
  });
  events.forEach((event) => {
    const time = toSeriesTime(event.date);
    if (!time) return;
    markers.push({
      id: `event:${event.id}`,
      time,
      position: "aboveBar",
      shape: "square",
      color: eventMarkerColor(event.tone),
      size: 0.8,
      text: event.label,
    });
  });
  superTrendSignals.forEach((signal) => {
    const markerId = `supertrend:${signal.side}:${timeKey(signal.time)}`;
    const source = sourceByTime.get(timeKey(signal.time));
    const markerReadout = buildTradingViewTradeMarkerReadout({
      date: source?.period_label || source?.date || timeKey(signal.time),
      fallbackPrice: source?.close ?? null,
      label: signal.label,
      prefix: "SuperTrend",
      price: signal.price,
      side: signal.side,
    });
    if (markerReadout) markerReadoutByMarkerId.set(markerId, markerReadout);
    markers.push({
      id: markerId,
      time: signal.time as Time,
      position: signal.side === "sell" ? "aboveBar" : "belowBar",
      shape: signal.side === "sell" ? "arrowDown" : "arrowUp",
      color: tradingViewTradeMarkerColor(signal.side),
      size: 1.1,
      text: `ST ${signal.label}`,
    });
  });
  alphaTrendSignals.forEach((signal) => {
    const source = sourceByTime.get(timeKey(signal.time));
    const markerReadout = buildTradingViewTradeMarkerReadout({
      date: signal.date || source?.period_label || source?.date || timeKey(signal.time),
      fallbackPrice: source?.close ?? null,
      label: signal.label,
      prefix: "AlphaTrend",
      price: signal.price,
      side: signal.side,
    });
    if (markerReadout) markerReadoutByMarkerId.set(signal.id, markerReadout);
    markers.push({
      id: signal.id,
      time: signal.time as Time,
      position: signal.side === "sell" ? "aboveBar" : "belowBar",
      shape: signal.side === "sell" ? "arrowDown" : "arrowUp",
      color: tradingViewTradeMarkerColor(signal.side),
      size: 1.15,
      text: `AT ${signal.label}`,
    });
  });
  tensionFlowTrendSignals.forEach((signal) => {
    const source = sourceByTime.get(timeKey(signal.time));
    const markerReadout = buildTradingViewTradeMarkerReadout({
      date: signal.date || source?.period_label || source?.date || timeKey(signal.time),
      fallbackPrice: source?.close ?? null,
      label: signal.label,
      prefix: "Tension Flow",
      price: signal.price,
      side: signal.side,
    });
    if (markerReadout) markerReadoutByMarkerId.set(signal.id, markerReadout);
    markers.push({
      id: signal.id,
      time: signal.time as Time,
      position: signal.side === "sell" ? "aboveBar" : "belowBar",
      shape: signal.side === "sell" ? "arrowDown" : "arrowUp",
      color: tradingViewTradeMarkerColor(signal.side),
      size: 1.05,
      text: `TFT ${signal.label}`,
    });
  });
  return { markerReadoutByMarkerId, markers, signalIdByMarkerId };
}

function addSegmentedLineSeries({
  chart,
  candles,
  color,
  data,
  title,
}: {
  chart: ReturnType<typeof createChart>;
  candles: LightweightChartLinePoint[];
  color: string;
  data: LightweightChartLinePoint[];
  title: string;
}) {
  const segments = splitLineSegments(data, candles);
  segments.forEach((segment, index) => {
    if (segment.length === 0) return;
    const lineSeries = chart.addSeries(LineSeries, {
      color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: index === segments.length - 1,
      title,
    });
    lineSeries.setData(segment as LineData<Time>[]);
  });
}

function splitLineSegments(
  data: LightweightChartLinePoint[],
  candles: LightweightChartLinePoint[],
): LightweightChartLinePoint[][] {
  const rankByTime = new Map(candles.map((candle, index) => [timeKey(candle.time), index]));
  const sorted = [...data].sort((left, right) => {
    const leftRank = rankByTime.get(timeKey(left.time)) ?? 0;
    const rightRank = rankByTime.get(timeKey(right.time)) ?? 0;
    return leftRank - rightRank;
  });
  const segments: LightweightChartLinePoint[][] = [];
  let current: LightweightChartLinePoint[] = [];
  let previousRank: number | null = null;

  sorted.forEach((point) => {
    const rank = rankByTime.get(timeKey(point.time));
    if (rank == null) return;
    if (previousRank != null && rank !== previousRank + 1) {
      if (current.length > 0) segments.push(current);
      current = [];
    }
    current.push(point);
    previousRank = rank;
  });
  if (current.length > 0) segments.push(current);
  return segments;
}

function signalMarkerText(signal: TradingViewSignalMarkerLike) {
  const parts = [
    signal.signal_name,
    typeof signal.score === "number" ? `S${formatNumber(signal.score, 1)}` : null,
    typeof signal.entry_price === "number" ? formatNumber(signal.entry_price, 2) : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function eventMarkerColor(tone?: TradingViewEvidenceEventLike["tone"]) {
  if (tone === "good") return "#22c55e";
  if (tone === "risk") return "#ef4444";
  if (tone === "warn") return "#f59e0b";
  return "#94a3b8";
}

function buildHoverPriceChange(bar: LightweightChartBarLike, previousClose: number | null) {
  const close = finiteChartNumber(bar.close);
  const basis = finiteChartNumber(previousClose) ?? finiteChartNumber(bar.open);
  if (close == null || basis == null || basis === 0) {
    return { change: null, changePct: null };
  }
  const change = close - basis;
  return {
    change,
    changePct: change / Math.abs(basis),
  };
}

function hoverPriceChangeTone(change: number | null) {
  if (change == null || change === 0) return "neutral";
  return change > 0 ? "good" : "risk";
}

function toSeriesTime(value?: string | null): Time | null {
  const time = toLightweightChartTime(value);
  if (time == null) return null;
  return time as Time;
}

function lineStyleFor(style: "solid" | "dashed" | "dotted") {
  if (style === "solid") return LineStyle.Solid;
  if (style === "dotted") return LineStyle.Dotted;
  return LineStyle.Dashed;
}

function timeKey(value: LightweightChartTime | Time) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function finiteChartNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
