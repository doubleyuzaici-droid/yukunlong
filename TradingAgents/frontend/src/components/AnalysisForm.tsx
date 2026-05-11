import { useState, FormEvent, useEffect, useRef } from "react";

const STORAGE_KEY = "tradingagents_config";

function loadConfig(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveConfig(config: Record<string, unknown>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

const MARKET_OPTIONS = [
  { value: "us", label: "🇺🇸 美股" },
  { value: "china", label: "🇨🇳 A股" },
  { value: "hongkong", label: "🇭🇰 港股" },
];

const DEPTH_OPTIONS = [
  { value: "shallow", label: "快速" },
  { value: "medium", label: "标准" },
  { value: "deep", label: "深度" },
];

const ANALYST_OPTIONS = [
  { value: "market", label: "市场技术面" },
  { value: "fundamentals", label: "基本面" },
  { value: "news", label: "新闻" },
  { value: "social", label: "社交媒体" },
  { value: "sec_filings", label: "SEC文件(美股)" },
];

const LLM_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "xai", label: "xAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "通义千问" },
  { value: "glm", label: "智谱GLM" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "azure", label: "Azure OpenAI" },
  { value: "ollama", label: "Ollama(本地)" },
];

const LANG_OPTIONS = [
  "English", "Simplified Chinese", "Japanese", "Korean",
  "Hindi", "Spanish", "Portuguese", "French", "German", "Arabic", "Russian",
];

interface Props {
  onStart: (taskId: string, ticker: string, tradeDate: string) => void;
}

export default function AnalysisForm({ onStart }: Props) {
  const [loading, setLoading] = useState(false);
  const [ticker, setTicker] = useState("NVDA");
  const today = new Date().toISOString().slice(0, 10);
  const [tradeDate, setTradeDate] = useState(today);
  const [market, setMarket] = useState("us");
  const [depth, setDepth] = useState("medium");
  const [analysts, setAnalysts] = useState(["market", "fundamentals", "news", "social"]);
  const [llmProvider, setLlmProvider] = useState("openai");
  const [deepModel, setDeepModel] = useState("gpt-5.4");
  const [quickModel, setQuickModel] = useState("gpt-5.4-mini");
  const [backendUrl, setBackendUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [outputLang, setOutputLang] = useState("English");
  const [openaiEffort, setOpenaiEffort] = useState("medium");
  const [anthropicEffort, setAnthropicEffort] = useState("high");
  const [googleThinking, setGoogleThinking] = useState("high");
  const [deepseekThinking, setDeepseekThinking] = useState("enabled");
  const [deepseekEffort, setDeepseekEffort] = useState("medium");

  // Restore saved config on mount
  useEffect(() => {
    const saved = loadConfig();
    if (saved.ticker) setTicker(saved.ticker as string);
    if (saved.market) setMarket(saved.market as string);
    if (saved.depth) setDepth(saved.depth as string);
    if (saved.llmProvider) setLlmProvider(saved.llmProvider as string);
    if (saved.deepModel) setDeepModel(saved.deepModel as string);
    if (saved.quickModel) setQuickModel(saved.quickModel as string);
    if (saved.backendUrl) setBackendUrl(saved.backendUrl as string);
    if (saved.apiKey) setApiKey(saved.apiKey as string);
    if (saved.outputLang) setOutputLang(saved.outputLang as string);
    if (saved.openaiEffort) setOpenaiEffort(saved.openaiEffort as string);
    if (saved.anthropicEffort) setAnthropicEffort(saved.anthropicEffort as string);
    if (saved.googleThinking) setGoogleThinking(saved.googleThinking as string);
    if (saved.deepseekThinking) setDeepseekThinking(saved.deepseekThinking as string);
    if (saved.deepseekEffort) setDeepseekEffort(saved.deepseekEffort as string);
  }, []);

  // Save config on every change, but skip the very first render
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    saveConfig({
      ticker, market, depth,
      llmProvider, deepModel, quickModel, backendUrl, apiKey, outputLang,
      openaiEffort, anthropicEffort, googleThinking, deepseekThinking, deepseekEffort,
    });
  }, [ticker, market, depth,
      llmProvider, deepModel, quickModel, backendUrl, apiKey, outputLang,
      openaiEffort, anthropicEffort, googleThinking, deepseekThinking, deepseekEffort]);

  const toggleAnalyst = (value: string) => {
    setAnalysts((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        ticker,
        trade_date: tradeDate,
        market_profile: market,
        research_depth: depth,
        selected_analysts: analysts,
        llm_provider: llmProvider,
        deep_think_llm: deepModel,
        quick_think_llm: quickModel,
        backend_url: backendUrl || null,
        api_key: apiKey || null,
        output_language: outputLang,
      };
      if (llmProvider === "openai") body.openai_reasoning_effort = openaiEffort;
      if (llmProvider === "anthropic") body.anthropic_effort = anthropicEffort;
      if (llmProvider === "google") body.google_thinking_level = googleThinking;
      if (llmProvider === "deepseek") {
        body.deepseek_thinking = deepseekThinking;
        body.openai_reasoning_effort = deepseekEffort;
      }

      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (data.success) {
        onStart(data.data.task_id, ticker, tradeDate);
      } else {
        alert("Failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Network error: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 680,
        margin: "0 auto",
        padding: "32px 24px",
        overflow: "auto",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>新建分析</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 14 }}>
        配置分析参数，启动多智能体金融交易分析流程
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label>股票代码</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="NVDA / 600519.SH / 00700.HK"
              required
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label>交易日期</label>
            <input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              required
              style={{ width: "100%", colorScheme: "dark" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label>市场</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              style={{ width: "100%" }}
            >
              {MARKET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>研究深度</label>
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
              {DEPTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDepth(opt.value)}
                  style={{
                    flex: 1,
                    background: depth === opt.value ? "var(--accent-green)" : "var(--bg-tertiary)",
                    borderColor: depth === opt.value ? "var(--accent-green)" : "var(--border-color)",
                    color: depth === opt.value ? "#fff" : "var(--text-primary)",
                    padding: "7px 10px",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label>分析师选择</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {ANALYST_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleAnalyst(opt.value)}
                style={{
                  background: analysts.includes(opt.value)
                    ? "var(--accent-green)"
                    : "var(--bg-tertiary)",
                  borderColor: analysts.includes(opt.value)
                    ? "var(--accent-green)"
                    : "var(--border-color)",
                  color: analysts.includes(opt.value) ? "#fff" : "var(--text-primary)",
                  padding: "6px 14px",
                  fontSize: 13,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label>LLM 供应商</label>
          <select
            value={llmProvider}
            onChange={(e) => setLlmProvider(e.target.value)}
            style={{ width: "100%" }}
          >
            {LLM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label>深度推理模型</label>
            <input
              value={deepModel}
              onChange={(e) => setDeepModel(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label>快速推理模型</label>
            <input
              value={quickModel}
              onChange={(e) => setQuickModel(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* OpenAI Reasoning Effort */}
        {llmProvider === "openai" && (
          <div>
            <label>推理力度 (Reasoning Effort)</label>
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
              {[
                { value: "low", label: "低" },
                { value: "medium", label: "中" },
                { value: "high", label: "高" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOpenaiEffort(opt.value)}
                  style={{
                    flex: 1,
                    background: openaiEffort === opt.value ? "var(--accent-green)" : "var(--bg-tertiary)",
                    borderColor: openaiEffort === opt.value ? "var(--accent-green)" : "var(--border-color)",
                    color: openaiEffort === opt.value ? "#fff" : "var(--text-primary)",
                    padding: "7px 10px",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Anthropic Effort */}
        {llmProvider === "anthropic" && (
          <div>
            <label>推理深度 (Effort)</label>
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
              {[
                { value: "low", label: "低 (快速)" },
                { value: "medium", label: "中 (均衡)" },
                { value: "high", label: "高 (推荐)" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAnthropicEffort(opt.value)}
                  style={{
                    flex: 1,
                    background: anthropicEffort === opt.value ? "var(--accent-green)" : "var(--bg-tertiary)",
                    borderColor: anthropicEffort === opt.value ? "var(--accent-green)" : "var(--border-color)",
                    color: anthropicEffort === opt.value ? "#fff" : "var(--text-primary)",
                    padding: "7px 10px",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Google Thinking Level */}
        {llmProvider === "google" && (
          <div>
            <label>思考模式 (Thinking Mode)</label>
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
              {[
                { value: "high", label: "启用思考 (推荐)" },
                { value: "minimal", label: "最小化思考" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGoogleThinking(opt.value)}
                  style={{
                    flex: 1,
                    background: googleThinking === opt.value ? "var(--accent-green)" : "var(--bg-tertiary)",
                    borderColor: googleThinking === opt.value ? "var(--accent-green)" : "var(--border-color)",
                    color: googleThinking === opt.value ? "#fff" : "var(--text-primary)",
                    padding: "7px 10px",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DeepSeek Thinking Mode + Reasoning Effort */}
        {llmProvider === "deepseek" && (
          <>
            <div>
              <label>思考模式 (Thinking Mode)</label>
              <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                {[
                  { value: "enabled", label: "启用思考" },
                  { value: "disabled", label: "非思考模式" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDeepseekThinking(opt.value)}
                    style={{
                      flex: 1,
                      background: deepseekThinking === opt.value ? "var(--accent-green)" : "var(--bg-tertiary)",
                      borderColor: deepseekThinking === opt.value ? "var(--accent-green)" : "var(--border-color)",
                      color: deepseekThinking === opt.value ? "#fff" : "var(--text-primary)",
                      padding: "7px 10px",
                      fontSize: 13,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label>推理力度 (Reasoning Effort)</label>
              <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                {[
                  { value: "low", label: "低" },
                  { value: "medium", label: "中" },
                  { value: "high", label: "高" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDeepseekEffort(opt.value)}
                    style={{
                      flex: 1,
                      background: deepseekEffort === opt.value ? "var(--accent-green)" : "var(--bg-tertiary)",
                      borderColor: deepseekEffort === opt.value ? "var(--accent-green)" : "var(--border-color)",
                      color: deepseekEffort === opt.value ? "#fff" : "var(--text-primary)",
                      padding: "7px 10px",
                      fontSize: 13,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* API Key & Base URL */}
        <div style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🔑 认证配置 (可选)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="留空则使用环境变量中的 Key"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label>Base URL (代理地址)</label>
              <input
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="留空使用默认地址"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>

        <div>
          <label>输出语言</label>
          <select
            value={outputLang}
            onChange={(e) => setOutputLang(e.target.value)}
            style={{ width: "100%" }}
          >
            {LANG_OPTIONS.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="primary" disabled={loading} style={{ marginTop: 8, padding: "12px 0", fontSize: 16 }}>
          {loading ? "提交中..." : "开始分析"}
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload();
          }}
          style={{ marginTop: 8, padding: "8px 0", fontSize: 12, color: "var(--text-secondary)", background: "transparent", border: "none" }}
        >
          清除已保存的配置
        </button>
      </form>
    </div>
  );
}
