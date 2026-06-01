import { openDB as openIdb } from 'idb';

export const DB_NAME = 'lostfound-db';
export const DB_VERSION = 1;
export const STORE_NAME = 'offline_queue';

let dbPromise;

/**
 * Opens (or reuses) the offline queue database.
 * Safe to call from the main thread and from a Service Worker.
 */
export function openDB() {
  if (!dbPromise) {
    dbPromise = openIdb(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * @param {Record<string, unknown>} record
 * @returns {Promise<Record<string, unknown>>}
 */
export async function addToQueue(record) {
  const db = await openDB();
  const item = {
    ...record,
    id: record.id ?? crypto.randomUUID(),
    attempts: record.attempts ?? 0,
  };
  await db.put(STORE_NAME, item);
  return item;
}

/**
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function getAllFromQueue() {
  const db = await openDB();
  return db.getAll(STORE_NAME);
}

/** Alias for getAllFromQueue (main thread). */
export async function getAllQueue() {
  return getAllFromQueue();
}

/**
 * Raw IndexedDB open — same schema as openDB(), usable without the idb ESM wrapper.
 * Service Worker duplicates this in public/sw.js (cannot import modules).
 */
export function openQueueDBRaw() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false });
      }
    };
  });
}

/**
 * Read all queued items via raw IndexedDB (no idb dependency).
 */
export async function getAllQueueRaw() {
  const db = await openQueueDBRaw();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * @param {string} id
 */
export async function deleteFromQueue(id) {
  const db = await openDB();
  await db.delete(STORE_NAME, id);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} updates
 * @returns {Promise<Record<string, unknown> | undefined>}
 */
export async function updateQueueItem(id, updates) {
  const db = await openDB();
  const existing = await db.get(STORE_NAME, id);
  if (!existing) {
    return undefined;
  }
  const updated = { ...existing, ...updates };
  await db.put(STORE_NAME, updated);
  return updated;
}
