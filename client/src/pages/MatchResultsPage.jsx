import { MatchCard } from '../components/matches/MatchCard.jsx';
import { MOCK_MATCHES } from '../constants/mockData.js';

/**
 * ai_match_results.html — hero, filter chips, match list.
 */
export default function MatchResultsPage() {
  return (
    <div className="bg-background text-on-background min-h-screen pb-24">
      <div className="px-margin-mobile max-w-2xl mx-auto">
        <section className="mb-lg mt-4">
          <h2 className="font-h1 text-h1 text-on-surface mb-xs">Matches found</h2>
          <p className="font-body-md text-on-surface-variant">
            Our AI compared reports to surface likely candidates. Mock data for layout review.
          </p>
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
        <div className="space-y-lg">
          {MOCK_MATCHES.map((m) => (
            <MatchCard key={m._id} match={m} />
          ))}
        </div>
      </div>
    </div>
  );
}
