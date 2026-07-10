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
  const navigate = useNavigate();
  const displayName = authUser?.name ?? 'there';

  const [stats, setStats] = useState(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

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

  return (
    <div className="bg-background text-on-background min-h-screen pb-24">
      <div className="w-full max-w-5xl lg:max-w-6xl mx-auto px-margin-mobile md:px-8 space-y-lg">
        <section className="mt-4 space-y-xs">
          <h2 className="font-h1 text-h1 text-on-surface">
            Hello, {displayName} <span aria-hidden>👋</span>
          </h2>
          <DashboardLocationBadge />
        </section>

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
