import { Link } from 'react-router-dom';
import { ItemImage } from '../items/ItemImage.jsx';

const DEFAULT_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBOiwfrjNLHId_LTP1ZPQ3I0hSSWLJVMJu5S2MA13Fuf0beDiN_8M7bpcoicK4xJKMCdRAvuQU85sYji7R6qTwp1RFNYw_R1Xf63KhKjdm5lkjq8lE-Zl5wVubGx88wVta9xhpTsaTgvybfI1Prx0vJ-1hX9u3PhkDIfbmU4_3JoaAOcMvFagzs1AwKLUETO7MhLrNeLRSZTjoHuGlysS8mcIzb2sA10Rltu_JFp4csxA6fsLNQCGZIgDPv0-m-BkSv9qvMDIEWydg';

function scoreBadgeClasses(score) {
  if (score >= 0.85) {
    return 'bg-primary-container text-on-primary-container';
  }
  if (score >= 0.7) {
    return 'bg-tertiary-container text-on-tertiary';
  }
  return 'bg-surface-container-highest text-on-surface-variant';
}

function scoreIcon(score) {
  if (score >= 0.85) {
    return 'verified';
  }
  if (score >= 0.7) {
    return 'analytics';
  }
  return 'help';
}

/**
 * ai_match_results.html — match article (image, score pill, meta, actions).
 */
export function MatchCard({ match, distanceLabel = '' }) {
  const pct = Math.round(match.similarityScore * 100);
  const img = match.imageUrl ?? DEFAULT_IMG;
  const borderAccent = match.similarityScore >= 0.85 ? 'border-t-2 border-primary' : '';
  const detailPath = match.itemId ? `/item/${match.itemId}` : '/matches';

  return (
    <article
      className={`bg-surface-container-lowest rounded-xl premium-shadow overflow-hidden active:scale-[0.98] transition-all duration-200 ${borderAccent}`}
    >
      <div className="relative h-48 w-full bg-surface-container-low">
        {match.itemId ? (
          <ItemImage
            itemId={match.itemId}
            hasImage={match.hasImage !== false}
            className="w-full h-full object-cover"
            placeholderClassName="absolute inset-0 flex items-center justify-center bg-surface-container-low"
          />
        ) : (
          <img alt={match.title} className="w-full h-full object-cover" src={img} />
        )}
        <div
          className={`absolute top-md right-md px-md py-xs rounded-full font-label-sm flex items-center gap-xs shadow-md ${scoreBadgeClasses(
            match.similarityScore,
          )}`}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {scoreIcon(match.similarityScore)}
          </span>
          {pct}% Match
        </div>
      </div>
      <div className="p-md">
        <div className="flex justify-between items-start gap-sm mb-sm">
          <div className="min-w-0 flex-1">
            <h3 className="font-h3 text-h3 text-on-surface line-clamp-2">{match.title}</h3>
            <p className="font-caption text-on-surface-variant mt-1 truncate">{match.category}</p>
            <p className="font-caption text-on-surface-variant flex items-center gap-xs mt-1 min-w-0">
              <span className="material-symbols-outlined text-[16px] shrink-0">location_on</span>
              <span className="truncate" title={match.locationName}>
                {match.locationName}
              </span>
            </p>
            {distanceLabel ? (
              <p className="font-caption text-primary mt-1">{distanceLabel}</p>
            ) : null}
          </div>
          <p className="font-caption text-primary font-bold shrink-0">{match.date}</p>
        </div>
        <div className="flex gap-sm mt-md">
          <Link
            to={detailPath}
            className="flex-1 py-xs rounded-lg border border-outline text-outline font-label-sm hover:bg-surface-container transition-colors flex items-center justify-center"
          >
            View Details
          </Link>
          <Link
            to={`/chat/${match._id}`}
            className="flex-1 py-xs rounded-lg bg-primary text-on-primary font-label-sm flex items-center justify-center gap-xs hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">chat</span>
            Start Chat
          </Link>
        </div>
      </div>
    </article>
  );
}
