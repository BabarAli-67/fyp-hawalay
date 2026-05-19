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
