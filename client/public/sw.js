/* eslint-disable no-restricted-globals */
/**
 * Hawalay PWA service worker — static cache + offline report queue drain.
 * Plain JS only (no ES modules).
 */

const CACHE_NAME = 'hawalay-v2';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];

const DB_NAME = 'lostfound-db';
const DB_VERSION = 2;
const STORE_NAME = 'offline_queue';

const SYNC_TAG = 'sync-lost-found-items';
const MAX_SYNC_ATTEMPTS = 5;

/** Prevents overlapping drains from sync events, messages, or multiple tabs. */
let activeDrainPromise = null;

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => undefined)),
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Fetch: network-first for /api/, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});

// Background sync: drain offline queue
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(drainOfflineQueue());
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'DRAIN_OFFLINE_QUEUE') {
    const replyPort = event.ports?.[0] ?? null;
    event.waitUntil(
      drainOfflineQueue().then((summary) => {
        broadcastSyncSummary(summary, replyPort);
      }),
    );
  }
});

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false });
      }
      if (!db.objectStoreNames.contains('report_drafts')) {
        db.createObjectStore('report_drafts', { keyPath: 'userId' });
      }
    };
  });
}

function getAllQueueItems(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

function putQueueItem(db, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
}

function deleteQueueItem(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function resolveEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return null;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const origin = self.location.origin;
  if (endpoint.startsWith('/')) {
    return `${origin}${endpoint}`;
  }
  return `${origin}/${endpoint}`;
}

function base64ToBlob(base64, mimeType) {
  const raw = typeof base64 === 'string' ? base64 : '';
  const payload = raw.includes(',') ? raw.split(',')[1] : raw;
  const bytes = atob(payload);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mimeType || 'image/jpeg' });
}

function reconstructFormData(queuedItem) {
  const fd = new FormData();
  const fields = JSON.parse(queuedItem.body || '{}');
  for (const [key, value] of Object.entries(fields)) {
    if (value != null && value !== '') {
      fd.append(key, value);
    }
  }
  if (queuedItem.imageBase64) {
    const mimeType = queuedItem.mimeType || 'image/jpeg';
    const filename = queuedItem.filename || 'image.jpg';
    const blob = base64ToBlob(queuedItem.imageBase64, mimeType);
    fd.append('image', blob, filename);
  }
  return fd;
}

function sortQueueItems(items) {
  return [...items].sort((a, b) => {
    const aTime = Number(a.queuedAt) || 0;
    const bTime = Number(b.queuedAt) || 0;
    return aTime - bTime;
  });
}

async function syncQueueItem(db, item) {
  const url = resolveEndpoint(item.endpoint);
  if (!url) {
    return {
      id: item.id,
      outcome: 'failed',
      reason: 'invalid_endpoint',
      attempts: (item.attempts || 0) + 1,
    };
  }

  const formData = reconstructFormData(item);
  const headers = {};
  if (item.authHeader && typeof item.authHeader === 'string') {
    headers.Authorization = item.authHeader;
  }

  const response = await fetch(url, {
    method: item.method || 'POST',
    headers,
    body: formData,
  });

  if (response.ok) {
    await deleteQueueItem(db, item.id);
    return { id: item.id, outcome: 'synced', status: response.status };
  }

  const attempts = (item.attempts || 0) + 1;
  const lastError =
    response.status === 401
      ? 'auth_expired'
      : response.status === 429
        ? 'rate_limited'
        : `http_${response.status}`;

  await putQueueItem(db, {
    ...item,
    attempts,
    lastError,
    lastAttemptAt: Date.now(),
  });

  return {
    id: item.id,
    outcome: 'failed',
    reason: lastError,
    status: response.status,
    attempts,
  };
}

async function drainOfflineQueueInner() {
  const summary = {
    syncedIds: [],
    failedIds: [],
    skippedIds: [],
    remaining: 0,
  };

  let db;
  try {
    db = await openIndexedDB();
  } catch (err) {
    console.warn('[sw] could not open IndexedDB:', err);
    return summary;
  }

  let items;
  try {
    items = await getAllQueueItems(db);
  } catch (err) {
    console.warn('[sw] could not read offline queue:', err);
    return summary;
  }

  const sorted = sortQueueItems(items);

  for (const item of sorted) {
    const attempts = Number(item.attempts) || 0;
    if (attempts >= MAX_SYNC_ATTEMPTS) {
      summary.skippedIds.push(item.id);
      continue;
    }

    try {
      const result = await syncQueueItem(db, item);
      if (result.outcome === 'synced') {
        summary.syncedIds.push(result.id);
      } else {
        summary.failedIds.push(result.id);
      }
    } catch (err) {
      const nextAttempts = attempts + 1;
      const isNetwork = err instanceof TypeError;
      try {
        await putQueueItem(db, {
          ...item,
          attempts: nextAttempts,
          lastError: isNetwork ? 'network_error' : 'sync_error',
          lastAttemptAt: Date.now(),
        });
      } catch (writeErr) {
        console.warn('[sw] could not update failed item:', item.id, writeErr);
      }
      summary.failedIds.push(item.id);
      console.warn('[sw] offline sync failed for item:', item.id, err);
    }
  }

  try {
    const remaining = await getAllQueueItems(db);
    summary.remaining = remaining.length;
  } catch {
    summary.remaining = summary.failedIds.length + summary.skippedIds.length;
  }

  return summary;
}

function drainOfflineQueue() {
  if (activeDrainPromise) {
    return activeDrainPromise;
  }

  activeDrainPromise = drainOfflineQueueInner()
    .catch((err) => {
      console.warn('[sw] drain failed:', err);
      return {
        syncedIds: [],
        failedIds: [],
        skippedIds: [],
        remaining: 0,
        error: err?.message || 'drain_failed',
      };
    })
    .finally(() => {
      activeDrainPromise = null;
    });

  return activeDrainPromise;
}

function broadcastSyncSummary(summary, replyPort) {
  const payload = {
    type: 'OFFLINE_QUEUE_SYNC_COMPLETE',
    syncedIds: summary.syncedIds ?? [],
    failedIds: summary.failedIds ?? [],
    skippedIds: summary.skippedIds ?? [],
    remaining: summary.remaining ?? 0,
    error: summary.error ?? null,
  };

  if (replyPort) {
    try {
      replyPort.postMessage(payload);
    } catch {
      // Port may be closed if the tab navigated away.
    }
  }

  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage(payload);
    });
  });

  (summary.syncedIds ?? []).forEach((itemId) => {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'OFFLINE_QUEUE_DRAINED', itemId });
      });
    });
  });
}
