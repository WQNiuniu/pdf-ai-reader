export type FileNode = {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
};

export type AiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};
