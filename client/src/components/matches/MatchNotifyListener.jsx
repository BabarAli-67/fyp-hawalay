import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const MATCH_TOAST_MS = 4500;

/**
 * Auto-dismissing toast when the matching engine finds a new candidate.
 * Dedupes by matchId so reconnects do not spam the user.
 */
export function MatchNotifyListener() {
  const navigate = useNavigate();
  const seenMatchIdsRef = useRef(new Set());

  useEffect(() => {
    function handleMatchFound(event) {
      const payload = event.detail ?? {};
      const matchId = payload.matchId ? String(payload.matchId) : '';
      if (!matchId || seenMatchIdsRef.current.has(matchId)) {
        return;
      }
      seenMatchIdsRef.current.add(matchId);

      const title = payload.title ? String(payload.title).trim() : '';
      const headline = title
        ? `New match found — ${title}`
        : 'New match found for your item!';

      const navigateToMatches = () => {
        navigate('/my-matches');
      };

      toast.success(
        <button
          type="button"
          className="text-left w-full bg-transparent border-0 p-0 cursor-pointer flex items-start gap-sm"
          onClick={navigateToMatches}
        >
          <span
            className="material-symbols-outlined text-[22px] shrink-0 text-inverse-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden
          >
            auto_awesome
          </span>
          <span>
            <span className="font-label-sm font-bold block">{headline}</span>
            <span className="font-caption block mt-0.5 opacity-90">
              Tap to view match results
            </span>
          </span>
        </button>,
        {
          toastId: `match-found-${matchId}`,
          autoClose: MATCH_TOAST_MS,
          pauseOnHover: true,
          closeOnClick: true,
          onClick: navigateToMatches,
        },
      );

      window.dispatchEvent(new CustomEvent('hawalay:refresh-matches', { detail: payload }));
      window.dispatchEvent(new CustomEvent('hawalay:unread-refetch'));
    }

    window.addEventListener('hawalay:match-found', handleMatchFound);
    return () => window.removeEventListener('hawalay:match-found', handleMatchFound);
  }, [navigate]);

  return null;
}

export default MatchNotifyListener;
