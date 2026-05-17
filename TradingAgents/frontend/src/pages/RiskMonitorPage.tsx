import { useEffect, useMemo, useState } from "react";
import type { MarketPulsePayload, MarketQuote } from "../types/market";
import { formatSignedPercent } from "../utils/formatters";
import { type AuditEvent, listAuditEvents } from "../utils/audit";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface AlertRow {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  target: string;
  detail: string;
}

export default function RiskMonitorPage({
  onOpenSymbol,
}: {
  onOpenSymbol?: (symbol: string) => void;
}) {
  const [pulse, setPulse] = useState<MarketPulsePayload | null>(null);
  const [qualityIssues, setQualityIssues] = useState<Record<string, unknown>[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [message, setMessage] = useState("读取中");

  const load = async () => {
    setMessage("刷新监控");
    const [pulseResponse, qualityResponse] = await Promise.all([
      fetch("/api/market/pulse"),
      fetch("/api/research/data-quality"),
    ]);
    const pulsePayload = (await pulseResponse.json()) as ApiResponse<MarketPulsePayload>;
    const qualityPayload = await qualityResponse.json();
    if (pulsePayload.success) setPulse(pulsePayload.data);
    if (qualityPayload.success) setQualityIssues(qualityPayload.data);
    setAuditEvents(listAuditEvents());
    setMessage("监控已刷新");
  };

  useEffect(() => {
    load();
  }, []);

  const alerts = useMemo(() => buildAlerts(pulse?.quotes || [], qualityIssues), [pulse, qualityIssues]);
  const criticalCount = alerts.filter((alert) => alert.severity === "critical").length;
  const warningCount = alerts.filter((alert) => alert.severity === "warning").length;

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>告警中心</h1>
        <p>聚合行情过期、缺失数据、异常波动和关键人工操作，用于日常投研巡检。</p>
      </div>
      <div className="toolbar">
        <button className="primary" onClick={load}>刷新监控</button>
        <span className="muted">{message}</span>
      </div>
      <div className="pipeline-summary">
        <Metric label="严重告警" value={String(criticalCount)} />
        <Metric label="风险提示" value={String(warningCount)} />
        <Metric label="数据质量问题" value={String(qualityIssues.length)} />
        <Metric label="审计事件" value={String(auditEvents.length)} />
      </div>
      <div className="split-grid">
        <div className="list-panel alert-list">
          <h2>实时告警</h2>
          {alerts.map((alert) => (
            <button
              className={`alert-row ${alert.severity}`}
              key={alert.id}
              onClick={() => onOpenSymbol?.(alert.target)}
            >
              <strong>{alert.title}</strong>
              <span>{alert.target}</span>
              <small>{alert.detail}</small>
            </button>
          ))}
          {alerts.length === 0 && <p className="empty-state">暂无告警。</p>}
        </div>
        <div className="data-table-wrap">
          <table className="data-table compact-table dense-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>动作</th>
                <th>对象</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                  <td>{event.action}</td>
                  <td>{event.target || "-"}</td>
                  <td>{event.detail || "-"}</td>
                </tr>
              ))}
              {auditEvents.length === 0 && (
                <tr>
                  <td colSpan={4}>暂无本地审计事件</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function buildAlerts(quotes: MarketQuote[], qualityIssues: Record<string, unknown>[]): AlertRow[] {
  const alerts: AlertRow[] = [];
  const pushAlert = (alert: Omit<AlertRow, "id">) => {
    const id = `${alert.severity}-${alert.title}-${alert.target}-${alert.detail}`;
    if (alerts.some((item) => item.id === id)) return;
    alerts.push({ ...alert, id });
  };
  quotes.forEach((quote) => {
    if (quote.status !== "ok") {
      pushAlert({
        severity: "critical",
        title: "行情缺失",
        target: quote.symbol,
        detail: quote.status_text || "本地研究库暂无行情",
      });
    }
    if ((quote.data_age_days || 0) > 5) {
      pushAlert({
        severity: "critical",
        title: "行情陈旧",
        target: quote.symbol,
        detail: quote.freshness_text || "数据超过 5 天未更新",
      });
    } else if ((quote.data_age_days || 0) > 1) {
      pushAlert({
        severity: "warning",
        title: "行情延迟",
        target: quote.symbol,
        detail: quote.freshness_text || "非最近交易日",
      });
    }
    if (Math.abs(quote.change_pct || 0) >= 0.03) {
      pushAlert({
        severity: "info",
        title: "大幅波动",
        target: quote.symbol,
        detail: formatSignedPercent(quote.change_pct),
      });
    }
  });
  qualityIssues.slice(0, 12).forEach((issue) => {
    pushAlert({
      severity: String(issue.severity || "").includes("error") ? "critical" : "warning",
      title: String(issue.check_name || "数据质量"),
      target: String(issue.symbol || "-"),
      detail: String(issue.message || "数据质量问题待处理"),
    });
  });
  return alerts;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
