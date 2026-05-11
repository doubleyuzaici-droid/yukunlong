import { useEffect, useState } from "react";

interface SignalRow {
  signal_id: string;
  symbol: string;
  market: string;
  signal_name: string;
  signal_level: string;
  direction: string;
  score: number;
}

const today = new Date().toISOString().slice(0, 10);
const GROUPS = [
  {
    key: "focus",
    label: "重点观察",
    match: (signal: SignalRow) =>
      signal.direction === "opportunity" && ["S", "A"].includes(signal.signal_level),
  },
  {
    key: "new",
    label: "新增观察",
    match: (signal: SignalRow) =>
      signal.direction === "opportunity" && signal.signal_level === "B",
  },
  {
    key: "pending",
    label: "等待确认",
    match: (signal: SignalRow) =>
      signal.direction === "neutral" ||
      (signal.direction === "opportunity" && signal.signal_level === "C"),
  },
  {
    key: "risk",
    label: "风险升高",
    match: (signal: SignalRow) =>
      signal.direction === "risk" && signal.signal_level !== "D",
  },
  {
    key: "invalid",
    label: "信号失效",
    match: (signal: SignalRow) =>
      signal.direction === "risk" && signal.signal_level === "D",
  },
];

export default function TodaySignalsPage() {
  const [date, setDate] = useState(today);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [message, setMessage] = useState("");

  const load = async (targetDate = date) => {
    const response = await fetch(`/api/signals/today?date=${targetDate}`);
    const data = await response.json();
    if (data.success) setSignals(data.data);
  };

  useEffect(() => {
    load(date);
  }, []);

  const scan = async () => {
    setMessage("扫描中");
    const response = await fetch("/api/signals/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const data = await response.json();
    setMessage(data.success ? `触发 ${data.data.count} 条信号` : "扫描失败");
    await load(date);
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>今日信号</h1>
        <p>规则引擎输出观察、确认、风险和失效信号。</p>
      </div>
      <div className="toolbar">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <button className="primary" onClick={scan}>扫描</button>
        <button onClick={() => load(date)}>刷新</button>
        <span className="muted">{message}</span>
      </div>
      <div className="signal-grid">
        {GROUPS.map((group) => {
          const rows = signals.filter(group.match);
          return (
            <div className="signal-column" key={group.key}>
              <h2>
                {group.label}
                <span>{rows.length}</span>
              </h2>
              {rows.map((signal) => (
              <div className="signal-row" key={signal.signal_id}>
                <div>
                  <strong>{signal.symbol}</strong>
                  <span>{signal.market}</span>
                </div>
                <span>{signal.signal_name}</span>
                <b>{signal.signal_level}</b>
                <small>{Number(signal.score || 0).toFixed(1)}</small>
              </div>
              ))}
              {rows.length === 0 && <p className="empty-state">暂无记录</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
