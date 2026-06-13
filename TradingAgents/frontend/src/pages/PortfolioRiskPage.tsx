import { FormEvent, useEffect, useState } from "react";
import { DataTrustPanel } from "../components/DataTrustPanel";
import { formatMoney, formatPercent } from "../utils/formatters";

interface PortfolioRiskPayload {
  strategy_version: string;
  date: string;
  positions: { symbol: string; market: string; quantity: number; cost: number; weight: number }[];
  exposure: {
    gross_exposure: number;
    net_exposure: number;
    gross_exposure_pct?: number | null;
    market_exposure: Record<string, number>;
    industry_exposure?: Record<string, number>;
  };
  concentration: {
    top_symbol?: string | null;
    top_weight?: number | null;
    position_count: number;
  };
  drawdown: {
    current_drawdown?: number | null;
    equity?: number | null;
    cash?: number | null;
  };
  stress_tests: { scenario: string; estimated_pnl: number }[];
  correlation_matrix?: { symbol: string; correlations: Record<string, number | null> }[];
  risk_budget?: { symbol: string; weight: number; budget_status: string; suggested_max_weight: number }[];
}

export default function PortfolioRiskPage() {
  const [strategyVersion, setStrategyVersion] = useState("portfolio_v1");
  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10));
  const [payload, setPayload] = useState<PortfolioRiskPayload | null>(null);
  const [message, setMessage] = useState("");

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    const response = await fetch(
      `/api/professional/portfolio-risk?${new URLSearchParams({ strategy_version: strategyVersion, date: targetDate }).toString()}`,
    );
    const data = await response.json();
    if (data.success) {
      setPayload(data.data);
      setMessage("组合风险已刷新");
    } else {
      setMessage("组合风险读取失败");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>组合风险</h1>
        <p>从交易日志和权益曲线聚合暴露、集中度、回撤和压力测试，用于补足单票信号之外的组合视角。</p>
      </div>
      <form className="toolbar" onSubmit={load}>
        <input value={strategyVersion} onChange={(event) => setStrategyVersion(event.target.value)} />
        <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        <button className="primary">刷新风险</button>
        <span className="muted">{message}</span>
      </form>
      <DataTrustPanel
        compact
        title="组合风险可信度"
        summary="组合风险来自交易日志、开放持仓和权益曲线；无开放持仓时展示空暴露而不是估算风险。"
        items={[
          { label: "策略版本", value: strategyVersion },
          { label: "风险日期", value: payload?.date || targetDate },
          { label: "持仓数量", value: String(payload?.concentration.position_count || 0), tone: (payload?.concentration.position_count || 0) > 0 ? "good" : "warn" },
          { label: "总暴露", value: formatMoney(payload?.exposure.gross_exposure) },
          { label: "暴露/权益", value: formatPercent(payload?.exposure.gross_exposure_pct) },
          { label: "压力场景", value: `${payload?.stress_tests.length || 0} 个` },
        ]}
        warnings={(payload?.positions.length || 0) === 0 ? ["暂无开放持仓，组合风险只能展示空仓状态"] : []}
        disclaimer="组合风险页用于模拟组合和研究日志监控，不替代实盘风控系统。"
      />
      <div className="pipeline-summary">
        <Metric label="总暴露" value={formatMoney(payload?.exposure.gross_exposure)} />
        <Metric label="暴露/权益" value={formatPercent(payload?.exposure.gross_exposure_pct)} />
        <Metric label="最大持仓" value={payload?.concentration.top_symbol || "-"} />
        <Metric label="当前回撤" value={formatPercent(payload?.drawdown.current_drawdown)} />
      </div>
      <div className="context-grid">
        <div className="detail-panel">
          <div className="section-subhead">
            <h2>市场暴露</h2>
            <span className="muted">{payload?.date || "-"}</span>
          </div>
          <div className="factor-metric-grid">
            {Object.entries(payload?.exposure.market_exposure || {}).map(([market, value]) => (
              <div className="mini-metric" key={market}>
                <span>{market}</span>
                <strong>{formatMoney(value)}</strong>
              </div>
            ))}
            {Object.keys(payload?.exposure.market_exposure || {}).length === 0 && (
              <div className="empty-state block">暂无开放持仓暴露</div>
            )}
          </div>
        </div>
        <div className="detail-panel">
          <div className="section-subhead">
            <h2>行业暴露</h2>
            <span className="muted">按自选股行业聚合</span>
          </div>
          <div className="factor-metric-grid">
            {Object.entries(payload?.exposure.industry_exposure || {}).map(([industry, value]) => (
              <div className="mini-metric" key={industry}>
                <span>{industry}</span>
                <strong>{formatMoney(value)}</strong>
              </div>
            ))}
            {Object.keys(payload?.exposure.industry_exposure || {}).length === 0 && (
              <div className="empty-state block">暂无行业暴露</div>
            )}
          </div>
        </div>
        <div className="list-panel compact-list">
          <h2>压力测试</h2>
          {(payload?.stress_tests || []).map((row) => (
            <p key={row.scenario}>
              <strong>{row.scenario}</strong>
              <span>{formatMoney(row.estimated_pnl)}</span>
            </p>
          ))}
        </div>
      </div>
      <div className="context-grid">
        <div className="data-table-wrap">
          <table className="data-table compact-table dense-table">
            <thead>
              <tr>
                <th>风险预算</th>
                <th>权重</th>
                <th>上限</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.risk_budget || []).map((row) => (
                <tr key={row.symbol}>
                  <td>{row.symbol}</td>
                  <td>{formatPercent(row.weight)}</td>
                  <td>{formatPercent(row.suggested_max_weight)}</td>
                  <td><span className={row.budget_status === "ok" ? "status-badge" : "status-badge freshness-delayed"}>{row.budget_status}</span></td>
                </tr>
              ))}
              {(payload?.risk_budget || []).length === 0 && <tr><td colSpan={4}>暂无风险预算</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="data-table-wrap">
          <table className="data-table compact-table dense-table">
            <thead>
              <tr>
                <th>相关性</th>
                {(payload?.correlation_matrix || []).slice(0, 4).map((row) => <th key={row.symbol}>{row.symbol}</th>)}
              </tr>
            </thead>
            <tbody>
              {(payload?.correlation_matrix || []).slice(0, 4).map((row) => (
                <tr key={row.symbol}>
                  <td>{row.symbol}</td>
                  {(payload?.correlation_matrix || []).slice(0, 4).map((col) => (
                    <td key={col.symbol}>{row.correlations[col.symbol] == null ? "-" : row.correlations[col.symbol]?.toFixed(2)}</td>
                  ))}
                </tr>
              ))}
              {(payload?.correlation_matrix || []).length === 0 && <tr><td colSpan={2}>暂无相关性矩阵</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="data-table-wrap">
        <table className="data-table compact-table dense-table">
          <thead>
            <tr>
              <th>股票</th>
              <th>市场</th>
              <th>数量</th>
              <th>成本暴露</th>
              <th>权重</th>
            </tr>
          </thead>
          <tbody>
            {(payload?.positions || []).map((row) => (
              <tr key={row.symbol}>
                <td>{row.symbol}</td>
                <td>{row.market}</td>
                <td>{row.quantity.toFixed(0)}</td>
                <td>{formatMoney(row.cost)}</td>
                <td>{formatPercent(row.weight)}</td>
              </tr>
            ))}
            {(payload?.positions || []).length === 0 && (
              <tr><td colSpan={5}>暂无开放持仓，组合风险将随组合回测或交易日志生成。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong></div>;
}
