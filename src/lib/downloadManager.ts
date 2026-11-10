import { DownloadItem, useStore } from '../store/useStore';
import { makeBlobId, saveDownloadRecord } from './documentStore';

/**
 * One place for every download made inside Liu OS (music, notes exports, shared files…).
 * Files are fetched with progress, kept in IndexedDB so the Downloads app can re-save or preview
 * them, and handed to the browser's own download so they land in the visitor's Downloads folder.
 */

const controllers = new Map<string, AbortController>();

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';
const makeId = () => `download-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const safeFileName = (value: string, fallback = 'download') => Array.from(value)
  .filter((character) => (character.codePointAt(0) ?? 0) >= 32)
  .join('')
  .replace(/[\\/:*?"<>|]/g, '')
  .trim()
  .slice(0, 120) || fallback;

/** Hands a blob to the browser's normal download flow. */
export const saveBlobToDevice = (name: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

const persist = (item: DownloadItem, blob?: Blob) => {
  void saveDownloadRecord({ ...item, extension: item.extension ?? extensionOf(item.name) }, blob).catch(() => undefined);
};

/** Records a file that already exists in memory (exports, generated files) and saves it. */
export const recordBlobDownload = (name: string, blob: Blob, source: DownloadItem['source'], extra: Partial<DownloadItem> = {}) => {
  const blobId = makeBlobId();
  const item: DownloadItem = {
    id: makeId(),
    name,
    type: blob.type || 'application/octet-stream',
    extension: extensionOf(name),
    size: blob.size,
    createdAt: Date.now(),
    source,
    blobId,
    status: 'done',
    progress: 1,
    ...extra,
  };
  useStore.getState().addDownload(item);
  persist(item, blob);
  saveBlobToDevice(name, blob);
  return item;
};

interface StartOptions {
  url: string;
  name: string;
  source: DownloadItem['source'];
  expectedSize?: number;
  type?: string;
  detail?: string;
  /** Open the URL in a new tab if the browser refuses a cross-origin fetch. */
  fallbackToTab?: boolean;
}

/** Downloads a remote file with progress. Resolves with the finished record. */
export const startDownload = async ({ url, name, source, expectedSize, type, detail, fallbackToTab = true }: StartOptions) => {
  const store = useStore.getState();
  const id = makeId();
  const controller = new AbortController();
  controllers.set(id, controller);
  const item: DownloadItem = {
    id,
    name,
    type: type ?? 'application/octet-stream',
    extension: extensionOf(name),
    size: expectedSize ?? 0,
    createdAt: Date.now(),
    source,
    status: 'downloading',
    progress: 0,
    received: 0,
    sourceUrl: url,
    detail,
  };
  store.addDownload(item);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`http-${response.status}`);
    const total = Number(response.headers.get('content-length')) || expectedSize || 0;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let lastPaint = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      const now = performance.now();
      if (now - lastPaint > 120) {
        lastPaint = now;
        useStore.getState().updateDownload(id, { received, size: total || received, progress: total ? received / total : 0 });
      }
    }
    const mime = response.headers.get('content-type')?.split(';')[0] || item.type;
    const blob = new Blob(chunks as BlobPart[], { type: mime });
    const blobId = makeBlobId();
    const finished: DownloadItem = { ...item, type: mime, size: blob.size, received: blob.size, progress: 1, status: 'done', blobId };
    useStore.getState().updateDownload(id, finished);
    persist(finished, blob);
    saveBlobToDevice(name, blob);
    return finished;
  } catch (error) {
    const canceled = controller.signal.aborted;
    const patch: Partial<DownloadItem> = { status: canceled ? 'canceled' : 'failed', error: canceled ? 'canceled' : (error instanceof Error ? error.message : 'failed') };
    if (!canceled && fallbackToTab) {
      // Cross-origin hosts without CORS cannot be fetched; let the browser handle the link itself.
      window.open(url, '_blank', 'noopener,noreferrer');
      patch.error = 'opened-in-tab';
    }
    useStore.getState().updateDownload(id, patch);
    persist({ ...item, ...patch });
    return null;
  } finally {
    controllers.delete(id);
  }
};

export const cancelDownload = (id: string) => controllers.get(id)?.abort();

export const activeDownloadCount = (items: DownloadItem[]) => items.filter((item) => item.status === 'downloading').length;
