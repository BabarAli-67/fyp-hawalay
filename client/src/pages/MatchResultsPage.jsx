import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getMatchesForItem } from '../api/matchesService.js';
import { MatchCard } from '../components/matches/MatchCard.jsx';

function formatMatchDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function mapMatchForCard(row) {
  const item = row.item || {};
  return {
    _id: row.matchId,
    itemId: item._id,
    hasImage: Boolean(item.imageFileId),
    similarityScore: Number(row.score) || 0,
    title: item.title || 'Untitled item',
    category: item.category || '',
    locationName: item.locationName || 'Location unknown',
    date: formatMatchDate(item.date || row.createdAt),
  };
}

function MatchCardSkeleton() {
  return (
    <div
      className="animate-pulse bg-surface-container-lowest rounded-xl premium-shadow overflow-hidden"
      role="status"
      aria-label="Loading match"
    >
      <div className="h-48 w-full bg-surface-container" />
      <div className="p-md space-y-2">
        <div className="h-5 w-2/3 rounded bg-surface-container" />
        <div className="h-3 w-1/2 rounded bg-surface-container" />
        <div className="h-3 w-3/4 rounded bg-surface-container" />
      </div>
    </div>
  );
}

/**
 * AI match results for a single source item.
 */
export default function MatchResultsPage() {
  const { itemId } = useParams();
  const location = useLocation();
  const reportSubmitted = location.state?.reportSubmitted === true;
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadMatches = useCallback(async () => {
    if (!itemId) {
      setMatches([]);
      setIsLoading(false);
      setLoadError('Missing item id');
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getMatchesForItem(itemId);
      const rows = Array.isArray(data?.matches) ? data.matches : [];
      setMatches(rows.map(mapMatchForCard));
    } catch (err) {
      const message = err?.response?.data?.error || 'Could not load matches';
      setLoadError(message);
      setMatches([]);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    function handleRefresh(event) {
      const payload = event.detail ?? {};
      if (payload.sourceItemId && String(payload.sourceItemId) !== String(itemId)) {
        return;
      }
      loadMatches();
    }

    window.addEventListener('hawalay:refresh-matches', handleRefresh);
    return () => window.removeEventListener('hawalay:refresh-matches', handleRefresh);
  }, [itemId, loadMatches]);

  return (
    <div className="bg-background text-on-background min-h-screen pb-24">
      <div className="px-margin-mobile max-w-2xl mx-auto">
        <section className="mb-lg mt-4">
          {reportSubmitted ? (
            <div
              className="rounded-xl border border-primary-container/40 bg-primary-container/10 px-md py-md mb-md"
              role="status"
            >
              <p className="font-body-md text-on-surface">
                Your item was submitted! We&apos;ll notify you when we find a match.
              </p>
            </div>
          ) : null}
          <h2 className="font-h1 text-h1 text-on-surface mb-xs">Matches found</h2>
          <p className="font-body-md text-on-surface-variant">
            Our AI compared reports to surface likely candidates for your item.
          </p>
          {itemId ? (
            <Link
              to={`/item/${itemId}`}
              className="inline-block mt-sm font-label-sm text-primary hover:underline"
            >
              View your report
            </Link>
          ) : null}
        </section>

        <section className="flex gap-xs overflow-x-auto pb-md no-scrollbar">
          <button
            type="button"
            className="active-chip px-lg py-xs rounded-full font-label-sm whitespace-nowrap premium-shadow"
          >
            All Matches
          </button>
          <button
            type="button"
            className="bg-surface-container text-on-surface-variant px-lg py-xs rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-colors"
          >
            Highest Accuracy
          </button>
          <button
            type="button"
            className="bg-surface-container text-on-surface-variant px-lg py-xs rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-colors"
          >
            Recently Added
          </button>
          <button
            type="button"
            className="bg-surface-container text-on-surface-variant px-lg py-xs rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-colors"
          >
            Near Me
          </button>
        </section>

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

        {!isLoading && !loadError && matches.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-xl text-center">
            <span
              className="material-symbols-outlined text-[48px] text-on-surface-variant mb-sm block"
              data-icon="travel_explore"
            >
              travel_explore
            </span>
            <p className="font-h3 text-h3 text-on-surface">
              No matches found yet — we&apos;re still looking
            </p>
            <p className="font-body-md text-on-surface-variant mt-xs">
              New matches will appear here and in your alerts when we find similar items.
            </p>
          </div>
        ) : null}

        {!isLoading && !loadError && matches.length > 0 ? (
          <div className="space-y-lg">
            {matches.map((m) => (
              <MatchCard key={m._id} match={m} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
