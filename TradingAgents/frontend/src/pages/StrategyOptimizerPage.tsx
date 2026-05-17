import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { recordAuditEvent } from "../utils/audit";
import { formatMoney, formatNumber, formatPercent } from "../utils/formatters";

const today = new Date().toISOString().slice(0, 10);
const defaultSweepStart = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

interface OptimizerPayload {
  candidate_yaml?: string;
  markdown?: string;
  summary?: Record<string, unknown>[];
  failures?: Record<string, unknown>[];
  ablation_steps?: Record<string, unknown>[];
  walk_forward_periods?: Record<string, unknown>[];
}

interface CandidateRow {
  candidate_id: string;
  name: string;
  candidate_yaml: string;
  status: string;
  created_at?: string;
  applied_at?: string | null;
}

interface SweepResultRow {
  params: Record<string, string | number | boolean>;
  metrics: Record<string, number>;
  score?: number;
}

interface WalkForwardFold {
  period: {
    train_start: string;
    train_end: string;
    test_start: string;
    test_end: string;
  };
  best_params: Record<string, string | number | boolean>;
  oos: {
    metrics?: Record<string, number>;
    trades?: unknown[];
  };
}

interface OptimizerSweepPayload {
  start: string;
  end: string;
  grid: Record<string, (string | number | boolean)[]>;
  score_key: string;
  sweep_results: SweepResultRow[];
  best?: SweepResultRow | null;
  walk_forward?: {
    fold_count: number;
    folds: WalkForwardFold[];
  };
  overfit_diagnostics?: {
    score_key: string;
    best_in_sample_score?: number | null;
    oos_score_mean?: number | null;
    score_degradation?: number | null;
    positive_oos_rate?: number | null;
    fold_count: number;
    verdict: string;
    warning: string;
  };
}

export default function StrategyOptimizerPage() {
  const [data, setData] = useState<OptimizerPayload | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [sweep, setSweep] = useState<OptimizerSweepPayload | null>(null);
  const [sweepStart, setSweepStart] = useState(defaultSweepStart);
  const [sweepEnd, setSweepEnd] = useState(today);
  const [sweepFolds, setSweepFolds] = useState(3);
  const [scoreKey, setScoreKey] = useState("sharpe");
  const [sweepGridJson, setSweepGridJson] = useState('{"holding_days":[5,20,60]}');
  const [sweepLoading, setSweepLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const response = await fetch("/api/research/optimizer");
    const result = await response.json();
    if (result.success) {
      setData(result.data);
      setMessage("诊断已生成");
    }
  };

  const loadCandidates = async () => {
    const response = await fetch("/api/research/optimizer/candidates");
    const result = await response.json();
    if (result.success) setCandidates(result.data.candidates);
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const saveCandidate = async () => {
    if (!data?.candidate_yaml) return;
    const response = await fetch("/api/research/optimizer/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `candidate_${new Date().toISOString().slice(0, 10)}`,
        candidate_yaml: data.candidate_yaml,
      }),
    });
    const result = await response.json();
    setMessage(result.success ? "候选策略已保存" : "保存失败");
    await loadCandidates();
  };

  const runSweep = async () => {
    setSweepLoading(true);
    setMessage("");
    try {
      const grid = JSON.parse(sweepGridJson);
      if (!grid || typeof grid !== "object" || Array.isArray(grid)) {
        throw new Error("参数网格必须是 JSON object");
      }
      const response = await fetch("/api/research/optimizer/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: sweepStart,
          end: sweepEnd,
          grid,
          folds: sweepFolds,
          score_key: scoreKey,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setSweep(result.data);
        setMessage(`参数扫描完成：${result.data.sweep_results?.length || 0} 组`);
      } else {
        setMessage(result.error || "参数扫描失败");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "参数网格解析失败");
    }
    setSweepLoading(false);
  };

  const applyCandidate = async (candidateId: string) => {
    if (!window.confirm("确认应用该候选策略？当前 active_strategy.yml 会被替换，建议先完成回测验证。")) {
      return;
    }
    const response = await fetch(`/api/research/optimizer/candidates/${candidateId}/apply`, {
      method: "POST",
    });
    const result = await response.json();
    if (result.success) recordAuditEvent("apply_strategy_candidate", candidateId, "active_strategy.yml updated");
    setMessage(result.success ? "候选策略已应用" : "应用失败");
    await loadCandidates();
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>策略调优</h1>
        <p>读取回测表现，生成候选配置，所有候选都需要人工确认。</p>
      </div>
      <div className="toolbar">
        <button className="primary" onClick={load}>生成诊断</button>
        <button onClick={saveCandidate} disabled={!data?.candidate_yaml}>保存候选</button>
        <button onClick={loadCandidates}>刷新候选</button>
        <span className="muted">{message}</span>
      </div>
      <div className="section-subhead">
        <h2>真实参数扫描</h2>
        <span className="muted">组合回测 + Walk Forward 验证</span>
      </div>
      <div className="sweep-control-grid">
        <input type="date" value={sweepStart} onChange={(event) => setSweepStart(event.target.value)} />
        <input type="date" value={sweepEnd} onChange={(event) => setSweepEnd(event.target.value)} />
        <select value={scoreKey} onChange={(event) => setScoreKey(event.target.value)}>
          <option value="sharpe">Sharpe</option>
          <option value="total_return">总收益</option>
          <option value="calmar">Calmar</option>
          <option value="sortino">Sortino</option>
        </select>
        <input
          type="number"
          min={1}
          max={5}
          value={sweepFolds}
          onChange={(event) => setSweepFolds(Number(event.target.value))}
        />
        <textarea
          value={sweepGridJson}
          onChange={(event) => setSweepGridJson(event.target.value)}
          spellCheck={false}
        />
        <button className="primary" onClick={runSweep} disabled={sweepLoading}>
          {sweepLoading ? "扫描中" : "运行扫描"}
        </button>
      </div>
      {sweep && <OptimizerSweepPanel sweep={sweep} />}
      {data ? (
        <div className="review-layout">
          <div className="pipeline-summary">
            <Metric label="信号摘要" value={String(data.summary?.length || 0)} />
            <Metric label="失败原因" value={String(data.failures?.length || 0)} />
            <Metric label="消融步骤" value={String(data.ablation_steps?.length || 0)} />
            <Metric label="Walk Forward" value={String(data.walk_forward_periods?.length || 0)} />
          </div>
          <OptimizerDiagnosticsGrid data={data} />
          <div className="split-grid">
            <div className="markdown-panel">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {data.markdown || "暂无诊断摘要。"}
              </ReactMarkdown>
            </div>
            <pre className="code-panel">{data.candidate_yaml || "暂无候选配置。"}</pre>
          </div>
        </div>
      ) : (
        <div className="empty-state block">等待诊断。</div>
      )}
      <div className="section-subhead">
        <h2>候选策略</h2>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>状态</th>
              <th>创建</th>
              <th>应用</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.candidate_id}>
                <td>{candidate.name}<br /><span className="muted">{candidate.candidate_id.slice(0, 8)}</span></td>
                <td><span className="status-badge">{candidate.status}</span></td>
                <td>{candidate.created_at || "-"}</td>
                <td>{candidate.applied_at || "-"}</td>
                <td>
                  <button className="mini" onClick={() => applyCandidate(candidate.candidate_id)}>
                    应用
                  </button>
                </td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={5}>暂无候选策略</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OptimizerSweepPanel({ sweep }: { sweep: OptimizerSweepPayload }) {
  const best = sweep.best;
  return (
    <div className="review-layout">
      <div className="pipeline-summary">
        <Metric label="参数组合" value={String(sweep.sweep_results.length)} />
        <Metric label="评分字段" value={sweep.score_key} />
        <Metric label="最佳评分" value={formatNumber(best?.score, 2)} />
        <Metric label="OOS 折数" value={String(sweep.walk_forward?.fold_count || 0)} />
        <Metric label="过拟合诊断" value={sweep.overfit_diagnostics?.verdict || "-"} />
        <Metric label="OOS 均分" value={formatNumber(sweep.overfit_diagnostics?.oos_score_mean, 2)} />
      </div>
      {sweep.overfit_diagnostics && (
        <div className="detail-panel strategy-disclosure-card">
          <div>
            <span className="eyebrow">Overfit Guard</span>
            <h2>{sweep.overfit_diagnostics.warning}</h2>
            <p>
              样本内 {formatNumber(sweep.overfit_diagnostics.best_in_sample_score, 2)} ·
              折外均值 {formatNumber(sweep.overfit_diagnostics.oos_score_mean, 2)} ·
              衰减 {formatPercent(sweep.overfit_diagnostics.score_degradation)} ·
              正收益折数 {formatPercent(sweep.overfit_diagnostics.positive_oos_rate)}
            </p>
          </div>
        </div>
      )}
      {best && (
        <div className="detail-panel">
          <div className="detail-header">
            <div>
              <span className="eyebrow">Best Candidate</span>
              <h2>{formatParams(best.params)}</h2>
              <p>
                总收益 {formatPercent(best.metrics.total_return)} · 回撤{" "}
                {formatPercent(best.metrics.max_drawdown)} · Sharpe {formatNumber(best.metrics.sharpe, 2)}
              </p>
            </div>
            <span className="status-badge">{sweep.start} ~ {sweep.end}</span>
          </div>
        </div>
      )}
      <div className="sweep-result-grid">
        <div className="data-table-wrap">
          <table className="data-table compact-table dense-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>参数</th>
                <th>评分</th>
                <th>收益</th>
                <th>回撤</th>
                <th>最终权益</th>
              </tr>
            </thead>
            <tbody>
              {sweep.sweep_results.map((row, index) => (
                <tr key={`${formatParams(row.params)}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{formatParams(row.params)}</td>
                  <td>{formatNumber(row.score, 2)}</td>
                  <td>{formatPercent(row.metrics.total_return)}</td>
                  <td>{formatPercent(row.metrics.max_drawdown)}</td>
                  <td>{formatMoney(row.metrics.final_equity)}</td>
                </tr>
              ))}
              {sweep.sweep_results.length === 0 && (
                <tr>
                  <td colSpan={6}>暂无扫描结果</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="list-panel compact-list">
          <h2>Walk-forward 折外验证</h2>
          {(sweep.walk_forward?.folds || []).map((fold, index) => (
            <p key={`${fold.period.test_start}-${index}`}>
              <strong>
                {fold.period.train_start} ~ {fold.period.train_end}
              </strong>
              <span>
                验证 {fold.period.test_start} ~ {fold.period.test_end} · {formatParams(fold.best_params)}
              </span>
              <span>
                OOS {formatPercent(fold.oos.metrics?.total_return)} / Sharpe{" "}
                {formatNumber(fold.oos.metrics?.sharpe, 2)} / 交易 {fold.oos.trades?.length || 0}
              </span>
            </p>
          ))}
          {(sweep.walk_forward?.folds || []).length === 0 && <p className="empty-state">暂无折外验证</p>}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatParams(params: Record<string, string | number | boolean>) {
  const entries = Object.entries(params);
  if (entries.length === 0) return "-";
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(" · ");
}

function OptimizerDiagnosticsGrid({ data }: { data: OptimizerPayload }) {
  return (
    <div className="optimizer-grid">
      <div className="list-panel compact-list">
        <h2>失败原因聚合</h2>
        {(data.failures || []).slice(0, 6).map((row, index) => (
          <p key={index}>
            <strong>{String(row.fail_reason || row.reason || row.signal_name || "unknown")}</strong>
            <span>{String(row.count || row.sample_count || "-")} 样本</span>
          </p>
        ))}
        {(data.failures || []).length === 0 && <p className="empty-state">暂无失败原因</p>}
      </div>
      <div className="list-panel compact-list">
        <h2>消融对比</h2>
        {(data.ablation_steps || []).slice(0, 6).map((row, index) => (
          <p key={index}>
            <strong>{String(row.step || row.name || `step_${index + 1}`)}</strong>
            <span>{String(row.description || row.expected_effect || row.note || "-")}</span>
          </p>
        ))}
        {(data.ablation_steps || []).length === 0 && <p className="empty-state">暂无消融步骤</p>}
      </div>
      <div className="list-panel compact-list">
        <h2>Walk-forward 区间</h2>
        {(data.walk_forward_periods || []).slice(0, 6).map((row, index) => (
          <p key={index}>
            <strong>{String(row.train_start || row.start || "-")} ~ {String(row.train_end || row.end || "-")}</strong>
            <span>验证 {String(row.test_start || row.validation_start || "-")} ~ {String(row.test_end || row.validation_end || "-")}</span>
          </p>
        ))}
        {(data.walk_forward_periods || []).length === 0 && <p className="empty-state">暂无 walk-forward</p>}
      </div>
      <div className="list-panel compact-list">
        <h2>参数扫描建议</h2>
        {["score_threshold", "holding_days", "atr_stop", "max_position_pct"].map((name, index) => (
          <p key={name}>
            <strong>{name}</strong>
            <span>{index === 0 ? "按信号胜率分层提高阈值" : index === 1 ? "用 10/20/40 日持有期交叉验证" : index === 2 ? "比较 1.5/2/2.5 ATR 止损" : "按回撤贡献限制单票仓位"}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
