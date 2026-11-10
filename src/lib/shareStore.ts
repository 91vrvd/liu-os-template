import type { ShareInboxItem, ShareMessage, ShareTransfer } from '../types/share';

const DB_NAME = 'liu-os-share-v1';
const DB_VERSION = 1;
const FILE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const requestResult = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('indexeddb-request-failed'));
});

const openShareDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains('messages')) {
      const messages = db.createObjectStore('messages', { keyPath: 'id' });
      messages.createIndex('roomCode', 'roomCode', { unique: false });
      messages.createIndex('createdAt', 'createdAt', { unique: false });
    }
    if (!db.objectStoreNames.contains('inbox')) {
      const inbox = db.createObjectStore('inbox', { keyPath: 'id' });
      inbox.createIndex('expiresAt', 'expiresAt', { unique: false });
      inbox.createIndex('roomCode', 'roomCode', { unique: false });
    }
    if (!db.objectStoreNames.contains('blobs')) {
      db.createObjectStore('blobs', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('transfers')) {
      const transfers = db.createObjectStore('transfers', { keyPath: 'id' });
      transfers.createIndex('updatedAt', 'updatedAt', { unique: false });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('share-database-unavailable'));
});

const withStore = async <T,>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  operation: (stores: Record<string, IDBObjectStore>) => Promise<T>,
) => {
  const db = await openShareDb();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const transaction = db.transaction(names, mode);
  const stores = Object.fromEntries(names.map((name) => [name, transaction.objectStore(name)]));
  try {
    const result = await operation(stores);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('share-transaction-failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('share-transaction-aborted'));
    });
    return result;
  } finally {
    db.close();
  }
};

export const saveShareMessage = (message: ShareMessage) => withStore('messages', 'readwrite', async ({ messages }) => {
  await requestResult(messages.put(message));
});

export const listShareMessages = (roomCode: string) => withStore('messages', 'readonly', async ({ messages }) => {
  const index = messages.index('roomCode');
  const rows = await requestResult(index.getAll(IDBKeyRange.only(roomCode))) as ShareMessage[];
  return rows.sort((a, b) => a.createdAt - b.createdAt);
});

export const clearShareMessages = (roomCode: string) => withStore('messages', 'readwrite', async ({ messages }) => {
  const keys = await requestResult(messages.index('roomCode').getAllKeys(IDBKeyRange.only(roomCode)));
  await Promise.all(keys.map((key) => requestResult(messages.delete(key))));
});

export const saveShareTransfer = (transfer: ShareTransfer) => withStore('transfers', 'readwrite', async ({ transfers }) => {
  await requestResult(transfers.put(transfer));
});

export const listShareTransfers = () => withStore('transfers', 'readonly', async ({ transfers }) => {
  const rows = await requestResult(transfers.getAll()) as ShareTransfer[];
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
});

export const saveInboxItem = (item: ShareInboxItem, blob?: Blob) => withStore(
  blob ? ['inbox', 'blobs'] : 'inbox',
  'readwrite',
  async ({ inbox, blobs }) => {
    await requestResult(inbox.put(item));
    if (blob && item.blobId && blobs) {
      await requestResult(blobs.put({ id: item.blobId, blob }));
    }
  },
);

export const listInboxItems = () => withStore('inbox', 'readonly', async ({ inbox }) => {
  const rows = await requestResult(inbox.getAll()) as ShareInboxItem[];
  return rows.sort((a, b) => b.receivedAt - a.receivedAt);
});

export const getShareBlob = (blobId: string) => withStore('blobs', 'readonly', async ({ blobs }) => {
  const row = await requestResult(blobs.get(blobId)) as { id: string; blob: Blob } | undefined;
  return row?.blob ?? null;
});

export const setInboxPinned = (id: string, pinned: boolean) => withStore('inbox', 'readwrite', async ({ inbox }) => {
  const item = await requestResult(inbox.get(id)) as ShareInboxItem | undefined;
  if (!item) return;
  await requestResult(inbox.put({
    ...item,
    pinned,
    expiresAt: pinned ? Number.MAX_SAFE_INTEGER : Date.now() + FILE_RETENTION_MS,
  }));
});

const removeOpfsFile = async (name?: string) => {
  if (!name || !navigator.storage?.getDirectory) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(name);
  } catch {
    // The file may already have been removed by browser storage eviction.
  }
};

export const deleteInboxItem = (item: ShareInboxItem) => withStore(
  ['inbox', 'blobs'],
  'readwrite',
  async ({ inbox, blobs }) => {
    await requestResult(inbox.delete(item.id));
    if (item.blobId) await requestResult(blobs.delete(item.blobId));
    await removeOpfsFile(item.opfsName);
  },
);

export const cleanupExpiredInbox = async (now = Date.now()) => {
  const items = await listInboxItems();
  const expired = items.filter((item) => !item.pinned && item.expiresAt <= now);
  await Promise.all(expired.map(deleteInboxItem));
  return expired.length;
};

export const inboxExpiryFor = (receivedAt = Date.now()) => receivedAt + FILE_RETENTION_MS;

export const storageEstimate = async () => {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return {
    quota: estimate.quota ?? 0,
    usage: estimate.usage ?? 0,
    available: Math.max(0, (estimate.quota ?? 0) - (estimate.usage ?? 0)),
  };
};

export const hasStorageFor = async (bytes: number) => {
  const estimate = await storageEstimate();
  if (!estimate || !estimate.quota) return true;
  return estimate.available >= bytes * 1.05;
};

export const createOpfsWriter = async (transferId: string, keepExistingData: boolean) => {
  if (!navigator.storage?.getDirectory) return null;
  const root = await navigator.storage.getDirectory();
  const opfsName = `liu-share-${transferId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const handle = await root.getFileHandle(opfsName, { create: true });
  const existingSize = (await handle.getFile()).size;
  const writable = await handle.createWritable({ keepExistingData });
  return { opfsName, writable, existingSize };
};

export const getOpfsFile = async (opfsName: string) => {
  if (!navigator.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(opfsName);
    return await handle.getFile();
  } catch {
    return null;
  }
};

export const sanitizeShareFileName = (name: string) => {
  const withoutControlCharacters = Array.from(name, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? '_' : character;
  }).join('');
  const clean = withoutControlCharacters
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.\.+/g, '.')
    .trim();
  return (clean || 'shared-file').slice(0, 180);
};

export const fileFingerprint = async (file: File) => {
  const sampleSize = 64 * 1024;
  const first = await file.slice(0, sampleSize).arrayBuffer();
  const last = file.size > sampleSize
    ? await file.slice(Math.max(0, file.size - sampleSize)).arrayBuffer()
    : new ArrayBuffer(0);
  const metadata = new TextEncoder().encode(`${file.name}|${file.size}|${file.lastModified}|`);
  const combined = new Uint8Array(metadata.length + first.byteLength + last.byteLength);
  combined.set(metadata, 0);
  combined.set(new Uint8Array(first), metadata.length);
  combined.set(new Uint8Array(last), metadata.length + first.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', combined);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const classifySharePreview = (file: Pick<File, 'name' | 'type'>): ShareInboxItem['previewKind'] => {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase() ?? '';
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(extension)) return 'image';
  if (file.type.startsWith('audio/') || ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'webm'].includes(extension)) return 'audio';
  if (file.type.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm'].includes(extension)) return 'video';
  if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (['docx', 'pptx', 'xlsx', 'csv'].includes(extension)) return 'office';
  if (
    file.type.startsWith('text/')
    || ['txt', 'md', 'markdown', 'json', 'xml', 'html', 'htm', 'js', 'ts', 'tsx', 'jsx', 'css', 'py', 'java', 'c', 'cpp', 'rs'].includes(extension)
  ) return 'text';
  if (extension === 'zip') return 'archive';
  return 'download';
};
