import { useEffect, useState } from "react";
import { Store } from "@tauri-apps/plugin-store";
import { AiConfig } from "../../app/types";

const store = new Store("settings.json");

type Props = {
  value: AiConfig;
  onChange: (value: AiConfig) => void;
  onClose: () => void;
};

export function ProviderSettings({ value, onChange, onClose }: Props) {
  const [draft, setDraft] = useState<AiConfig>(value);

  useEffect(() => {
    store.get<AiConfig>("aiConfig").then((saved) => {
      if (saved) {
        setDraft(saved);
        onChange(saved);
      }
    });
  }, [onChange]);

  const save = async () => {
    await store.set("aiConfig", draft);
    await store.save();
    onChange(draft);
    onClose();
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
          <button onClick={save}>保存</button>
        </div>
      </div>
    </div>
  );
}
