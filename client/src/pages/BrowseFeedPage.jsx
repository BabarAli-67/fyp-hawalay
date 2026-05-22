import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance.js';
import { BrowseFilters } from '../components/browse/BrowseFilters.jsx';
import { BrowseItemCard } from '../components/items/BrowseItemCard.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { mapItemForCard } from '../utils/mapItemForCard.js';

/**
 * Community browse feed — all active lost & found reports (Search tab).
 */
export default function BrowseFeedPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [reportType, setReportType] = useState('');
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        status: 'active',
        page: 1,
        limit: 50,
      };
      if (reportType) params.reportType = reportType;
      if (category) params.category = category;
      if (appliedKeyword.trim()) params.q = appliedKeyword.trim();

      const { data } = await axiosInstance.get('/api/items', { params });
      setItems((data.items ?? []).map(mapItemForCard));
    } catch (err) {
      setItems([]);
      setError(err?.response?.data?.error ?? 'Could not load community reports.');
    } finally {
      setLoading(false);
    }
  }, [reportType, category, appliedKeyword]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function handleSearchSubmit() {
    setAppliedKeyword(keyword);
  }

  return (
    <div className="bg-background text-on-background min-h-screen pb-8">
      <div className="px-margin-mobile max-w-2xl mx-auto space-y-lg">
        <section className="mt-4">
          <h2 className="font-h1 text-h1 text-on-surface mb-xs">Browse community</h2>
          <p className="font-body-md text-on-surface-variant">
            Lost and found reports from all Hawalay members.
          </p>
        </section>

        <BrowseFilters
          reportType={reportType}
          onReportTypeChange={setReportType}
          category={category}
          onCategoryChange={setCategory}
          keyword={keyword}
          onKeywordChange={setKeyword}
          onSearchSubmit={handleSearchSubmit}
        />

        {loading ? (
          <div className="flex justify-center py-xl">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            icon="error"
            title="Could not load reports"
            subtitle={error}
            actionLabel="Try again"
            onAction={fetchItems}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="travel_explore"
            title="No reports found"
            subtitle={
              appliedKeyword || reportType || category
                ? 'Try changing your filters or search terms.'
                : 'Be the first to report a lost or found item.'
            }
            actionLabel={appliedKeyword || reportType || category ? 'Clear filters' : undefined}
            onAction={
              appliedKeyword || reportType || category
                ? () => {
                    setKeyword('');
                    setAppliedKeyword('');
                    setReportType('');
                    setCategory('');
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md pb-8">
            {items.map((item) => (
              <BrowseItemCard key={item._id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
