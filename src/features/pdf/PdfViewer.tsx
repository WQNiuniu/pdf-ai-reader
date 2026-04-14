import { useEffect, useRef, useState } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { buildPageContext } from "./pdfContextExtractor";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

type Props = {
  filePath: string;
  onPageChange: (page: number) => void;
  onContextChange: (context: string) => void;
};

export function PdfViewer({ filePath, onPageChange, onContextChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!filePath) return;
    let canceled = false;
    (async () => {
      try {
        const bytes = await readFile(filePath);
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        if (canceled) return;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageIndex(1);
        onPageChange(1);

        const texts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          texts.push(text.items.map((item: any) => item.str).join(" "));
        }
        if (canceled) return;
        setPageTexts(texts);
        setError("");
      } catch (e) {
        setPdfDoc(null);
        setError(String(e));
      }
    })();
    return () => {
      canceled = true;
    };
  }, [filePath, onPageChange]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let canceled = false;
    (async () => {
      try {
        const page = await pdfDoc.getPage(pageIndex);
        if (canceled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: zoom / 100 });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch (e) {
        setError(String(e));
      }
    })();
    return () => {
      canceled = true;
    };
  }, [pdfDoc, pageIndex, zoom]);

  useEffect(() => {
    // 翻页后回到页首；缩放时保留当前位置以便连续阅读。
    if (frameRef.current) {
      frameRef.current.scrollTop = 0;
    }
  }, [pageIndex]);

  useEffect(() => {
    onPageChange(pageIndex);
    const context = buildPageContext(pageTexts, pageIndex);
    onContextChange(context);
  }, [onContextChange, onPageChange, pageIndex, pageTexts]);

  const canPrev = pageIndex > 1;
  const canNext = pageIndex < numPages;

  if (!filePath) return <div className="panel-body">请选择左侧 PDF 文件开始阅读。</div>;

  return (
    <div className="panel-body">
      <div className="panel-header">
        <span>PDF 阅读</span>
        <div className="viewer-actions">
          <button disabled={!canPrev} onClick={() => setPageIndex((p) => Math.max(1, p - 1))}>
            上一页
          </button>
          <span>
            {pageIndex}/{numPages || "-"}
          </span>
          <button
            disabled={!canNext}
            onClick={() => setPageIndex((p) => Math.min(numPages || 1, p + 1))}
          >
            下一页
          </button>
          <button onClick={() => setZoom((v) => Math.max(50, v - 10))}>-</button>
          <span>{zoom}%</span>
          <button onClick={() => setZoom((v) => Math.min(200, v + 10))}>+</button>
        </div>
      </div>
      {error && <div className="error-text">{error}</div>}
      <div className="pdf-frame" ref={frameRef}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
