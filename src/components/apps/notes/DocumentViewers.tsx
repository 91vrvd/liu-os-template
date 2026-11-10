import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clipboard, Download, Expand, RotateCw, Search, ZoomIn, ZoomOut } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PptxViewer as PptxViewerInstance, SearchHighlightHandle } from '@aiden0z/pptx-renderer';
import { getBlob, LocalDocument } from '../../../lib/documentStore';

type CommonLabels = {
  loading: string;
  previewUnavailable: string;
  previous: string;
  next: string;
  zoomIn: string;
  zoomOut: string;
  search: string;
  copy: string;
  fullscreen: string;
  download: string;
  rotate: string;
};

const countMatches = (text: string, query: string) => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return 0;
  return text.toLocaleLowerCase().split(normalized).length - 1;
};

export const DocxPreview: React.FC<{
  blobId?: string;
  content?: string;
  labels: CommonLabels;
}> = ({ blobId, content, labels }) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        if (!blobId || !bodyRef.current || !styleRef.current) throw new Error('docx-blob-missing');
        const blob = await getBlob(blobId);
        if (!blob) throw new Error('docx-blob-not-found');
        const { renderAsync } = await import('docx-preview');
        bodyRef.current.replaceChildren();
        styleRef.current.replaceChildren();
        await renderAsync(blob, bodyRef.current, styleRef.current, {
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          renderComments: false,
          renderAltChunks: false,
          useBase64URL: false,
          experimental: false,
        });
        if (active) setLoading(false);
      } catch {
        if (active) {
          setLoading(false);
          setError(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [blobId]);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    root.querySelectorAll('.liu-doc-search-hit').forEach((element) => element.classList.remove('liu-doc-search-hit'));
    const normalized = query.trim().toLocaleLowerCase();
    const allText = root.textContent ?? content ?? '';
    setMatches(countMatches(allText, normalized));
    if (!normalized) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if ((node.textContent ?? '').toLocaleLowerCase().includes(normalized)) {
        const parent = node.parentElement;
        parent?.classList.add('liu-doc-search-hit');
        parent?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        break;
      }
      node = walker.nextNode();
    }
  }, [content, query]);

  const copyText = () => {
    const text = bodyRef.current?.textContent ?? content ?? '';
    void navigator.clipboard?.writeText(text);
  };

  return <div className="flex min-h-0 flex-1 flex-col bg-slate-100/80 dark:bg-black/20">
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/85 px-3 py-2 dark:border-white/10 dark:bg-[#242426]">
      <label className="flex min-w-40 flex-1 items-center gap-2 rounded-md bg-slate-100 px-2 py-1.5 text-xs text-slate-500 dark:bg-white/10 dark:text-slate-300">
        <Search size={14} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="min-w-0 flex-1 bg-transparent outline-none" />
        {query && <span className="tabular-nums text-[10px] text-slate-400">{matches}</span>}
      </label>
      <button type="button" onClick={copyText} title={labels.copy} aria-label={labels.copy} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><Clipboard size={15} /></button>
      <button type="button" onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))} title={labels.zoomOut} aria-label={labels.zoomOut} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><ZoomOut size={15} /></button>
      <span className="w-10 text-center text-[11px] tabular-nums text-slate-400">{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))} title={labels.zoomIn} aria-label={labels.zoomIn} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><ZoomIn size={15} /></button>
    </div>
    <div ref={styleRef} className="hidden" />
    <div className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-6">
      <div className="liu-docx-preview mx-auto transition-transform" style={{ zoom } as React.CSSProperties} ref={bodyRef} />
      {loading && <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">{labels.loading}</span>}
      {error && <span className="absolute inset-0 flex items-center justify-center text-sm text-amber-600">{labels.previewUnavailable}</span>}
    </div>
  </div>;
};

const PptxThumbnail: React.FC<{ viewer: PptxViewerInstance; index: number; active: boolean; onClick: () => void }> = ({ viewer, index, active, onClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    ref.current.replaceChildren();
    const handle = viewer.renderThumbnailToContainer(index, ref.current, { width: 132 });
    return () => handle?.dispose();
  }, [index, viewer]);
  return <button type="button" onClick={onClick} className={`w-full rounded-md border p-1 text-left transition ${active ? 'border-blue-500 bg-blue-50 dark:bg-blue-400/10' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5'}`}>
    <div ref={ref} className="aspect-video w-full overflow-hidden rounded-sm bg-white" />
    <span className="mt-1 block text-center text-[10px] tabular-nums text-slate-400">{index + 1}</span>
  </button>;
};

export const PptxPreview: React.FC<{ blobId?: string; labels: CommonLabels & { slide: string; noSlides: string } }> = ({ blobId, labels }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PptxViewerInstance | null>(null);
  const highlightRef = useRef<SearchHighlightHandle | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const [viewer, setViewer] = useState<PptxViewerInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        if (!blobId || !canvasRef.current) throw new Error('pptx-blob-missing');
        const blob = await getBlob(blobId);
        if (!blob) throw new Error('pptx-blob-not-found');
        const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import('@aiden0z/pptx-renderer/browser');
        canvasRef.current.replaceChildren();
        const instance = await PptxViewer.open(await blob.arrayBuffer(), canvasRef.current, {
          renderMode: 'slide',
          fitMode: 'contain',
          zoomPercent: 100,
          zipLimits: RECOMMENDED_ZIP_LIMITS,
          lazyMedia: true,
          lazySlides: true,
          pdfjs: false,
          signal: abortController.signal,
          onSlideChange: (index) => {
            if (active) setCurrent(index);
          },
        });
        if (!active) {
          instance.destroy();
          return;
        }
        viewerRef.current = instance;
        setViewer(instance);
        setTotal(instance.slideCount);
        setCurrent(instance.currentSlideIndex);
        setLoading(false);
      } catch (loadError) {
        if (active && !(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setLoading(false);
          setError(true);
        }
      }
    })();
    return () => {
      active = false;
      abortController.abort();
      highlightRef.current?.dispose();
      highlightRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      setViewer(null);
    };
  }, [blobId]);

  const goTo = (index: number) => {
    if (!viewer) return;
    const next = Math.max(0, Math.min(total - 1, index));
    void viewer.goToSlide(next).then(() => setCurrent(next));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowLeft') goTo(current - 1);
      if (event.key === 'ArrowRight') goTo(current + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const applySearch = async () => {
    if (!viewer) return;
    highlightRef.current?.dispose();
    highlightRef.current = null;
    viewer.clearSearchHighlights();
    const matches = query.trim() ? viewer.searchText(query.trim()) : [];
    setMatchCount(matches.length);
    if (!matches[0]) return;
    goTo(matches[0].slideIndex);
    highlightRef.current = await viewer.highlightSearchResult(matches[0], { borderColor: '#0a84ff', backgroundColor: 'rgba(10,132,255,.14)' });
  };

  const setViewerZoom = (next: number) => {
    const normalized = Math.max(50, Math.min(180, next));
    setZoom(normalized);
    void viewer?.setZoom(normalized);
  };

  const touchEnd = (clientX: number) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (start === null || Math.abs(start - clientX) < 48) return;
    goTo(start > clientX ? current + 1 : current - 1);
  };

  return <div ref={wrapperRef} className="flex min-h-0 flex-1 flex-col bg-slate-100/80 dark:bg-black/20">
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/85 px-3 py-2 dark:border-white/10 dark:bg-[#242426]">
      <label className="flex min-w-36 flex-1 items-center gap-2 rounded-md bg-slate-100 px-2 py-1.5 text-xs text-slate-500 dark:bg-white/10 dark:text-slate-300">
        <Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void applySearch(); }} placeholder={labels.search} className="min-w-0 flex-1 bg-transparent outline-none" />
        {query && <span className="text-[10px] tabular-nums text-slate-400">{matchCount}</span>}
      </label>
      <button type="button" onClick={() => setViewerZoom(zoom - 10)} title={labels.zoomOut} aria-label={labels.zoomOut} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><ZoomOut size={15} /></button>
      <span className="w-10 text-center text-[11px] tabular-nums text-slate-400">{zoom}%</span>
      <button type="button" onClick={() => setViewerZoom(zoom + 10)} title={labels.zoomIn} aria-label={labels.zoomIn} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><ZoomIn size={15} /></button>
      <button type="button" onClick={() => void wrapperRef.current?.requestFullscreen()} title={labels.fullscreen} aria-label={labels.fullscreen} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><Expand size={15} /></button>
    </div>
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
      {viewer && total > 0 && <aside className="hidden w-36 shrink-0 space-y-2 overflow-y-auto pr-1 sm:block">
        {Array.from({ length: total }, (_, index) => <PptxThumbnail key={index} viewer={viewer} index={index} active={index === current} onClick={() => goTo(index)} />)}
      </aside>}
      <div className="relative flex min-w-0 flex-1 flex-col items-center gap-2 overflow-hidden">
        <div onTouchStart={(event) => { touchStartRef.current = event.changedTouches[0]?.clientX ?? null; }} onTouchEnd={(event) => touchEnd(event.changedTouches[0]?.clientX ?? 0)} ref={canvasRef} className="liu-pptx-preview flex min-h-52 w-full flex-1 items-center justify-center overflow-auto rounded-lg bg-white shadow-sm dark:bg-[#171719]" />
        {loading && <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">{labels.loading}</span>}
        {error && <span className="absolute inset-0 flex items-center justify-center text-sm text-amber-600">{labels.previewUnavailable}</span>}
        {!loading && !error && total === 0 && <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">{labels.noSlides}</span>}
        {total > 0 && <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500 dark:text-slate-300">
          <button type="button" aria-label={labels.previous} disabled={current <= 0} onClick={() => goTo(current - 1)} className="rounded-md p-1.5 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-white/10"><ChevronLeft size={16} /></button>
          <span className="tabular-nums">{labels.slide} {current + 1} / {total}</span>
          <button type="button" aria-label={labels.next} disabled={current >= total - 1} onClick={() => goTo(current + 1)} className="rounded-md p-1.5 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-white/10"><ChevronRight size={16} /></button>
        </div>}
      </div>
    </div>
  </div>;
};

const spreadsheetColumn = (index: number) => {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
};

export const SheetPreview: React.FC<{ document: LocalDocument; labels: CommonLabels & { sheet: string; row: string; noResults: string } }> = ({ document, labels }) => {
  const sheets = useMemo(() => document.previewData?.type === 'sheets' ? document.previewData.sheets ?? [] : [], [document.previewData]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const rows = useMemo(() => sheets[activeSheet]?.rows ?? [], [activeSheet, sheets]);
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return rows.map((row, index) => ({ row, index })).filter(({ row }) => !normalized || row.some((cell) => cell.toLocaleLowerCase().includes(normalized)));
  }, [query, rows]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const columnCount = Math.max(1, ...rows.map((row) => row.length));

  useEffect(() => setPage(1), [activeSheet, query]);

  return <div className="flex min-h-0 flex-1 flex-col bg-slate-100/70 dark:bg-black/20">
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/85 px-3 py-2 dark:border-white/10 dark:bg-[#242426]">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">{sheets.map((sheet, index) => <button type="button" key={sheet.name} onClick={() => setActiveSheet(index)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs ${index === activeSheet ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300'}`}>{labels.sheet} · {sheet.name}</button>)}</div>
      <label className="flex w-44 items-center gap-2 rounded-md bg-slate-100 px-2 py-1.5 text-xs text-slate-500 dark:bg-white/10 dark:text-slate-300"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="min-w-0 flex-1 bg-transparent outline-none" /></label>
    </div>
    <div className="min-h-0 flex-1 overflow-auto p-3">
      {visibleRows.length ? <div className="min-w-max overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#242426]">
        <table className="border-collapse text-xs">
          <thead className="sticky top-0 z-20 bg-slate-100 text-slate-500 dark:bg-[#333336] dark:text-slate-300"><tr><th className="sticky left-0 z-30 h-8 min-w-12 border-b border-r border-slate-200 bg-slate-100 px-2 dark:border-white/10 dark:bg-[#333336]" />{Array.from({ length: columnCount }, (_, index) => <th key={index} className="h-8 min-w-28 border-b border-r border-slate-200 px-3 text-center font-medium dark:border-white/10">{spreadsheetColumn(index)}</th>)}</tr></thead>
          <tbody>{visibleRows.map(({ row, index }) => <tr key={index} className="hover:bg-blue-50/60 dark:hover:bg-blue-400/5"><th className="sticky left-0 z-10 w-12 border-b border-r border-slate-200 bg-slate-100 px-2 text-center font-normal text-slate-400 dark:border-white/10 dark:bg-[#333336]">{index + 1}</th>{Array.from({ length: columnCount }, (_, cellIndex) => <td key={cellIndex} className="max-w-72 border-b border-r border-slate-200 px-3 py-2 align-top dark:border-white/10"><span className="block max-h-16 overflow-hidden whitespace-pre-wrap break-words">{row[cellIndex] ?? ''}</span></td>)}</tr>)}</tbody>
        </table>
      </div> : <div className="flex h-full items-center justify-center text-sm text-slate-400">{labels.noResults}</div>}
    </div>
    {filteredRows.length > pageSize && <div className="flex shrink-0 items-center justify-center gap-3 border-t border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-[#242426] dark:text-slate-300"><button type="button" aria-label={labels.previous} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"><ChevronLeft size={15} /></button><span className="tabular-nums">{page} / {pageCount} · {filteredRows.length} {labels.row}</span><button type="button" aria-label={labels.next} disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"><ChevronRight size={15} /></button></div>}
  </div>;
};

export const PdfPreview: React.FC<{ blobId?: string; labels: CommonLabels & { page: (page: number, total: number) => string; noResults: string } }> = ({ blobId, labels }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scale, setScale] = useState(1.2);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<number[]>([]);

  useEffect(() => {
    let active = true;
    let loadedPdf: PDFDocumentProxy | null = null;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        if (!blobId) throw new Error('pdf-blob-missing');
        const blob = await getBlob(blobId);
        if (!blob) throw new Error('pdf-blob-not-found');
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        loadedPdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
        if (!active) return;
        setPdf(loadedPdf);
        setTotal(loadedPdf.numPages);
        setPage(1);
      } catch {
        if (active) {
          setLoading(false);
          setError(true);
        }
      }
    })();
    return () => {
      active = false;
      if (loadedPdf) void loadedPdf.cleanup();
    };
  }, [blobId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!pdf || !canvasRef.current) return;
        setLoading(true);
        const pdfPage = await pdf.getPage(Math.min(page, pdf.numPages));
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pdfPage.getViewport({ scale: scale * pixelRatio });
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('pdf-canvas-unavailable');
        await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
        if (active) setLoading(false);
      } catch {
        if (active) {
          setLoading(false);
          setError(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [page, pdf, scale]);

  const searchPdf = async () => {
    if (!pdf || !query.trim()) {
      setMatches([]);
      return;
    }
    const normalized = query.trim().toLocaleLowerCase();
    const pages: number[] = [];
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const pdfPage = await pdf.getPage(index);
      const content = await pdfPage.getTextContent();
      const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').toLocaleLowerCase();
      if (text.includes(normalized)) pages.push(index);
    }
    setMatches(pages);
    if (pages[0]) setPage(pages[0]);
  };

  return <div ref={wrapperRef} className="flex min-h-0 flex-1 flex-col bg-slate-100/70 dark:bg-black/20">
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/85 px-3 py-2 dark:border-white/10 dark:bg-[#242426]">
      <label className="flex min-w-36 flex-1 items-center gap-2 rounded-md bg-slate-100 px-2 py-1.5 text-xs text-slate-500 dark:bg-white/10 dark:text-slate-300"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchPdf(); }} placeholder={labels.search} className="min-w-0 flex-1 bg-transparent outline-none" />{query && <span className="text-[10px] tabular-nums text-slate-400">{matches.length}</span>}</label>
      <button type="button" onClick={() => setScale((value) => Math.max(0.6, value - 0.2))} title={labels.zoomOut} aria-label={labels.zoomOut} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><ZoomOut size={15} /></button>
      <span className="w-10 text-center text-[11px] tabular-nums text-slate-400">{Math.round(scale * 100)}%</span>
      <button type="button" onClick={() => setScale((value) => Math.min(2.4, value + 0.2))} title={labels.zoomIn} aria-label={labels.zoomIn} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><ZoomIn size={15} /></button>
      <button type="button" onClick={() => void wrapperRef.current?.requestFullscreen()} title={labels.fullscreen} aria-label={labels.fullscreen} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><Expand size={15} /></button>
      {total > 0 && <div className="ml-1 flex items-center gap-1 border-l border-slate-200 pl-2 dark:border-white/10"><button type="button" aria-label={labels.previous} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"><ChevronLeft size={15} /></button><span className="min-w-12 text-center text-[11px] tabular-nums text-slate-400">{labels.page(page, total)}</span><button type="button" aria-label={labels.next} disabled={page >= total} onClick={() => setPage((value) => Math.min(total, value + 1))} className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"><ChevronRight size={15} /></button></div>}
    </div>
    <div className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto p-3"><canvas ref={canvasRef} className="max-w-full bg-white shadow-sm" />{loading && <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">{labels.loading}</span>}{error && <span className="absolute inset-0 flex items-center justify-center text-sm text-amber-600">{labels.previewUnavailable}</span>}</div>
  </div>;
};

export const ImagePreview: React.FC<{ blobId?: string; alt: string; labels: CommonLabels }> = ({ blobId, alt, labels }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    let active = true;
    let nextUrl: string | null = null;
    setLoading(true);
    void (async () => {
      const blob = blobId ? await getBlob(blobId) : null;
      if (!active || !blob) return;
      let safeBlob = blob;
      if (blob.type === 'image/svg+xml' || alt.toLocaleLowerCase().endsWith('.svg')) {
        const DOMPurify = (await import('dompurify')).default;
        const sanitized = DOMPurify.sanitize(await blob.text(), { USE_PROFILES: { svg: true, svgFilters: true } });
        safeBlob = new Blob([sanitized], { type: 'image/svg+xml' });
      }
      nextUrl = URL.createObjectURL(safeBlob);
      if (active) {
        setUrl(nextUrl);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [alt, blobId]);

  const download = () => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = alt;
    link.click();
  };

  return <div className="flex min-h-0 flex-1 flex-col bg-slate-100/70 dark:bg-black/20">
    <div className="flex shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white/85 px-3 py-2 dark:border-white/10 dark:bg-[#242426]">
      <button type="button" onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))} title={labels.zoomOut} aria-label={labels.zoomOut} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><ZoomOut size={15} /></button><span className="w-10 text-center text-[11px] tabular-nums text-slate-400">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(4, value + 0.25))} title={labels.zoomIn} aria-label={labels.zoomIn} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><ZoomIn size={15} /></button><button type="button" onClick={() => setRotation((value) => (value + 90) % 360)} title={labels.rotate} aria-label={labels.rotate} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><RotateCw size={15} /></button><button type="button" onClick={download} title={labels.download} aria-label={labels.download} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><Download size={15} /></button>
    </div>
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">{url && <img src={url} alt={alt} style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} className="max-h-full max-w-full object-contain transition-transform duration-200" />}{loading && <span className="absolute text-sm text-slate-400">{labels.loading}</span>}{!loading && !url && <span className="absolute text-sm text-amber-600">{labels.previewUnavailable}</span>}</div>
  </div>;
};
