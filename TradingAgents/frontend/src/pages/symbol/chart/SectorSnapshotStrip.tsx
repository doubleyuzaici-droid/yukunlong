// 同板块联动 mini-strip — 用于 Chart Tab 顶部
// readability-review.md §3 缺失 1
import { useEffect, useState } from "react";
import { fetchSectorSnapshot, type SectorSnapshotShape } from "../../../api/symbol-workspace/fetchers";
import { Skeleton } from "../_shared/atoms";
import { classOfChange, fmtPct } from "../formatters";

interface Props {
  symbol: string;
  date: string;
}

export function SectorSnapshotStrip({ symbol, date }: Props) {
  const [data, setData] = useState<SectorSnapshotShape | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetchSectorSnapshot(symbol, date, ac.signal)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [symbol, date]);

  if (loading) {
    return <Skeleton height={48} />;
  }
  if (!data || !data.industry) {
    return null; // 没行业归类就不显示
  }

  const own = data.own_change_pct;
  const sector = data.sector_avg_change_pct;
  const market = data.market_index.change_pct;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto auto 1fr",
        gap: "var(--sw-sp-3)",
        alignItems: "center",
        padding: "var(--sw-sp-3) var(--sw-sp-4)",
        background: "var(--sw-bg-surface)",
        border: "1px solid var(--sw-border-subtle)",
        borderRadius: "var(--sw-r-md)",
        fontSize: 13,
      }}
      role="region"
      aria-label="同板块联动"
    >
      <Cell label="该股" value={own} bold />
      <Divider />
      <Cell label={data.industry || "板块"} value={sector} />
      <Divider />
      <Cell label={`大盘 (${data.market_index.symbol})`} value={market} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "var(--sw-sp-3)",
          color: "var(--sw-text-tertiary)",
          fontSize: 11,
        }}
      >
        {data.peers.length > 0 && (
          <>
            <span>同板块 5 只：</span>
            {data.peers.map((p) => (
              <span key={p.symbol} title={p.symbol}>
                {p.name}{" "}
                <span className={`sw-mono ${classOfChange(p.change_pct)}`}>
                  {fmtPct(p.change_pct, 1)}
                </span>
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  bold,
}: {
  label: string;
  value: number | null;
  bold?: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ color: "var(--sw-text-secondary)", fontSize: 12 }}>{label}</span>
      <span
        className={`sw-mono ${classOfChange(value)}`}
        style={{ fontSize: bold ? 16 : 14, fontWeight: bold ? 600 : 500 }}
      >
        {fmtPct(value, 2)}
      </span>
    </span>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{
        width: 1,
        height: 18,
        background: "var(--sw-border-subtle)",
      }}
    />
  );
}
