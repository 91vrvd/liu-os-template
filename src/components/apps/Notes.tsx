import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Download, Eye, FileDown, Pin, PinOff, FileImage, FilePlus2, FileSpreadsheet, FileText, FolderOpen, Import, Paperclip, Pencil, Presentation, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { useI18n, TranslationKey } from '../../i18n';
import { useStore } from '../../store/useStore';
import { exportDocx, exportHtml, exportJson, exportPdf, exportPptx, exportXlsx } from '../../lib/documentExports';
import { parseLocalFile, toDocument } from '../../lib/documentParsers';
import { createEmptyNote, deleteBlob, deleteDocument, DocumentAttachment, DocumentKind, FileSupportStatus, getBlob, hasDocumentStorageCapacity, listDocuments, LocalDocument, makeBlobId, loadDocuments, saveBlob, saveDocument } from '../../lib/documentStore';
import { recordBlobDownload } from '../../lib/downloadManager';
import { DocxPreview, ImagePreview, PdfPreview, PptxPreview, SheetPreview } from './notes/DocumentViewers';

type FilterKind = DocumentKind | 'all';
type ImportResult = { fileName: string; success: boolean; error?: string };

const MAX_FILES_PER_IMPORT = 12;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_IMPORT_BYTES = 120 * 1024 * 1024;

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (timestamp: number, language: 'zh' | 'en') => new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp);
const safeFilename = (value: string, fallback: string) => Array.from(value).filter((character) => (character.codePointAt(0) ?? 0) >= 32).join('').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || fallback;

const kindLabelKey: Record<FilterKind, TranslationKey> = {
  all: 'notes.allDocuments',
  note: 'notes.title',
  text: 'notes.documents',
  markdown: 'notes.documents',
  word: 'notes.word',
  presentation: 'notes.presentation',
  spreadsheet: 'notes.spreadsheet',
  pdf: 'notes.pdf',
  image: 'notes.image',
  other: 'notes.other',
};

const supportLabelKey: Record<FileSupportStatus, TranslationKey> = {
  editable: 'notes.editable',
  preview: 'notes.previewAvailable',
  'attachment-only': 'notes.attachmentOnly',
  unsupported: 'notes.unsupported',
};

const DocIcon: React.FC<{ document: LocalDocument; size?: number }> = ({ document, size = 18 }) => {
  if (document.kind === 'image') return <FileImage size={size} />;
  if (document.kind === 'spreadsheet') return <FileSpreadsheet size={size} />;
  if (document.kind === 'presentation') return <Presentation size={size} />;
  if (document.kind === 'pdf') return <FileText size={size} />;
  if (document.kind === 'other') return <Paperclip size={size} />;
  return <FileText size={size} />;
};

/** Title shown in lists and exports: the explicit title, else the first line of the note. */
const displayTitle = (document: LocalDocument, language: 'zh' | 'en') => {
  const title = document.title.trim();
  if (title) return title;
  const firstLine = (document.content ?? '').split('\n').map((line) => line.trim()).find(Boolean);
  return firstLine ? firstLine.slice(0, 60) : (language === 'zh' ? '新笔记' : 'New Note');
};

const snippetOf = (document: LocalDocument) => {
  const lines = (document.content ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  const body = document.title.trim() ? lines : lines.slice(1);
  return body.join(' ').slice(0, 90);
};

const dateGroup = (timestamp: number, language: 'zh' | 'en') => {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const diffDays = (startOfToday.getTime() - timestamp) / 86_400_000;
  if (timestamp >= startOfToday.getTime()) return language === 'zh' ? '今天' : 'Today';
  if (diffDays < 1) return language === 'zh' ? '昨天' : 'Yesterday';
  if (diffDays < 7) return language === 'zh' ? '过去 7 天' : 'Previous 7 Days';
  if (diffDays < 30) return language === 'zh' ? '过去 30 天' : 'Previous 30 Days';
  return language === 'zh' ? '更早' : 'Earlier';
};

const isImageFile = (file: File) => (file.type.startsWith('image/') && file.type !== 'image/svg+xml') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
const isImageAttachment = (attachment: DocumentAttachment) => (attachment.type.startsWith('image/') && attachment.type !== 'image/svg+xml') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(attachment.name);

const NoteImageAttachment: React.FC<{ attachment: DocumentAttachment; alt: string; onDownload: () => void; onRemove: () => void; removeLabel: string }> = ({ attachment, alt, onDownload, onRemove, removeLabel }) => {
  const [source, setSource] = useState('');
  useEffect(() => {
    let objectUrl = '';
    let active = true;
    void getBlob(attachment.blobId).then((blob) => {
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.blobId]);
  return <figure className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
    <button type="button" onClick={onDownload} className="block min-h-24 w-full">{source ? <img src={source} alt={alt} className="max-h-72 w-full object-contain" /> : <span className="block h-24 w-full animate-pulse bg-slate-100 dark:bg-white/5" />}</button>
    <figcaption className="truncate px-2 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">{attachment.name}</figcaption>
    <button type="button" onClick={onRemove} aria-label={removeLabel} title={removeLabel} className="absolute right-2 top-2 rounded-full bg-black/65 p-1 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"><X size={13} /></button>
  </figure>;
};

// Exports go through the shared download manager so they show up in the Downloads app.
const downloadBlob = (name: string, blob: Blob, _addDownload: unknown, documentId?: string) => {
  recordBlobDownload(name, blob, 'notes', documentId ? { documentId } : {});
};

export const NotesApp: React.FC = () => {
  const { t, language } = useI18n();
  const addDownload = useStore((state) => state.addDownload);
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'storage-full' | 'importing'>('idle');
  const [mobilePreview, setMobilePreview] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [showSupport, setShowSupport] = useState(false);
  const [officeEditMode, setOfficeEditMode] = useState(false);
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < 768);
  const importRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const noteBodyRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef(new Map<string, LocalDocument>());
  const saveTimerRef = useRef<number | null>(null);
  const statusTimerRef = useRef<number | null>(null);

  const markSaved = () => {
    setStatus('saved');
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus((current) => (current === 'saved' ? 'idle' : current)), 2200);
  };

  /** Writes queued edits. Typing is batched so IndexedDB is not hit on every keystroke. */
  const flushSaves = React.useCallback(async () => {
    if (saveTimerRef.current) { window.clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    const pending = [...pendingRef.current.values()];
    pendingRef.current.clear();
    if (!pending.length) return;
    try {
      await Promise.all(pending.map((document) => saveDocument(document)));
      markSaved();
    } catch {
      setStatus('error');
    }
  }, []);

  const queueSave = (document: LocalDocument) => {
    pendingRef.current.set(document.id, document);
    setStatus('saving');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void flushSaves(), 450);
  };

  useEffect(() => {
    const flush = () => { void flushSaves(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, [flushSaves]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    const updateLayout = (width: number) => setIsCompact(width < 760);
    updateLayout(shell.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === 'number') updateLayout(width);
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    void loadDocuments().then((loaded) => {
      if (!active) return;
      const normalized = loaded.map((document) => ['word', 'presentation'].includes(document.kind) && document.supportStatus !== 'editable' ? { ...document, supportStatus: 'editable' as const } : document);
      normalized.forEach((document, index) => { if (document !== loaded[index]) void saveDocument(document); });
      setDocuments(normalized);
      setSelectedId(normalized[0]?.id ?? null);
      setLoading(false);
    }).catch(() => { if (active) { setLoading(false); setStatus('error'); } });
    return () => { active = false; };
  }, []);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesFilter = filter === 'all' || document.kind === filter;
      const haystack = `${document.title} ${document.content ?? ''} ${document.extension ?? ''}`.toLowerCase();
      return matchesFilter && (!query || haystack.includes(query));
    }).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);
  }, [documents, filter, search]);
  const selected = documents.find((document) => document.id === selectedId) ?? null;

  useEffect(() => {
    setOfficeEditMode(false);
    void flushSaves();
  }, [flushSaves, selectedId]);

  const updateSelected = (patch: Partial<LocalDocument>, touch = true) => {
    if (!selected) return;
    const next = { ...selected, ...patch, updatedAt: touch ? Date.now() : selected.updatedAt };
    setDocuments((current) => current.map((document) => document.id === next.id ? next : document));
    queueSave(next);
  };

  const togglePin = () => {
    if (!selected) return;
    updateSelected({ pinned: !selected.pinned }, false);
  };

  const createNote = () => {
    const note = createEmptyNote(language);
    setDocuments((current) => [note, ...current]);
    setSelectedId(note.id);
    setMobilePreview(true);
    void saveDocument(note).catch(() => setStatus('error'));
  };

  const deleteSelected = async () => {
    if (!selected || !window.confirm(t('notes.deleteConfirm'))) return;
    try {
      pendingRef.current.delete(selected.id);
      await deleteDocument(selected);
      const remaining = documents.filter((document) => document.id !== selected.id);
      setDocuments(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setMobilePreview(false);
    } catch {
      setStatus('error');
    }
  };

  const importFiles = async (inputFiles: FileList | File[]) => {
    const files = Array.from(inputFiles).slice(0, MAX_FILES_PER_IMPORT);
    if (!files.length) return;
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_IMPORT_BYTES || files.some((file) => file.size > MAX_FILE_BYTES)) {
      setStatus('error');
      setImportResults(files.map((file) => ({ fileName: file.name, success: false, error: 'size-limit' })));
      return;
    }
    if (!(await hasDocumentStorageCapacity(totalBytes))) {
      setStatus('storage-full');
      setImportResults(files.map((file) => ({ fileName: file.name, success: false, error: 'storage-full' })));
      return;
    }
    setStatus('importing');
    const results: ImportResult[] = [];
    const imported: LocalDocument[] = [];
    for (const file of files) {
      try {
        const parsed = await parseLocalFile(file);
        const blobId = makeBlobId();
        await saveBlob(blobId, file);
        const document = toDocument(file, parsed, blobId);
        await saveDocument(document);
        imported.push(document);
        results.push({ fileName: file.name, success: true });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') setStatus('storage-full');
        results.push({ fileName: file.name, success: false, error: error instanceof Error ? error.message : 'parse-failed' });
      }
    }
    const latest = await listDocuments();
    setDocuments(latest);
    if (imported[0]) { setSelectedId(imported[0].id); setMobilePreview(true); }
    setImportResults(results);
    setStatus((current) => current === 'storage-full' ? current : imported.length === files.length ? 'saved' : 'error');
  };

  const downloadOriginal = async (document: LocalDocument) => {
    if (!document.originalBlobId) return;
    const blob = await getBlob(document.originalBlobId);
    if (!blob) { setStatus('error'); return; }
    downloadBlob(document.originalFileName ?? document.title, blob, addDownload, document.id);
    setStatus('saved');
  };

  const downloadAttachment = async (attachment: NonNullable<LocalDocument['attachments']>[number]) => {
    const blob = await getBlob(attachment.blobId);
    if (!blob) { setStatus('error'); return; }
    downloadBlob(attachment.name, blob, addDownload);
    setStatus('saved');
  };

  const attachImagesToSelected = async (files: File[]) => {
    if (!selected || !['note', 'text', 'markdown'].includes(selected.kind)) return;
    const images = files.filter(isImageFile).slice(0, MAX_FILES_PER_IMPORT);
    if (!images.length) return;
    const totalBytes = images.reduce((sum, file) => sum + file.size, 0);
    if (images.some((file) => file.size > MAX_FILE_BYTES) || !(await hasDocumentStorageCapacity(totalBytes))) {
      setStatus('storage-full');
      return;
    }
    const attachments: DocumentAttachment[] = [];
    for (const file of images) {
      const blobId = makeBlobId();
      await saveBlob(blobId, file);
      attachments.push({ id: `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, blobId, name: file.name, type: file.type || 'application/octet-stream', size: file.size, createdAt: Date.now() });
    }
    updateSelected({ attachments: [...(selected.attachments ?? []), ...attachments] });
    window.requestAnimationFrame(() => {
      const body = noteBodyRef.current;
      if (!body) return;
      body.focus();
      body.setSelectionRange(body.value.length, body.value.length);
    });
  };

  const removeAttachment = async (attachment: DocumentAttachment) => {
    if (!selected) return;
    await deleteBlob(attachment.blobId);
    updateSelected({ attachments: (selected.attachments ?? []).filter((item) => item.id !== attachment.id) });
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    const canAttach = Boolean(selected && ['note', 'text', 'markdown'].includes(selected.kind) && files.length && files.every(isImageFile));
    if (canAttach) void attachImagesToSelected(files);
    else void importFiles(files);
  };

  const handleBodyPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(event.clipboardData.files).filter(isImageFile);
    if (!images.length) return;
    event.preventDefault();
    void attachImagesToSelected(images);
  };

  const toggleOfficeEditor = async () => {
    if (!selected) return;
    if (officeEditMode) {
      setOfficeEditMode(false);
      return;
    }
    if (!selected.content && selected.originalBlobId && selected.originalFileName) {
      try {
        const blob = await getBlob(selected.originalBlobId);
        if (blob) {
          const parsed = await parseLocalFile(new File([blob], selected.originalFileName, { type: selected.mimeType || blob.type }));
          updateSelected({ content: parsed.content ?? '', previewData: parsed.previewData, supportStatus: 'editable' });
        }
      } catch {
        setStatus('error');
      }
    }
    setOfficeEditMode(true);
  };

  const exportCurrent = async (extension: 'md' | 'txt' | 'html' | 'docx' | 'pdf' | 'pptx') => {
    if (!selected) return;
    try {
      let blob: Blob;
      if (extension === 'md') blob = new Blob([`# ${selected.title}\n\n${selected.content ?? ''}`], { type: 'text/markdown' });
      else if (extension === 'txt') blob = new Blob([`${selected.title}\n\n${selected.content ?? ''}`], { type: 'text/plain' });
      else if (extension === 'html') blob = exportHtml(selected);
      else if (extension === 'docx') blob = await exportDocx(selected);
      else if (extension === 'pdf') blob = await exportPdf(selected);
      else blob = await exportPptx(selected);
      downloadBlob(`${safeFilename(displayTitle(selected, language), 'document')}.${extension}`, blob, addDownload, selected.id);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const exportWorkbook = async () => {
    try {
      const blob = await exportXlsx(documents, language);
      downloadBlob('notes.xlsx', blob, addDownload);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const exportAll = () => {
    downloadBlob('notes-backup.json', exportJson(documents), addDownload);
    setStatus('saved');
  };

  const statusText = status === 'error' ? t('notes.storageError') : status === 'storage-full' ? t('notes.storageFull') : status === 'importing' ? t('notes.importing') : status === 'saving' ? (language === 'zh' ? '正在保存…' : 'Saving…') : status === 'saved' ? t('notes.saved') : t('notes.storageReady');
  const countFor = (value: FilterKind) => (value === 'all' ? documents.length : documents.filter((document) => document.kind === value).length);
  const visibleFilters = (['all', 'note', 'text', 'markdown', 'word', 'presentation', 'spreadsheet', 'pdf', 'image', 'other'] as FilterKind[]).filter((value) => value === 'all' || value === 'note' || value === filter || countFor(value) > 0);
  const characterCount = selected?.content ? Array.from(selected.content.replace(/\s/g, '')).length : 0;
    const viewerLabels = {
    loading: t('notes.loading'),
    previewUnavailable: t('notes.previewUnavailable'),
    previous: t('notes.previous'),
    next: t('notes.next'),
    zoomIn: t('notes.zoomIn'),
    zoomOut: t('notes.zoomOut'),
    search: t('notes.searchDocument'),
    copy: t('notes.copyText'),
    fullscreen: t('notes.fullscreen'),
    download: t('notes.openOriginal'),
    rotate: t('notes.rotate'),
  };

  return <div
    ref={shellRef}
    data-testid="notes-app"
    data-window-interactive="true"
    data-compact={isCompact ? 'true' : 'false'}
    onPointerDown={(event) => event.stopPropagation()}
    onDragOver={(event) => event.preventDefault()}
    onDrop={handleDrop}
    className="flex h-full min-h-0 w-full select-text flex-col overflow-hidden bg-[#f5f5f7] text-slate-800 dark:bg-[#1c1c1e] dark:text-slate-100"
  >
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-[#2c2c2e]/80">
      <button type="button" onClick={createNote} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10"><FilePlus2 size={16} />{t('notes.newNote')}</button>
      <button type="button" onClick={() => importRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10"><Import size={16} />{t('notes.import')}</button>
      <button type="button" onClick={exportAll} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10"><Download size={16} />{t('notes.exportAll')}</button>
      <button type="button" onClick={() => setShowSupport((value) => !value)} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><FileDown size={15} />{t('notes.supportMatrix')}</button>
      <input ref={importRef} type="file" multiple accept=".txt,.md,.markdown,.json,.csv,.html,.htm,.rtf,.xml,.docx,.doc,.odt,.pptx,.ppt,.pps,.ppsx,.odp,.xlsx,.xls,.xlsm,.ods,.pdf,.ofd,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.zip" className="hidden" onChange={(event) => { void importFiles(event.target.files ?? []); event.target.value = ''; }} />
    </div>
    {showSupport && <div className="flex shrink-0 flex-wrap gap-2 border-b border-slate-200 bg-white/70 px-3 py-2 text-[11px] dark:border-white/10 dark:bg-[#242426]"><span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">TXT / MD / JSON / DOCX / PPTX · {t('notes.editable')}</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">XLSX / PDF · {t('notes.previewAvailable')}</span><span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">DOC / PPT / XLS / OFD · {t('notes.attachmentOnly')}</span></div>}
    <div className="flex min-h-0 flex-1">
      <aside className={`${isCompact ? 'hidden' : 'flex'} w-44 shrink-0 flex-col border-r border-slate-200 bg-white/70 dark:border-white/10 dark:bg-[#242426]`}>
        <div className="border-b border-slate-200 p-3 dark:border-white/10"><div className="flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-2 text-sm text-slate-500 dark:bg-white/10 dark:text-slate-400"><FolderOpen size={15} /><span className="truncate">{t('notes.allDocuments')}</span></div></div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-2">{visibleFilters.map((value) => <button key={value} type="button" onClick={() => { setFilter(value); setMobilePreview(false); }} className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${filter === value ? 'bg-amber-400/90 font-semibold text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}><span>{t(kindLabelKey[value])}</span><span className="tabular-nums opacity-70">{countFor(value)}</span></button>)}</nav>
        <div className="border-t border-slate-200 p-3 text-[10px] text-slate-400 dark:border-white/10">{t('notes.storageReady')}</div>
      </aside>
      <section className={`${isCompact && mobilePreview ? 'hidden' : 'flex'} ${isCompact ? 'w-full' : 'w-72'} shrink-0 flex-col border-r border-slate-200 bg-white/60 dark:border-white/10 dark:bg-[#222224]`}>
        <div className="flex gap-2 border-b border-slate-200 p-3 dark:border-white/10"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-2 text-sm text-slate-500 dark:bg-white/10 dark:text-slate-400"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('notes.search')} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" />{search && <button type="button" onClick={() => setSearch('')} aria-label="clear"><X size={13} /></button>}</label>{isCompact && <select value={filter} onChange={(event) => setFilter(event.target.value as FilterKind)} aria-label={t('notes.allDocuments')} className="max-w-[40%] rounded-lg bg-slate-100 px-2 text-xs text-slate-600 outline-none dark:bg-white/10 dark:text-slate-300">{visibleFilters.map((value) => <option key={value} value={value}>{t(kindLabelKey[value])} ({countFor(value)})</option>)}</select>}</div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? <div className="p-5 text-center text-xs text-slate-400">{t('notes.loading')}</div> : filteredDocuments.length ? filteredDocuments.map((document, index) => {
            const group = document.pinned ? (language === 'zh' ? '置顶' : 'Pinned') : dateGroup(document.updatedAt, language);
            const previous = filteredDocuments[index - 1];
            const previousGroup = previous ? (previous.pinned ? (language === 'zh' ? '置顶' : 'Pinned') : dateGroup(previous.updatedAt, language)) : null;
            const active = document.id === selectedId;
            const snippet = snippetOf(document);
            return <React.Fragment key={document.id}>
              {group !== previousGroup && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold text-slate-400 first:pt-1">{group}</div>}
              <button type="button" onClick={() => { setSelectedId(document.id); setMobilePreview(true); }} className={`mb-0.5 flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${active ? 'bg-amber-300/80 text-slate-900 dark:bg-amber-400/80' : 'hover:bg-slate-100 dark:hover:bg-white/10'}`}>
                {document.kind !== 'note' && <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${active ? 'bg-white/40' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}><DocIcon document={document} size={15} /></span>}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold">{displayTitle(document, language)}</span>{document.pinned && <Pin size={11} className="shrink-0 opacity-60" />}</span>
                  <span className={`mt-0.5 block truncate text-[12px] ${active ? 'text-slate-700' : 'text-slate-400'}`}>
                    <span className="mr-1.5">{formatDate(document.updatedAt, language)}</span>
                    {document.kind === 'note' ? (snippet || (language === 'zh' ? '没有更多文字' : 'No additional text')) : `${document.extension?.toUpperCase() || t(kindLabelKey[document.kind])} · ${formatBytes(document.size)}`}
                  </span>
                  {document.attachments?.length ? <span className={`mt-0.5 inline-flex items-center gap-1 text-[10px] ${active ? 'text-slate-700' : 'text-slate-400'}`}><Paperclip size={10} />{document.attachments.length}</span> : null}
                </span>
              </button>
            </React.Fragment>;
          }) : <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-5 text-center text-sm text-slate-400"><FileText size={34} strokeWidth={1.5} /><span>{search ? t('notes.noResults') : t('notes.noNotes')}</span>{!search && <button type="button" onClick={createNote} className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900">{t('notes.createFirst')}</button>}</div>}
        </div>
      </section>
      <main className={`${isCompact && !mobilePreview ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
        {selected ? <>
          <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-[#242426]">
            {isCompact && <button type="button" onClick={() => setMobilePreview(false)} className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10" title={t('notes.backToList')}><ArrowLeft size={17} /></button>}
            <span className="flex min-w-0 items-center gap-2 text-xs text-slate-400"><DocIcon document={selected} size={14} />{t(supportLabelKey[selected.supportStatus])}</span>
            <span className={`ml-auto text-[11px] transition-colors ${status === 'error' || status === 'storage-full' ? 'text-red-500' : 'text-slate-400'}`}>{statusText}</span>
            {['word', 'presentation'].includes(selected.kind) && <button type="button" onClick={() => void toggleOfficeEditor()} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10">{officeEditMode ? <Eye size={15} /> : <Pencil size={15} />}{officeEditMode ? t('notes.previewOriginal') : t('notes.editContent')}</button>}
            <button type="button" onClick={togglePin} title={selected.pinned ? (language === 'zh' ? '取消置顶' : 'Unpin') : (language === 'zh' ? '置顶' : 'Pin')} aria-label={selected.pinned ? 'Unpin' : 'Pin'} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">{selected.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
            <button type="button" onClick={() => { pendingRef.current.set(selected.id, selected); void flushSaves(); }} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10"><Save size={15} /><span className="hidden sm:inline">{t('notes.save')}</span></button>
            <button type="button" onClick={() => void deleteSelected()} className="rounded-md p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title={t('notes.delete')}><Trash2 size={16} /></button>
          </header>
          {officeEditMode && ['word', 'presentation'].includes(selected.kind) ? <div data-window-interactive="true" onPointerDown={(event) => event.stopPropagation()} className="flex min-h-0 min-w-0 flex-1 flex-col bg-white/80 px-5 py-4 dark:bg-[#1c1c1e]/80"><input data-testid="notes-office-title" value={selected.title} maxLength={160} onChange={(event) => updateSelected({ title: event.target.value })} placeholder={t('notes.titlePlaceholder')} className="w-full min-w-0 select-text border-none bg-transparent text-2xl font-semibold outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700" /><p className="mt-2 text-xs text-slate-400">{selected.kind === 'presentation' ? t('notes.pptEditHint') : t('notes.wordEditHint')}</p><textarea data-testid="notes-office-body" value={selected.content ?? ''} onChange={(event) => updateSelected({ content: event.target.value, previewData: selected.kind === 'word' ? { ...selected.previewData, type: 'docx', text: event.target.value } : selected.previewData })} placeholder={t('notes.bodyPlaceholder')} className="mt-3 min-h-32 w-full min-w-0 basis-0 flex-1 select-text resize-none overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 font-mono text-[14px] leading-7 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-black/20" /><div className="mt-3 flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 pt-3 text-xs dark:border-white/10"><button type="button" onClick={() => void exportCurrent(selected.kind === 'word' ? 'docx' : 'pptx')} className="rounded-md bg-blue-500 px-3 py-1.5 font-medium text-white hover:bg-blue-600">{selected.kind === 'word' ? t('notes.exportDocx') : t('notes.exportPptx')}</button></div></div>
            : selected.supportStatus === 'editable' && ['note', 'text', 'markdown'].includes(selected.kind) ? <div data-window-interactive="true" onPointerDown={(event) => event.stopPropagation()} className="flex min-h-0 min-w-0 flex-1 flex-col bg-white/80 px-5 py-4 dark:bg-[#1c1c1e]/80"><div className="mb-1 text-center text-[11px] text-slate-400">{new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'long', timeStyle: 'short' }).format(selected.updatedAt)}</div><input data-testid="notes-title" value={selected.title} maxLength={160} onChange={(event) => updateSelected({ title: event.target.value })} placeholder={displayTitle(selected, language) === (language === 'zh' ? '新笔记' : 'New Note') ? t('notes.titlePlaceholder') : displayTitle(selected, language)} className="w-full min-w-0 select-text border-none bg-transparent text-2xl font-semibold outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700" /><div className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{selected.attachments?.filter(isImageAttachment).length ? <div className="mb-4 grid max-h-[45%] shrink-0 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">{selected.attachments.filter(isImageAttachment).map((attachment) => <NoteImageAttachment key={attachment.id} attachment={attachment} alt={attachment.name} onDownload={() => void downloadAttachment(attachment)} onRemove={() => void removeAttachment(attachment)} removeLabel={t('notes.removeAttachment')} />)}</div> : null}<textarea data-testid="notes-body" ref={noteBodyRef} value={selected.content ?? ''} onChange={(event) => updateSelected({ content: event.target.value, previewData: { type: 'text', text: event.target.value } })} onPaste={handleBodyPaste} placeholder={selected.attachments?.some(isImageAttachment) ? t('notes.continueBelowImage') : t('notes.bodyPlaceholder')} className="min-h-32 w-full min-w-0 basis-0 flex-1 select-text resize-none overflow-y-auto border-none bg-transparent text-[15px] leading-7 outline-none placeholder:text-slate-400" />{selected.attachments?.filter((attachment) => !isImageAttachment(attachment)).length ? <div className="mt-3 shrink-0 border-t border-slate-200 pt-3 text-xs dark:border-white/10"><div className="mb-2 flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><Paperclip size={13} />{t('notes.attachments')}</div><div className="flex flex-wrap gap-2">{selected.attachments.filter((attachment) => !isImageAttachment(attachment)).map((attachment) => <button key={attachment.id} type="button" onClick={() => void downloadAttachment(attachment)} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-slate-500 hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:hover:bg-white/10"><Paperclip size={13} /><span className="max-w-48 truncate">{attachment.name}</span><span className="text-[10px] text-slate-400">{formatBytes(attachment.size)}</span></button>)}</div></div> : null}</div><div className="mt-3 flex shrink-0 items-center gap-2 border-t border-slate-200 pt-3 text-xs dark:border-white/10"><span className="mr-auto tabular-nums text-slate-400">{language === 'zh' ? `${characterCount} 字` : `${characterCount} characters`}</span><details className="relative"><summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><FileDown size={14} />{t('notes.export')}<ChevronDown size={12} /></summary><div className="absolute bottom-full right-0 z-10 mb-1 grid w-36 gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#2c2c2e]">{(['md', 'txt', 'html', 'docx', 'pdf', 'pptx'] as const).map((extension) => <button key={extension} type="button" onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open'); void exportCurrent(extension); }} className="rounded-md px-2 py-1.5 text-left text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">.{extension}</button>)}<button type="button" onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open'); void exportWorkbook(); }} className="rounded-md px-2 py-1.5 text-left text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">.xlsx {language === 'zh' ? '（全部）' : '(all)'}</button></div></details></div></div>
              : selected.kind === 'word' && selected.originalBlobId ? <DocxPreview blobId={selected.originalBlobId} content={selected.content} labels={viewerLabels} />
              : selected.kind === 'presentation' && selected.originalBlobId ? <PptxPreview blobId={selected.originalBlobId} labels={{ ...viewerLabels, slide: t('notes.slide'), noSlides: t('notes.noSlides') }} />
              : selected.previewData?.type === 'sheets' ? <SheetPreview document={selected} labels={{ ...viewerLabels, sheet: t('notes.sheet'), row: t('notes.rows'), noResults: t('notes.noResults') }} />
                : selected.previewData?.type === 'pdf' ? <PdfPreview blobId={selected.originalBlobId} labels={{ ...viewerLabels, page: (page, total) => `${page} / ${total}`, noResults: t('notes.noResults') }} />
                  : selected.previewData?.type === 'image' ? <ImagePreview blobId={selected.originalBlobId} alt={selected.title} labels={viewerLabels} />
                    : <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-slate-100/70 p-8 text-center dark:bg-black/20"><Paperclip size={42} className="text-slate-300 dark:text-slate-600" /><h2 className="text-lg font-semibold">{t('notes.noPreview')}</h2>{selected.previewData?.warning === 'macro-not-executed' && <p className="max-w-md text-xs text-amber-600 dark:text-amber-300">{t('notes.macroWarning')}</p>}<button type="button" onClick={() => void downloadOriginal(selected)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"><Download size={15} />{t('notes.openOriginal')}</button></div>}
        </> : <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-slate-400"><FileText size={46} strokeWidth={1.5} /><h2 className="text-lg font-semibold text-slate-600 dark:text-slate-300">{t('notes.noNotes')}</h2><button type="button" onClick={createNote} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300">{t('notes.createFirst')}</button><div className="mt-3 flex items-center gap-2 text-xs"><Upload size={14} />{t('notes.dropFiles')}</div></div>}
      </main>
    </div>
    {importResults.length > 0 && <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white/80 px-3 py-2 text-[11px] dark:border-white/10 dark:bg-[#242426]"><span className="font-medium">{importResults.filter((result) => result.success).length}/{importResults.length} {t('notes.filesImported')}</span><span className="truncate text-slate-400">{importResults.filter((result) => !result.success).map((result) => `${result.fileName}: ${result.error}`).join(' · ')}</span><button type="button" onClick={() => setImportResults([])} className="ml-auto rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-white/10">×</button></div>}
  </div>;
};
