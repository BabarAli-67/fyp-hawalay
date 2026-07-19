import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getMatchesForItem, getUserMatches } from '../api/matchesService.js';
import { MatchCard } from '../components/matches/MatchCard.jsx';
import { MatchCardSkeleton } from '../components/matches/MatchCardSkeleton.jsx';
import { MatchFilterBar } from '../components/matches/MatchFilterBar.jsx';
import { useUserLocation } from '../hooks/useUserLocation.js';
import { formatDistanceKm } from '../utils/geoDistance.js';
import { mapMatchForCard } from '../utils/mapMatchForCard.js';
import { matchesCacheKey, readListCache, writeListCache } from '../utils/browseCache.js';
import { sortMatches } from '../utils/matchSort.js';

const SUBMITTED_BANNER_MS = 5000;
const ALL_MATCHES_LIMIT = 100;

/**
 * Unified Smart Matches page — all user matches, or scoped to one report via route param.
 * Routes: `/my-matches` and `/matches/ai/:itemId` (same component).
 */
export default function SmartMatchesPage() {
  const { itemId: scopedReportId } = useParams();
  const location = useLocation();
  const reportSubmitted = location.state?.reportSubmitted === true;

  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showSubmittedBanner, setShowSubmittedBanner] = useState(reportSubmitted);

  const nearMeEnabled = activeFilter === 'near';
  const { coords: userCoords, status: locationStatus, error: locationError, requestLocation } =
    useUserLocation({ enabled: nearMeEnabled });

  const loadMatches = useCallback(async () => {
    const cacheKey = matchesCacheKey(scopedReportId);
    const cached = readListCache(cacheKey);

    // Stale-while-revalidate: render cached matches instantly, refresh in background.
    if (cached) {
      setMatches(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);

    try {
      const data = scopedReportId
        ? await getMatchesForItem(scopedReportId)
        : await getUserMatches(1, ALL_MATCHES_LIMIT);
      const rows = Array.isArray(data?.matches) ? data.matches : [];
      const mapped = rows.map(mapMatchForCard);
      setMatches(mapped);
      writeListCache(cacheKey, mapped);
    } catch (err) {
      if (!cached) {
        const message = err?.response?.data?.error || 'Could not load matches';
        setLoadError(message);
        setMatches([]);
        toast.error(message, { autoClose: 4000 });
      }
    } finally {
      setIsLoading(false);
    }
  }, [scopedReportId]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    if (!reportSubmitted) return undefined;
    const timer = window.setTimeout(() => setShowSubmittedBanner(false), SUBMITTED_BANNER_MS);
    return () => window.clearTimeout(timer);
  }, [reportSubmitted]);

  useEffect(() => {
    function handleRefresh(event) {
      const payload = event.detail ?? {};
      if (scopedReportId) {
        const payloadItemId = payload.itemId || payload.sourceItemId;
        if (payloadItemId && String(payloadItemId) !== String(scopedReportId)) {
          return;
        }
      }
      loadMatches();
    }

    window.addEventListener('hawalay:refresh-matches', handleRefresh);
    return () => window.removeEventListener('hawalay:refresh-matches', handleRefresh);
  }, [scopedReportId, loadMatches]);

  const displayedMatches = useMemo(
    () => sortMatches(matches, activeFilter, userCoords),
    [matches, activeFilter, userCoords],
  );

  function handleFilterChange(filterId) {
    setActiveFilter(filterId);
    if (filterId === 'near') {
      requestLocation();
    }
  }

  const pageTitle = scopedReportId ? 'Matches found' : 'Smart Matches';
  const pageSubtitle = scopedReportId
    ? 'AI candidates for this report, ranked and filterable.'
    : 'All AI match candidates across your lost and found reports.';

  return (
    <div className="bg-background text-on-background min-h-screen pb-24 overflow-x-hidden">
      <div className="px-margin-mobile max-w-2xl mx-auto w-full">
        <section className="mb-lg mt-4">
          {showSubmittedBanner ? (
            <div
              className="rounded-xl border border-primary-container/40 bg-primary-container/10 px-md py-md mb-md flex items-start gap-sm"
              role="status"
            >
              <span
                className="material-symbols-outlined text-primary shrink-0 mt-0.5"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden
              >
                check_circle
              </span>
              <p className="font-body-md text-on-surface flex-1 min-w-0">
                Your item was submitted! We&apos;ll notify you when we find a match.
              </p>
              <button
                type="button"
                onClick={() => setShowSubmittedBanner(false)}
                className="shrink-0 text-on-surface-variant hover:text-on-surface p-1 rounded-full"
                aria-label="Dismiss"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          ) : null}

          <h2 className="font-h1 text-h1 text-on-surface mb-xs">{pageTitle}</h2>
          <p className="font-body-md text-on-surface-variant">{pageSubtitle}</p>

          <div className="mt-sm flex flex-wrap items-center gap-sm">
            {scopedReportId ? (
              <>
                <Link
                  to={`/item/${scopedReportId}`}
                  className="font-label-sm text-primary hover:underline"
                >
                  View your report
                </Link>
                <Link to="/my-matches" className="font-label-sm text-primary hover:underline">
                  View all matches
                </Link>
              </>
            ) : null}
          </div>
        </section>

        <MatchFilterBar activeFilter={activeFilter} onFilterChange={handleFilterChange} />

        {activeFilter === 'near' && locationStatus === 'loading' ? (
          <p className="font-caption text-on-surface-variant mb-md" role="status">
            Getting your location for nearby sorting…
          </p>
        ) : null}

        {activeFilter === 'near' && locationStatus === 'error' ? (
          <div
            className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-md py-sm mb-md flex flex-wrap items-center justify-between gap-sm"
            role="alert"
          >
            <p className="font-caption text-on-surface-variant">
              {locationError || 'Location unavailable — showing highest accuracy instead.'}
            </p>
            <button
              type="button"
              onClick={requestLocation}
              className="font-label-sm text-primary hover:underline shrink-0"
            >
              Try again
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-lg">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <div
            className="rounded-xl border border-outline-variant/30 bg-error-container px-md py-md text-center"
            role="alert"
          >
            <p className="font-body-md text-on-error-container mb-sm">{loadError}</p>
            <button
              type="button"
              onClick={loadMatches}
              className="font-label-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!isLoading && !loadError && displayedMatches.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-xl text-center">
            <span
              className="material-symbols-outlined text-[48px] text-on-surface-variant mb-sm block"
              aria-hidden
            >
              travel_explore
            </span>
            <p className="font-h3 text-h3 text-on-surface">
              {matches.length === 0
                ? 'No matches found yet — we\'re still looking'
                : 'No matches match this filter'}
            </p>
            <p className="font-body-md text-on-surface-variant mt-xs">
              {matches.length === 0
                ? 'New matches will appear here and in your alerts when we find similar items.'
                : 'Try another filter or check back when more reports are added.'}
            </p>
          </div>
        ) : null}

        {!isLoading && !loadError && displayedMatches.length > 0 ? (
          <div className="space-y-lg pb-2" key={activeFilter}>
            {displayedMatches.map((match) => (
              <MatchCard
                key={match._id}
                match={match}
                distanceLabel={
                  activeFilter === 'near' && match.distanceKm != null
                    ? formatDistanceKm(match.distanceKm)
                    : ''
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
