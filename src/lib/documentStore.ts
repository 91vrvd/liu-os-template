export type DocumentKind = 'note' | 'text' | 'markdown' | 'word' | 'presentation' | 'spreadsheet' | 'pdf' | 'image' | 'other';
export type FileSupportStatus = 'editable' | 'preview' | 'attachment-only' | 'unsupported';

export interface DocumentAttachment {
  id: string;
  blobId: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
}

export interface DocumentPreview {
  type: 'text' | 'docx' | 'pptx' | 'slides' | 'sheets' | 'pdf' | 'image' | 'attachment';
  text?: string;
  slides?: Array<{ number: number; title: string; text: string; images?: string[] }>;
  sheets?: Array<{ name: string; rows: string[][] }>;
  warning?: string;
}

export interface DocumentDownloadRecord {
  id: string;
  name: string;
  type: string;
  extension: string;
  size: number;
  createdAt: number;
  source: 'notes' | 'music' | 'image' | 'file' | 'share';
  blobId?: string;
  documentId?: string;
  status?: 'downloading' | 'done' | 'failed' | 'canceled';
  progress?: number;
  received?: number;
  sourceUrl?: string;
  error?: string;
  detail?: string;
}

export interface LocalDocument {
  id: string;
  kind: DocumentKind;
  supportStatus: FileSupportStatus;
  title: string;
  content?: string;
  originalFileName?: string;
  mimeType?: string;
  extension?: string;
  size?: number;
  createdAt: number;
  updatedAt: number;
  previewData?: DocumentPreview;
  originalBlobId?: string;
  attachments?: DocumentAttachment[];
  pinned?: boolean;
}

const DB_NAME = 'liu-os-documents-v2';
const DB_VERSION = 2;
const DOCUMENT_STORE = 'documents';
const BLOB_STORE = 'blobs';
const PREVIEW_STORE = 'previews';
const DOWNLOAD_STORE = 'downloads';
const SETTINGS_STORE = 'settings';
const LEGACY_NOTES_KEY = 'liu-os-notes-v1';

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('indexeddb-unavailable'));
    return;
  }
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(DOCUMENT_STORE)) request.result.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' });
    if (!request.result.objectStoreNames.contains(BLOB_STORE)) request.result.createObjectStore(BLOB_STORE);
    if (!request.result.objectStoreNames.contains(PREVIEW_STORE)) request.result.createObjectStore(PREVIEW_STORE);
    if (!request.result.objectStoreNames.contains(DOWNLOAD_STORE)) request.result.createObjectStore(DOWNLOAD_STORE, { keyPath: 'id' });
    if (!request.result.objectStoreNames.contains(SETTINGS_STORE)) request.result.createObjectStore(SETTINGS_STORE);
  };
  request.onsuccess = () => {
    request.result.onversionchange = () => request.result.close();
    resolve(request.result);
  };
  request.onerror = () => reject(request.error ?? new Error('documents-db-open-failed'));
  request.onblocked = () => reject(new Error('documents-db-upgrade-blocked'));
});

const transaction = async <T>(mode: IDBTransactionMode, handler: (stores: { documents: IDBObjectStore; blobs: IDBObjectStore; previews: IDBObjectStore }, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void) => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction([DOCUMENT_STORE, BLOB_STORE, PREVIEW_STORE], mode);
    let result: T;
    let resultReady = false;
    const setResult = (value: T) => { result = value; resultReady = true; };
    const fail = (reason?: unknown) => {
      try { tx.abort(); } catch { /* The transaction may already be inactive. */ }
      reject(reason ?? new Error('documents-db-operation-failed'));
    };
    handler({ documents: tx.objectStore(DOCUMENT_STORE), blobs: tx.objectStore(BLOB_STORE), previews: tx.objectStore(PREVIEW_STORE) }, setResult, fail);
    tx.oncomplete = () => {
      db.close();
      if (resultReady) resolve(result);
      else reject(new Error('documents-db-result-missing'));
    };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('documents-db-transaction-failed')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('documents-db-transaction-aborted')); };
  });
};

export const listDocuments = () => transaction<LocalDocument[]>('readonly', ({ documents }, resolve, reject) => {
  const request = documents.getAll();
  request.onsuccess = () => resolve((request.result as LocalDocument[]).sort((a, b) => b.updatedAt - a.updatedAt));
  request.onerror = () => reject(request.error ?? new Error('documents-list-failed'));
});

export const saveDocument = (document: LocalDocument) => transaction<void>('readwrite', ({ documents }, resolve, reject) => {
  const request = documents.put(document);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error ?? new Error('document-save-failed'));
});

export const saveDocuments = (documentsToSave: LocalDocument[]) => transaction<void>('readwrite', ({ documents }, resolve, reject) => {
  if (!documentsToSave.length) {
    resolve();
    return;
  }
  let completed = 0;
  documentsToSave.forEach((document) => {
    const request = documents.put(document);
    request.onsuccess = () => {
      completed += 1;
      if (completed === documentsToSave.length) resolve();
    };
    request.onerror = () => reject(request.error ?? new Error('documents-save-failed'));
  });
});

export const deleteDocument = (document: LocalDocument) => transaction<void>('readwrite', ({ documents, blobs, previews }, resolve) => {
  documents.delete(document.id);
  if (document.originalBlobId) blobs.delete(document.originalBlobId);
  document.attachments?.forEach((attachment) => blobs.delete(attachment.blobId));
  previews.delete(document.id);
  resolve();
});

export const saveBlob = (blobId: string, blob: Blob) => transaction<void>('readwrite', ({ blobs }, resolve, reject) => {
  const request = blobs.put(blob, blobId);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error ?? new Error('blob-save-failed'));
});

export const getBlob = (blobId: string) => transaction<Blob | null>('readonly', ({ blobs }, resolve, reject) => {
  const request = blobs.get(blobId);
  request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
  request.onerror = () => reject(request.error ?? new Error('blob-read-failed'));
});

export const deleteBlob = (blobId: string) => transaction<void>('readwrite', ({ blobs }, resolve, reject) => {
  const request = blobs.delete(blobId);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error ?? new Error('blob-delete-failed'));
});

type LegacyNote = { id: string; title: string; content: string; createdAt: number; updatedAt: number; attachments?: Array<{ id: string; name: string; type?: string; size?: number; createdAt?: number }> };

const readLegacyNotes = (): LegacyNote[] => {
  try {
    const raw = localStorage.getItem(LEGACY_NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { notes?: unknown } | unknown[];
    const values = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && Array.isArray(parsed.notes) ? parsed.notes : [];
    return values.filter((value): value is LegacyNote => (
      Boolean(value) && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string' && typeof (value as { title?: unknown }).title === 'string' && typeof (value as { content?: unknown }).content === 'string'
    )).map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      createdAt: Number.isFinite(note.createdAt) ? note.createdAt : Date.now(),
      updatedAt: Number.isFinite(note.updatedAt) ? note.updatedAt : Date.now(),
      attachments: Array.isArray(note.attachments) ? note.attachments.filter((attachment) => Boolean(attachment) && typeof attachment.id === 'string' && typeof attachment.name === 'string') : undefined,
    }));
  } catch {
    return [];
  }
};

const readLegacyBlob = (id: string) => new Promise<Blob | null>((resolve) => {
  if (typeof indexedDB === 'undefined') { resolve(null); return; }
  const request = indexedDB.open('liu-os-notes-files-v1', 1);
  request.onsuccess = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains('attachments')) { db.close(); resolve(null); return; }
    const readRequest = db.transaction('attachments', 'readonly').objectStore('attachments').get(id);
    readRequest.onsuccess = () => { db.close(); resolve((readRequest.result as { blob?: Blob } | undefined)?.blob ?? null); };
    readRequest.onerror = () => { db.close(); resolve(null); };
  };
  request.onerror = () => resolve(null);
});

export const migrateLegacyNotes = async (existing: LocalDocument[]) => {
  if (existing.length || typeof window === 'undefined' || localStorage.getItem(`${LEGACY_NOTES_KEY}-migrated`)) return existing;
  const legacyNotes = readLegacyNotes();
  if (!legacyNotes.length) return existing;
  const migrated = await Promise.all(legacyNotes.map(async (note): Promise<LocalDocument> => {
    const attachments: DocumentAttachment[] = [];
    for (const legacyAttachment of note.attachments ?? []) {
      const legacyBlob = await readLegacyBlob(legacyAttachment.id);
      if (!legacyBlob) continue;
      const blobId = makeBlobId();
      await saveBlob(blobId, legacyBlob);
      attachments.push({
        id: legacyAttachment.id,
        blobId,
        name: legacyAttachment.name,
        type: legacyAttachment.type ?? legacyBlob.type ?? 'application/octet-stream',
        size: legacyAttachment.size ?? legacyBlob.size,
        createdAt: legacyAttachment.createdAt ?? note.createdAt,
      });
    }
    return {
      id: note.id,
      kind: 'note',
      supportStatus: 'editable',
      title: note.title,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      previewData: { type: 'text', text: note.content },
      ...(attachments.length ? { attachments } : {}),
    };
  }));
  await transaction<void>('readwrite', ({ documents }, resolve) => {
    migrated.forEach((document) => documents.put(document));
    resolve();
  });
  localStorage.setItem(`${LEGACY_NOTES_KEY}-migrated`, '1');
  return migrated;
};

export const loadDocuments = async () => migrateLegacyNotes(await listDocuments());

export const createEmptyNote = (language: 'zh' | 'en'): LocalDocument => {
  const now = Date.now();
  return {
    id: makeId('note'),
    kind: 'note',
    supportStatus: 'editable',
    // Empty title: the list shows the first line of the note, like Apple Notes.
    title: language === 'zh' ? '' : '',
    content: '',
    createdAt: now,
    updatedAt: now,
    previewData: { type: 'text', text: '' },
  };
};

export const makeBlobId = () => makeId('blob');

export const hasDocumentStorageCapacity = async (incomingBytes: number) => {
  if (!navigator.storage?.estimate) return true;
  try {
    const estimate = await navigator.storage.estimate();
    if (!estimate.quota) return true;
    const usage = estimate.usage ?? 0;
    const reserve = Math.max(10 * 1024 * 1024, estimate.quota * 0.03);
    return usage + incomingBytes + reserve < estimate.quota;
  } catch {
    return true;
  }
};

const downloadTransaction = async <T>(mode: IDBTransactionMode, handler: (stores: { downloads: IDBObjectStore; blobs: IDBObjectStore }, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void) => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction([DOWNLOAD_STORE, BLOB_STORE], mode);
    let result: T;
    let resultReady = false;
    const setResult = (value: T) => { result = value; resultReady = true; };
    const fail = (reason?: unknown) => {
      try { tx.abort(); } catch { /* The transaction may already be inactive. */ }
      reject(reason ?? new Error('downloads-db-operation-failed'));
    };
    handler({ downloads: tx.objectStore(DOWNLOAD_STORE), blobs: tx.objectStore(BLOB_STORE) }, setResult, fail);
    tx.oncomplete = () => {
      db.close();
      if (resultReady) resolve(result);
      else reject(new Error('downloads-db-result-missing'));
    };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('downloads-db-transaction-failed')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('downloads-db-transaction-aborted')); };
  });
};

export const listDownloadRecords = () => downloadTransaction<DocumentDownloadRecord[]>('readonly', ({ downloads }, resolve, reject) => {
  const request = downloads.getAll();
  request.onsuccess = () => resolve((request.result as DocumentDownloadRecord[]).sort((a, b) => b.createdAt - a.createdAt));
  request.onerror = () => reject(request.error ?? new Error('downloads-list-failed'));
});

export const saveDownloadRecord = (record: DocumentDownloadRecord, blob?: Blob) => downloadTransaction<void>('readwrite', ({ downloads, blobs }, resolve, reject) => {
  const saveRecord = () => {
    const request = downloads.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('download-record-save-failed'));
  };
  if (blob && record.blobId) {
    const blobRequest = blobs.put(blob, record.blobId);
    blobRequest.onsuccess = saveRecord;
    blobRequest.onerror = () => reject(blobRequest.error ?? new Error('download-blob-save-failed'));
    return;
  }
  saveRecord();
});

export const deleteDownloadRecord = (record: DocumentDownloadRecord) => downloadTransaction<void>('readwrite', ({ downloads, blobs }, resolve) => {
  downloads.delete(record.id);
  if (record.blobId) blobs.delete(record.blobId);
  resolve();
});
