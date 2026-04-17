import { useEffect, useState } from "react";
import { load } from "@tauri-apps/plugin-store";
import { AiConfig } from "../../app/types";
import { resolveChatEndpoint } from "../chat/aiClient";

const fallbackStorageKey = "pdf-ai-reader.aiConfig";
let storePromise: Promise<Awaited<ReturnType<typeof load>>> | null = null;

async function getStore() {
  storePromise ??= load("settings.json");
  return storePromise;
}

type Props = {
  value: AiConfig;
  onChange: (value: AiConfig) => void;
  onClose: () => void;
};

export function ProviderSettings({ value, onChange, onClose }: Props) {
  const [draft, setDraft] = useState<AiConfig>(value);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const store = await getStore();
        const saved = await store.get<AiConfig>("aiConfig");
        if (cancelled) return;
        if (saved) {
          setDraft(saved);
          onChange(saved);
          return;
        }
      } catch {
        // Tauri Store 不可用时回退到 localStorage。
      }
      try {
        const raw = localStorage.getItem(fallbackStorageKey);
        if (!raw) return;
        const saved = JSON.parse(raw) as AiConfig;
        if (cancelled) return;
        setDraft(saved);
        onChange(saved);
      } catch {
        // ignore bad local data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onChange]);

  const save = async () => {
    if (!draft.baseUrl.trim() || !draft.model.trim()) {
      setStatus("请填写 Base URL 和 Model。");
      return;
    }
    setSaving(true);
    setStatus("");
    let savedByStore = false;
    try {
      const store = await getStore();
      await store.set("aiConfig", draft);
      await store.save();
      savedByStore = true;
    } catch {
      savedByStore = false;
    }
    try {
      localStorage.setItem(fallbackStorageKey, JSON.stringify(draft));
    } catch {
      // ignore localStorage failure
    }
    onChange(draft);
    setSaving(false);
    setStatus(savedByStore ? "保存成功。" : "已保存（回退模式）。");
    setTimeout(() => onClose(), 200);
  };

  const testConnection = async () => {
    if (!draft.baseUrl.trim() || !draft.model.trim() || !draft.apiKey.trim()) {
      setStatus("测试前请填写 Base URL、Model 和 API Key。");
      return;
    }
    setTesting(true);
    setStatus("正在测试连接...");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const payload = {
        model: draft.model,
        temperature: draft.temperature,
        messages: [{ role: "user", content: "Reply with OK only." }],
        max_tokens: 8
      };
      const endpoint = resolveChatEndpoint(draft.baseUrl);
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${draft.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status} (${endpoint}): ${text || resp.statusText}`);
      }
      setStatus("连接测试成功。");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setStatus("连接测试超时（15s）。");
      } else {
        setStatus(`连接测试失败：${String(error)}`);
      }
    } finally {
      clearTimeout(timer);
      setTesting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>AI Provider 设置</h3>
        <label>
          Base URL
          <input
            value={draft.baseUrl}
            onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
          />
        </label>
        <label>
          API Key
          <input
            value={draft.apiKey}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            type="password"
          />
        </label>
        <label>
          Model
          <input
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          />
        </label>
        <label>
          Temperature
          <input
            value={draft.temperature}
            onChange={(e) =>
              setDraft({
                ...draft,
                temperature: Number(e.target.value) || 0
              })
            }
            type="number"
            min={0}
            max={2}
            step={0.1}
          />
        </label>
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button onClick={testConnection} disabled={saving || testing}>
            {testing ? "测试中..." : "测试连接"}
          </button>
          <button onClick={save} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
        {status && <div className="panel-subtitle">{status}</div>}
      </div>
    </div>
  );
}
