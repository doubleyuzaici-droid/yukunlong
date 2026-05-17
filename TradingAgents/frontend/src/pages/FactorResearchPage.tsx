import { FormEvent, useEffect, useMemo, useState } from "react";
import { DataTrustPanel } from "../components/DataTrustPanel";
import { formatNumber, formatPercent, formatSignedPercent } from "../utils/formatters";

interface Ranking {
  metric: string;
  rank?: number | null;
  total: number;
  percentile?: number | null;
  leader?: Record<string, unknown> | null;
}

interface FactorResearchPayload {
  symbol: string;
  date: string;
  industry?: string | null;
  factor_snapshot?: Record<string, number | string | null> | null;
  industry_peer_count: number;
  rankings: Record<string, Ranking>;
  peer_rows: Record<string, number | string | null>[];
  style_exposure: Record<string, number | null>;
  factor_effectiveness?: {
    method: string;
    metric: string;
    observations: number;
    rank_ic20?: number | null;
    top_bucket_return?: number | null;
    bottom_bucket_return?: number | null;
    spread?: number | null;
    warnings?: string[];
  };
}

const FACTOR_LABELS: Record<string, string> = {
  rel_strength_index20: "相对指数强弱",
  rel_strength_industry20: "相对行业强弱",
  ret20: "20日收益",
  ret60: "60日收益",
  volume_ratio20: "成交量脉冲",
  amount_ratio20: "成交额脉冲",
};

export default function FactorResearchPage({
  initialSymbol = "600519.SH",
  initialEnd,
}: {
  initialSymbol?: string;
  initialEnd?: string;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [targetDate, setTargetDate] = useState(initialEnd || new Date().toISOString().slice(0, 10));
  const [payload, setPayload] = useState<FactorResearchPayload | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSymbol(initialSymbol);
    if (initialEnd) setTargetDate(initialEnd);
  }, [initialSymbol, initialEnd]);

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    const response = await fetch(
      `/api/professional/factors?${new URLSearchParams({ symbol, date: targetDate }).toString()}`,
    );
    const data = await response.json();
    if (data.success) {
      setPayload(data.data);
      setMessage(data.data.factor_snapshot ? "因子研究已刷新" : "暂无因子快照");
    } else {
      setMessage("因子研究读取失败");
    }
  };

  useEffect(() => {
    load();
  }, [initialSymbol, initialEnd]);

  const styleRows = useMemo(() => Object.entries(payload?.style_exposure || {}), [payload]);
  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>因子研究</h1>
        <p>横截面排名、行业同组对比和风格暴露，用来判断信号是否有可解释的因子支撑。</p>
      </div>
      <form className="toolbar" onSubmit={load}>
        <input value={symbol} onChange={(event) => setSymbol(event.target.value)} />
        <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        <button className="primary">刷新因子</button>
        <span className="muted">{message}</span>
      </form>
      <DataTrustPanel
        compact
        title="因子研究可信度"
        summary="因子页展示横截面相对位置、行业同组样本和风格暴露；样本不足时只作为方向参考。"
        items={[
          { label: "因子快照", value: payload?.factor_snapshot ? "可用" : "缺失", tone: payload?.factor_snapshot ? "good" : "warn" },
          { label: "行业样本", value: `${payload?.industry_peer_count || 0} 个`, tone: (payload?.industry_peer_count || 0) >= 5 ? "good" : "warn" },
          { label: "排名指标", value: `${Object.keys(payload?.rankings || {}).length} 个` },
          { label: "风格暴露", value: `${styleRows.length} 项` },
          { label: "日期", value: payload?.date || targetDate },
        ]}
        warnings={[
          ...(!payload?.factor_snapshot ? ["缺少因子快照，横截面排名不可用"] : []),
          ...((payload?.industry_peer_count || 0) < 5 ? ["行业同组样本偏少，因子分位稳定性不足"] : []),
        ]}
        disclaimer="因子有效性需要结合历史 IC、分层收益和交易成本验证。"
      />
      <div className="pipeline-summary">
        <Metric label="行业" value={payload?.industry || "-"} />
        <Metric label="同业样本" value={String(payload?.industry_peer_count || 0)} />
        <Metric label="相对指数" value={formatSignedPercent(Number(payload?.factor_snapshot?.rel_strength_index20))} />
        <Metric label="相对行业" value={formatSignedPercent(Number(payload?.factor_snapshot?.rel_strength_industry20))} />
      </div>
      <div className="context-grid">
        <div className="detail-panel">
          <div className="section-subhead">
            <h2>横截面排名</h2>
            <span className="muted">{payload?.date || "-"}</span>
          </div>
          <div className="factor-metric-grid">
            {Object.entries(payload?.rankings || {}).map(([metric, ranking]) => (
              <div className="mini-metric" key={metric}>
                <span>{FACTOR_LABELS[metric] || metric}</span>
                <strong>{ranking.rank ? `${ranking.rank}/${ranking.total}` : "-"}</strong>
                <small>分位 {formatPercent(ranking.percentile)}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="detail-panel">
          <div className="section-subhead">
            <h2>风格暴露</h2>
            <span className="muted">数值来自本地因子快照</span>
          </div>
          <div className="bar-chart">
            {styleRows.map(([name, value]) => (
              <div className="bar-row" key={name}>
                <span>{name}</span>
                <div className="bar-track">
                  <i
                    className={(value || 0) >= 0 ? "positive" : "negative"}
                    style={{ width: `${Math.max(5, Math.min(100, Math.abs(Number(value || 0)) * 100))}%` }}
                  />
                </div>
                <b>{formatNumber(Number(value), 2)}</b>
              </div>
            ))}
            {styleRows.length === 0 && <p className="empty-state">暂无风格暴露</p>}
          </div>
        </div>
      </div>
      <FactorEffectivenessPanel rows={payload?.peer_rows || []} effectiveness={payload?.factor_effectiveness} />
      <div className="data-table-wrap">
        <table className="data-table compact-table dense-table">
          <thead>
            <tr>
              <th>股票</th>
              <th>相对指数</th>
              <th>相对行业</th>
              <th>20日</th>
              <th>60日</th>
              <th>量/额脉冲</th>
            </tr>
          </thead>
          <tbody>
            {(payload?.peer_rows || []).map((row) => (
              <tr key={String(row.symbol)}>
                <td>{String(row.symbol)}</td>
                <td>{formatSignedPercent(Number(row.rel_strength_index20))}</td>
                <td>{formatSignedPercent(Number(row.rel_strength_industry20))}</td>
                <td>{formatSignedPercent(Number(row.ret20))}</td>
                <td>{formatSignedPercent(Number(row.ret60))}</td>
                <td>{formatNumber(Number(row.volume_ratio20), 2)} / {formatNumber(Number(row.amount_ratio20), 2)}</td>
              </tr>
            ))}
            {(payload?.peer_rows || []).length === 0 && <tr><td colSpan={6}>暂无同组因子样本</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong></div>;
}

function FactorEffectivenessPanel({
  rows,
  effectiveness,
}: {
  rows: Record<string, number | string | null>[];
  effectiveness?: FactorResearchPayload["factor_effectiveness"];
}) {
  const stats = useMemo(() => {
    const clean = rows
      .map((row) => ({
        symbol: String(row.symbol || "-"),
        factor: Number(row.rel_strength_industry20 ?? row.rel_strength_index20 ?? 0),
        ret20: Number(row.ret20 ?? 0),
      }))
      .filter((row) => Number.isFinite(row.factor) && Number.isFinite(row.ret20));
    const sorted = [...clean].sort((left, right) => right.factor - left.factor);
    const bucketSize = Math.max(1, Math.ceil(sorted.length * 0.25));
    const top = sorted.slice(0, bucketSize);
    const bottom = sorted.slice(-bucketSize);
    const average = (items: typeof clean) =>
      items.length ? items.reduce((sum, item) => sum + item.ret20, 0) / items.length : 0;
    const topRet = average(top);
    const bottomRet = average(bottom);
    return { count: clean.length, topRet, bottomRet, spread: topRet - bottomRet, top, bottom };
  }, [rows]);

  return (
    <div className="detail-panel factor-effectiveness-panel">
      <div className="section-subhead">
        <h2>因子有效性验证</h2>
        <span className="muted">{effectiveness?.method || "同组分层收益代理"}</span>
      </div>
      <div className="pipeline-summary">
        <Metric label="有效样本" value={`${effectiveness?.observations ?? stats.count} 个`} />
        <Metric label="RankIC 20D" value={formatNumber(effectiveness?.rank_ic20, 3)} />
        <Metric label="Top分层20日" value={formatSignedPercent(effectiveness?.top_bucket_return ?? stats.topRet)} />
        <Metric label="Bottom分层20日" value={formatSignedPercent(effectiveness?.bottom_bucket_return ?? stats.bottomRet)} />
        <Metric label="分层差" value={formatSignedPercent(effectiveness?.spread ?? stats.spread)} />
      </div>
      {(effectiveness?.warnings || []).length > 0 && (
        <div className="compact-warning-list">
          {effectiveness?.warnings?.map((warning) => <span key={warning}>{warning}</span>)}
        </div>
      )}
      <div className="factor-driver-list">
        {stats.top.slice(0, 3).map((row) => (
          <span key={`top-${row.symbol}`}>Top {row.symbol} {formatSignedPercent(row.ret20)}</span>
        ))}
        {stats.bottom.slice(0, 3).map((row) => (
          <span key={`bottom-${row.symbol}`}>Bottom {row.symbol} {formatSignedPercent(row.ret20)}</span>
        ))}
      </div>
    </div>
  );
}
