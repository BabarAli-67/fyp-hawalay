import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axiosInstance from '../api/axiosInstance.js';
import { getMatchesForItem } from '../api/matchesService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ReturnVerificationPanel } from '../components/matches/ReturnVerificationPanel.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { EditReportModal } from '../components/items/EditReportModal.jsx';
import { ItemImage } from '../components/items/ItemImage.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { recordRecentlyViewed, removeRecentlyViewed } from '../utils/recentlyViewed.js';
import { invalidateListCaches } from '../utils/browseCache.js';
import { clearCachedItemImage } from '../utils/itemImageCache.js';

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
  if (status === 'returned') return 'Returned';
  if (status === 'claimed') return 'Claimed';
  if (status === 'expired') return 'Expired';
  return 'Active';
}

export default function ItemDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [matchContext, setMatchContext] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function loadItem() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(`/api/items/${id}`);
      setItem(res.data);
    } catch (err) {
      setItem(null);
      setError(err?.response?.data?.error ?? 'Could not load this report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItem();
  }, [id]);

  const currentUserId = user?._id ? String(user._id) : '';
  const isOwner = Boolean(item?.ownerId && currentUserId && String(item.ownerId) === currentUserId);

  useEffect(() => {
    if (!item?._id) return;
    const userId = user?._id ?? user?.id;
    if (!userId) return;
    recordRecentlyViewed(userId, item);
  }, [item, user]);

  useEffect(() => {
    if (!isOwner || !item?._id) {
      setMatchContext(null);
      return;
    }

    let cancelled = false;

    getMatchesForItem(item._id)
      .then((data) => {
        if (cancelled) return;
        const matches = Array.isArray(data?.matches) ? data.matches : [];
        const actionable =
          matches.find((match) => match.returnVerification?.userRole && !match.returnVerification?.returnCompleted) ||
          matches.find((match) => match.returnVerification?.userRole) ||
          null;
        setMatchContext(actionable);
      })
      .catch(() => {
        if (!cancelled) setMatchContext(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isOwner, item?._id, item?.status]);

  const reportVariant = item?.reportType === 'found' ? 'found' : 'lost';
  const reportLabel = item?.reportType === 'found' ? 'FOUND' : 'LOST';

  async function handleSaveReport(payload) {
    setEditSaving(true);
    setEditError(null);
    try {
      const { data } = await axiosInstance.patch(`/api/items/${id}`, payload);
      setItem(data);
      setEditOpen(false);
      toast.success('Report updated successfully.');
    } catch (err) {
      setEditError(err?.response?.data?.error || 'Could not update this report.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteReport() {
    if (deleting || !id) return;
    setDeleting(true);

    // Optimistic UI: leave the detail page immediately while the API runs.
    setDeleteOpen(false);
    invalidateListCaches();
    clearCachedItemImage(id);
    const userId = user?._id ?? user?.id;
    if (userId) removeRecentlyViewed(userId, id);
    toast.success('Report deleted.');
    navigate('/dashboard', { replace: true });

    try {
      await axiosInstance.delete(`/api/items/${id}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not delete this report. It may still appear until you refresh.');
    }
  }

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
              <ItemImage
                itemId={item._id}
                hasImage={Boolean(item.imageFileId)}
                iconSize="md"
                placeholderClassName="w-full h-full flex items-center justify-center"
              />
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge variant={reportVariant} label={reportLabel} />
                <span className="px-2 py-1 rounded-md bg-surface/90 text-on-surface text-[10px] font-bold uppercase backdrop-blur-sm">
                  {statusLabel(item.status)}
                </span>
              </div>
            </section>

            <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm space-y-md">
              <div className="flex flex-col gap-md sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="font-h1 text-h1 text-on-surface break-words">{item.title}</h1>
                  <div className="flex items-center gap-1 text-on-surface-variant mt-sm">
                    <span className="material-symbols-outlined text-[18px]">location_on</span>
                    <span className="font-body-md">{item.locationName}</span>
                  </div>
                </div>
                {isOwner ? (
                  <div className="flex shrink-0 gap-sm" aria-label="Report actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditError(null);
                        setEditOpen(true);
                      }}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-xs rounded-xl border border-primary/40 px-md font-label-sm text-primary transition-colors hover:bg-primary-container/15 sm:flex-none"
                    >
                      <span className="material-symbols-outlined text-[19px]">edit</span>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteOpen(true)}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-xs rounded-xl border border-error/40 px-md font-label-sm text-error transition-colors hover:bg-error-container/30 sm:flex-none"
                    >
                      <span className="material-symbols-outlined text-[19px]">delete</span>
                      Delete
                    </button>
                  </div>
                ) : null}
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

            <div className="flex flex-col items-center gap-sm mt-lg pb-8 w-full">
              {matchContext?.returnVerification?.userRole ? (
                <div className="w-full max-w-lg">
                  <ReturnVerificationPanel
                    matchId={matchContext.matchId}
                    returnVerification={matchContext.returnVerification}
                    onUpdated={(next) => {
                      setMatchContext((prev) =>
                        prev ? { ...prev, returnVerification: next } : prev,
                      );
                      if (next?.returnCompleted) {
                        loadItem();
                      }
                    }}
                  />
                  {matchContext.matchId ? (
                    <Link
                      to={`/chat/${matchContext.matchId}`}
                      className="mt-sm inline-flex items-center justify-center gap-xs font-label-sm text-primary hover:underline w-full"
                    >
                      <span className="material-symbols-outlined text-[18px]">chat</span>
                      Open match chat
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {isOwner ? (
                <Link
                  to="/my-matches"
                  className="font-label-sm text-primary hover:underline"
                >
                  View smart matches for this item
                </Link>
              ) : (
                <p className="font-caption text-on-surface-variant text-center">
                  Smart matches are only available on your own reports.
                </p>
              )}
              {!matchContext?.returnVerification?.userRole ? (
                <p className="font-caption text-on-surface-variant text-center">
                  Coordinate return details in match chat once you connect with the other party.{' '}
                  <Link to="/matches" className="text-primary underline">
                    Browse more reports
                  </Link>
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>

      <EditReportModal
        item={item}
        open={editOpen}
        saving={editSaving}
        error={editError}
        onClose={() => {
          if (!editSaving) {
            setEditOpen(false);
            setEditError(null);
          }
        }}
        onSave={handleSaveReport}
      />

      {deleteOpen && item ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-md backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setDeleteOpen(false);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-report-title"
            aria-describedby="delete-report-description"
            className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface p-lg shadow-xl"
          >
            <div className="mb-md flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
              <span className="material-symbols-outlined">delete</span>
            </div>
            <h2 id="delete-report-title" className="font-h2 text-h2 text-on-surface">
              Delete this report?
            </h2>
            <p
              id="delete-report-description"
              className="mt-sm font-body-md text-on-surface-variant"
            >
              “{item.title}” will be removed from your dashboard and community results. This
              action cannot be undone.
            </p>
            <div className="mt-lg flex gap-sm">
              <Button
                variant="secondary"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteReport} loading={deleting}>
                Delete report
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
