import { FormEvent, useEffect, useState } from "react";
import { DataTrustPanel } from "../components/DataTrustPanel";
import { formatNumber } from "../utils/formatters";

interface NewsItem {
  news_id: string;
  date: string;
  symbol: string;
  headline: string;
  source?: string | null;
  url?: string | null;
  sentiment?: string | null;
  credibility?: number | null;
  summary?: string | null;
}

interface NewsEvidencePayload {
  symbol: string;
  start: string;
  end: string;
  items: NewsItem[];
  sentiment_distribution: Record<string, number>;
  evidence_quality: {
    item_count: number;
    high_credibility_count: number;
    source_count: number;
  };
}

export default function NewsEvidencePage({
  initialSymbol = "600519.SH",
  initialEnd,
}: {
  initialSymbol?: string;
  initialEnd?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [end, setEnd] = useState(initialEnd || today);
  const [start, setStart] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [payload, setPayload] = useState<NewsEvidencePayload | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSymbol(initialSymbol);
    if (initialEnd) setEnd(initialEnd);
  }, [initialSymbol, initialEnd]);

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    const response = await fetch(
      `/api/professional/news-evidence?${new URLSearchParams({ symbol, start, end }).toString()}`,
    );
    const data = await response.json();
    if (data.success) {
      setPayload(data.data);
      setMessage(`读取 ${data.data.items.length} 条证据`);
    } else {
      setMessage("新闻证据读取失败");
    }
  };

  const syncNews = async () => {
    setMessage("同步新闻证据中");
    const response = await fetch("/api/professional/news-evidence/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: [symbol], start, end, source: "auto" }),
    });
    const data = await response.json();
    setMessage(data.success ? `新闻同步 ${data.data.rows_written} 条` : "新闻同步失败");
    await load();
  };

  useEffect(() => {
    load();
  }, [initialSymbol, initialEnd]);

  const distribution = payload?.sentiment_distribution || {};
  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>新闻舆情证据</h1>
        <p>按来源、可信度、情绪和摘要追踪新闻证据链，用于解释 Agent 新闻/情绪结论。</p>
      </div>
      <form className="toolbar" onSubmit={load}>
        <input value={symbol} onChange={(event) => setSymbol(event.target.value)} />
        <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <button className="primary">读取证据</button>
        <button type="button" onClick={syncNews}>同步新闻</button>
        <span className="muted">{message}</span>
      </form>
      <DataTrustPanel
        compact
        title="新闻证据可信度"
        summary="新闻舆情只展示已同步证据，按来源、可信度和情绪披露；不会自动编造新闻。"
        items={[
          { label: "证据条数", value: String(payload?.evidence_quality.item_count || 0), tone: (payload?.evidence_quality.item_count || 0) > 0 ? "good" : "warn" },
          { label: "高可信证据", value: String(payload?.evidence_quality.high_credibility_count || 0) },
          { label: "来源数量", value: String(payload?.evidence_quality.source_count || 0), tone: (payload?.evidence_quality.source_count || 0) > 1 ? "good" : "neutral" },
          { label: "覆盖区间", value: `${payload?.start || start} ~ ${payload?.end || end}` },
        ]}
        warnings={(payload?.evidence_quality.item_count || 0) === 0 ? ["缺少新闻证据，新闻/情绪 Agent 结论不可审计"] : []}
        disclaimer="新闻情绪仅作为催化和风险解释，需结合价格与成交量反应判断。"
      />
      <div className="pipeline-summary">
        <Metric label="证据数" value={String(payload?.evidence_quality.item_count || 0)} />
        <Metric label="高可信" value={String(payload?.evidence_quality.high_credibility_count || 0)} />
        <Metric label="来源数" value={String(payload?.evidence_quality.source_count || 0)} />
        <Metric label="正/负/中" value={`${distribution.positive || 0} / ${distribution.negative || 0} / ${distribution.neutral || 0}`} />
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>标题</th>
              <th>来源</th>
              <th>情绪</th>
              <th>可信度</th>
              <th>摘要</th>
            </tr>
          </thead>
          <tbody>
            {(payload?.items || []).map((item) => (
              <tr key={item.news_id}>
                <td>{item.date}</td>
                <td>
                  {item.url ? <a className="text-action" href={item.url} target="_blank" rel="noreferrer">{item.headline}</a> : item.headline}
                </td>
                <td>{item.source || "-"}</td>
                <td><span className="status-badge muted-badge">{item.sentiment || "unknown"}</span></td>
                <td>{formatNumber(item.credibility, 2)}</td>
                <td>{item.summary || "-"}</td>
              </tr>
            ))}
            {(payload?.items || []).length === 0 && (
              <tr><td colSpan={6}>暂无新闻证据。请先同步新闻/报告证据，页面不会自动编造新闻。</td></tr>
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
