import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance.js';
import { Badge } from '../components/ui/Badge.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

function formatItemDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function statusLabel(status) {
  if (status === 'claimed') return 'Claimed';
  if (status === 'expired') return 'Expired';
  return 'Active';
}

export default function ItemDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    axiosInstance
      .get(`/api/items/${id}`)
      .then((res) => setItem(res.data))
      .catch((err) => {
        setItem(null);
        setError(err?.response?.data?.error ?? 'Could not load this report.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const imageUrl =
    item?.imageFileId && API_BASE ? `${API_BASE}/api/items/${item._id}/image` : null;
  const reportVariant = item?.reportType === 'found' ? 'found' : 'lost';
  const reportLabel = item?.reportType === 'found' ? 'FOUND' : 'LOST';

  return (
    <div className="bg-background text-on-background min-h-screen pb-24">
      <div className="px-margin-mobile max-w-2xl mx-auto">
        <div className="mt-4 mb-md">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-xs text-primary font-label-sm active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-xl">
            <Spinner />
          </div>
        ) : error || !item ? (
          <EmptyState
            icon="inventory_2"
            title="Report not found"
            subtitle={error ?? 'This item may have been removed.'}
            actionLabel="Browse community"
            onAction={() => navigate('/matches')}
          />
        ) : (
          <>
            <section className="relative w-full h-56 sm:h-72 rounded-xl overflow-hidden bg-surface-container shadow-sm mb-md">
              {imageUrl ? (
                <img alt="" className="w-full h-full object-cover" src={imageUrl} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[64px] text-outline-variant">image</span>
                </div>
              )}
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge variant={reportVariant} label={reportLabel} />
                <span className="px-2 py-1 rounded-md bg-surface/90 text-on-surface text-[10px] font-bold uppercase backdrop-blur-sm">
                  {statusLabel(item.status)}
                </span>
              </div>
            </section>

            <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm space-y-md">
              <div>
                <h1 className="font-h1 text-h1 text-on-surface">{item.title}</h1>
                <div className="flex items-center gap-1 text-on-surface-variant mt-sm">
                  <span className="material-symbols-outlined text-[18px]">location_on</span>
                  <span className="font-body-md">{item.locationName}</span>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-md font-body-md">
                <div>
                  <dt className="font-caption text-on-surface-variant">Category</dt>
                  <dd className="text-on-surface">{item.category}</dd>
                </div>
                <div>
                  <dt className="font-caption text-on-surface-variant">
                    {item.reportType === 'lost' ? 'Date lost' : 'Date found'}
                  </dt>
                  <dd className="text-on-surface">{formatItemDate(item.date)}</dd>
                </div>
                {item.brand ? (
                  <div>
                    <dt className="font-caption text-on-surface-variant">Brand</dt>
                    <dd className="text-on-surface">{item.brand}</dd>
                  </div>
                ) : null}
              </dl>

              {item.colors?.length > 0 ? (
                <div>
                  <p className="font-caption text-on-surface-variant mb-xs">Colors</p>
                  <div className="flex flex-wrap gap-xs">
                    {item.colors.map((color) => (
                      <span
                        key={color}
                        className="px-3 py-1 rounded-full bg-surface-variant/30 text-on-surface font-caption"
                      >
                        {color}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {item.description ? (
                <div>
                  <h2 className="font-h3 text-h3 text-on-surface mb-xs">Description</h2>
                  <p className="font-body-md text-on-surface-variant leading-relaxed">{item.description}</p>
                </div>
              ) : null}

              {item.distinctiveFeatures ? (
                <div>
                  <h2 className="font-h3 text-h3 text-on-surface mb-xs">Distinctive features</h2>
                  <p className="font-body-md text-on-surface-variant leading-relaxed">
                    {item.distinctiveFeatures}
                  </p>
                </div>
              ) : null}

              {item.secondaryLocationName ? (
                <div>
                  <h2 className="font-h3 text-h3 text-on-surface mb-xs">Secondary area</h2>
                  <p className="font-body-md text-on-surface-variant">{item.secondaryLocationName}</p>
                </div>
              ) : null}
            </section>

            <p className="font-caption text-on-surface-variant text-center mt-lg pb-8">
              Contact options and claiming will be available in a future release.{' '}
              <Link to="/matches" className="text-primary underline">
                Browse more reports
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
