import { DocumentKind, DocumentPreview, FileSupportStatus, LocalDocument } from './documentStore';

export interface ParsedDocument {
  kind: DocumentKind;
  supportStatus: FileSupportStatus;
  content?: string;
  previewData: DocumentPreview;
  warning?: string;
}

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';
const textExtensions = new Set(['txt', 'log', 'md', 'markdown', 'json', 'html', 'htm', 'rtf', 'xml']);
const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);

type OfficeParseMode = 'validate-pptx' | 'read-docx' | 'read-xlsx';
type OfficeParseResponse = { ok: boolean; text?: string; slides?: Array<{ number: number; title: string; text: string }>; sheets?: Array<{ name: string; rows: string[][] }>; error?: string };
const OFFICE_PARSE_TIMEOUT_MS = 30000;

const makeTextPreview = (text: string): DocumentPreview => ({ type: 'text', text: text.slice(0, 200000) });

const runOfficeWorker = async (file: File, mode: OfficeParseMode) => {
  const buffer = await file.arrayBuffer();
  return new Promise<OfficeParseResponse>((resolve, reject) => {
    const worker = new Worker(new URL('./documentParser.worker.ts', import.meta.url), { type: 'module' });
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('office-parse-timeout'));
    }, OFFICE_PARSE_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };
    worker.onmessage = (event: MessageEvent<OfficeParseResponse>) => {
      cleanup();
      if (!event.data.ok) reject(new Error(event.data.error ?? 'office-parse-failed'));
      else resolve(event.data);
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('office-worker-failed'));
    };
    worker.postMessage({ mode, buffer }, [buffer]);
  });
};

const readSpreadsheet = async (file: File): Promise<DocumentPreview> => {
  if (file.name.toLocaleLowerCase().endsWith('.xlsx')) {
    const result = await runOfficeWorker(file, 'read-xlsx');
    return { type: 'sheets', sheets: result.sheets ?? [] };
  }
  const XLSXModule = await import('@e965/xlsx');
  const XLSX = XLSXModule.default ?? XLSXModule;
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: true, cellNF: true, cellStyles: true, dense: false });
  const sheets = workbook.SheetNames.map((name: string) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: '' }) as unknown[][];
    return { name, rows: rows.slice(0, 1000).map((row) => row.slice(0, 40).map((cell) => String(cell ?? ''))) };
  });
  return { type: 'sheets', sheets };
};

const readWord = async (file: File) => (await runOfficeWorker(file, 'read-docx')).text ?? '';

const mimeMatchesExtension = (file: File, extension: string) => {
  const mime = file.type.toLocaleLowerCase();
  if (!mime || mime === 'application/octet-stream' || mime === 'application/zip') return true;
  if (extension === 'docx') return mime.includes('wordprocessingml') || mime.includes('msword');
  if (extension === 'pptx') return mime.includes('presentationml') || mime.includes('powerpoint');
  if (extension === 'xlsx') return mime.includes('spreadsheetml') || mime.includes('excel');
  if (extension === 'pdf') return mime === 'application/pdf';
  if (imageExtensions.has(extension)) return mime.startsWith('image/');
  if (textExtensions.has(extension) || extension === 'csv') return mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('rtf');
  return true;
};

const kindFor = (extension: string): { kind: DocumentKind; supportStatus: FileSupportStatus } => {
  if (extension === 'md' || extension === 'markdown') return { kind: 'markdown', supportStatus: 'editable' };
  if (extension === 'csv') return { kind: 'spreadsheet', supportStatus: 'preview' };
  if (textExtensions.has(extension)) return { kind: 'text', supportStatus: 'editable' };
  if (extension === 'docx') return { kind: 'word', supportStatus: 'editable' };
  if (extension === 'pptx') return { kind: 'presentation', supportStatus: 'editable' };
  if (extension === 'xlsx') return { kind: 'spreadsheet', supportStatus: 'preview' };
  if (extension === 'pdf') return { kind: 'pdf', supportStatus: 'preview' };
  if (imageExtensions.has(extension)) return { kind: 'image', supportStatus: 'preview' };
  if (['doc', 'docm', 'dot', 'dotx', 'odt', 'ppt', 'pptm', 'pps', 'ppsx', 'odp', 'xls', 'xlsm', 'xltx', 'ods', 'ofd'].includes(extension)) return { kind: 'other', supportStatus: 'attachment-only' };
  return { kind: 'other', supportStatus: 'attachment-only' };
};

export const parseLocalFile = async (file: File): Promise<ParsedDocument> => {
  const extension = extensionOf(file.name);
  if (!mimeMatchesExtension(file, extension)) throw new Error('file-type-mismatch');
  const descriptor = kindFor(extension);
  if (descriptor.supportStatus === 'attachment-only') {
    return { ...descriptor, previewData: { type: 'attachment', warning: extension === 'docm' || extension === 'pptm' || extension === 'xlsm' ? 'macro-not-executed' : undefined } };
  }
  if (descriptor.kind === 'image') return { ...descriptor, previewData: { type: 'image' } };
  if (descriptor.kind === 'pdf') return { ...descriptor, previewData: { type: 'pdf' } };
  if (descriptor.kind === 'presentation') {
    const result = await runOfficeWorker(file, 'validate-pptx');
    const slides = result.slides ?? [];
    const content = slides.map((slide) => `--- Slide ${slide.number} ---\n${slide.text}`).join('\n\n');
    return { ...descriptor, content, previewData: { type: 'pptx', slides } };
  }
  if (descriptor.kind === 'spreadsheet') return { ...descriptor, previewData: await readSpreadsheet(file) };
  if (descriptor.kind === 'word') {
    const content = await readWord(file);
    return { ...descriptor, content, previewData: { type: 'docx', text: content } };
  }

  const rawText = await file.text();
  if (extension === 'xml' && /<!DOCTYPE|<!ENTITY/i.test(rawText)) throw new Error('xml-external-entities-blocked');
  let content = rawText;
  if (extension === 'html' || extension === 'htm') {
    const DOMPurify = (await import('dompurify')).default;
    const sanitized = DOMPurify.sanitize(rawText, { USE_PROFILES: { html: true }, FORBID_TAGS: ['script', 'iframe', 'object', 'embed'] });
    content = new DOMParser().parseFromString(sanitized, 'text/html').body.textContent ?? '';
  }
  return { ...descriptor, content: content.slice(0, 200000), previewData: makeTextPreview(content) };
};

export const toDocument = (file: File, parsed: ParsedDocument, blobId: string): LocalDocument => {
  const now = Date.now();
  const extension = extensionOf(file.name);
  const sourceName = file.name.replace(/\\/g, '/').split('/').pop() ?? '';
  const safeName = Array.from(sourceName).filter((character) => (character.codePointAt(0) ?? 0) >= 32).join('').slice(0, 180) || `document.${extension || 'bin'}`;
  return {
    id: `document-${now}-${Math.random().toString(36).slice(2, 8)}`,
    kind: parsed.kind,
    supportStatus: parsed.supportStatus,
    title: safeName,
    content: parsed.content,
    originalFileName: safeName,
    mimeType: file.type || 'application/octet-stream',
    extension,
    size: file.size,
    createdAt: now,
    updatedAt: now,
    previewData: parsed.previewData,
    originalBlobId: blobId,
  };
};
