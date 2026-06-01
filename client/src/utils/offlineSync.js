const SYNC_TAG = 'sync-lost-found-items';
const DRAIN_DEBOUNCE_MS = 800;
const TAB_LOCK_MS = 30_000;
const TAB_LOCK_KEY = 'hawalay:offline-drain-lock';

/** @type {BroadcastChannel | null} */
let broadcastChannel = null;
let drainDebounceTimer = null;
let clientDrainInFlight = false;

function getBroadcastChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel('hawalay-offline-sync');
  }
  return broadcastChannel;
}

function dispatchQueueChanged(detail) {
  window.dispatchEvent(new CustomEvent('hawalay:offline-queue-changed', { detail }));
}

function readTabLock() {
  try {
    const raw = sessionStorage.getItem(TAB_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > TAB_LOCK_MS) {
      sessionStorage.removeItem(TAB_LOCK_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setTabLock() {
  try {
    sessionStorage.setItem(
      TAB_LOCK_KEY,
      JSON.stringify({ at: Date.now(), tabId: `${Date.now()}-${Math.random()}` }),
    );
  } catch {
    // sessionStorage unavailable
  }
}

function clearTabLock() {
  try {
    sessionStorage.removeItem(TAB_LOCK_KEY);
  } catch {
    // ignore
  }
}

/**
 * Ask the service worker to drain the offline report queue.
 * Debounced; coalesces rapid calls from online events and multiple tabs.
 * @returns {Promise<object|null>} Sync summary from SW, or null if skipped
 */
export function requestOfflineQueueDrain() {
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    if (drainDebounceTimer) {
      clearTimeout(drainDebounceTimer);
    }

    drainDebounceTimer = setTimeout(async () => {
      drainDebounceTimer = null;
      const result = await executeDrain();
      resolve(result);
    }, DRAIN_DEBOUNCE_MS);
  });
}

async function executeDrain() {
  if (clientDrainInFlight) {
    return { skipped: true, reason: 'client_in_flight' };
  }

  if (readTabLock()) {
    return { skipped: true, reason: 'other_tab' };
  }

  try {
    clientDrainInFlight = true;
    setTabLock();
    getBroadcastChannel()?.postMessage({ type: 'DRAIN_STARTED', at: Date.now() });

    const registration = await navigator.serviceWorker.ready;

    if (registration.sync && typeof registration.sync.register === 'function') {
      try {
        await registration.sync.register(SYNC_TAG);
      } catch {
        // Background Sync unsupported or registration failed — postMessage still runs.
      }
    }

    const summary = await postDrainMessage(registration.active);
    if (summary) {
      dispatchQueueChanged(summary);
    }
    getBroadcastChannel()?.postMessage({ type: 'DRAIN_FINISHED', at: Date.now() });
    return summary;
  } catch {
    return null;
  } finally {
    clientDrainInFlight = false;
    clearTabLock();
  }
}

function postDrainMessage(worker) {
  if (!worker) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => resolve(null), 60_000);

    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      resolve(event.data ?? null);
    };

    worker.postMessage({ type: 'DRAIN_OFFLINE_QUEUE' }, [channel.port2]);
  });
}

function handleSwMessage(event) {
  const data = event.data;
  if (!data?.type) return;

  if (data.type === 'OFFLINE_QUEUE_SYNC_COMPLETE' || data.type === 'OFFLINE_QUEUE_DRAINED') {
    dispatchQueueChanged(data);
  }
}

function handleBroadcastMessage(event) {
  if (event.data?.type === 'DRAIN_STARTED') {
    try {
      sessionStorage.setItem(
        TAB_LOCK_KEY,
        JSON.stringify({ at: event.data.at ?? Date.now(), tabId: 'peer' }),
      );
    } catch {
      // ignore
    }
  }

  if (event.data?.type === 'DRAIN_FINISHED') {
    clearTabLock();
  }
}

export function registerOfflineSyncListeners() {
  if (!('serviceWorker' in navigator)) return undefined;

  const onLoad = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.info('[sw] registered:', reg.scope);
        if (navigator.onLine) {
          requestOfflineQueueDrain();
        }
      })
      .catch((err) => console.warn('[sw] registration failed:', err));
  };

  const onOnline = () => {
    requestOfflineQueueDrain();
  };

  navigator.serviceWorker.addEventListener('message', handleSwMessage);
  getBroadcastChannel()?.addEventListener('message', handleBroadcastMessage);

  window.addEventListener('load', onLoad);
  window.addEventListener('online', onOnline);

  return () => {
    window.removeEventListener('load', onLoad);
    window.removeEventListener('online', onOnline);
    navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    broadcastChannel?.removeEventListener('message', handleBroadcastMessage);
    broadcastChannel?.close();
    broadcastChannel = null;
    if (drainDebounceTimer) {
      clearTimeout(drainDebounceTimer);
      drainDebounceTimer = null;
    }
  };
}

/** Max sync attempts before an item is skipped (must match public/sw.js). */
export const MAX_SYNC_ATTEMPTS = 5;

export { SYNC_TAG, DRAIN_DEBOUNCE_MS };
