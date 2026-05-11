import { FormEvent, useEffect, useState } from "react";

interface WatchlistItem {
  symbol: string;
  market: string;
  industry?: string | null;
  thesis?: string | null;
  status: string;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [symbols, setSymbols] = useState("00700.HK 600519.SH");
  const [market, setMarket] = useState("");
  const [industry, setIndustry] = useState("");
  const [thesis, setThesis] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const response = await fetch("/api/research/watchlist");
    const data = await response.json();
    if (data.success) setItems(data.data);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const parsed = symbols.split(/[\s,，]+/).filter(Boolean);
    const response = await fetch("/api/research/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbols: parsed,
        market: market || undefined,
        industry: industry || undefined,
        thesis: thesis || undefined,
      }),
    });
    const data = await response.json();
    if (data.success) {
      setItems(data.data);
      setMessage(`已更新 ${parsed.length} 个标的`);
    } else {
      setMessage("更新失败");
    }
    setLoading(false);
  };

  const remove = async (symbol: string) => {
    setMessage("");
    const response = await fetch(
      `/api/research/watchlist/${encodeURIComponent(symbol)}`,
      { method: "DELETE" },
    );
    const data = await response.json();
    if (data.success) {
      setItems(data.data);
      setMessage(`${symbol} 已移出观察池`);
    } else {
      setMessage("移除失败");
    }
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>自选股池</h1>
        <p>维护 A/H 研究范围，供每日扫描、复盘和回测共用。</p>
      </div>
      <form className="toolbar stacked" onSubmit={submit}>
        <input
          className="wide-input"
          value={symbols}
          onChange={(event) => setSymbols(event.target.value)}
          placeholder="00700.HK 1024.HK 600519.SH"
        />
        <select value={market} onChange={(event) => setMarket(event.target.value)}>
          <option value="">自动识别市场</option>
          <option value="CHINA">A 股</option>
          <option value="HONGKONG">港股</option>
        </select>
        <input
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          placeholder="行业"
        />
        <input
          className="wide-input"
          value={thesis}
          onChange={(event) => setThesis(event.target.value)}
          placeholder="关注逻辑"
        />
        <button className="primary" disabled={loading}>
          {loading ? "处理中" : "添加"}
        </button>
        <span className="muted">{message}</span>
      </form>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>股票</th>
              <th>市场</th>
              <th>行业</th>
              <th>关注逻辑</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.symbol}>
                <td>{item.symbol}</td>
                <td>{item.market}</td>
                <td>{item.industry || "-"}</td>
                <td>{item.thesis || "-"}</td>
                <td>{item.status}</td>
                <td>
                  <button className="danger mini" onClick={() => remove(item.symbol)}>
                    移除
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6}>暂无自选股</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
