import { AiConfig, ChatMessage } from "../../app/types";

export function resolveChatEndpoint(baseUrl: string): string {
  const input = baseUrl.trim();
  if (!input) return input;
  const normalized = input.replace(/\/+$/, "");
  if (/(\/chat\/completions|\/responses)$/i.test(normalized)) {
    return normalized;
  }
  if (/\/v\d+$/i.test(normalized)) {
    return `${normalized}/chat/completions`;
  }
  return `${normalized}/chat/completions`;
}

export async function askAi(
  config: AiConfig,
  messages: ChatMessage[],
  context: string,
  currentPage: number
): Promise<string> {
  if (!config.apiKey.trim()) throw new Error("请先在 AI 设置中填写 API Key。");
  const systemPrompt = [
    "你是 PDF 阅读助手，只能根据提供的文档上下文回答问题。",
    "如果上下文不足，请明确说明无法确认，不要编造。",
    "回答尽量附带来源页码。"
  ].join("\n");
  const payload = {
    model: config.model,
    temperature: config.temperature,
    messages: [
      { role: "system", content: `${systemPrompt}\n\n当前页: ${currentPage}` },
      { role: "system", content: `文档上下文:\n${context || "（当前无可用文本）"}` },
      ...messages
    ]
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let resp: Response;
  const endpoint = resolveChatEndpoint(config.baseUrl);
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("AI 请求超时，请稍后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    throw new Error(`AI 请求失败(${endpoint}): ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? "模型没有返回有效内容。";
}
