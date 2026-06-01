import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useOfflineQueue } from '../hooks/useOfflineQueue.js';
import { getAllQueue, updateQueueItem } from '../utils/indexedDB.js';
import { formatQueuedTime, parseQueueItem } from '../utils/parseQueueItem.js';
import { requestOfflineQueueDrain } from '../utils/offlineSync.js';
import { usePwaInstall } from '../context/PwaInstallContext.jsx';

function errorLabel(code) {
  if (code === 'auth_expired') return 'Sign in again to sync';
  if (code === 'rate_limited') return 'Rate limited — will retry';
  if (code === 'network_error') return 'Network error';
  if (code?.startsWith('http_')) return `Server error (${code.replace('http_', '')})`;
  return 'Sync failed';
}

function QueueItemRow({ item, onRetry }) {
  const reportLabel = item.reportType === 'found' ? 'Found' : 'Lost';

  return (
    <div
      className={`p-md rounded-xl border flex items-center gap-md ${
        item.syncFailed
          ? 'bg-error-container/20 border-error/30'
          : 'bg-surface-container border-outline-variant'
      }`}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-variant shrink-0 flex items-center justify-center">
        {item.imageSrc ? (
          <img alt="" className="w-full h-full object-cover" src={item.imageSrc} />
        ) : (
          <span className="material-symbols-outlined text-on-surface-variant">inventory_2</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-h3 text-h3 text-on-surface truncate">{item.title}</p>
        <p className="font-caption text-caption text-on-surface-variant truncate">
          {reportLabel} · {item.locationName}
          {item.queuedAt ? ` · ${formatQueuedTime(item.queuedAt)}` : ''}
        </p>
        {item.attempts > 0 ? (
          <p className="font-caption text-caption text-outline mt-0.5">
            Attempt {item.attempts}/{item.maxAttempts}
            {item.lastError ? ` · ${errorLabel(item.lastError)}` : ''}
          </p>
        ) : null}
      </div>
      {item.syncFailed ? (
        <button
          type="button"
          onClick={() => onRetry(item.id)}
          className="font-label-sm text-primary shrink-0 hover:underline"
        >
          Retry
        </button>
      ) : (
        <span className="material-symbols-outlined text-outline-variant shrink-0" title="Waiting to sync">
          schedule
        </span>
      )}
    </div>
  );
}

/**
 * Offline PWA hub — live queue from IndexedDB, sync via service worker.
 */
export default function OfflineExperiencePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = useOfflineQueue();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const { install: installApp } = usePwaInstall();

  const loadQueue = useCallback(async () => {
    try {
      const rows = await getAllQueue();
      setQueue(rows.map(parseQueueItem));
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (isOnline) {
      loadQueue();
    }
  }, [isOnline, loadQueue]);

  useEffect(() => {
    function handleQueueChanged() {
      loadQueue();
    }

    window.addEventListener('hawalay:offline-queue-changed', handleQueueChanged);
    return () => window.removeEventListener('hawalay:offline-queue-changed', handleQueueChanged);
  }, [loadQueue]);

  async function handleRetryItem(itemId) {
    await updateQueueItem(itemId, { attempts: 0, lastError: null, lastAttemptAt: null });
    await loadQueue();
    if (navigator.onLine) {
      await requestOfflineQueueDrain();
    }
  }

  async function handleRetryConnection() {
    setRetrying(true);
    try {
      if (!navigator.onLine) {
        toast.info('Still offline. Your queued reports are safe locally.');
        return;
      }

      const summary = await requestOfflineQueueDrain();
      await loadQueue();

      const synced = summary?.syncedIds?.length ?? 0;
      const failed = summary?.failedIds?.length ?? 0;
      const remaining = summary?.remaining ?? queue.length;

      if (synced > 0 && remaining === 0) {
        toast.success(`Synced ${synced} report${synced === 1 ? '' : 's'}.`);
        navigate('/dashboard');
      } else if (synced > 0 && remaining > 0) {
        toast.warning(`Synced ${synced}, ${remaining} still pending${failed ? ` (${failed} failed)` : ''}.`);
      } else if (remaining === 0) {
        toast.success('Back online — all queued reports synced.');
        navigate('/dashboard');
      } else if (failed > 0) {
        toast.info(`${remaining} report(s) pending. ${failed} need retry — check errors below.`);
      } else {
        toast.info(`${remaining} report(s) still pending sync.`);
      }
    } catch {
      toast.error('Could not sync right now. Try again when your connection is stable.');
    } finally {
      setRetrying(false);
    }
  }

  async function handleInstall() {
    const result = await installApp();
    if (result.outcome === 'accepted') {
      toast.success('Hawalay installed.');
    }
  }

  const pendingCount = queue.length;
  const statusTitle = isOnline ? 'Connection restored' : 'Taking a Breath';
  const statusBody = isOnline
    ? 'You are online. Pending reports will sync automatically, or tap Retry to sync now.'
    : "You're currently offline. Reports you submit are saved locally and will sync when you're back.";

  return (
    <div className="bg-background text-on-surface min-h-screen pb-24">
      <div className="px-margin-mobile max-w-lg mx-auto pt-4">
        <section className="flex flex-col items-center text-center mb-xl">
          <div
            className={`w-full max-w-[200px] aspect-square mb-lg rounded-full flex items-center justify-center ${
              isOnline ? 'bg-primary-container/20' : 'bg-secondary-container/30'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[72px] ${
                isOnline ? 'text-primary' : 'text-on-surface-variant'
              }`}
              style={isOnline ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {isOnline ? 'cloud_done' : 'cloud_off'}
            </span>
          </div>
          <h2 className="font-h1 text-h1 text-on-surface mb-xs">{statusTitle}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-[320px]">{statusBody}</p>
          <button
            type="button"
            onClick={handleRetryConnection}
            disabled={retrying}
            className="mt-lg px-xl py-md bg-primary text-on-primary rounded-full font-h3 text-h3 shadow-sm active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
          >
            {retrying ? (
              <Spinner className="w-5 h-5" />
            ) : (
              <span className="material-symbols-outlined">refresh</span>
            )}
            {isOnline ? 'Sync now' : 'Retry connection'}
          </button>
          {user ? (
            <p className="font-caption text-caption text-outline mt-md">
              Signed in as {user.name}
            </p>
          ) : null}
        </section>

        <section className="mb-xl p-lg rounded-xl glass-panel border border-primary/10 shadow-sm flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-h3 text-h3 text-primary mb-1">Access Everywhere</h3>
            <p className="font-caption text-caption text-on-surface-variant">
              Install Hawalay to report lost or found items even with poor connectivity.
            </p>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            className="bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-md py-sm rounded-lg active:scale-95 transition-all shrink-0"
          >
            Install
          </button>
        </section>

        <section className="mb-xl">
          <div className="flex items-center justify-between mb-md">
            <h3 className="font-h2 text-h2 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary">cloud_sync</span>
              Sync pending
            </h3>
            {pendingCount > 0 ? (
              <span className="bg-tertiary-container text-on-tertiary-container text-caption font-caption px-xs py-1 rounded-full">
                {pendingCount} {pendingCount === 1 ? 'item' : 'items'}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="flex justify-center py-lg">
              <Spinner />
            </div>
          ) : pendingCount === 0 ? (
            <EmptyState
              icon="check_circle"
              title="Nothing waiting to sync"
              subtitle="Submit a report while offline and it will appear here until it reaches the server."
              actionLabel="Report an item"
              onAction={() => navigate('/report')}
              className="py-md"
            />
          ) : (
            <div className="space-y-md">
              {queue.map((item) => (
                <QueueItemRow key={item.id} item={item} onRetry={handleRetryItem} />
              ))}
            </div>
          )}
        </section>

        <section className="mb-xl pb-8">
          <h3 className="font-h2 text-h2 mb-md">Available offline</h3>
          <div className="grid grid-cols-2 gap-md">
            <Link
              to="/report"
              className="aspect-square rounded-xl bg-surface-container-low p-md flex flex-col justify-between border border-primary/5 active:scale-98 transition-all"
            >
              <span className="material-symbols-outlined text-primary text-3xl">add_circle</span>
              <div>
                <p className="font-h3 text-h3">Report item</p>
                <p className="font-caption text-caption text-on-surface-variant">Queues for sync</p>
              </div>
            </Link>
            <Link
              to="/dashboard"
              className="aspect-square rounded-xl bg-surface-container-low p-md flex flex-col justify-between border border-primary/5 active:scale-98 transition-all"
            >
              <span className="material-symbols-outlined text-primary text-3xl">home</span>
              <div>
                <p className="font-h3 text-h3">Dashboard</p>
                <p className="font-caption text-caption text-on-surface-variant">Cached shell</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
