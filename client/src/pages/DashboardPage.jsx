import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance.js';
import { ItemCard } from '../components/items/ItemCard.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

function mapItemForCard(item) {
  return {
    _id: item._id,
    title: item.title,
    reportType: item.reportType,
    category: item.category,
    locationName: item.locationName,
    date: item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
    status: item.status ?? 'active',
    imageUrl:
      item.imageFileId && API_BASE ? `${API_BASE}/api/items/${item._id}/image` : null,
  };
}

/**
 * dashboard.html — 1:1 main column + bottom navigation (header supplied by AppLayout).
 */
export default function DashboardPage() {
  const { user: authUser } = useAuth();
  const outletContext = useOutletContext() ?? {};
  const user = authUser ?? outletContext.user;
  const navigate = useNavigate();
  const location = useLocation();
  const homeActive = location.pathname === '/dashboard';
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

  return (
    <div className="bg-background text-on-background min-h-screen pb-24">
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
              to="/matches"
              className="glass-card border border-primary-container/30 p-md rounded-xl flex gap-md items-center shadow-sm"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-container/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
              </div>
              <div className="flex-1">
                <p className="font-h3 text-h3 text-on-surface-variant leading-none mb-1">Potential Match Found</p>
                <p className="font-caption text-caption text-outline">
                  A Leather Wallet matches your &quot;Lost&quot; report in Downtown.
                </p>
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
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe h-20 bg-surface/70 backdrop-blur-xl rounded-t-xl shadow-lg">
        <Link
          to="/dashboard"
          className={`flex flex-col items-center justify-center active:scale-98 transition-all duration-200 cursor-pointer px-3 py-1 rounded-xl ${
            homeActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
          aria-current={homeActive ? 'page' : undefined}
        >
          <span
            className="material-symbols-outlined"
            style={homeActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            home
          </span>
          <span className="font-label-sm text-label-sm">Home</span>
        </Link>
        <Link
          to="/matches"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all duration-200 cursor-pointer px-3 py-1"
        >
          <span className="material-symbols-outlined">search</span>
          <span className="font-label-sm text-label-sm">Search</span>
        </Link>
        <Link
          to="/report"
          className="flex flex-col items-center justify-center relative -mt-8"
        >
          <div className="w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform duration-200">
            <span className="material-symbols-outlined text-white text-[32px]">add</span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant mt-2">Report</span>
        </Link>
        <Link
          to="/notifications"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all duration-200 cursor-pointer px-3 py-1"
        >
          <span className="material-symbols-outlined">notifications</span>
          <span className="font-label-sm text-label-sm">Alerts</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl transition-all duration-200 cursor-pointer px-3 py-1"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-sm text-label-sm">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
