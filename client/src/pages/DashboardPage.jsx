import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance.js';
import { ItemCard } from '../components/items/ItemCard.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { mapItemForCard } from '../utils/mapItemForCard.js';

/**
 * dashboard.html — 1:1 main column + bottom navigation (header supplied by AppLayout).
 */
export default function DashboardPage() {
  const { user: authUser } = useAuth();
  const outletContext = useOutletContext() ?? {};
  const user = authUser ?? outletContext.user;
  const navigate = useNavigate();
  const displayName = user?.name ?? 'there';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const ownerId = user?._id ?? user?.id;

  const fetchItems = useCallback(async () => {
    if (!ownerId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/api/items', {
        params: { ownerId, page: 1, limit: 20 },
      });
      setItems((data.items ?? []).map(mapItemForCard));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleStatusChange(item, status) {
    try {
      await axiosInstance.patch(`/api/items/${item._id}/status`, { status });
      await fetchItems();
    } catch {
      // Status stays unchanged; list is unchanged until a successful patch.
    }
  }

  const firstActiveItem = items.find((item) => item.status === 'active');
  const smartMatchesTo = firstActiveItem ? `/matches/ai/${firstActiveItem._id}` : '/report';
  const smartMatchesLabel = firstActiveItem
    ? `View matches for "${firstActiveItem.title}"`
    : 'Report an item to start matching';

  return (
    <div className="bg-background text-on-background min-h-screen">
      <div className="px-margin-mobile space-y-lg">
        <section className="mt-4">
          <h2 className="font-h1 text-h1 text-on-surface">Hello, {displayName}</h2>
          <p className="font-body-md text-on-surface-variant">Your ethical stewardship dashboard is ready.</p>
        </section>
        <section className="grid grid-cols-2 gap-md">
          <button
            type="button"
            onClick={() => navigate('/report', { state: { reportType: 'lost' } })}
            className="bg-primary shadow-sm rounded-xl p-md flex flex-col justify-between aspect-square active:scale-95 transition-transform duration-200 cursor-pointer text-left"
          >
            <div className="bg-white/20 w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white">search</span>
            </div>
            <span className="text-white font-h3 text-h3 leading-tight">Report Lost</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/report', { state: { reportType: 'found' } })}
            className="bg-primary-container shadow-sm rounded-xl p-md flex flex-col justify-between aspect-square active:scale-95 transition-transform duration-200 cursor-pointer text-left"
          >
            <div className="bg-on-primary-container/10 w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary-container">add_circle</span>
            </div>
            <span className="text-on-primary-container font-h3 text-h3 leading-tight">Report Found</span>
          </button>
          <div className="bg-surface-container shadow-sm rounded-xl p-md flex flex-col justify-between aspect-square active:scale-95 transition-transform duration-200 cursor-pointer border border-outline-variant/30">
            <div className="bg-on-surface-variant/10 w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant">document_scanner</span>
            </div>
            <span className="text-on-surface font-h3 text-h3 leading-tight">Scan Item</span>
          </div>
          <div className="bg-surface-container shadow-sm rounded-xl p-md flex flex-col justify-between aspect-square active:scale-95 transition-transform duration-200 cursor-pointer border border-outline-variant/30">
            <div className="bg-on-surface-variant/10 w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant">history</span>
            </div>
            <span className="text-on-surface font-h3 text-h3 leading-tight">My Activities</span>
          </div>
        </section>
        <section className="space-y-md">
          <div className="flex justify-between items-center">
            <h3 className="font-h3 text-h3 text-on-surface">Smart Matches</h3>
            <span className="bg-tertiary-container/20 text-tertiary font-label-sm px-2 py-1 rounded-full">2 New</span>
          </div>
          <div className="flex flex-col gap-sm">
            <Link
              to={smartMatchesTo}
              className="glass-card border border-primary-container/30 p-md rounded-xl flex gap-md items-center shadow-sm"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-container/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
              </div>
              <div className="flex-1">
                <p className="font-h3 text-h3 text-on-surface-variant leading-none mb-1">
                  {firstActiveItem ? 'View Smart Matches' : 'Start Matching'}
                </p>
                <p className="font-caption text-caption text-outline">{smartMatchesLabel}</p>
              </div>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </Link>
          </div>
        </section>
        <section className="space-y-md pb-8">
          <div className="flex justify-between items-center">
            <h3 className="font-h3 text-h3 text-on-surface">Recent Activity</h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-xl">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon="inventory_2"
              title="No reports yet"
              subtitle="Report a lost or found item to see it here."
              actionLabel="Report an item"
              onAction={() => navigate('/report', { state: { reportType: 'lost' } })}
            />
          ) : (
            <div className="flex overflow-x-auto gap-md pb-4 custom-scrollbar -mx-margin-mobile px-margin-mobile">
              {items.map((item) => (
                <div key={item._id} className="min-w-[280px] shrink-0">
                  <ItemCard item={item} onStatusChange={handleStatusChange} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
