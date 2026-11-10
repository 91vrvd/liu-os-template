const DB_NAME = 'liu-os-media-v1';
const DB_VERSION = 1;
const BLOB_STORE = 'audio-blobs';

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('indexeddb-unavailable'));
    return;
  }
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(BLOB_STORE)) request.result.createObjectStore(BLOB_STORE);
  };
  request.onsuccess = () => {
    request.result.onversionchange = () => request.result.close();
    resolve(request.result);
  };
  request.onerror = () => reject(request.error ?? new Error('media-db-open-failed'));
  request.onblocked = () => reject(new Error('media-db-upgrade-blocked'));
});

const blobTransaction = async <T>(mode: IDBTransactionMode, handler: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void) => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, mode);
    let result: T;
    let resultReady = false;
    const setResult = (value: T) => { result = value; resultReady = true; };
    const fail = (reason?: unknown) => {
      try { tx.abort(); } catch { /* The transaction may already be inactive. */ }
      reject(reason ?? new Error('media-db-operation-failed'));
    };
    handler(tx.objectStore(BLOB_STORE), setResult, fail);
    tx.oncomplete = () => {
      db.close();
      if (resultReady) resolve(result);
      else reject(new Error('media-db-result-missing'));
    };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('media-db-transaction-failed')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('media-db-transaction-aborted')); };
  });
};

export const saveMediaBlob = (id: string, blob: Blob) => blobTransaction<void>('readwrite', (store, resolve, reject) => {
  const request = store.put(blob, id);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error ?? new Error('media-blob-save-failed'));
});

export const getMediaBlob = (id: string) => blobTransaction<Blob | null>('readonly', (store, resolve, reject) => {
  const request = store.get(id);
  request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
  request.onerror = () => reject(request.error ?? new Error('media-blob-read-failed'));
});

export const deleteMediaBlob = (id: string) => blobTransaction<void>('readwrite', (store, resolve) => {
  store.delete(id);
  resolve();
});

export const makeMediaBlobId = () => `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const hasMediaStorageCapacity = async (incomingBytes: number) => {
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
