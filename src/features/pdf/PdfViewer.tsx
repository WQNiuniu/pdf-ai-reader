import { useEffect, useMemo, useRef, useState } from "react";
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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pageWrapRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pageCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const renderedZoomRef = useRef<Record<number, number>>({});
  const activeRendersRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map());
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [jumpTo, setJumpTo] = useState<string>("");
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [pageBaseSizes, setPageBaseSizes] = useState<Record<number, { width: number; height: number }>>({});
  const [visiblePages, setVisiblePages] = useState<number[]>([]);
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
        setJumpTo("1");
        renderedZoomRef.current = {};

        const texts: string[] = [];
        const baseSizes: Record<number, { width: number; height: number }> = {};
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          baseSizes[i] = { width: viewport.width, height: viewport.height };
          const text = await page.getTextContent();
          texts.push(text.items.map((item: any) => item.str).join(" "));
        }
        if (canceled) return;
        setPageTexts(texts);
        setPageBaseSizes(baseSizes);
        setVisiblePages([1]);
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

  const pagesToRender = useMemo(() => {
    const set = new Set<number>();
    // 始终预渲染当前页附近页面，保证翻页和滚动顺滑。
    for (let p = pageIndex - 2; p <= pageIndex + 2; p += 1) {
      if (p >= 1 && p <= numPages) set.add(p);
    }
    for (const p of visiblePages) {
      for (let k = p - 1; k <= p + 1; k += 1) {
        if (k >= 1 && k <= numPages) set.add(k);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [numPages, pageIndex, visiblePages]);

  useEffect(() => {
    if (!pdfDoc) return;
    if (!pagesToRender.length) return;
    let canceled = false;
    (async () => {
      try {
        setError("");
        const scale = zoom / 100;
        const dpr = window.devicePixelRatio || 1;
        for (const pageNum of pagesToRender) {
          if (canceled) return;
          if (renderedZoomRef.current[pageNum] === zoom) continue;
          const canvas = pageCanvasRefs.current[pageNum];
          if (!canvas) continue;
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: scale * dpr });
          const context = canvas.getContext("2d");
          if (!context) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const baseSize = pageBaseSizes[pageNum] || { width: viewport.width / (scale * dpr), height: viewport.height / (scale * dpr) };
          canvas.style.width = `${baseSize.width * scale}px`;
          canvas.style.height = `${baseSize.height * scale}px`;
          // 取消该页面可能存在的旧渲染任务，避免同一 canvas 并发渲染
          const oldTask = activeRendersRef.current.get(pageNum);
          if (oldTask) {
            try { oldTask.cancel(); } catch {}
            activeRendersRef.current.delete(pageNum);
          }
          const renderTask = page.render({ canvasContext: context, viewport });
          activeRendersRef.current.set(pageNum, renderTask);
          try {
            await renderTask.promise;
            if (!canceled) renderedZoomRef.current[pageNum] = zoom;
          } catch (e: any) {
            // 取消操作抛出的 AbortException 是正常行为，忽略
            if (e?.name !== "AbortException") throw e;
          }
          activeRendersRef.current.delete(pageNum);
        }
      } catch (e) {
        if (!canceled) setError(String(e));
      }
    })();
    return () => {
      canceled = true;
      // 取消所有正在进行的渲染任务
      for (const task of activeRendersRef.current.values()) {
        try { task.cancel(); } catch {}
      }
      activeRendersRef.current.clear();
    };
  }, [pdfDoc, pagesToRender, zoom]);

  useEffect(() => {
    if (!frameRef.current) return;
    if (!numPages) return;
    const root = frameRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        // 选择在视区内占比最大的页作为当前页
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => ({
            page: Number((e.target as HTMLElement).dataset.page || "0"),
            ratio: e.intersectionRatio
          }))
          .filter((v) => v.page >= 1);
        if (!visible.length) return;
        setVisiblePages(visible.map((v) => v.page));
        visible.sort((a, b) => b.ratio - a.ratio);
        const next = visible[0]?.page;
        if (next && next !== pageIndex) {
          setPageIndex(next);
        }
      },
      { root, threshold: [0.25, 0.5, 0.75] }
    );
    for (let p = 1; p <= numPages; p += 1) {
      const el = pageWrapRefs.current[p];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, filePath]);

  useEffect(() => {
    // 当前页变化时同步页码输入框（滚动触发也会更新）
    if (pageIndex >= 1) setJumpTo(String(pageIndex));
  }, [pageIndex]);

  useEffect(() => {
    onPageChange(pageIndex);
    const context = buildPageContext(pageTexts, pageIndex);
    onContextChange(context);
  }, [onContextChange, onPageChange, pageIndex, pageTexts]);

  const scrollToPage = (page: number) => {
    const el = pageWrapRefs.current[page];
    if (el) {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  const canPrev = pageIndex > 1;
  const canNext = pageIndex < numPages;
  const pageList = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);
  const scaledPageSize = (p: number) => {
    const base = pageBaseSizes[p];
    if (!base) return { width: 760, height: 980 };
    const scale = zoom / 100;
    return {
      width: Math.round(base.width * scale),
      height: Math.round(base.height * scale)
    };
  };

  if (!filePath) return <div className="panel-body">请选择左侧 PDF 文件开始阅读。</div>;

  return (
    <div className="panel-body">
      <div className="panel-header">
        <span>PDF 阅读</span>
        <div className="viewer-actions">
          <button
            disabled={!canPrev}
            onClick={() => {
              const next = Math.max(1, pageIndex - 1);
              scrollToPage(next);
              setPageIndex(next);
            }}
          >
            上一页
          </button>
          <span>
            {pageIndex}/{numPages || "-"}
          </span>
          <button
            disabled={!canNext}
            onClick={() => {
              const next = Math.min(numPages || 1, pageIndex + 1);
              scrollToPage(next);
              setPageIndex(next);
            }}
          >
            下一页
          </button>
          <input
            className="page-jump"
            value={jumpTo}
            onChange={(e) => setJumpTo(e.target.value)}
            placeholder="页码"
            inputMode="numeric"
          />
          <button
            onClick={() => {
              const n = Number(jumpTo);
              if (!Number.isFinite(n)) return;
              const target = Math.min(Math.max(1, Math.trunc(n)), numPages || 1);
              scrollToPage(target);
              setPageIndex(target);
              setJumpTo(String(target));
            }}
            disabled={!numPages}
          >
            跳转
          </button>
          <button onClick={() => setZoom((v) => Math.max(50, v - 10))}>-</button>
          <span>{zoom}%</span>
          <button onClick={() => setZoom((v) => Math.min(200, v + 10))}>+</button>
        </div>
      </div>
      {error && <div className="error-text">{error}</div>}
      <div className="pdf-frame" ref={frameRef}>
        <div className="pdf-pages">
          {pageList.map((p) => (
            <div
              key={p}
              className={`pdf-page ${p === pageIndex ? "active" : ""}`}
              data-page={p}
              ref={(el) => {
                pageWrapRefs.current[p] = el;
              }}
            >
              <div className="pdf-page-label">Page {p}</div>
              <canvas
                style={scaledPageSize(p)}
                ref={(el) => {
                  pageCanvasRefs.current[p] = el;
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
