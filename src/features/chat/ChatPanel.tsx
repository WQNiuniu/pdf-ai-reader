import { useState } from "react";
import { AiConfig, ChatMessage } from "../../app/types";
import { askAi } from "./aiClient";

type Props = {
  filePath: string;
  currentPage: number;
  pdfContext: string;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  aiConfig: AiConfig;
};

export function ChatPanel({
  filePath,
  currentPage,
  pdfContext,
  messages,
  onMessagesChange,
  aiConfig
}: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!input.trim() || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: input.trim() }];
    onMessagesChange(nextMessages);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const answer = await askAi(aiConfig, nextMessages, pdfContext, currentPage);
      onMessagesChange([...nextMessages, { role: "assistant", content: answer }]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel-body">
      <div className="panel-header">
        <span>AI 对话</span>
        <span className="panel-subtitle">{filePath ? "文档已加载" : "未打开 PDF"}</span>
      </div>
      <div className="chat-list">
        {messages.map((msg, index) => (
          <div key={index} className={`chat-item ${msg.role}`}>
            <div className="chat-role">{msg.role}</div>
            <div>{msg.content}</div>
          </div>
        ))}
      </div>
      {error && <div className="error-text">{error}</div>}
      <div className="chat-input-wrap">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="向当前 PDF 提问..."
        />
        <button onClick={send} disabled={loading || !filePath}>
          {loading ? "发送中..." : "发送"}
        </button>
      </div>
    </div>
  );
}
