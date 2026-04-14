import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { FileTree } from "../features/explorer/FileTree";
import { PdfViewer } from "../features/pdf/PdfViewer";
import { ChatPanel } from "../features/chat/ChatPanel";
import { ProviderSettings } from "../features/settings/ProviderSettings";
import { AiConfig, ChatMessage } from "./types";

const defaultAiConfig: AiConfig = {
  baseUrl: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.2
};

export function AppShell() {
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(360);
  const [rootPath, setRootPath] = useState<string>("");
  const [currentPdfPath, setCurrentPdfPath] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pdfContext, setPdfContext] = useState<string>("");
  const [chatMap, setChatMap] = useState<Record<string, ChatMessage[]>>({});
  const [aiConfig, setAiConfig] = useState<AiConfig>(defaultAiConfig);
  const [showSettings, setShowSettings] = useState(false);

  const title = useMemo(() => {
    if (!currentPdfPath) return "PDF AI Reader";
    return currentPdfPath.split(/[\\/]/).pop() ?? "PDF AI Reader";
  }, [currentPdfPath]);

  const currentMessages = useMemo(() => {
    if (!currentPdfPath) return [];
    return chatMap[currentPdfPath] ?? [];
  }, [chatMap, currentPdfPath]);

  const updateCurrentMessages = (nextMessages: ChatMessage[]) => {
    if (!currentPdfPath) return;
    setChatMap((prev) => ({ ...prev, [currentPdfPath]: nextMessages }));
  };

  const startDrag = (side: "left" | "right") => (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startLeft = leftWidth;
    const startRight = rightWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      if (side === "left") {
        setLeftWidth(Math.min(420, Math.max(220, startLeft + delta)));
      } else {
        setRightWidth(Math.min(520, Math.max(280, startRight - delta)));
      }
    };
    const stop = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
  };

  useEffect(() => {
    // 避免触发 WebView 全局缩放（会让右侧 AI 面板也变大）。
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      if (event.key === "+" || event.key === "-" || event.key === "=" || event.key === "0") {
        event.preventDefault();
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="title">{title}</div>
        <div className="topbar-actions">
          <button onClick={() => setShowSettings((v) => !v)}>AI 设置</button>
        </div>
      </header>
      <main
        className="main-grid"
        style={{
          gridTemplateColumns: `${leftWidth}px 4px minmax(480px, 1fr) 4px ${rightWidth}px`
        }}
      >
        <aside className="panel panel-left">
          <FileTree
            rootPath={rootPath}
            onRootChange={setRootPath}
            onOpenPdf={setCurrentPdfPath}
            activePdf={currentPdfPath}
          />
        </aside>
        <div className="splitter" onMouseDown={startDrag("left")} />
        <section className="panel panel-center">
          <PdfViewer
            filePath={currentPdfPath}
            onPageChange={setCurrentPage}
            onContextChange={setPdfContext}
          />
        </section>
        <div className="splitter" onMouseDown={startDrag("right")} />
        <aside className="panel panel-right">
          <ChatPanel
            filePath={currentPdfPath}
            currentPage={currentPage}
            pdfContext={pdfContext}
            messages={currentMessages}
            onMessagesChange={updateCurrentMessages}
            aiConfig={aiConfig}
          />
        </aside>
      </main>
      {showSettings && (
        <ProviderSettings
          value={aiConfig}
          onChange={setAiConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
