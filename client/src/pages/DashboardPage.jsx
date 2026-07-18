import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCommunityStats } from '../api/statsService.js';
import { CommunityImpactCard } from '../components/dashboard/CommunityImpactCard.jsx';
import { DashboardLocationBadge } from '../components/dashboard/DashboardLocationBadge.jsx';
import { DashboardSearchBar } from '../components/dashboard/DashboardSearchBar.jsx';
import { HowHawalayWorks } from '../components/dashboard/HowHawalayWorks.jsx';
import { PrivacyPriorityBanner } from '../components/dashboard/PrivacyPriorityBanner.jsx';
import { RecentlyFoundSection } from '../components/dashboard/RecentlyFoundSection.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useOfflineQueue } from '../hooks/useOfflineQueue.js';
import { getAllQueue } from '../utils/indexedDB.js';

const EMPTY_STATS = {
  itemsLost: 0,
  itemsFound: 0,
  itemsReunited: 0,
  activeHelpers: 0,
};

/**
 * Home dashboard — quick actions, community search, platform impact, and onboarding.
 */
export default function DashboardPage() {
  const { user: authUser } = useAuth();
  const { isOnline } = useOfflineQueue();
  const navigate = useNavigate();
  const displayName = authUser?.name ?? 'there';

  const [stats, setStats] = useState(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const { data } = await getCommunityStats();
      setStats({
        itemsLost: Number(data?.itemsLost) || 0,
        itemsFound: Number(data?.itemsFound) || 0,
        itemsReunited: Number(data?.itemsReunited) || 0,
        activeHelpers: Number(data?.activeHelpers) || 0,
      });
    } catch {
      setStats(EMPTY_STATS);
      setStatsError('Could not load community statistics.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const loadPendingSyncCount = useCallback(async () => {
    try {
      const queue = await getAllQueue();
      setPendingSyncCount(queue.length);
    } catch {
      setPendingSyncCount(0);
    }
  }, []);

  useEffect(() => {
    loadPendingSyncCount();

    const handleQueueChanged = () => loadPendingSyncCount();
    window.addEventListener('hawalay:offline-queue-changed', handleQueueChanged);
    return () => window.removeEventListener('hawalay:offline-queue-changed', handleQueueChanged);
  }, [loadPendingSyncCount]);

  useEffect(() => {
    loadPendingSyncCount();
  }, [isOnline, loadPendingSyncCount]);

  return (
    <div className="bg-background text-on-background min-h-screen pb-24">
      <div className="w-full max-w-5xl lg:max-w-6xl mx-auto px-margin-mobile md:px-8 space-y-lg">
        <section className="mt-4 space-y-xs">
          <h2 className="font-h1 text-h1 text-on-surface">
            Hello, {displayName} <span aria-hidden>👋</span>
          </h2>
          <DashboardLocationBadge />
        </section>

        {pendingSyncCount > 0 ? (
          <section
            className="flex items-center gap-md rounded-xl border border-tertiary/20 bg-tertiary-container px-md py-sm text-on-tertiary-container shadow-sm"
            role="status"
            aria-live="polite"
          >
            <span className="material-symbols-outlined shrink-0" aria-hidden>
              cloud_sync
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-label-sm text-label-sm">
                {pendingSyncCount} {pendingSyncCount === 1 ? 'report is' : 'reports are'} pending sync
              </p>
              <p className="font-caption text-caption">
                {isOnline
                  ? 'Syncing automatically. This notice will disappear after a successful sync.'
                  : 'Saved on this device and will sync automatically when you reconnect.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/offline')}
              className="shrink-0 rounded-lg px-sm py-xs font-label-sm text-label-sm hover:bg-on-tertiary-container/10"
            >
              View
            </button>
          </section>
        ) : null}

        <section className="grid grid-cols-2 gap-md md:gap-lg">
          <button
            type="button"
            onClick={() => navigate('/report')}
            className="bg-primary shadow-sm rounded-xl p-md md:p-lg flex flex-col justify-between aspect-square md:aspect-auto md:h-44 lg:h-48 active:scale-95 transition-transform duration-200 cursor-pointer text-left"
          >
            <div className="bg-white/20 w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white">add_circle</span>
            </div>
            <span className="text-white font-h3 text-h3 leading-tight">Report Item</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/my-matches')}
            className="bg-surface-container shadow-sm rounded-xl p-md md:p-lg flex flex-col justify-between aspect-square md:aspect-auto md:h-44 lg:h-48 active:scale-95 transition-transform duration-200 cursor-pointer border border-outline-variant/30 text-left"
          >
            <div className="bg-on-surface-variant/10 w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant">auto_awesome</span>
            </div>
            <span className="text-on-surface font-h3 text-h3 leading-tight">My Matches</span>
          </button>
        </section>

        <DashboardSearchBar />

        <CommunityImpactCard
          stats={stats}
          loading={statsLoading}
          error={statsError}
          onRetry={loadStats}
        />

        <RecentlyFoundSection />

        <HowHawalayWorks />

        <PrivacyPriorityBanner />
      </div>
    </div>
  );
}
