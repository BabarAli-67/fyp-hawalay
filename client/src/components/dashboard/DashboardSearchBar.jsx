import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Dashboard global search — navigates to community browse with query.
 */
export function DashboardSearchBar() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');

  function goToBrowse(query = keyword) {
    const q = String(query || '').trim();
    if (q) {
      navigate(`/matches?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/matches');
    }
  }

  return (
    <form
      className="flex gap-sm md:gap-md items-center w-full"
      onSubmit={(e) => {
        e.preventDefault();
        goToBrowse();
      }}
    >
      <div className="relative flex-1">
        <span
          className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none"
          aria-hidden
        >
          search
        </span>
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search lost & found items…"
          aria-label="Search lost and found items"
          className="w-full h-12 pl-12 pr-md bg-surface-container-low border border-outline-variant/40 rounded-xl text-on-surface font-body-md outline-none focus:border-primary transition-colors"
        />
      </div>
      <button
        type="button"
        onClick={() => navigate('/matches')}
        aria-label="Browse with filters"
        className="shrink-0 w-12 h-12 rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface-variant flex items-center justify-center hover:bg-surface-container transition-colors"
      >
        <span className="material-symbols-outlined text-[22px]">tune</span>
      </button>
    </form>
  );
}
