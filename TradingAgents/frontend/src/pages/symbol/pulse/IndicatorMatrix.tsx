// Tab 1 指标矩阵 — 短/中/长三列按时间维度
import { Sparkline } from "../_shared/atoms";
import type { IndicatorColumn } from "../../../types/symbol-workspace";

interface Props {
  columns: IndicatorColumn[];
}

export function IndicatorMatrix({ columns }: Props) {
  return (
    <div className="sw-matrix">
      {columns.map((col) => (
        <div className="sw-matrix__col" key={col.horizon}>
          <div className="sw-matrix__head">
            <h4>{col.title}</h4>
            <small>{col.subtitle} · {col.items.length} 指标</small>
          </div>
          <div className="sw-matrix__rows">
            {col.items.length === 0 || col.items.every((r) => r.value === "-" || r.value === "待接入") ? (
              <div className="sw-empty" style={{ padding: "var(--sw-sp-3)" }}>
                <strong style={{ fontSize: 12 }}>
                  {col.horizon === "long" ? "长线指标暂未支持" : "暂无该维度指标"}
                </strong>
                <span style={{ fontSize: 11 }}>
                  {col.horizon === "long"
                    ? "需要接入财务三表与现金流数据"
                    : "等行情与因子数据落库"}
                </span>
              </div>
            ) : (
              col.items.map((row) => (
                <div className="sw-matrix__row" key={row.label}>
                  <span className="sw-lbl">{row.label}</span>
                  <span className={`sw-val sw-tone-${row.tone}`}>{row.value}</span>
                  {row.spark && row.spark.length >= 2 ? (
                    <Sparkline values={row.spark} tone={row.tone} />
                  ) : (
                    <span aria-hidden />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
