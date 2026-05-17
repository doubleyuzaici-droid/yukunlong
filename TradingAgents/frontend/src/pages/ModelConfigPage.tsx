import { FormEvent, useEffect, useMemo, useState } from "react";
import { DataTrustPanel } from "../components/DataTrustPanel";

interface ProviderConfig {
  provider: string;
  display_name?: string;
  default_quick_model?: string | null;
  default_deep_model?: string | null;
  base_url?: string | null;
  api_key_mask?: string | null;
  enabled: boolean;
  updated_at?: string | null;
}

interface LLMConfigPayload {
  provider_catalog: Record<string, { quick: [string, string][]; deep: [string, string][]; known_models: string[] }>;
  provider_configs: ProviderConfig[];
  env_readiness: Record<string, { env?: string | null; configured: boolean; api_key_mask?: string | null }>;
}

const PROVIDERS = ["openai", "anthropic", "google", "deepseek", "qwen", "glm", "xai", "openrouter", "azure", "ollama"];

export default function ModelConfigPage() {
  const [payload, setPayload] = useState<LLMConfigPayload | null>(null);
  const [provider, setProvider] = useState("openai");
  const [displayName, setDisplayName] = useState("OpenAI Primary");
  const [quickModel, setQuickModel] = useState("gpt-5.4-mini");
  const [deepModel, setDeepModel] = useState("gpt-5.4");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState("");

  const selectedCatalog = payload?.provider_catalog[provider];
  const modelOptions = useMemo(() => {
    const values = new Set<string>();
    selectedCatalog?.quick.forEach(([, value]) => values.add(value));
    selectedCatalog?.deep.forEach(([, value]) => values.add(value));
    return [...values];
  }, [selectedCatalog]);

  const load = async () => {
    const response = await fetch("/api/config/llm");
    const data = await response.json();
    if (data.success) setPayload(data.data);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/config/llm/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        display_name: displayName,
        default_quick_model: quickModel,
        default_deep_model: deepModel,
        base_url: baseUrl || null,
        api_key: apiKey || null,
        enabled,
      }),
    });
    const data = await response.json();
    setMessage(data.success ? "配置已保存，密钥仅以脱敏状态回显" : "保存失败");
    setApiKey("");
    await load();
  };

  const validate = async () => {
    const response = await fetch("/api/config/llm/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model: deepModel }),
    });
    const data = await response.json();
    setMessage(data.success ? `模型校验：${data.data.model_known ? "目录内模型" : "自定义/未知模型"}` : "校验失败");
  };

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>模型配置中心</h1>
        <p>集中维护 LLM 厂家、默认模型、Base URL 和密钥就绪状态；页面永不回显明文密钥。</p>
      </div>
      <form className="toolbar stacked" onSubmit={save}>
        <select value={provider} onChange={(event) => setProvider(event.target.value)}>
          {PROVIDERS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="显示名称" />
        <input value={quickModel} onChange={(event) => setQuickModel(event.target.value)} placeholder="快速模型" />
        <input value={deepModel} onChange={(event) => setDeepModel(event.target.value)} placeholder="深度模型" />
        <input className="wide-input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="Base URL，可留空" />
        <input className="wide-input" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="API Key，仅存脱敏标记" />
        <label className="inline-check">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          启用
        </label>
        <button className="primary">保存配置</button>
        <button type="button" onClick={validate}>校验模型</button>
        <span className="muted">{message}</span>
      </form>
      <DataTrustPanel
        compact
        title="模型配置可信度"
        summary="模型页只显示脱敏密钥状态和模型目录校验，避免把未知模型误判为不可用。"
        items={[
          { label: "Provider", value: provider },
          { label: "快速模型", value: quickModel },
          { label: "深度模型", value: deepModel },
          { label: "启用状态", value: enabled ? "启用" : "停用", tone: enabled ? "good" : "warn" },
          { label: "环境可用", value: payload?.env_readiness[provider]?.configured ? "可用" : "未配置", tone: payload?.env_readiness[provider]?.configured ? "good" : "warn" },
          { label: "密钥回显", value: "仅脱敏" },
        ]}
        warnings={!payload?.env_readiness[provider]?.configured ? [`${provider} 环境变量或本地配置未就绪`] : []}
        disclaimer="页面不会回显明文 API Key；自定义模型需通过实际调用校验。"
      />
      <div className="context-grid">
        <div className="detail-panel">
          <div className="section-subhead">
            <h2>环境就绪</h2>
            <span className="muted">按 provider 环境变量检查</span>
          </div>
          <div className="factor-metric-grid">
            {Object.entries(payload?.env_readiness || {}).map(([name, row]) => (
              <div className="mini-metric" key={name}>
                <span>{name}</span>
                <strong>{row.configured ? "可用" : "未配置"}</strong>
                <small>{row.env || "本地服务"} · {row.api_key_mask || "-"}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="detail-panel">
          <div className="section-subhead">
            <h2>模型目录</h2>
            <span className="muted">{provider}</span>
          </div>
          <div className="factor-driver-list">
            {modelOptions.map((model) => <span key={model}>{model}</span>)}
            {modelOptions.length === 0 && <span>支持自定义模型 ID</span>}
          </div>
        </div>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>默认模型</th>
              <th>Base URL</th>
              <th>密钥</th>
              <th>状态</th>
              <th>更新</th>
            </tr>
          </thead>
          <tbody>
            {(payload?.provider_configs || []).map((row) => (
              <tr key={row.provider}>
                <td>{row.display_name || row.provider}<br /><span className="muted">{row.provider}</span></td>
                <td>{row.default_quick_model || "-"}<br /><span className="muted">{row.default_deep_model || "-"}</span></td>
                <td>{row.base_url || "默认"}</td>
                <td>{row.api_key_mask || "使用环境变量或未配置"}</td>
                <td><span className={row.enabled ? "status-badge" : "status-badge muted-badge"}>{row.enabled ? "启用" : "停用"}</span></td>
                <td>{row.updated_at || "-"}</td>
              </tr>
            ))}
            {(payload?.provider_configs || []).length === 0 && (
              <tr><td colSpan={6}>暂无本地模型配置，仍可使用环境变量。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
