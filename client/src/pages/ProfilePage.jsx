import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance.js';
import { getUserMatches } from '../api/matchesService.js';
import { AvatarEditorModal } from '../components/profile/AvatarEditorModal.jsx';
import { EditProfileModal } from '../components/profile/EditProfileModal.jsx';
import { ProfileSettingsMenu } from '../components/profile/ProfileSettingsMenu.jsx';
import { ReportFilterBar } from '../components/profile/ReportFilterBar.jsx';
import { UserAvatar } from '../components/UserAvatar.jsx';
import { ItemCard } from '../components/items/ItemCard.jsx';
import { MatchCard } from '../components/matches/MatchCard.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatMemberSince } from '../utils/formatMemberSince.js';
import { mapItemForCard } from '../utils/mapItemForCard.js';
import { mapMatchForCard } from '../utils/mapMatchForCard.js';

const MY_REPORTS_PAGE_SIZE = 3;
const MATCH_HISTORY_PAGE_SIZE = 3;

const EMPTY_STATS = { lost: 0, found: 0, returns: 0 };

function reportStatusParam(filter) {
  if (filter === 'active') return 'active';
  if (filter === 'returned') return 'returned';
  return undefined;
}

function emptyStateForReportFilter(filter, navigate) {
  if (filter === 'active') {
    return {
      icon: 'inventory_2',
      title: 'No active reports',
      subtitle: 'Reports you mark as returned will move to the Returned tab.',
      actionLabel: 'Report an item',
      onAction: () => navigate('/report'),
    };
  }
  if (filter === 'returned') {
    return {
      icon: 'task_alt',
      title: 'No returned items yet',
      subtitle: "You haven't successfully returned any items yet. Complete a match handover to see them here.",
      actionLabel: 'View matches',
      onAction: () => navigate('/my-matches'),
    };
  }
  return {
    icon: 'inventory_2',
    title: 'No reports on your profile yet',
    subtitle: 'Your lost and found reports will appear here once you submit them.',
    actionLabel: 'Report an item',
    onAction: () => navigate('/report'),
  };
}

/**
 * user_profle.html — profile hero + sections (authenticated user from AuthContext).
 * Top navbar and bottom tab bar are provided by AppLayout.
 */
export default function ProfilePage() {
  const { user: authUser, isAuthLoading } = useAuth();
  const outletContext = useOutletContext() ?? {};
  const user = authUser ?? outletContext.user;
  const onLogoutRequest = outletContext.onLogoutRequest;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reports');
  const [reportFilter, setReportFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [loadingMoreReports, setLoadingMoreReports] = useState(false);
  const [reportsPage, setReportsPage] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [loadingMoreMatches, setLoadingMoreMatches] = useState(false);
  const [matchesPage, setMatchesPage] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [modal, setModal] = useState(null);

  const ownerId = user?._id ?? user?.id;
  const totalReportPages = Math.ceil(totalReports / MY_REPORTS_PAGE_SIZE) || 1;
  const hasMoreReports = reportsPage < totalReportPages;
  const totalMatchPages = Math.ceil(totalMatches / MATCH_HISTORY_PAGE_SIZE) || 1;
  const hasMoreMatches = matchesPage < totalMatchPages;

  const fetchProfileStats = useCallback(async () => {
    if (!ownerId) {
      setStats(EMPTY_STATS);
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);
    try {
      const [lostRes, foundRes, returnedRes] = await Promise.all([
        axiosInstance.get('/api/items', {
          params: { ownerId, reportType: 'lost', page: 1, limit: 1 },
        }),
        axiosInstance.get('/api/items', {
          params: { ownerId, reportType: 'found', page: 1, limit: 1 },
        }),
        axiosInstance.get('/api/items', {
          params: { ownerId, status: 'returned', page: 1, limit: 1 },
        }),
      ]);

      setStats({
        lost: Number(lostRes.data?.total) || 0,
        found: Number(foundRes.data?.total) || 0,
        returns: Number(returnedRes.data?.total) || 0,
      });
    } catch {
      setStats(EMPTY_STATS);
    } finally {
      setStatsLoading(false);
    }
  }, [ownerId]);

  const fetchReports = useCallback(
    async (page, { append = false, filter = reportFilter } = {}) => {
      if (!ownerId) {
        setItems([]);
        setTotalReports(0);
        setReportsPage(1);
        setItemsLoading(false);
        return;
      }

      if (append) {
        setLoadingMoreReports(true);
      } else {
        setItemsLoading(true);
      }

      try {
        const status = reportStatusParam(filter);
        const params = { ownerId, page, limit: MY_REPORTS_PAGE_SIZE };
        if (status) params.status = status;

        const { data } = await axiosInstance.get('/api/items', { params });
        const mapped = (data.items ?? []).map(mapItemForCard);
        setTotalReports(Number(data.total) || 0);
        setReportsPage(Number(data.page) || page);
        setItems((prev) => (append ? [...prev, ...mapped] : mapped));
      } catch {
        if (!append) {
          setItems([]);
          setTotalReports(0);
          setReportsPage(1);
        }
      } finally {
        if (append) {
          setLoadingMoreReports(false);
        } else {
          setItemsLoading(false);
        }
      }
    },
    [ownerId, reportFilter],
  );

  const fetchMatchHistory = useCallback(
    async (page, { append = false } = {}) => {
      if (!ownerId) {
        setMatches([]);
        setTotalMatches(0);
        setMatchesPage(1);
        setMatchesLoading(false);
        return;
      }

      if (append) {
        setLoadingMoreMatches(true);
      } else {
        setMatchesLoading(true);
      }

      try {
        const data = await getUserMatches(page, MATCH_HISTORY_PAGE_SIZE);
        const mapped = (data.matches ?? []).map(mapMatchForCard);
        setTotalMatches(Number(data.total) || 0);
        setMatchesPage(Number(data.page) || page);
        setMatches((prev) => (append ? [...prev, ...mapped] : mapped));
        setMatchesLoaded(true);
      } catch {
        if (!append) {
          setMatches([]);
          setTotalMatches(0);
          setMatchesPage(1);
        }
      } finally {
        if (append) {
          setLoadingMoreMatches(false);
        } else {
          setMatchesLoading(false);
        }
      }
    },
    [ownerId],
  );

  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchProfileStats();
    }
  }, [fetchProfileStats, isAuthLoading, user]);

  useEffect(() => {
    if (!isAuthLoading && user && activeTab === 'reports') {
      fetchReports(1, { filter: reportFilter });
    }
  }, [activeTab, fetchReports, isAuthLoading, reportFilter, user]);

  useEffect(() => {
    if (!isAuthLoading && user && activeTab === 'matches' && !matchesLoaded) {
      fetchMatchHistory(1);
    }
  }, [activeTab, fetchMatchHistory, isAuthLoading, matchesLoaded, user]);

  async function handleLoadMoreReports() {
    if (!hasMoreReports || loadingMoreReports) return;
    await fetchReports(reportsPage + 1, { append: true });
  }

  async function handleLoadMoreMatches() {
    if (!hasMoreMatches || loadingMoreMatches) return;
    await fetchMatchHistory(matchesPage + 1, { append: true });
  }

  function handleReportFilterChange(nextFilter) {
    setReportFilter(nextFilter);
  }

  function renderHero() {
    if (isAuthLoading) {
      return (
        <section className="flex flex-col items-center text-center py-xl" aria-busy="true">
          <Spinner />
          <p className="font-body-md text-on-surface-variant mt-md">Loading your profile…</p>
        </section>
      );
    }

    if (!user) {
      return (
        <section className="flex flex-col items-center text-center py-lg">
          <EmptyState
            icon="person_off"
            title="Profile unavailable"
            subtitle="Sign in again to view your profile."
            actionLabel="Go to login"
            onAction={() => navigate('/login')}
          />
        </section>
      );
    }

    const displayName = user.name?.trim() || 'Hawalay member';
    const email = user.email?.trim() || '';
    const bio = user.bio?.trim() || '';

    return (
      <section className="flex flex-col items-center text-center">
        <div className="relative mb-md">
          <button
            type="button"
            onClick={() => setModal('avatar')}
            className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Change profile photo"
          >
            <UserAvatar user={user} size="lg" className="border-4 border-surface-container-lowest shadow-lg" />
            <span className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md border-2 border-surface-container-lowest">
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            </span>
          </button>
          {user.isVerified ? (
            <div
              className="absolute -bottom-2 right-2 bg-primary text-on-primary text-[10px] font-bold px-3 py-1 rounded-full border-2 border-surface-container-lowest shadow-sm flex items-center gap-1"
              aria-label="Verified member"
            >
              <span
                className="material-symbols-outlined text-[12px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              TRUSTED
            </div>
          ) : null}
        </div>
        <h1 className="font-h1 text-h1 text-on-surface">{displayName}</h1>
        {email ? (
          <p className="font-body-md text-on-surface-variant mt-xs break-all max-w-full px-sm">{email}</p>
        ) : null}
        {bio ? (
          <p className="font-body-md text-on-surface mt-sm max-w-md px-sm">{bio}</p>
        ) : null}
        <p className="text-on-surface-variant font-body-md mt-xs">{formatMemberSince(user.createdAt)}</p>
        {!user.isVerified ? (
          <p className="font-caption text-on-surface-variant mt-sm px-md">
            Email verification pending — complete registration to earn trusted status.
          </p>
        ) : null}
      </section>
    );
  }

  function renderViewMoreButton({ onClick, loading, disabled }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full h-12 rounded-xl border border-outline-variant/40 bg-surface-container-low font-label-sm text-primary flex items-center justify-center gap-xs active:scale-[0.98] transition-transform hover:bg-surface-container disabled:opacity-60"
      >
        {loading ? (
          <>
            <Spinner />
            Loading…
          </>
        ) : (
          <>
            View more
            <span className="material-symbols-outlined text-[18px]">expand_more</span>
          </>
        )}
      </button>
    );
  }

  function handleSettingsAction(action) {
    if (action === 'edit') setModal('edit');
    else if (action === 'avatar') setModal('avatar');
  }

  const showMainSections = !isAuthLoading && user;

  return (
    <div className="bg-background text-on-background min-h-screen">
      <div className="px-margin-mobile space-y-lg max-w-2xl mx-auto">
        <section className="mt-4 flex items-start justify-between gap-md">
          <div className="min-w-0 flex-1">
            <h2 className="font-h1 text-h1 text-on-surface">Profile</h2>
            <p className="font-body-md text-on-surface-variant">Your account, reports, and preferences.</p>
          </div>
          {showMainSections ? (
            <ProfileSettingsMenu
              user={user}
              onOpenModal={handleSettingsAction}
              onLogoutRequest={onLogoutRequest}
            />
          ) : null}
        </section>

        {renderHero()}

        {showMainSections ? (
          <>
            <section className="grid grid-cols-3 gap-3" aria-label="Report statistics">
              <div className="bg-surface-container-low p-md rounded-xl text-center shadow-sm border-b-4 border-transparent">
                <p className="font-h2 text-h2 text-primary font-bold">
                  {statsLoading ? '—' : stats.lost}
                </p>
                <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Lost</p>
              </div>
              <div className="bg-primary-container/10 p-md rounded-xl text-center shadow-sm border-b-4 border-primary">
                <p className="font-h2 text-h2 text-primary font-bold">
                  {statsLoading ? '—' : stats.found}
                </p>
                <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Found</p>
              </div>
              <div className="bg-surface-container-low p-md rounded-xl text-center shadow-sm border-b-4 border-transparent">
                <p className="font-h2 text-h2 text-primary font-bold">
                  {statsLoading ? '—' : stats.returns}
                </p>
                <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Returns</p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-xl border-b border-outline-variant/30 mb-md">
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className={`pb-base border-b-2 font-h3 text-h3 transition-colors ${
                    activeTab === 'reports'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant'
                  }`}
                >
                  My Reports
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('matches')}
                  className={`pb-base border-b-2 font-h3 text-h3 transition-colors ${
                    activeTab === 'matches'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant'
                  }`}
                >
                  Match History
                </button>
              </div>

              {activeTab === 'reports' ? (
                <>
                  <ReportFilterBar activeFilter={reportFilter} onFilterChange={handleReportFilterChange} />
                  {itemsLoading ? (
                    <div className="flex justify-center py-xl">
                      <Spinner />
                    </div>
                  ) : items.length === 0 ? (
                    <EmptyState
                      {...emptyStateForReportFilter(reportFilter, navigate)}
                      className="py-lg"
                    />
                  ) : (
                    <div className="space-y-md pb-8">
                      {items.map((item) => (
                        <ItemCard key={item._id} item={item} />
                      ))}
                      {hasMoreReports
                        ? renderViewMoreButton({
                            onClick: handleLoadMoreReports,
                            loading: loadingMoreReports,
                            disabled: loadingMoreReports,
                          })
                        : null}
                    </div>
                  )}
                </>
              ) : matchesLoading ? (
                <div className="flex justify-center py-xl">
                  <Spinner />
                </div>
              ) : matches.length === 0 ? (
                <EmptyState
                  icon="auto_awesome"
                  title="No match history yet"
                  subtitle="When our matching service finds candidates for your reports, they will show up here."
                  actionLabel="Browse community"
                  onAction={() => navigate('/matches')}
                  className="py-lg"
                />
              ) : (
                <div className="space-y-md pb-8">
                  {matches.map((match) => (
                    <MatchCard key={match._id} match={match} />
                  ))}
                  {hasMoreMatches
                    ? renderViewMoreButton({
                        onClick: handleLoadMoreMatches,
                        loading: loadingMoreMatches,
                        disabled: loadingMoreMatches,
                      })
                    : null}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>

      {modal === 'edit' ? <EditProfileModal user={user} onClose={() => setModal(null)} /> : null}
      {modal === 'avatar' ? <AvatarEditorModal user={user} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
